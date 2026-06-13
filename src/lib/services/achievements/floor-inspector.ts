import { FLOOR_INSPECTOR_MIN_DEATHS } from "@/lib/domain/constants";
import { pickTied } from "./types";
import type { AchievementRule } from "./types";

// Floor Inspector — most deaths of the night.
//
// HISTORY: this was originally outlier-gated (>=3 deaths AND >=2x the runner-up,
// else no award) to keep an all-positive culture. The guild reversed that on
// 2026-06-14 (see docs/achievement-design.md): it now simply goes to whoever
// died the most, as long as they cleared the FLOOR_INSPECTOR_MIN_DEATHS floor
// so a near-clean night still mints nothing. Most deaths wins; ties broken
// deterministically.
export const floorInspector: AchievementRule = {
  key: "floor-inspector",
  evaluate(scores, ctx) {
    const withDeaths = scores
      .filter((s) => s.deaths > 0)
      .sort((a, b) => b.deaths - a.deaths);
    if (withDeaths.length === 0) return [];

    const topDeaths = withDeaths[0].deaths;
    if (topDeaths < FLOOR_INSPECTOR_MIN_DEATHS) return [];

    // Most deaths wins. If several are tied at the top, pick one deterministically.
    const tied = withDeaths.filter((s) => s.deaths === topDeaths);
    const winner = pickTied(tied, `${ctx.raidNightId}:floor-inspector`);
    return [{ achievementKey: "floor-inspector", characterId: winner.characterId }];
  },
};
