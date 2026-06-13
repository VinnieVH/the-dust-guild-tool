import { WELL_OILED_AVG_PARSE } from "@/lib/domain/constants";
import type { NightScore } from "@/lib/domain/night-score";
import type { AchievementRule, RuleAward } from "./types";

// Single-night GUILD awards. "Everyone present gets it" = one award per
// character that appears in the night's scores (they logged a fight, so they
// were there). NOTE: new-speed-record is NOT here — it's history-dependent and
// lives in a separate recompute pass (see speed-record.ts).

/** One award per present character. */
function awardAll(scores: NightScore[], achievementKey: string): RuleAward[] {
  return scores.map((s) => ({ achievementKey, characterId: s.characterId }));
}

// Clean Sweep — the guild killed every boss in the zone this night.
export const cleanSweep: AchievementRule = {
  key: "clean-sweep",
  evaluate(scores, ctx) {
    if (ctx.zoneEncounterCount == null || ctx.zoneEncounterCount === 0) return [];
    if (ctx.totalBossFights < ctx.zoneEncounterCount) return [];
    return awardAll(scores, "clean-sweep");
  },
};

// Well-Oiled Machine — the night's raid-average parse cleared the bar. Averages
// over EVERYONE scored (a collective, high-execution night), not just the
// eligible — though in practice the present roster is the raid.
export const wellOiledMachine: AchievementRule = {
  key: "well-oiled-machine",
  evaluate(scores, ctx) {
    void ctx;
    if (scores.length === 0) return [];
    const avg = scores.reduce((a, s) => a + s.parseAvg, 0) / scores.length;
    if (avg < WELL_OILED_AVG_PARSE) return [];
    return awardAll(scores, "well-oiled-machine");
  },
};
