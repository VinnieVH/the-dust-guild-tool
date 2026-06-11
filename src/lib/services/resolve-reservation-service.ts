import type { ClaimInput } from "@/lib/domain/character";

// Port for the officer resolution actions. The repository implements it; the
// service stays Prisma-free and unit-testable. The load-bearing invariant: any
// time we link a reservation whose rawName differs from the character's name, we
// MUST insert a character_alias for rawName — otherwise the next softres sync
// re-derives `unmatched` and the row falls back into the queue (breaking the
// resolve-once guarantee that sync-softres-service relies on).
export interface ResolveReservationStore {
  /** The reservation's rawName + current character name (null if unmatched). */
  getReservation(reservationId: string): Promise<{
    rawName: string;
    characterId: string | null;
    suggestedCharacterId: string | null;
  } | null>;

  /** A character's canonical name, for deciding whether an alias is needed. */
  getCharacterName(characterId: string): Promise<string | null>;

  /** Set the reservation's characterId (and clear any suggestion). */
  setReservationCharacter(reservationId: string, characterId: string): Promise<void>;

  /** Insert a confirmed alias (idempotent: ignore if it already exists). */
  ensureAlias(characterId: string, alias: string): Promise<void>;

  /** Create an unowned character (officer-supplied spec/role); return its id. */
  createCharacter(input: ClaimInput): Promise<string>;

  /** Mark the reservation ignored (drops it out of the queue). */
  ignoreReservation(reservationId: string): Promise<void>;
}

export type ResolveResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "name_taken" };

// Link a reservation to an EXISTING character. Inserts an alias for rawName when
// it differs from the character's canonical name — the resolve-once guarantee.
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

// Create a new unowned character (officer supplies the spec/role sync can't) and
// link the reservation. The character's name == rawName by construction, so no
// alias is needed. `name_taken` if the name already exists (the officer should
// Link to it instead).
export async function createAndLinkReservation(
  store: ResolveReservationStore,
  reservationId: string,
  input: ClaimInput,
): Promise<ResolveResult> {
  const reservation = await store.getReservation(reservationId);
  if (!reservation) return { ok: false, reason: "not_found" };

  // Character.name is @unique. createCharacter surfaces a unique-violation when
  // the name already exists; translate it to name_taken so the officer Links to
  // the existing character instead of duplicating it.
  let characterId: string;
  try {
    characterId = await store.createCharacter(input);
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
