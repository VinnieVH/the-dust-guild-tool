import type { ReportPerformance } from "@/lib/domain/night-score";
import { nightBossFights, scoreNight } from "./night-score";
import {
  PER_NIGHT_ACHIEVEMENT_KEYS,
  runNightEngine,
} from "./achievement-engine";
import type { RuleAward } from "./achievements/types";

// Runs the per-night achievement engine for one raid night and persists the
// awards. Pure over an injected store. CRITICAL: the persistence delete is
// SCOPED to PER_NIGHT_ACHIEVEMENT_KEYS so it only removes awards this engine
// regenerates — it must NEVER touch new-speed-record (owned by the speed-record
// pass) or streak milestones, which it can't recompute. See the advisor note in
// docs/achievement-design.md.

export interface NightEngineStore {
  /**
   * Resolved performances for the night across all its reports, plus each
   * report's boss-fight count (for the participation denominator) and the
   * zone's total encounter count (for clean-sweep, null if unknown).
   * Only MATCHED performances (characterId set) are scored — unmatched names
   * sit in the queue and can't win an award until resolved.
   */
  getNightPerformances(raidNightId: string): Promise<{
    performances: ReportPerformance[];
    reportBossFights: number[];
    zoneEncounterCount: number | null;
  }>;

  /**
   * Map an achievement KEY to its id (the awards table FKs by id). Returns the
   * ids for the given keys, so the scoped delete + insert can use ids.
   */
  resolveAchievementIds(keys: string[]): Promise<Map<string, string>>;

  /**
   * Replace this night's per-night awards: delete existing awards for this
   * raidNightId WHOSE achievementId is in `ownedAchievementIds`, then insert the
   * given (achievementId, characterId) rows. Scoped delete = idempotent re-run
   * without clobbering other passes' awards.
   */
  replaceNightAwards(
    raidNightId: string,
    ownedAchievementIds: string[],
    awards: Array<{ achievementId: string; characterId: string }>,
  ): Promise<void>;
}

export interface NightEngineResult {
  awards: number;
  scored: number;
}

export async function runNightEngineForNight(
  store: NightEngineStore,
  raidNightId: string,
): Promise<NightEngineResult> {
  const { performances, reportBossFights, zoneEncounterCount } =
    await store.getNightPerformances(raidNightId);

  const scores = scoreNight(performances, nightBossFights(reportBossFights));

  const ruleAwards: RuleAward[] = runNightEngine(scores, {
    raidNightId,
    totalBossFights: nightBossFights(reportBossFights),
    zoneEncounterCount,
  });

  // Resolve keys -> ids. We need both the awards' keys AND the full owned-key
  // set (so the scoped delete clears stale awards even for rules that awarded
  // nobody this run — e.g. a re-ingest where the top parser changed).
  const idByKey = await store.resolveAchievementIds(PER_NIGHT_ACHIEVEMENT_KEYS);
  const ownedAchievementIds = PER_NIGHT_ACHIEVEMENT_KEYS.map(
    (k) => idByKey.get(k),
  ).filter((id): id is string => !!id);

  const awards = ruleAwards
    .map((a) => {
      const achievementId = idByKey.get(a.achievementKey);
      return achievementId ? { achievementId, characterId: a.characterId } : null;
    })
    .filter((a): a is { achievementId: string; characterId: string } => !!a);

  await store.replaceNightAwards(raidNightId, ownedAchievementIds, awards);

  return { awards: awards.length, scored: scores.length };
}
