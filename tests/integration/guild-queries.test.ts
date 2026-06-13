import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { MainRole } from "@/lib/domain/enums";
import { getComposition, getZoneBests } from "@/lib/repositories/guild-queries";
import { db } from "@/lib/db";

// Guild dashboard read models against REAL Postgres. The risk these guard:
//   - getZoneBests RE-IMPLEMENTS the min-clearMs aggregation + is25ManZone
//     filter (it doesn't share the speed-record pass's code). The Kara-exclusion
//     here is the exact bug class we hardened across the achievement engine, so
//     it needs its own regression guard.
//   - getComposition groups the latest-raid lineup by role, gear-sorted.
const PFX = "itest-gq-";

async function cleanup() {
  await db.raidNight.deleteMany({ where: { raidHelperEventId: { startsWith: PFX } } });
  await db.guildZoneRanking.deleteMany({ where: { zoneId: { in: [1056] } } });
  await db.guildComposition.deleteMany({ where: { name: { startsWith: PFX } } });
}

beforeEach(cleanup);
afterEach(cleanup);
afterAll(async () => {
  await db.$disconnect();
});

describe("getZoneBests (live DB)", () => {
  it("takes the fastest report per 25-man zone, ignores 10-man, joins the rank", async () => {
    const night = await db.raidNight.create({
      data: { raidHelperEventId: `${PFX}evt`, title: `${PFX}n`, date: new Date("2026-05-01") },
    });
    // Two SSC reports (170, 155 min) -> best is 155. A faster Karazhan report
    // (30 min) must be ignored (10-man content).
    await db.wclReport.createMany({
      data: [
        { reportCode: `${PFX}r1`, zone: "SSC / TK", clearMs: 170 * 60000, raidNightId: night.id },
        { reportCode: `${PFX}r2`, zone: "SSC / TK", clearMs: 155 * 60000, raidNightId: night.id },
        { reportCode: `${PFX}kara`, zone: "Karazhan", clearMs: 30 * 60000, raidNightId: night.id },
      ],
    });
    await db.guildZoneRanking.create({
      data: {
        zoneId: 1056, zoneName: "SSC / TK",
        speedServerRank: 45, speedRegionRank: 204, speedWorldRank: 363,
        speedColor: "rare", fetchedAt: new Date(),
      },
    });

    const bests = await getZoneBests();
    const ssc = bests.find((b) => b.zoneName === "SSC / TK")!;

    expect(ssc.bestClearMs).toBe(155 * 60000); // faster of the two SSC reports
    expect(ssc.speedServerRank).toBe(45); // rank row joined
    expect(ssc.speedColor).toBe("rare");

    // Karazhan is never its own card, and its time never leaks into a 25-man zone.
    expect(bests.some((b) => b.zoneName === "Karazhan")).toBe(false);
    for (const b of bests) {
      if (b.bestClearMs != null) expect(b.bestClearMs).toBeGreaterThanOrEqual(60 * 60000);
    }

    // Fixed set: every 25-man raid is present even with no clear (shows "—").
    expect(bests.map((b) => b.zoneName).sort()).toEqual(
      ["BT / Hyjal", "Gruul / Magtheridon", "SSC / TK"].sort(),
    );
    const bt = bests.find((b) => b.zoneName === "BT / Hyjal")!;
    expect(bt.bestClearMs).toBeNull();
  });
});

describe("getComposition (live DB)", () => {
  it("groups by role and sorts each role by item level desc", async () => {
    const now = new Date();
    await db.guildComposition.createMany({
      data: [
        { name: `${PFX}Tank1`, role: MainRole.TANK, className: "Warrior", spec: "Protection", maxItemLevel: 127, sourceReportCode: `${PFX}rep`, fetchedAt: now },
        { name: `${PFX}Dps1`, role: MainRole.DPS, className: "Druid", spec: "Feral", maxItemLevel: 120, sourceReportCode: `${PFX}rep`, fetchedAt: now },
        { name: `${PFX}Dps2`, role: MainRole.DPS, className: "Mage", spec: "Fire", maxItemLevel: 131, sourceReportCode: `${PFX}rep`, fetchedAt: now },
        { name: `${PFX}Heal1`, role: MainRole.HEALER, className: "Priest", spec: "Holy", maxItemLevel: 125, sourceReportCode: `${PFX}rep`, fetchedAt: now },
      ],
    });

    const comp = await getComposition();
    const ours = (m: { name: string }) => m.name.startsWith(PFX);
    const tanks = comp.tanks.filter(ours);
    const healers = comp.healers.filter(ours);
    const dps = comp.dps.filter(ours);

    expect(tanks).toHaveLength(1);
    expect(healers).toHaveLength(1);
    expect(dps).toHaveLength(2);
    // DPS sorted by item level desc: Dps2 (131) before Dps1 (120).
    expect(dps.map((d) => d.name)).toEqual([`${PFX}Dps2`, `${PFX}Dps1`]);
    expect(dps[0]).toMatchObject({ className: "Mage", spec: "Fire", maxItemLevel: 131 });
  });
});
