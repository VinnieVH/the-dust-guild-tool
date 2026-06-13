import { describe, expect, it } from "vitest";
import { MainRole } from "@/lib/domain/enums";
import type { ReportPerformance } from "@/lib/domain/night-score";
import { nightBossFights, scoreNight } from "@/lib/services/night-score";

function perf(over: Partial<ReportPerformance> = {}): ReportPerformance {
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
    fightsPresent: 1,
    reportBossFights: 1,
    ...over,
  };
}

describe("scoreNight", () => {
  it("weights the parse mean by fights (1-boss TK + 6-boss SSC)", () => {
    // Same character across two reports: 100% on the 1-boss TK, 70 on 6-boss SSC.
    // Weighted mean = (100*1 + 70*6) / 7 = 74.28..., NOT the flat mean 85.
    const scores = scoreNight(
      [
        perf({ parseAvg: 100, fightsPresent: 1, reportBossFights: 1 }),
        perf({ parseAvg: 70, fightsPresent: 6, reportBossFights: 6 }),
      ],
      nightBossFights([1, 6]),
    );
    expect(scores).toHaveLength(1);
    expect(scores[0].parseAvg).toBeCloseTo((100 + 70 * 6) / 7, 5);
    expect(scores[0].fightsPresent).toBe(7);
    expect(scores[0].participation).toBeCloseTo(1, 5);
    expect(scores[0].eligible).toBe(true);
  });

  it("gates eligibility at exactly 75% participation", () => {
    // 3 of 4 boss fights = 75% -> eligible (>=).
    const at75 = scoreNight([perf({ fightsPresent: 3 })], 4);
    expect(at75[0].participation).toBe(0.75);
    expect(at75[0].eligible).toBe(true);

    // 2 of 4 = 50% -> not eligible.
    const below = scoreNight([perf({ fightsPresent: 2 })], 4);
    expect(below[0].eligible).toBe(false);
  });

  it("sums deaths/interrupts/dispels across reports", () => {
    const scores = scoreNight(
      [
        perf({ deaths: 1, interrupts: 2, dispels: 0 }),
        perf({ deaths: 2, interrupts: 1, dispels: 3 }),
      ],
      2,
    );
    expect(scores[0].deaths).toBe(3);
    expect(scores[0].interrupts).toBe(3);
    expect(scores[0].dispels).toBe(3);
  });

  it("ORs consumable presence across reports and counts categories", () => {
    const scores = scoreNight(
      [
        perf({ hadFlask: true, hadFood: false, hadElixir: false }),
        perf({ hadFlask: false, hadFood: true, hadElixir: false }),
      ],
      2,
    );
    expect(scores[0].hadFlask).toBe(true);
    expect(scores[0].hadFood).toBe(true);
    expect(scores[0].hadElixir).toBe(false);
    expect(scores[0].consumableCount).toBe(2);
  });

  it("picks the fight-weighted dominant role (off-spec stint doesn't flip it)", () => {
    const scores = scoreNight(
      [
        perf({ role: MainRole.TANK, fightsPresent: 5 }),
        perf({ role: MainRole.DPS, fightsPresent: 1 }),
      ],
      6,
    );
    expect(scores[0].role).toBe(MainRole.TANK);
  });

  it("scores multiple distinct characters independently", () => {
    const scores = scoreNight(
      [
        perf({ characterId: "a", characterName: "Aaa", parseAvg: 90, fightsPresent: 2 }),
        perf({ characterId: "b", characterName: "Bbb", parseAvg: 50, fightsPresent: 2 }),
      ],
      2,
    );
    expect(scores).toHaveLength(2);
    const a = scores.find((s) => s.characterId === "a")!;
    const b = scores.find((s) => s.characterId === "b")!;
    expect(a.parseAvg).toBe(90);
    expect(b.parseAvg).toBe(50);
  });

  it("never divides by zero when the night has no boss fights", () => {
    const scores = scoreNight([perf({ fightsPresent: 0 })], 0);
    expect(scores[0].participation).toBe(0);
    expect(scores[0].eligible).toBe(false);
    expect(Number.isNaN(scores[0].parseAvg)).toBe(false);
  });
});
