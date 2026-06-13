import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { MainRole } from "@/lib/domain/enums";
import type { ExternalReport } from "@/lib/domain/external";
import type { IPerformanceSource } from "@/lib/integrations/interfaces";
import {
  nightEngineRepository,
  wclSyncRepository,
} from "@/lib/repositories/wcl-repository";
import { runNightEngineForNight } from "@/lib/services/run-night-engine-service";
import { syncWclReport } from "@/lib/services/sync-wcl-service";
import { db } from "@/lib/db";

// Step 4.2 acceptance against REAL Postgres: ingest a report -> engine awards ->
// re-ingest is idempotent AND the per-night delete does NOT clobber a
// new-speed-record award (the bug we designed the scoped delete against).
const PFX = "itest-wcl-";
const CODE = `${PFX}report1`;

class FakeSource implements IPerformanceSource {
  constructor(private report: ExternalReport) {}
  async fetchReport() {
    return this.report;
  }
}

function report(): ExternalReport {
  // A small clean clear: 2 DPS, 1 healer, 1 tank, all present all 10 fights.
  const base = {
    deaths: 0, interrupts: 0, dispels: 0,
    hadFlask: true, hadFood: true, hadElixir: true, fightsPresent: 10,
  };
  return {
    reportCode: CODE,
    zone: "SSC / TK",
    totalBossFights: 10,
    performances: [
      { name: `${PFX}Topdps`, role: MainRole.DPS, parseAvg: 95, dpsOrHps: 2000, ...base, interrupts: 3 },
      { name: `${PFX}Lowdps`, role: MainRole.DPS, parseAvg: 60, dpsOrHps: 1000, ...base },
      { name: `${PFX}Healer`, role: MainRole.HEALER, parseAvg: 88, dpsOrHps: 0, ...base, dispels: 4 },
      { name: `${PFX}Tank`, role: MainRole.TANK, parseAvg: 80, dpsOrHps: 500, ...base },
    ],
  };
}

async function seed() {
  const night = await db.raidNight.create({
    data: { raidHelperEventId: `${PFX}evt`, title: `${PFX}night`, date: new Date("2026-06-12T18:00:00Z") },
  });
  // Claim every performer so they resolve (matched).
  const names = [`${PFX}Topdps`, `${PFX}Lowdps`, `${PFX}Healer`, `${PFX}Tank`];
  const specs: Record<string, MainRole> = {
    [`${PFX}Topdps`]: MainRole.DPS, [`${PFX}Lowdps`]: MainRole.DPS,
    [`${PFX}Healer`]: MainRole.HEALER, [`${PFX}Tank`]: MainRole.TANK,
  };
  const chars: Record<string, string> = {};
  for (const name of names) {
    const c = await db.character.create({
      data: { name, class: "Warrior", spec: "Arms", mainRole: specs[name] },
    });
    chars[name] = c.id;
  }
  return { nightId: night.id, chars };
}

async function cleanup() {
  const night = await db.raidNight.findUnique({ where: { raidHelperEventId: `${PFX}evt` }, select: { id: true } });
  if (night) await db.raidNight.delete({ where: { id: night.id } });
  await db.character.deleteMany({ where: { name: { startsWith: PFX } } });
}

beforeEach(cleanup);
afterEach(cleanup);
afterAll(async () => {
  await db.$disconnect();
});

async function awardKeys(nightId: string): Promise<string[]> {
  const rows = await db.achievementAward.findMany({
    where: { raidNightId: nightId },
    select: { achievement: { select: { key: true } }, characterId: true },
  });
  return rows.map((r) => `${r.achievement.key}:${r.characterId}`).sort();
}

describe("WCL ingestion -> engine (live DB)", () => {
  it("ingests, resolves, and awards the expected achievements", async () => {
    const { nightId, chars } = await seed();
    const sync = await syncWclReport(new FakeSource(report()), wclSyncRepository, nightId, CODE);
    expect(sync.matched).toBe(4);
    expect(sync.unmatched).toBe(0);

    await runNightEngineForNight(nightEngineRepository, nightId);
    const keys = await awardKeys(nightId);

    // Per-role crowns to the right people.
    expect(keys).toContain(`deadliest:${chars[`${PFX}Topdps`]}`);
    expect(keys).toContain(`lifebinder:${chars[`${PFX}Healer`]}`);
    expect(keys).toContain(`immovable-object:${chars[`${PFX}Tank`]}`);
    // Utility.
    expect(keys).toContain(`kick-commander:${chars[`${PFX}Topdps`]}`);
    expect(keys).toContain(`cleanse-crusader:${chars[`${PFX}Healer`]}`);
    // Clean sweep (10/11? — SSC/TK is 11 bosses, we logged 10 => NOT a sweep).
    expect(keys.some((k) => k.startsWith("clean-sweep:"))).toBe(false);
    // Iron man: everyone (no deaths), all eligible.
    expect(keys.filter((k) => k.startsWith("iron-man:"))).toHaveLength(4);
  });

  it("is idempotent on re-ingest", async () => {
    const { nightId } = await seed();
    await syncWclReport(new FakeSource(report()), wclSyncRepository, nightId, CODE);
    await runNightEngineForNight(nightEngineRepository, nightId);
    const first = await awardKeys(nightId);

    // Re-ingest the same report + re-run.
    await syncWclReport(new FakeSource(report()), wclSyncRepository, nightId, CODE);
    await runNightEngineForNight(nightEngineRepository, nightId);
    const second = await awardKeys(nightId);

    expect(second).toEqual(first);
    // Performances weren't duplicated.
    const perfCount = await db.playerPerformance.count({
      where: { wclReport: { raidNightId: nightId } },
    });
    expect(perfCount).toBe(4);
  });

  it("does NOT clobber a new-speed-record award on re-ingest (scoped delete)", async () => {
    const { nightId, chars } = await seed();
    await syncWclReport(new FakeSource(report()), wclSyncRepository, nightId, CODE);
    await runNightEngineForNight(nightEngineRepository, nightId);

    // Simulate the speed-record pass having awarded new-speed-record this night.
    const speedRec = await db.achievement.findUnique({ where: { key: "new-speed-record" }, select: { id: true } });
    await db.achievementAward.create({
      data: { achievementId: speedRec!.id, characterId: chars[`${PFX}Topdps`], raidNightId: nightId },
    });

    // Re-ingest + re-run the per-night engine. Its SCOPED delete must leave the
    // speed-record award intact (it can't regenerate it).
    await syncWclReport(new FakeSource(report()), wclSyncRepository, nightId, CODE);
    await runNightEngineForNight(nightEngineRepository, nightId);

    const survived = await db.achievementAward.findFirst({
      where: { raidNightId: nightId, achievement: { key: "new-speed-record" } },
    });
    expect(survived).not.toBeNull();
  });
});
