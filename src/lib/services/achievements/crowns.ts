import { MainRole } from "@/lib/domain/enums";
import { eligibleInRole, topOne } from "./helpers";
import type { AchievementRule } from "./types";

// The per-role parse crowns. Each ranks on parseAvg among eligible (≥75%
// participation) players IN THAT ROLE — so a healer never competes with a DPS.

export const deadliest: AchievementRule = {
  key: "deadliest",
  evaluate(scores, ctx) {
    return topOne(
      eligibleInRole(scores, MainRole.DPS),
      (s) => s.parseAvg,
      "deadliest",
      ctx.raidNightId,
    );
  },
};

export const lifebinder: AchievementRule = {
  key: "lifebinder",
  evaluate(scores, ctx) {
    return topOne(
      eligibleInRole(scores, MainRole.HEALER),
      (s) => s.parseAvg,
      "lifebinder",
      ctx.raidNightId,
    );
  },
};

export const immovableObject: AchievementRule = {
  key: "immovable-object",
  evaluate(scores, ctx) {
    return topOne(
      eligibleInRole(scores, MainRole.TANK),
      (s) => s.parseAvg,
      "immovable-object",
      ctx.raidNightId,
    );
  },
};
