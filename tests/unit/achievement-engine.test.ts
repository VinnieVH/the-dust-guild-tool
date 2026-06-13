import { describe, expect, it } from "vitest";
import { MainRole } from "@/lib/domain/enums";
import type { NightScore } from "@/lib/domain/night-score";
import { runNightEngine } from "@/lib/services/achievement-engine";
import type { NightContext } from "@/lib/services/achievements/types";

function score(over: Partial<NightScore> = {}): NightScore {
  return {
    characterId: "c1",
    characterName: "Vex",
    role: MainRole.DPS,
    parseAvg: 80,
    deaths: 0,
    interrupts: 0,
    dispels: 0,
    hadFlask: false,
    hadFood: false,
    hadElixir: false,
    consumableCount: 0,
    fightsPresent: 10,
    participation: 1,
    eligible: true,
    ...over,
  };
}

const ctx: NightContext = {
  raidNightId: "night-1",
  totalBossFights: 10,
  zoneEncounterCount: 10,
};

function awardsFor(key: string, awards: { achievementKey: string; characterId: string }[]) {
  return awards.filter((a) => a.achievementKey === key).map((a) => a.characterId).sort();
}

describe("achievement engine — per-role crowns", () => {
  it("awards each crown to the top eligible parser in that role", () => {
    const scores = [
      score({ characterId: "dps1", role: MainRole.DPS, parseAvg: 95 }),
      score({ characterId: "dps2", role: MainRole.DPS, parseAvg: 80 }),
      score({ characterId: "heal1", role: MainRole.HEALER, parseAvg: 88 }),
      score({ characterId: "tank1", role: MainRole.TANK, parseAvg: 70 }),
    ];
    const awards = runNightEngine(scores, ctx);
    expect(awardsFor("deadliest", awards)).toEqual(["dps1"]);
    expect(awardsFor("lifebinder", awards)).toEqual(["heal1"]);
    expect(awardsFor("immovable-object", awards)).toEqual(["tank1"]);
  });

  it("excludes ineligible (<75%) players from crowns", () => {
    const scores = [
      score({ characterId: "dps1", role: MainRole.DPS, parseAvg: 99, eligible: false }),
      score({ characterId: "dps2", role: MainRole.DPS, parseAvg: 70, eligible: true }),
    ];
    // The 99-parse player is ineligible → the eligible 70 wins.
    expect(awardsFor("deadliest", runNightEngine(scores, ctx))).toEqual(["dps2"]);
  });
});

describe("achievement engine — effort & utility", () => {
  it("Fully Buffed goes to the most consumable categories (min 1)", () => {
    const scores = [
      score({ characterId: "a", consumableCount: 3 }),
      score({ characterId: "b", consumableCount: 1 }),
    ];
    expect(awardsFor("fully-buffed", runNightEngine(scores, ctx))).toEqual(["a"]);
  });

  it("Fully Buffed awards nobody if no one brought a consumable", () => {
    const scores = [score({ characterId: "a", consumableCount: 0 })];
    expect(awardsFor("fully-buffed", runNightEngine(scores, ctx))).toEqual([]);
  });

  it("Iron Man awards EVERY eligible player with zero deaths (multi)", () => {
    const scores = [
      score({ characterId: "a", deaths: 0, eligible: true }),
      score({ characterId: "b", deaths: 0, eligible: true }),
      score({ characterId: "c", deaths: 2, eligible: true }),
      score({ characterId: "d", deaths: 0, eligible: false }), // not eligible
    ];
    expect(awardsFor("iron-man", runNightEngine(scores, ctx))).toEqual(["a", "b"]);
  });

  it("Kick Commander / Cleanse Crusader need at least 1", () => {
    const none = [score({ characterId: "a", interrupts: 0, dispels: 0 })];
    expect(awardsFor("kick-commander", runNightEngine(none, ctx))).toEqual([]);
    expect(awardsFor("cleanse-crusader", runNightEngine(none, ctx))).toEqual([]);

    const some = [
      score({ characterId: "a", interrupts: 3, dispels: 1 }),
      score({ characterId: "b", interrupts: 1, dispels: 4 }),
    ];
    expect(awardsFor("kick-commander", runNightEngine(some, ctx))).toEqual(["a"]);
    expect(awardsFor("cleanse-crusader", runNightEngine(some, ctx))).toEqual(["b"]);
  });
});

