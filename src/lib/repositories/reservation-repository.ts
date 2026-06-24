import type { ClaimInput } from "@/lib/domain/character";
import type { ResolveReservationStore } from "@/lib/services/resolve-reservation-service";
import type { SoftresSyncStore } from "@/lib/services/sync-softres-service";
import { db } from "@/lib/db";

// Thin Prisma wrapper backing the softres sync. The only place reservation
// persistence happens. Enforces the sync idempotency contract (see
// SoftresSyncStore): never clobber an officer-confirmed link, never touch
// `ignored`.
export const reservationRepository: SoftresSyncStore = {
  async findCharacterIdByNameOrAlias(name) {
    const direct = await db.character.findUnique({
      where: { name },
      select: { id: true },
    });
    if (direct) return direct.id;

    const alias = await db.characterAlias.findUnique({
      where: { alias: name },
      select: { characterId: true },
    });
    return alias?.characterId ?? null;
  },

  async listCharacterIdsByDiscordId(discordId) {
    const rows = await db.character.findMany({
      where: { user: { discordId } },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  },

  async assignOwnerIfUnowned(characterId, discordId) {
    const user = await db.user.findUnique({
      where: { discordId },
      select: { id: true },
    });
    if (!user) return false; // reserver's User doesn't exist yet — heal next sync.

    // Conditional update: the `userId: null` guard makes this assign-once and
    // race-safe — it can never overwrite an officer-set owner. count===0 means
    // already owned (by anyone), so nothing changed.
    const { count } = await db.character.updateMany({
      where: { id: characterId, userId: null },
      data: { userId: user.id },
    });
    return count > 0;
  },

  async upsertReservation({
    sheetId,
    rawName,
    rawClass,
    discordId,
    items,
    reservedAt,
    resolution,
  }) {
    const existing = await db.reservation.findUnique({
      where: { softresSheetId_rawName: { softresSheetId: sheetId, rawName } },
      select: { id: true, characterId: true },
    });

    // softres metadata always refreshes; the link fields are guarded below.
    const meta = { rawClass, discordId, items, reservedAt };

    if (!existing) {
      // First sight: write metadata + the freshly computed resolution.
      const link =
        resolution.kind === "matched"
          ? { characterId: resolution.characterId }
          : resolution.kind === "suggested"
            ? { suggestedCharacterId: resolution.characterId }
            : {};
      await db.reservation.create({
        data: { softresSheetId: sheetId, rawName, ...meta, ...link },
      });
      return { created: true, matched: resolution.kind === "matched" };
    }

    // Existing row. NEVER touch `ignored` (officer-owned). NEVER clear an
    // officer-confirmed `characterId`. If already linked, only refresh metadata.
    if (existing.characterId) {
      await db.reservation.update({
        where: { id: existing.id },
        data: meta,
      });
      return { created: false, matched: true };
    }

    // Not yet linked: it's safe to (re)write the computed resolution. A matched
    // result promotes the row out of the queue; suggested refreshes the hint;
    // unmatched clears any stale suggestion so the queue reflects reality.
    const link =
      resolution.kind === "matched"
        ? { characterId: resolution.characterId, suggestedCharacterId: null }
        : resolution.kind === "suggested"
          ? { suggestedCharacterId: resolution.characterId }
          : { suggestedCharacterId: null };
    await db.reservation.update({
      where: { id: existing.id },
      data: { ...meta, ...link },
    });
    return { created: false, matched: resolution.kind === "matched" };
  },
};

// Backs the officer resolution actions (Link / Accept suggestion / Create /
// Ignore). Kept distinct from the sync store: different concern, different
// invariants. The alias insertion that preserves the resolve-once guarantee
// happens in the service (resolve-reservation-service), not here.
export const reservationResolveRepository: ResolveReservationStore = {
  async getReservation(reservationId) {
    return db.reservation.findUnique({
      where: { id: reservationId },
      select: {
        rawName: true,
        characterId: true,
        suggestedCharacterId: true,
        discordId: true,
      },
    });
  },

  async getCharacterName(characterId) {
    const c = await db.character.findUnique({
      where: { id: characterId },
      select: { name: true },
    });
    return c?.name ?? null;
  },

  async getCharacterOwner(characterId) {
    const c = await db.character.findUnique({
      where: { id: characterId },
      select: { userId: true },
    });
    return c?.userId ?? null;
  },

  async findUserIdByDiscordId(discordId) {
    const u = await db.user.findUnique({
      where: { discordId },
      select: { id: true },
    });
    return u?.id ?? null;
  },

  async setReservationCharacter(reservationId, characterId) {
    await db.reservation.update({
      where: { id: reservationId },
      data: { characterId, suggestedCharacterId: null },
    });
  },

  async assignOwner(characterId, userId) {
    await db.character.update({
      where: { id: characterId },
      data: { userId },
    });
  },

  async ensureAlias(characterId, alias) {
    // Idempotent: the @unique alias may already exist from a prior resolve.
    await db.characterAlias.upsert({
      where: { alias },
      update: {},
      create: { characterId, alias },
    });
  },

  async createCharacter(input: ClaimInput, userId) {
    // Attributed to the reserver (their RH-stubbed user) so the member gets SR
    // matrix credit; unowned only when no user row exists for the dId. Throws on
    // the @unique name violation, which the service translates to `name_taken`.
    const created = await db.character.create({
      data: {
        name: input.name,
        class: input.class,
        spec: input.spec,
        mainRole: input.mainRole,
        userId,
      },
      select: { id: true },
    });
    return created.id;
  },

  async ignoreReservation(reservationId) {
    await db.reservation.update({
      where: { id: reservationId },
      data: { ignored: true },
    });
  },
};
