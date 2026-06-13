import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { MainRole } from "@/lib/domain/enums";
import type { ExternalReport } from "@/lib/domain/external";
import type { IPerformanceSource } from "@/lib/integrations/interfaces";
import {
  autoIngestRepository,
  nightEngineRepository,
  speedRecordRepository,
  wclSyncRepository,
} from "@/lib/repositories/wcl-repository";
import { wclNightId } from "@/lib/services/auto-ingest-service";
import { runNightEngineForNight } from "@/lib/services/run-night-engine-service";
import { runSpeedRecords } from "@/lib/services/run-speed-record-service";
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
  // A 9-of-10 night: 2 DPS, 1 healer, 1 tank, all present all 9 fights. Short of
  // a clean sweep (SSC/TK = 10 bosses) so clean-sweep stays off in this test.
  const base = {
    deaths: 0, interrupts: 0, dispels: 0,
    hadFlask: true, hadFood: true, hadElixir: true, fightsPresent: 9,
  };
  return {
    reportCode: CODE,
    zone: "SSC / TK",
    totalBossFights: 9, // SSC/TK is 10 bosses -> 9 is a partial (no clean sweep)
    clearMs: 3_600_000,
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

// The multi-zone test synthesizes a night via resolveNightForDate, keyed
// `wcl:<date>` (NOT prefixed) — a far-future date so it can't collide with real
// or other-test data. Cleanup must remove it by that exact key.
const MULTI_DATE = "2099-03-14";
const MULTI_NIGHT_ID = wclNightId(MULTI_DATE);

async function cleanup() {
  const nights = await db.raidNight.findMany({
    where: {
      OR: [
        { raidHelperEventId: { startsWith: PFX } },
        { raidHelperEventId: MULTI_NIGHT_ID },
      ],
    },
    select: { id: true },
  });
  for (const n of nights) await db.raidNight.delete({ where: { id: n.id } });
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
    // Clean sweep: SSC/TK is 10 bosses, we logged 9 => NOT a sweep.
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

  it("awards NOTHING for a 10-man (Karazhan) night — engine filters its source", async () => {
    // Insert a Karazhan report + matched performances DIRECTLY (the ingest guard
    // would reject Kara, so we simulate pre-guard data already in the DB). The
    // per-night engine must score zero 25-man performances -> zero awards.
    const { nightId, chars } = await seed();
    const kara = await db.wclReport.create({
      data: {
        reportCode: `${PFX}kara`,
        zone: "Karazhan",
        clearMs: 1_800_000,
        raidNightId: nightId,
        performances: {
          create: [
            { characterId: chars[`${PFX}Topdps`], rawName: `${PFX}Topdps`, role: MainRole.DPS,
              parseAvg: 99, dpsOrHps: 3000, deaths: 0, interrupts: 5, dispels: 0,
              hadFlask: true, hadFood: true, hadElixir: true, fightsPresent: 11 },
            { characterId: chars[`${PFX}Healer`], rawName: `${PFX}Healer`, role: MainRole.HEALER,
              parseAvg: 95, dpsOrHps: 0, deaths: 0, interrupts: 0, dispels: 9,
              hadFlask: true, hadFood: true, hadElixir: true, fightsPresent: 11 },
          ],
        },
      },
      select: { id: true },
    });
    void kara;

    const result = await runNightEngineForNight(nightEngineRepository, nightId);
    expect(result.scored).toBe(0); // no 25-man performances to score
    expect(result.awards).toBe(0);
    const awardCount = await db.achievementAward.count({ where: { raidNightId: nightId } });
    expect(awardCount).toBe(0);
  });

  it("scores only the 25-man report on a MIXED-zone night (SSC + Karazhan)", async () => {
    // Same night has both an SSC report and a Kara report. The engine must score
    // the SSC performances (awards exist) but ignore the Kara ones entirely.
    const { nightId, chars } = await seed();
    await syncWclReport(new FakeSource(report()), wclSyncRepository, nightId, CODE); // SSC
    await db.wclReport.create({
      data: {
        reportCode: `${PFX}kara2`,
        zone: "Karazhan",
        clearMs: 1_800_000,
        raidNightId: nightId,
        performances: {
          create: [
            // A Kara-only character who would win "deadliest" if Kara counted.
            { characterId: chars[`${PFX}Lowdps`], rawName: `${PFX}Lowdps`, role: MainRole.DPS,
              parseAvg: 100, dpsOrHps: 9999, deaths: 0, interrupts: 0, dispels: 0,
              hadFlask: true, hadFood: true, hadElixir: true, fightsPresent: 11 },
          ],
        },
      },
    });

    await runNightEngineForNight(nightEngineRepository, nightId);

    // Deadliest goes to the SSC top parser (Topdps@95), NOT the Kara 100-parse Lowdps.
    const deadliest = await db.achievementAward.findFirst({
      where: { raidNightId: nightId, achievement: { key: "deadliest" } },
      select: { characterId: true },
    });
    expect(deadliest?.characterId).toBe(chars[`${PFX}Topdps`]);
    expect(deadliest?.characterId).not.toBe(chars[`${PFX}Lowdps`]);
  });
});

