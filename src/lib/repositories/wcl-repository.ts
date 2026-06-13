import type { ReportPerformance } from "@/lib/domain/night-score";
import { MainRole } from "@/lib/domain/enums";
import { is25ManZone, zoneBossCount } from "@/lib/domain/wow";
import type { ResolvePerformanceStore } from "@/lib/services/resolve-performance-service";
import type { NightEngineStore } from "@/lib/services/run-night-engine-service";
import type { SpeedRecordStore } from "@/lib/services/run-speed-record-service";
import type { WclSyncStore } from "@/lib/services/sync-wcl-service";
import { db } from "@/lib/db";

// Thin Prisma wrapper backing WCL ingestion + the per-night achievement engine.
// The only place WCL report / performance / award persistence happens.

export const wclSyncRepository: WclSyncStore = {
  async findCharacterIdByNameOrAlias(name) {
    const direct = await db.character.findUnique({
      where: { name },
      select: { id: true },
    });
    if (direct) return direct.id;
    const alias = await db.characterAlias.findUnique({
      where: { alias: name },
      select: { characterId: true },
    });
    return alias?.characterId ?? null;
  },

  async upsertReport({ raidNightId, reportCode, zone, clearMs }) {
    const report = await db.wclReport.upsert({
      where: { reportCode },
      update: { zone, raidNightId, clearMs },
      create: { reportCode, zone, raidNightId, clearMs },
      select: { id: true },
    });
    return { wclReportId: report.id };
  },

  async deleteReport(reportId) {
    await db.wclReport.delete({ where: { id: reportId } });
  },

  async replacePerformances(wclReportId, rows) {
    // Re-ingest semantics: drop the report's old rows, insert the fresh set.
    await db.$transaction([
      db.playerPerformance.deleteMany({ where: { wclReportId } }),
      db.playerPerformance.createMany({
        data: rows.map((r) => ({ wclReportId, ...r })),
      }),
    ]);
  },
};

export const nightEngineRepository: NightEngineStore = {
  async getNightPerformances(raidNightId) {
    const reports = await db.wclReport.findMany({
      where: { raidNightId },
      select: {
        zone: true,
        performances: {
          // Only MATCHED rows can win awards; unmatched (characterId null) sit
          // in the queue until resolved.
          where: { characterId: { not: null } },
          select: {
            characterId: true,
            rawName: true,
            role: true,
            parseAvg: true,
            dpsOrHps: true,
            deaths: true,
            interrupts: true,
            dispels: true,
            hadFlask: true,
            hadFood: true,
            hadElixir: true,
            fightsPresent: true,
          },
        },
      },
    });

    // 25-man only: a night may mix zones (e.g. an SSC report + a Karazhan
    // report). Drop the 10-man reports per-REPORT (not per-night), so the
    // night's 25-man performances still score and a mixed night isn't wasted.
    // This filters generator #1 (the per-night engine) at its data source,
    // matching the speed-record + attendance filters — every per-night
    // achievement (crowns, iron-man, clean-sweep, well-oiled) is now 25-man.
    // Filtering here also keeps reportBossFights/zoneEncounterCount correct,
    // since they're derived inside the loop over the remaining reports.
    const raid25Reports = reports.filter((r) => is25ManZone(r.zone));

    const performances: ReportPerformance[] = [];
    const reportBossFights: number[] = [];
    // Distinct zones in the night; clean-sweep needs the encounter total. A
    // night is usually one zone — use the max known boss count across its zones.
    let zoneEncounterCount: number | null = null;

    for (const report of raid25Reports) {
      // Boss fights of this report = distinct performances aren't a count; we
      // store fightsPresent per player, not the report's boss total. The report
      // boss total is the max fightsPresent across its players (everyone present
      // for the whole report saw every boss). Good enough as the weight base.
      const maxFights = report.performances.reduce(
        (m, p) => Math.max(m, p.fightsPresent),
        0,
      );
      reportBossFights.push(maxFights);

      const zc = zoneBossCount(report.zone);
      if (zc != null) zoneEncounterCount = Math.max(zoneEncounterCount ?? 0, zc);

      for (const p of report.performances) {
        performances.push({
          characterId: p.characterId!,
          characterName: p.rawName,
          role: p.role as MainRole,
          parseAvg: p.parseAvg,
          deaths: p.deaths,
          interrupts: p.interrupts,
          dispels: p.dispels,
          hadFlask: p.hadFlask,
          hadFood: p.hadFood,
          hadElixir: p.hadElixir,
          fightsPresent: p.fightsPresent,
          reportBossFights: maxFights,
        });
      }
    }

    return { performances, reportBossFights, zoneEncounterCount };
  },

  async resolveAchievementIds(keys) {
    const rows = await db.achievement.findMany({
      where: { key: { in: keys } },
      select: { id: true, key: true },
    });
    return new Map(rows.map((r) => [r.key, r.id]));
  },

  async replaceNightAwards(raidNightId, ownedAchievementIds, awards) {
    await db.$transaction([
      // SCOPED delete: only this engine's achievements for this night. Never
      // touches new-speed-record or streak milestones (different owners).
      db.achievementAward.deleteMany({
        where: { raidNightId, achievementId: { in: ownedAchievementIds } },
      }),
      db.achievementAward.createMany({
        data: awards.map((a) => ({ ...a, raidNightId })),
      }),
    ]);
  },
};