describe("achievement engine — Floor Inspector (most deaths, min-3 floor)", () => {
  it("does NOT award when the top is below the death floor", () => {
    const scores = [
      score({ characterId: "a", deaths: 2 }), // < 3 floor
      score({ characterId: "b", deaths: 0 }),
    ];
    expect(awardsFor("floor-inspector", runNightEngine(scores, ctx))).toEqual([]);
  });

  it("does NOT award when nobody died", () => {
    const scores = [
      score({ characterId: "a", deaths: 0 }),
      score({ characterId: "b", deaths: 0 }),
    ];
    expect(awardsFor("floor-inspector", runNightEngine(scores, ctx))).toEqual([]);
  });

  it("awards the most deaths once the floor is cleared (no outlier gate)", () => {
    // 3 vs 2 — used to be no award (not an outlier); now the top wins.
    const scores = [
      score({ characterId: "klutz", deaths: 3 }),
      score({ characterId: "b", deaths: 2 }),
    ];
    expect(awardsFor("floor-inspector", runNightEngine(scores, ctx))).toEqual(["klutz"]);
  });

  it("awards a high-but-not-outlier top (5 vs 3 — used to be skipped)", () => {
    const scores = [
      score({ characterId: "a", deaths: 5 }),
      score({ characterId: "b", deaths: 3 }),
    ];
    expect(awardsFor("floor-inspector", runNightEngine(scores, ctx))).toEqual(["a"]);
  });

  it("breaks a top-tie deterministically (single winner)", () => {
    const scores = [
      score({ characterId: "a", deaths: 4 }),
      score({ characterId: "b", deaths: 4 }),
    ];
    const winners = awardsFor("floor-inspector", runNightEngine(scores, ctx));
    expect(winners).toHaveLength(1);
    expect(["a", "b"]).toContain(winners[0]);
    // Deterministic: same scores + night => same winner on a re-run.
    expect(awardsFor("floor-inspector", runNightEngine(scores, ctx))).toEqual(winners);
  });
});

describe("achievement engine — single-night guild awards", () => {
  it("Clean Sweep awards everyone present when all bosses died", () => {
    const scores = [score({ characterId: "a" }), score({ characterId: "b" })];
    const awards = runNightEngine(scores, { ...ctx, totalBossFights: 10, zoneEncounterCount: 10 });
    expect(awardsFor("clean-sweep", awards)).toEqual(["a", "b"]);
  });

  it("Clean Sweep awards nobody on a partial clear", () => {
    const scores = [score({ characterId: "a" })];
    const awards = runNightEngine(scores, { ...ctx, totalBossFights: 7, zoneEncounterCount: 10 });
    expect(awardsFor("clean-sweep", awards)).toEqual([]);
  });

  it("Well-Oiled Machine awards everyone when raid-avg parse clears the bar", () => {
    const scores = [
      score({ characterId: "a", parseAvg: 85 }),
      score({ characterId: "b", parseAvg: 90 }),
    ]; // avg 87.5 >= 80
    expect(awardsFor("well-oiled-machine", runNightEngine(scores, ctx)).length).toBe(2);
  });

  it("Well-Oiled Machine awards nobody on a low-parse night", () => {
    const scores = [
      score({ characterId: "a", parseAvg: 60 }),
      score({ characterId: "b", parseAvg: 70 }),
    ]; // avg 65 < 80
    expect(awardsFor("well-oiled-machine", runNightEngine(scores, ctx))).toEqual([]);
  });
});

describe("achievement engine — determinism", () => {
  it("is idempotent: same input → identical awards across runs", () => {
    const scores = [
      score({ characterId: "dps1", role: MainRole.DPS, parseAvg: 90, interrupts: 2 }),
      score({ characterId: "dps2", role: MainRole.DPS, parseAvg: 90, interrupts: 1 }),
    ];
    const a = runNightEngine(scores, ctx);
    const b = runNightEngine([...scores].reverse(), ctx);
    // Same awards regardless of input order (tie sorted by characterId + seeded).
    expect(JSON.stringify([...a].sort((x, y) => x.achievementKey.localeCompare(y.achievementKey) || x.characterId.localeCompare(y.characterId)))).toEqual(
      JSON.stringify([...b].sort((x, y) => x.achievementKey.localeCompare(y.achievementKey) || x.characterId.localeCompare(y.characterId))),
    );
  });

  it("breaks a parse tie deterministically (same winner every run)", () => {
    const scores = [
      score({ characterId: "tieA", role: MainRole.DPS, parseAvg: 88 }),
      score({ characterId: "tieB", role: MainRole.DPS, parseAvg: 88 }),
    ];
    const w1 = awardsFor("deadliest", runNightEngine(scores, ctx));
    const w2 = awardsFor("deadliest", runNightEngine([...scores].reverse(), ctx));
    expect(w1).toHaveLength(1);
    expect(w1).toEqual(w2); // order-independent winner
  });
});
