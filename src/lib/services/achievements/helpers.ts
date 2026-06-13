import type { NightScore } from "@/lib/domain/night-score";
import { MainRole } from "@/lib/domain/enums";
import { pickTied, type RuleAward } from "./types";

// Shared rule shapes. Keep rules tiny and declarative.

/** Single winner = the max of `metric` among `candidates`, ties broken by the
 *  seeded picker. Returns [] if there are no candidates or the top metric is
 *  not above `floor` (e.g. min 1 interrupt). */
export function topOne(
  candidates: NightScore[],
  metric: (s: NightScore) => number,
  achievementKey: string,
  raidNightId: string,
  floor = 0,
): RuleAward[] {
  if (candidates.length === 0) return [];
  let max = -Infinity;
  for (const c of candidates) max = Math.max(max, metric(c));
  if (max <= floor) return [];
  const tied = candidates.filter((c) => metric(c) === max);
  const winner = pickTied(tied, `${raidNightId}:${achievementKey}`);
  return [{ achievementKey, characterId: winner.characterId }];
}

/** The eligible (≥75% participation) scores in a given role. */
export function eligibleInRole(scores: NightScore[], role: MainRole): NightScore[] {
  return scores.filter((s) => s.eligible && s.role === role);
}