export const resolvePerformanceRepository: ResolvePerformanceStore = {
  async getCharacterName(characterId) {
    const c = await db.character.findUnique({
      where: { id: characterId },
      select: { name: true },
    });
    return c?.name ?? null;
  },

  async ensureAlias(characterId, alias) {
    await db.characterAlias.upsert({
      where: { alias },
      update: {},
      create: { characterId, alias },
    });
  },

  async backfillPerformances(rawName, characterId) {
    // Which nights have unmatched rows for this name? (Capture before update.)
    const affected = await db.playerPerformance.findMany({
      where: { rawName, characterId: null },
      select: { wclReport: { select: { raidNightId: true } } },
    });
    await db.playerPerformance.updateMany({
      where: { rawName, characterId: null },
      data: { characterId },
    });
    return [...new Set(affected.map((p) => p.wclReport.raidNightId))];
  },
};

export const speedRecordRepository: SpeedRecordStore = {
  async getZoneNights() {
    const reports = await db.wclReport.findMany({
      select: {
        raidNightId: true,
        zone: true,
        clearMs: true,
        raidNight: { select: { date: true } },
        performances: {
          where: { characterId: { not: null } },
          select: { characterId: true },
        },
      },
    });

    // Aggregate by (raidNight, zone): a night's clear for a zone = the fastest
    // report's time; present = distinct matched characters across its reports.
    const byKey = new Map<
      string,
      {
        raidNightId: string;
        zone: string;
        date: Date;
        clearMs: number | null;
        present: Set<string>;
      }
    >();
    for (const r of reports) {
      const key = `${r.raidNightId}::${r.zone}`;
      let entry = byKey.get(key);
      if (!entry) {
        entry = {
          raidNightId: r.raidNightId,
          zone: r.zone,
          date: r.raidNight.date,
          clearMs: null,
          present: new Set(),
        };
        byKey.set(key, entry);
      }
      if (r.clearMs != null && r.clearMs > 0) {
        entry.clearMs =
          entry.clearMs == null ? r.clearMs : Math.min(entry.clearMs, r.clearMs);
      }
      for (const p of r.performances) if (p.characterId) entry.present.add(p.characterId);
    }

    return [...byKey.values()].map((e) => ({
      raidNightId: e.raidNightId,
      date: e.date,
      zone: e.zone,
      clearMs: e.clearMs,
      presentCharacterIds: [...e.present],
    }));
  },

  async getSpeedRecordAchievementId() {
    const a = await db.achievement.findUnique({
      where: { key: "new-speed-record" },
      select: { id: true },
    });
    return a?.id ?? null;
  },

  async replaceSpeedRecordAwards(achievementId, awards) {
    await db.$transaction([
      // Owns this key across ALL nights: full delete + re-insert so a night that
      // is no longer a record (re-ingested slower) loses the award.
      db.achievementAward.deleteMany({ where: { achievementId } }),
      db.achievementAward.createMany({
        data: awards.flatMap((a) =>
          a.characterIds.map((characterId) => ({
            achievementId,
            characterId,
            raidNightId: a.raidNightId,
          })),
        ),
      }),
    ]);
  },
};
