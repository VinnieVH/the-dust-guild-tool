import { FLOOR_INSPECTOR_MIN_DEATHS } from "@/lib/domain/constants";
import { pickTied } from "./types";
import type { AchievementRule } from "./types";

// Floor Inspector — most deaths of the night.
//
// Uses `totalDeaths` (EVERY death in the report: kills + wipes + trash), NOT the
// kill-pull-only `deaths` that Iron Man and participation use. The wipe nights
// are the whole point — a kill-only count tops out around 5 and misses the
// 12-death wipefests this award exists to celebrate.
//
// HISTORY: originally outlier-gated (>=3 AND >=2x the runner-up) to keep an
// all-positive culture; the guild reversed that on 2026-06-14 to plain
// most-deaths (see docs/achievement-design.md). On 2026-06-14 it also moved from
// `deaths` to `totalDeaths`. Most deaths wins above the min floor; ties broken
// deterministically; a near-clean night still mints nothing.
export const floorInspector: AchievementRule = {
  key: "floor-inspector",
  evaluate(scores, ctx) {
    const withDeaths = scores
      .filter((s) => s.totalDeaths > 0)
      .sort((a, b) => b.totalDeaths - a.totalDeaths);
    if (withDeaths.length === 0) return [];

    const topDeaths = withDeaths[0].totalDeaths;
    if (topDeaths < FLOOR_INSPECTOR_MIN_DEATHS) return [];

    // Most deaths wins. If several are tied at the top, pick one deterministically.
    const tied = withDeaths.filter((s) => s.totalDeaths === topDeaths);
    const winner = pickTied(tied, `${ctx.raidNightId}:floor-inspector`);
    return [{ achievementKey: "floor-inspector", characterId: winner.characterId }];
  },
};
