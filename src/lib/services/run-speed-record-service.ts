import { computeSpeedRecords, type ZoneNight } from "./speed-record";

// Persists the New Speed Record award by recomputing over ALL nights' clear
// times (history pass — see speed-record.ts). Owns the `new-speed-record`
// achievement key exclusively: it deletes ALL existing new-speed-record awards
// and re-inserts from the recompute, so a re-ingest that makes a night slower
// correctly drops a now-stale record. Runs after report ingest.

export interface SpeedRecordStore {
  /** Every night with a clear time, its zone, date, and present characters.
   *  A night's clearMs = the fastest (min) of its reports for that zone; null
   *  if no report has a usable time. Present = distinct characters who logged a
   *  performance that night (the "everyone who was there" set). */
  getZoneNights(): Promise<ZoneNight[]>;

  /** The achievement id for `new-speed-record`. */
  getSpeedRecordAchievementId(): Promise<string | null>;

  /** Replace ALL new-speed-record awards with the given per-night character
   *  sets (delete-all by this achievement id, then insert). */
  replaceSpeedRecordAwards(
    achievementId: string,
    awards: Array<{ raidNightId: string; characterIds: string[] }>,
  ): Promise<void>;
}

export async function runSpeedRecords(store: SpeedRecordStore): Promise<{
  recordNights: number;
}> {
  const achievementId = await store.getSpeedRecordAchievementId();
  if (!achievementId) return { recordNights: 0 };

  const nights = await store.getZoneNights();
  const awards = computeSpeedRecords(nights);

  await store.replaceSpeedRecordAwards(
    achievementId,
    awards.map((a) => ({ raidNightId: a.raidNightId, characterIds: a.characterIds })),
  );

  return { recordNights: awards.length };
}
