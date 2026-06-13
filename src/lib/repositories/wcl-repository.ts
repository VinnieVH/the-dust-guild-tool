import type { ReportPerformance } from "@/lib/domain/night-score";
import { MainRole } from "@/lib/domain/enums";
import { zoneBossCount } from "@/lib/domain/wow";
import type { ResolvePerformanceStore } from "@/lib/services/resolve-performance-service";
import type { NightEngineStore } from "@/lib/services/run-night-engine-service";
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

  async upsertReport({ raidNightId, reportCode, zone }) {
    const report = await db.wclReport.upsert({
      where: { reportCode },
      update: { zone, raidNightId },
      create: { reportCode, zone, raidNightId },
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

    const performances: ReportPerformance[] = [];
    const reportBossFights: number[] = [];
    // Distinct zones in the night; clean-sweep needs the encounter total. A
    // night is usually one zone — use the max known boss count across its zones.
    let zoneEncounterCount: number | null = null;

    for (const report of reports) {
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
