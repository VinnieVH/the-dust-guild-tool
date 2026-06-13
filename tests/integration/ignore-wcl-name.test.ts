import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { MainRole } from "@/lib/domain/enums";
import {
  countUnmatchedPerformances,
  listUnmatchedPerformances,
} from "@/lib/repositories/wcl-unmatched-queries";
import {
  ignoreWclNameRepository,
  resolvePerformanceRepository,
} from "@/lib/repositories/wcl-repository";
import {
  ignoreAllUnmatchedWclNames,
  ignoreWclName,
} from "@/lib/services/ignore-wcl-name-service";
import { linkPerformanceName } from "@/lib/services/resolve-performance-service";
import { db } from "@/lib/db";

// Dismissing pug names is DISPLAY-ONLY: the unmatched queue + badge hide an
// ignored rawName, but the performance rows stay. Guards: (a) the list AND the
// count both drop (or the badge lies), (b) the ignore survives conceptually
// (keyed on rawName), (c) linking a name later clears its ignore entry.
const PFX = "itest-ign-";

async function seedUnmatched(rawName: string): Promise<void> {
  const night = await db.raidNight.create({
    data: { raidHelperEventId: `${PFX}${rawName}`, title: `${PFX}n`, date: new Date("2026-05-01") },
  });
  const report = await db.wclReport.create({
    data: { reportCode: `${PFX}${rawName}-rep`, zone: "SSC / TK", raidNightId: night.id },
    select: { id: true },
  });
  await db.playerPerformance.create({
    data: {
      wclReportId: report.id, characterId: null, rawName, role: MainRole.DPS,
      parseAvg: 50, dpsOrHps: 1, deaths: 0, interrupts: 0, dispels: 0,
      hadFlask: false, hadFood: false, hadElixir: false, fightsPresent: 1,
    },
  });
}

async function cleanup() {
  const nights = await db.raidNight.findMany({
    where: { raidHelperEventId: { startsWith: PFX } },
    select: { id: true },
  });
  for (const n of nights) await db.raidNight.delete({ where: { id: n.id } });
  await db.ignoredWclName.deleteMany({ where: { rawName: { startsWith: `${PFX}` } } });
  await db.character.deleteMany({ where: { name: { startsWith: PFX } } });
}

beforeEach(cleanup);
afterEach(cleanup);
afterAll(async () => {
  await db.$disconnect();
});

const ours = (n: string) => n.startsWith(PFX);

describe("ignore WCL name (live DB)", () => {
  it("hides a dismissed name from both the list and the count", async () => {
    await seedUnmatched(`${PFX}Pug`);

    const before = await listUnmatchedPerformances();
    expect(before.some((p) => p.rawName === `${PFX}Pug`)).toBe(true);
    const countBefore = await countUnmatchedPerformances();

    await ignoreWclName(ignoreWclNameRepository, `${PFX}Pug`);

    const after = await listUnmatchedPerformances();
    expect(after.some((p) => p.rawName === `${PFX}Pug`)).toBe(false);
    expect(await countUnmatchedPerformances()).toBe(countBefore - 1);

    // Display-only: the performance row is still in the DB (never deleted).
    const stillThere = await db.playerPerformance.count({ where: { rawName: `${PFX}Pug` } });
    expect(stillThere).toBe(1);
  });

  it("dismiss-all clears the whole current backlog", async () => {
    await seedUnmatched(`${PFX}A`);
    await seedUnmatched(`${PFX}B`);
    await seedUnmatched(`${PFX}C`);

    const res = await ignoreAllUnmatchedWclNames(ignoreWclNameRepository);
    expect(res.dismissed).toBeGreaterThanOrEqual(3); // at least our three

    const after = await listUnmatchedPerformances();
    expect(after.filter((p) => ours(p.rawName))).toHaveLength(0);
  });

  it("linking a previously-dismissed name removes it from the ignore list", async () => {
    await seedUnmatched(`${PFX}Returner`);
    await ignoreWclName(ignoreWclNameRepository, `${PFX}Returner`);
    expect((await listUnmatchedPerformances()).some((p) => p.rawName === `${PFX}Returner`)).toBe(false);

    // The pug turns out to be a real raider after all — create + link.
    const char = await db.character.create({
      data: { name: `${PFX}Returner`, class: "Mage", spec: "Fire", mainRole: MainRole.DPS },
    });
    await linkPerformanceName(resolvePerformanceRepository, `${PFX}Returner`, char.id);

    // No longer ignored, and no longer unmatched (now resolved).
    const ignored = await db.ignoredWclName.findUnique({ where: { rawName: `${PFX}Returner` } });
    expect(ignored).toBeNull();
    const perf = await db.playerPerformance.findFirst({ where: { rawName: `${PFX}Returner` } });
    expect(perf?.characterId).toBe(char.id);
  });
});
