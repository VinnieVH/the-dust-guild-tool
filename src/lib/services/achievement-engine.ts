import type { NightScore } from "@/lib/domain/night-score";
import {
  cleanseCrusader,
  fullyBuffed,
  ironMan,
  kickCommander,
} from "./achievements/effort";
import { deadliest, immovableObject, lifebinder } from "./achievements/crowns";
import { floorInspector } from "./achievements/floor-inspector";
import { cleanSweep, wellOiledMachine } from "./achievements/guild";
import type { AchievementRule, NightContext, RuleAward } from "./achievements/types";

// Step 4.4 — the achievement engine. Runs every registered PER-NIGHT rule over
// a night's scores and returns the awards. PURE: the caller persists them
// (delete this night's awards, then re-insert) so re-running a night is
// idempotent. Rules are deterministic (seeded tie-breaks, sorted candidates),
// so the same input yields the same awards every time.
//
// History-dependent awards (new-speed-record, attendance streaks) are NOT here
// — they're computed in separate recompute-from-history passes that the
// per-night delete can't clobber.

export const PER_NIGHT_RULES: AchievementRule[] = [
  // Per-role crowns
  deadliest,
  lifebinder,
  immovableObject,
  // Effort & utility
  fullyBuffed,
  ironMan,
  kickCommander,
  cleanseCrusader,
  // Affectionate banter (outlier-gated)
  floorInspector,
  // Single-night guild
  cleanSweep,
  wellOiledMachine,
];

/** Run all per-night rules; returns every award for the night (achievementKey +
 *  characterId). Deterministic and order-independent. */
export function runNightEngine(
  scores: NightScore[],
  ctx: NightContext,
  rules: AchievementRule[] = PER_NIGHT_RULES,
): RuleAward[] {
  const awards: RuleAward[] = [];
  for (const rule of rules) {
    awards.push(...rule.evaluate(scores, ctx));
  }
  return awards;
}