describe("speed-record pass (live DB)", () => {
  // Seed a second SSC/TK night and ingest a report with a chosen clear time.
  async function seedNightWithClear(suffix: string, date: string, clearMs: number, charId: string) {
    const night = await db.raidNight.create({
      data: { raidHelperEventId: `${PFX}evt-${suffix}`, title: `${PFX}night-${suffix}`, date: new Date(date) },
    });
    const rep: ExternalReport = { ...report(), reportCode: `${PFX}rep-${suffix}`, clearMs,
      totalBossFights: 10, // a FULL SSC/TK clear (10 bosses) — only full clears set a record
      performances: [report().performances[0]] }; // one performer is enough
    // Point that single performer at the shared character so it resolves.
    rep.performances = [{ ...rep.performances[0], name: `${PFX}Topdps` }];
    await syncWclReport(new FakeSource(rep), wclSyncRepository, night.id, rep.reportCode);
    void charId;
    return night.id;
  }

  it("awards new-speed-record only to faster-than-prior nights, and moves it on a faster re-clear", async () => {
    const { chars } = await seed(); // creates the base night + characters
    const top = chars[`${PFX}Topdps`];

    // Night A (earlier, 60 min) and Night B (later, 70 min — slower).
    const nightA = await seedNightWithClear("A", "2026-05-01T18:00:00Z", 60 * 60000, top);
    const nightB = await seedNightWithClear("B", "2026-05-08T18:00:00Z", 70 * 60000, top);

    await runSpeedRecords(speedRecordRepository);

    const recordNightsAfter = async () =>
      (await db.achievementAward.findMany({
        where: { achievement: { key: "new-speed-record" } },
        select: { raidNightId: true },
      })).map((r) => r.raidNightId);

    // Only Night A is a record (B was slower).
    let records = await recordNightsAfter();
    expect(records).toContain(nightA);
    expect(records).not.toContain(nightB);

    // A later, FASTER night C (50 min) becomes a new record.
    const nightC = await seedNightWithClear("C", "2026-05-15T18:00:00Z", 50 * 60000, top);
    await runSpeedRecords(speedRecordRepository);
    records = await recordNightsAfter();
    expect(records).toContain(nightA); // kept forever (was a record when it happened)
    expect(records).toContain(nightC);
    expect(records).not.toContain(nightB);
  });
});

