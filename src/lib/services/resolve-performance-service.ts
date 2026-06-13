// Officer action: link an unmatched WCL performance name to a character. Like
// the softres resolver, this inserts a character_alias for the rawName so every
// FUTURE sync auto-resolves it (resolve-once). It additionally backfills the
// ALREADY-INGESTED performance rows with that name and reports which raid nights
// were affected, so the caller can re-run those nights' engines (a newly matched
// top parser can change who wins a crown).

export interface ResolvePerformanceStore {
  /** Canonical name of a character (to decide whether an alias is needed). */
  getCharacterName(characterId: string): Promise<string | null>;
  /** Insert a confirmed alias (idempotent). */
  ensureAlias(characterId: string, alias: string): Promise<void>;
  /**
   * Backfill every player_performance row with this rawName to point at the
   * character. Returns the distinct raidNightIds touched (to re-run engines).
   */
  backfillPerformances(rawName: string, characterId: string): Promise<string[]>;
}

export type ResolvePerformanceResult =
  | { ok: true; affectedRaidNightIds: string[] }
  | { ok: false; reason: "not_found" };

export async function linkPerformanceName(
  store: ResolvePerformanceStore,
  rawName: string,
  characterId: string,
): Promise<ResolvePerformanceResult> {
  const name = await store.getCharacterName(characterId);
  if (name == null) return { ok: false, reason: "not_found" };

  // Alias only when the typed name differs from the canonical name.
  if (rawName !== name) {
    await store.ensureAlias(characterId, rawName);
  }

  const affectedRaidNightIds = await store.backfillPerformances(rawName, characterId);
  return { ok: true, affectedRaidNightIds };
}
