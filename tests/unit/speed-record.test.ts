import { describe, expect, it } from "vitest";
import { computeSpeedRecords, type ZoneNight } from "@/lib/services/speed-record";

function night(over: Partial<ZoneNight> = {}): ZoneNight {
  return {
    raidNightId: "n",
    date: new Date("2026-01-01"),
    zone: "SSC / TK",
    clearMs: 60 * 60 * 1000,
    presentCharacterIds: ["a"],
    ...over,
  };
}

describe("computeSpeedRecords", () => {
  it("awards the first night, and only faster subsequent nights", () => {
    const awards = computeSpeedRecords([
      night({ raidNightId: "n1", date: new Date("2026-01-01"), clearMs: 60 * 60000 }),
      night({ raidNightId: "n2", date: new Date("2026-01-08"), clearMs: 70 * 60000 }), // slower
      night({ raidNightId: "n3", date: new Date("2026-01-15"), clearMs: 50 * 60000 }), // faster → record
    ]);
    expect(awards.map((a) => a.raidNightId)).toEqual(["n1", "n3"]);
  });

  it("is correct under OUT-OF-ORDER ingest (the bug we designed against)", () => {
    // The faster, EARLIER night arrives second in the input array. Result must
    // be the same as if ingested in date order: only n1 (Jan 1, 50min) is the
    // record; n2 (Jan 8, 60min) was never actually a record.
    const inOrder = computeSpeedRecords([
      night({ raidNightId: "n1", date: new Date("2026-01-01"), clearMs: 50 * 60000 }),
      night({ raidNightId: "n2", date: new Date("2026-01-08"), clearMs: 60 * 60000 }),
    ]);
    const outOfOrder = computeSpeedRecords([
      night({ raidNightId: "n2", date: new Date("2026-01-08"), clearMs: 60 * 60000 }),
      night({ raidNightId: "n1", date: new Date("2026-01-01"), clearMs: 50 * 60000 }),
    ]);
    expect(inOrder.map((a) => a.raidNightId)).toEqual(["n1"]);
    expect(outOfOrder.map((a) => a.raidNightId)).toEqual(["n1"]);
  });

  it("tracks records per zone independently", () => {
    const awards = computeSpeedRecords([
      night({ raidNightId: "ssc1", zone: "SSC / TK", date: new Date("2026-01-01"), clearMs: 60 * 60000 }),
      night({ raidNightId: "gm1", zone: "Gruul / Magtheridon", date: new Date("2026-01-02"), clearMs: 90 * 60000 }),
    ]);
    // Each (25-man) zone's first night is its own record.
    expect(awards.map((a) => a.raidNightId).sort()).toEqual(["gm1", "ssc1"]);
  });

  it("excludes 10-man content (Karazhan) — never a guild speed record", () => {
    const awards = computeSpeedRecords([
      night({ raidNightId: "ssc1", zone: "SSC / TK", date: new Date("2026-01-01"), clearMs: 60 * 60000 }),
      night({ raidNightId: "kara1", zone: "Karazhan", date: new Date("2026-01-02"), clearMs: 30 * 60000 }),
    ]);
    // Kara is filtered out entirely, even though its time is faster.
    expect(awards.map((a) => a.raidNightId)).toEqual(["ssc1"]);
  });

  it("awards every character present on a record night", () => {
    const awards = computeSpeedRecords([
      night({ raidNightId: "n1", presentCharacterIds: ["a", "b", "c"] }),
    ]);
    expect(awards[0].characterIds).toEqual(["a", "b", "c"]);
  });

  it("skips nights with no clear time (can't set a record)", () => {
    const awards = computeSpeedRecords([
      night({ raidNightId: "n1", date: new Date("2026-01-01"), clearMs: null }),
      night({ raidNightId: "n2", date: new Date("2026-01-08"), clearMs: 60 * 60000 }),
    ]);
    expect(awards.map((a) => a.raidNightId)).toEqual(["n2"]);
  });
});