describe("multi-zone synthesized night (live DB)", () => {
  // Gap the advisor flagged: one Brussels day with TWO full clears of DIFFERENT
  // 25-man zones (SSC + Gruul), both auto-ingested onto the SAME `wcl:<date>`
  // night via resolveNightForDate. Two distinct risks, tested separately so
  // neither depends on the global speed-record ladder (which a running dev
  // server may be repopulating — these tables aren't PFX-scopable).
  function clear(suffix: string, zone: string, bosses: number, clearMs: number): ExternalReport {
    const base = {
      deaths: 0, interrupts: 0, dispels: 0,
      hadFlask: true, hadFood: true, hadElixir: true, fightsPresent: bosses,
    };
    return {
      reportCode: `${PFX}mz-${suffix}`,
      zone,
      totalBossFights: bosses, // a FULL clear of that zone
      clearMs,
      performances: [
        { name: `${PFX}Topdps`, role: MainRole.DPS, parseAvg: 95, dpsOrHps: 2000, ...base },
        { name: `${PFX}Tank`, role: MainRole.TANK, parseAvg: 80, dpsOrHps: 500, ...base },
      ],
    };
  }

  it("resolves both reports to ONE night and the engine pools them into one crown", async () => {
    const { chars } = await seed(); // creates characters (incl. Topdps/Tank)

    // Both reports land on the same Brussels date -> same synthesized night.
    const isoForTitle = new Date(`${MULTI_DATE}T19:00:00Z`);
    const sscNight = await autoIngestRepository.resolveNightForDate(MULTI_DATE, isoForTitle);
    const gmNight = await autoIngestRepository.resolveNightForDate(MULTI_DATE, isoForTitle);
    expect(sscNight).toBe(gmNight); // deterministic: same id for both reports

    // SSC/TK full clear (10 bosses) + Gruul/Mag full clear (3 bosses), same night.
    await syncWclReport(new FakeSource(clear("ssc", "SSC / TK", 10, 160 * 60000)), autoIngestRepository, sscNight, `${PFX}mz-ssc`);
    await syncWclReport(new FakeSource(clear("gm", "Gruul / Magtheridon", 3, 40 * 60000)), autoIngestRepository, gmNight, `${PFX}mz-gm`);

    await runNightEngineForNight(nightEngineRepository, sscNight);

    // Performances from BOTH reports are pooled, so the night yields exactly ONE
    // deadliest crown (to the top parser) — not one per report/zone.
    const deadliest = await db.achievementAward.findMany({
      where: { raidNightId: sscNight, achievement: { key: "deadliest" } },
      select: { characterId: true },
    });
    expect(deadliest).toHaveLength(1);
    expect(deadliest[0].characterId).toBe(chars[`${PFX}Topdps`]);
  });

  it("speed-record write de-dups two zone-records on one night (no unique-key crash)", async () => {
    // A night that sets a record in BOTH zones makes computeSpeedRecords emit two
    // awards with the SAME raidNightId and overlapping present characters. Without
    // de-dup, replaceSpeedRecordAwards inserts duplicate (achievement, char,
    // night) rows -> unique-key violation -> the whole sync crashes. Drive that
    // exact shape through the repository directly (independent of the global
    // ladder) and assert: no throw + one award per character.
    const { chars } = await seed();
    const isoForTitle = new Date(`${MULTI_DATE}T19:00:00Z`);
    const night = await autoIngestRepository.resolveNightForDate(MULTI_DATE, isoForTitle);
    const achId = await speedRecordRepository.getSpeedRecordAchievementId();
    expect(achId).not.toBeNull();

    const top = chars[`${PFX}Topdps`];
    const tank = chars[`${PFX}Tank`];
    // Two awards (one per zone-record) sharing the night, overlapping characters.
    await speedRecordRepository.replaceSpeedRecordAwards(achId!, [
      { raidNightId: night, characterIds: [top, tank] },
      { raidNightId: night, characterIds: [top, tank] },
    ]);

    const records = await db.achievementAward.findMany({
      where: { raidNightId: night, achievement: { key: "new-speed-record" } },
      select: { characterId: true },
    });
    expect(records.map((r) => r.characterId).sort()).toEqual([top, tank].sort());
  });
});
