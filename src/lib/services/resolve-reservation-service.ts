import type { ClaimInput } from "@/lib/domain/character";

// Port for the officer resolution actions. The repository implements it; the
// service stays Prisma-free and unit-testable. The load-bearing invariant: any
// time we link a reservation whose rawName differs from the character's name, we
// MUST insert a character_alias for rawName — otherwise the next softres sync
// re-derives `unmatched` and the row falls back into the queue (breaking the
// resolve-once guarantee that sync-softres-service relies on).
export interface ResolveReservationStore {
  /** The reservation's rawName, current link, and the reserver's Discord id
   *  (softres `dId`) — the latter is how we attribute the character to a user. */
  getReservation(reservationId: string): Promise<{
    rawName: string;
    characterId: string | null;
    suggestedCharacterId: string | null;
    discordId: string | null;
  } | null>;

  /** A character's canonical name, for deciding whether an alias is needed. */
  getCharacterName(characterId: string): Promise<string | null>;

  /** Current owner of a character (null if unowned). */
  getCharacterOwner(characterId: string): Promise<string | null>;

  /** User id for a Discord id, or null if no user row exists. Reservers usually
   *  already have a (RH-stubbed) row, so this is how we attribute the character. */
  findUserIdByDiscordId(discordId: string): Promise<string | null>;

  /** Set the reservation's characterId (and clear any suggestion). */
  setReservationCharacter(reservationId: string, characterId: string): Promise<void>;

  /** Assign a character to a user (gives the member credit in the SR matrix). */
  assignOwner(characterId: string, userId: string): Promise<void>;

  /** Insert a confirmed alias (idempotent: ignore if it already exists). */
  ensureAlias(characterId: string, alias: string): Promise<void>;

  /** Create a character owned by `userId` (or unowned when null); return its id. */
  createCharacter(input: ClaimInput, userId: string | null): Promise<string>;

  /** Mark the reservation ignored (drops it out of the queue). */
  ignoreReservation(reservationId: string): Promise<void>;
}

export type ResolveResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "name_taken" };

// Link a reservation to an EXISTING character. Inserts an alias for rawName when
// it differs from the character's canonical name — the resolve-once guarantee.
// Also attributes the character to the reserver (via dId) when it's unowned, so
// the member gets credit in the SR matrix; an existing owner is never clobbered.
export async function linkReservation(
  store: ResolveReservationStore,
  reservationId: string,
  characterId: string,
): Promise<ResolveResult> {
  const reservation = await store.getReservation(reservationId);
  if (!reservation) return { ok: false, reason: "not_found" };

  const charName = await store.getCharacterName(characterId);
  if (charName === null) return { ok: false, reason: "not_found" };

  await store.setReservationCharacter(reservationId, characterId);
  if (charName !== reservation.rawName) {
    await store.ensureAlias(characterId, reservation.rawName);
  }

  // Attribute to the reserver if the character has no owner yet. Respect an
  // existing owner (officer override). Assigning to the RH-stubbed user is safe:
  // it's the same row the real player logs into (adapter keys on discordId).
  if (reservation.discordId) {
    const owner = await store.getCharacterOwner(characterId);
    if (owner === null) {
      const userId = await store.findUserIdByDiscordId(reservation.discordId);
      if (userId) await store.assignOwner(characterId, userId);
    }
  }
  return { ok: true };
}

// Accept the stored dId-based suggestion. Same path as a manual link.
export async function acceptSuggestion(
  store: ResolveReservationStore,
  reservationId: string,
): Promise<ResolveResult> {
  const reservation = await store.getReservation(reservationId);
  if (!reservation) return { ok: false, reason: "not_found" };
  if (!reservation.suggestedCharacterId) return { ok: false, reason: "not_found" };
  return linkReservation(store, reservationId, reservation.suggestedCharacterId);
}

// Create a character (officer supplies the spec/role sync can't) and link the
// reservation. Attributed to the reserver (via dId) so the member gets matrix
// credit; unowned only when no user row exists for that dId. Name == rawName by
// construction, so no alias is needed. `name_taken` if the name already exists
// (the officer should Link to it instead).
export async function createAndLinkReservation(
  store: ResolveReservationStore,
  reservationId: string,
  input: ClaimInput,
): Promise<ResolveResult> {
  const reservation = await store.getReservation(reservationId);
  if (!reservation) return { ok: false, reason: "not_found" };

  const userId = reservation.discordId
    ? await store.findUserIdByDiscordId(reservation.discordId)
    : null;

  // Character.name is @unique. createCharacter surfaces a unique-violation when
  // the name already exists; translate it to name_taken so the officer Links to
  // the existing character instead of duplicating it.
  let characterId: string;
  try {
    characterId = await store.createCharacter(input, userId);
  } catch {
    return { ok: false, reason: "name_taken" };
  }
  await store.setReservationCharacter(reservationId, characterId);
  return { ok: true };
}

// Dismiss a reservation (e.g. a non-raider's stray reserve). Idempotency: sync
// never touches `ignored`, so it stays dismissed across re-syncs.
export async function ignoreReservation(
  store: ResolveReservationStore,
  reservationId: string,
): Promise<ResolveResult> {
  const reservation = await store.getReservation(reservationId);
  if (!reservation) return { ok: false, reason: "not_found" };
  await store.ignoreReservation(reservationId);
  return { ok: true };
}
