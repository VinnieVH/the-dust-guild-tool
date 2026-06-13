import { describe, expect, it } from "vitest";
import { MainRole } from "@/lib/domain/enums";
import type { ReportPerformance } from "@/lib/domain/night-score";
import {
  runNightEngineForNight,
  type NightEngineStore,
} from "@/lib/services/run-night-engine-service";
import { PER_NIGHT_ACHIEVEMENT_KEYS } from "@/lib/services/achievement-engine";

function rp(over: Partial<ReportPerformance> = {}): ReportPerformance {
  return {
    characterId: "c1",
    characterName: "Vex",
    role: MainRole.DPS,
    parseAvg: 90,
    deaths: 0,
    interrupts: 0,
    dispels: 0,
    hadFlask: false,
    hadFood: false,
    hadElixir: false,
    fightsPresent: 10,
    reportBossFights: 10,
    ...over,
  };
}

describe("runNightEngineForNight", () => {
  it("scopes the award delete to per-night achievement ids only", async () => {
    let scopedIds: string[] = [];
    const store: NightEngineStore = {
      async getNightPerformances() {
        return {
          performances: [
            rp({ characterId: "dps1", role: MainRole.DPS, parseAvg: 95 }),
            rp({ characterId: "tank1", role: MainRole.TANK, parseAvg: 80 }),
          ],
          reportBossFights: [10],
          zoneEncounterCount: 10,
        };
      },
      async resolveAchievementIds(keys) {
        // id = "id:" + key for the test.
        return new Map(keys.map((k) => [k, `id:${k}`]));
      },
      async replaceNightAwards(_night, ownedIds) {
        scopedIds = ownedIds;
      },
    };

    await runNightEngineForNight(store, "night-1");

    // The delete must be scoped to exactly the per-night keys — never the
    // speed-record or streak achievements.
    expect(scopedIds.sort()).toEqual(
      PER_NIGHT_ACHIEVEMENT_KEYS.map((k) => `id:${k}`).sort(),
    );
    expect(scopedIds).not.toContain("id:new-speed-record");
    expect(scopedIds.some((id) => id.startsWith("id:streak-"))).toBe(false);
  });

  it("persists the engine's awards mapped to achievement ids", async () => {
    let written: Array<{ achievementId: string; characterId: string }> = [];
    const store: NightEngineStore = {
      async getNightPerformances() {
        return {
          performances: [rp({ characterId: "dps1", role: MainRole.DPS, parseAvg: 95 })],
          reportBossFights: [10],
          zoneEncounterCount: 10,
        };
      },
      async resolveAchievementIds(keys) {
        return new Map(keys.map((k) => [k, `id:${k}`]));
      },
      async replaceNightAwards(_night, _owned, awards) {
        written = awards;
      },
    };

    const result = await runNightEngineForNight(store, "night-1");
    expect(result.scored).toBe(1);
    // dps1 should at least win deadliest + clean-sweep (full clear) + well-oiled.
    const deadliest = written.find((a) => a.achievementId === "id:deadliest");
    expect(deadliest?.characterId).toBe("dps1");
    expect(written.length).toBeGreaterThan(0);
  });
});
