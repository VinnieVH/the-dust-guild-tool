import { topOne } from "./helpers";
import type { AchievementRule, RuleAward } from "./types";

// Effort & utility awards. None of these are role-locked or use the 75% gate
// (except Iron Man, which does — see below); they reward preparation and
// attention, so "everyone can shine".

// Fully Buffed — most distinct consumable categories (flask/food/elixir).
// Min 1 category to win (the unprepared can't win, but still raid). Open to all
// roles/skill levels — the heart of "everyone can shine".
export const fullyBuffed: AchievementRule = {
  key: "fully-buffed",
  evaluate(scores, ctx) {
    return topOne(scores, (s) => s.consumableCount, "fully-buffed", ctx.raidNightId, 0);
  },
};

// Kick Commander — most successful interrupts. Min 1.
export const kickCommander: AchievementRule = {
  key: "kick-commander",
  evaluate(scores, ctx) {
    return topOne(scores, (s) => s.interrupts, "kick-commander", ctx.raidNightId, 0);
  },
};

// Cleanse Crusader — most dispels. Min 1.
export const cleanseCrusader: AchievementRule = {
  key: "cleanse-crusader",
  evaluate(scores, ctx) {
    return topOne(scores, (s) => s.dispels, "cleanse-crusader", ctx.raidNightId, 0);
  },
};

// Iron Man — zero deaths all night. Awarded to EVERY eligible (≥75%) player who
// didn't die. Multi-award, no tie-break (it's not a "top", it's a bar cleared).
export const ironMan: AchievementRule = {
  key: "iron-man",
  evaluate(scores, ctx): RuleAward[] {
    void ctx;
    return scores
      .filter((s) => s.eligible && s.deaths === 0)
      .map((s) => ({ achievementKey: "iron-man", characterId: s.characterId }));
  },
};
