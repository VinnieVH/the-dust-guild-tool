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
