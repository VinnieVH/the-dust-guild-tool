// New Speed Record — a GUILD achievement, but history-dependent, so it lives in
// a recompute-from-all-nights pass, NOT the per-night engine (which can't see
// prior nights and whose delete-by-night would clobber a record awarded on a
// later night). See docs/achievement-design.md PB determinism rule.
//
// Semantics: "was a record when it happened". Walking nights in DATE order
// (not ingestion order), a night is a record if its clear time is strictly
// faster than every PRIOR night's clear time IN THE SAME ZONE. The badge is
// kept forever even when a later night beats it. Computing over full history by
// date makes this correct under out-of-order ingest and backfill.

export interface ZoneNight {
  raidNightId: string;
  /** When the raid happened (NOT when it was ingested). */
  date: Date;
  /** Which zone this clear was in — records are per-zone. */
  zone: string;
  /** Clear duration in ms (report end - start). Null if not computable (e.g. an
   *  incomplete night) — such nights can't set a record. */
  clearMs: number | null;
  /** Characters present that night (for "everyone who was there gets it"). */
  presentCharacterIds: string[];
}

export interface SpeedRecordAward {
  raidNightId: string;
  characterIds: string[];
}

/**
 * Returns the nights that were a speed record when they happened, each with the
 * characters present (to be awarded `new-speed-record`). Pure & order-independent.
 */
export function computeSpeedRecords(nights: ZoneNight[]): SpeedRecordAward[] {
  // Sort by date ascending; tie-break on raidNightId so the order is total and
  // stable (two raids the same day — the earlier-id one is "first").
  const ordered = [...nights].sort((a, b) => {
    const d = a.date.getTime() - b.date.getTime();
    return d !== 0 ? d : a.raidNightId < b.raidNightId ? -1 : 1;
  });

  const bestByZone = new Map<string, number>();
  const awards: SpeedRecordAward[] = [];

  for (const night of ordered) {
    if (night.clearMs == null) continue; // can't set a record without a time
    const prevBest = bestByZone.get(night.zone);
    if (prevBest === undefined || night.clearMs < prevBest) {
      bestByZone.set(night.zone, night.clearMs);
      // Record when it happened — award everyone present.
      if (night.presentCharacterIds.length > 0) {
        awards.push({
          raidNightId: night.raidNightId,
          characterIds: night.presentCharacterIds,
        });
      }
    }
  }

  return awards;
}
