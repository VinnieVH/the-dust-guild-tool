import type { NightScore } from "@/lib/domain/night-score";

// The achievement rules pipeline (open/closed): the engine runs every
// registered rule and collects their awards. Adding an achievement = adding one
// AchievementRule. Rules are PURE — (scores, context) -> awards, no IO.
//
// SCOPE: these rules are PER-NIGHT and single-night. History-dependent awards
// (new-speed-record, streak milestones) live in separate recompute passes, NOT
// here — the per-night engine's delete-by-raidNightId can't regenerate them.

/** Per-night context a rule may need beyond the scores. */
export interface NightContext {
  raidNightId: string;
  /** Boss fights logged this night (sum across reports). */
  totalBossFights: number;
  /** Total bosses in the night's zone (for clean-sweep). May be null if the
   *  zone's encounter count is unknown. */
  zoneEncounterCount: number | null;
}

/** A single award a rule grants: an achievement key + the character receiving
 *  it. The engine attaches raidNightId. */
export interface RuleAward {
  achievementKey: string;
  characterId: string;
}

export interface AchievementRule {
  key: string;
  /** Return zero, one, or many awards for this night. */
  evaluate(scores: NightScore[], ctx: NightContext): RuleAward[];
}

// --- Deterministic tie-break ----------------------------------------------
// Seeded by raidNightId + achievementKey so re-runs pick the same winner. The
// candidate list is sorted by characterId FIRST so the pick is stable against
// input/query order (otherwise "deterministic" holds on paper but not in fact).

function seededIndex(seed: string, length: number): number {
  // Small FNV-1a hash → index. Deterministic, no Math.random.
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return Math.abs(h) % length;
}

/** Pick one winner from tied candidates, deterministically. */
export function pickTied<T extends { characterId: string }>(
  candidates: T[],
  seed: string,
): T {
  const sorted = [...candidates].sort((a, b) =>
    a.characterId < b.characterId ? -1 : a.characterId > b.characterId ? 1 : 0,
  );
  return sorted[seededIndex(seed, sorted.length)];
}
