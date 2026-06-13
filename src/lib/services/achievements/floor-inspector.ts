import {
  FLOOR_INSPECTOR_MIN_DEATHS,
  FLOOR_INSPECTOR_OUTLIER_MULTIPLE,
} from "@/lib/domain/constants";
import { pickTied } from "./types";
import type { AchievementRule } from "./types";

// Floor Inspector — affectionate banter, NOT a "most deaths" ranking.
//
// CULTURE (binding, see docs/achievement-design.md): the guild wants an
// all-positive default. This award must NOT just point at whoever happened to
// die most on a normal night. It fires ONLY when one player's deaths are a
// genuine comedic outlier — at least FLOOR_INSPECTOR_MIN_DEATHS deaths AND at
// least FLOOR_INSPECTOR_OUTLIER_MULTIPLE× the runner-up. Otherwise NO award. A
// clean or normal night produces no Floor Inspector at all. Do NOT "simplify"
// this into most-deaths — that reintroduces the call-out the guild rejected.
export const floorInspector: AchievementRule = {
  key: "floor-inspector",
  evaluate(scores, ctx) {
    const withDeaths = scores
      .filter((s) => s.deaths > 0)
      .sort((a, b) => b.deaths - a.deaths);
    if (withDeaths.length === 0) return [];

    const topDeaths = withDeaths[0].deaths;
    if (topDeaths < FLOOR_INSPECTOR_MIN_DEATHS) return [];

    // Runner-up = the highest death count strictly below the top. If everyone is
    // tied at the top, there is no clear outlier → no award.
    const runnerUp = withDeaths.find((s) => s.deaths < topDeaths)?.deaths ?? topDeaths;
    if (topDeaths < runnerUp * FLOOR_INSPECTOR_OUTLIER_MULTIPLE) return [];

    // Clear outlier. If several are tied at the (outlier) top, pick one
    // deterministically — but that's rare given the 2× gate.
    const tied = withDeaths.filter((s) => s.deaths === topDeaths);
    const winner = pickTied(tied, `${ctx.raidNightId}:floor-inspector`);
    return [{ achievementKey: "floor-inspector", characterId: winner.characterId }];
  },
};
