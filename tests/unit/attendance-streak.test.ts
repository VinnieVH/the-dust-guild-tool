import { describe, expect, it } from "vitest";
import { computeStreak, type StreakNight } from "@/lib/services/attendance-streak";

// Nights oldest -> newest (the caller orders them).
function nights(presence: boolean[]): StreakNight[] {
  return presence.map((present, i) => ({ reportCode: `n${i + 1}`, present }));
}

describe("computeStreak", () => {
  it("current streak is the trailing run of attended nights", () => {
    // present, miss, present, present, present -> trailing run = 3
    const r = computeStreak(nights([true, false, true, true, true]));
    expect(r.currentStreak).toBe(3);
  });

  it("current streak is 0 if the most recent night was missed", () => {
    const r = computeStreak(nights([true, true, true, false]));
    expect(r.currentStreak).toBe(0);
  });

  it("awards a milestone the first night the run reaches it", () => {
    // 5 in a row -> streak-5 on the 5th night.
    const r = computeStreak(nights([true, true, true, true, true]));
    expect(r.milestones).toEqual([{ achievementKey: "streak-5", crossedReportCode: "n5" }]);
  });

  it("awards higher milestones cumulatively as the run grows", () => {
    const r = computeStreak(nights(Array(10).fill(true)));
    expect(r.milestones.map((m) => m.achievementKey)).toEqual(["streak-5", "streak-10"]);
    expect(r.milestones.find((m) => m.achievementKey === "streak-10")?.crossedReportCode).toBe("n10");
  });

  it("does not re-award a milestone after a reset and re-climb", () => {
    // 5 in a row (streak-5 @ n5), miss, then 5 more (would hit 5 again but NOT re-awarded).
    const r = computeStreak(nights([...Array(5).fill(true), false, ...Array(5).fill(true)]));
    const fives = r.milestones.filter((m) => m.achievementKey === "streak-5");
    expect(fives).toHaveLength(1);
    expect(fives[0].crossedReportCode).toBe("n5"); // the FIRST time it was reached
  });

  it("treats a late joiner fairly — absences before they existed just bound the run", () => {
    // Absent for the first 39 nights (didn't exist), present for 40-49.
    const presence = [...Array(39).fill(false), ...Array(10).fill(true)];
    const r = computeStreak(nights(presence));
    expect(r.currentStreak).toBe(10); // truthful 10-streak, NOT penalized
    expect(r.milestones.map((m) => m.achievementKey)).toEqual(["streak-5", "streak-10"]);
  });

  it("handles an all-absent history", () => {
    const r = computeStreak(nights([false, false, false]));
    expect(r.currentStreak).toBe(0);
    expect(r.milestones).toEqual([]);
  });
});
