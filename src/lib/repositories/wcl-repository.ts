import type { ReportPerformance } from "@/lib/domain/night-score";
import { MainRole } from "@/lib/domain/enums";
import { is25ManZone, zoneBossCount } from "@/lib/domain/wow";
import {
  brusselsDate,
  wclNightId,
  type AutoIngestStore,
} from "@/lib/services/auto-ingest-service";
import type { IgnoreWclNameStore } from "@/lib/services/ignore-wcl-name-service";
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

  async upsertReport({ raidNightId, reportCode, zone, clearMs, bossKills }) {
    const report = await db.wclReport.upsert({
      where: { reportCode },
      update: { zone, raidNightId, clearMs, bossKills },
      create: { reportCode, zone, raidNightId, clearMs, bossKills },
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
    // If this name was previously dismissed as a pug, linking it overrides that.
    await db.ignoredWclName.deleteMany({ where: { rawName } });
    return [...new Set(affected.map((p) => p.wclReport.raidNightId))];
  },
};

export const ignoreWclNameRepository: IgnoreWclNameStore = {
  async ignoreName(rawName) {
    await db.ignoredWclName.upsert({
      where: { rawName },
      update: {},
      create: { rawName },
    });
  },

  async listUnmatchedNotIgnored() {
    const [perfs, ignored] = await Promise.all([
      db.playerPerformance.findMany({
        where: { characterId: null },
        select: { rawName: true },
        distinct: ["rawName"],
      }),
      db.ignoredWclName.findMany({ select: { rawName: true } }),
    ]);
    const seen = new Set(ignored.map((r) => r.rawName));
    return perfs.map((p) => p.rawName).filter((n) => !seen.has(n));
  },

  async ignoreNames(rawNames) {
    await db.ignoredWclName.createMany({
      data: rawNames.map((rawName) => ({ rawName })),
      skipDuplicates: true,
    });
  },

  async unignoreName(rawName) {
    await db.ignoredWclName.deleteMany({ where: { rawName } });
  },
};

export const speedRecordRepository: SpeedRecordStore = {
  async getZoneNights() {
    const reports = await db.wclReport.findMany({
      select: {
        raidNightId: true,
        zone: true,
        clearMs: true,
        bossKills: true,
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
      // Only a FULL clear (every boss killed) sets a speed record — a fast
      // partial must not. With auto-ingest, partial logs reach here too.
      const fullClear =
        r.bossKills != null && r.bossKills >= (zoneBossCount(r.zone) ?? Infinity);
      if (fullClear && r.clearMs != null && r.clearMs > 0) {
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
    // De-dup by (character, night): one night can set records in TWO zones at
    // once (e.g. a single evening full-clearing both Gruul/Mag and SSC), which
    // computeSpeedRecords emits as two awards sharing a raidNightId with
    // overlapping present characters. The award is "you were there when a record
    // fell" — earned once per night regardless of how many zones fell — and the
    // (achievement, character, night) unique key would otherwise reject the
    // duplicate row and crash the whole sync.
    const seen = new Set<string>();
    const rows: Array<{ achievementId: string; characterId: string; raidNightId: string }> = [];
    for (const a of awards) {
      for (const characterId of a.characterIds) {
        const key = `${characterId}::${a.raidNightId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({ achievementId, characterId, raidNightId: a.raidNightId });
      }
    }
    await db.$transaction([
      // Owns this key across ALL nights: full delete + re-insert so a night that
      // is no longer a record (re-ingested slower) loses the award.
      db.achievementAward.deleteMany({ where: { achievementId } }),
      db.achievementAward.createMany({ data: rows }),
    ]);
  },
};

// Auto-ingest: reuses wclSyncRepository's report/performance methods, plus the
// two auto-discovery-specific ones.
export const autoIngestRepository: AutoIngestStore = {
  ...wclSyncRepository,

  async listIngestedReportCodes() {
    const rows = await db.wclReport.findMany({ select: { reportCode: true } });
    return new Set(rows.map((r) => r.reportCode));
  },

  async resolveNightForDate(date, isoForTitle) {
    // 1) An existing Raid-Helper night on that Brussels date (one event/day).
    //    Scan a ±1-day UTC window (a Brussels day spans <26h of UTC) and match
    //    by computed Brussels date — cheap given how few nights exist.
    const dayMs = 24 * 60 * 60 * 1000;
    const around = new Date(isoForTitle.getTime());
    const candidates = await db.raidNight.findMany({
      where: {
        date: { gte: new Date(around.getTime() - dayMs), lte: new Date(around.getTime() + dayMs) },
        NOT: { raidHelperEventId: { startsWith: "wcl:" } },
      },
      select: { id: true, date: true },
    });
    const match = candidates.find((n) => brusselsDate(n.date) === date);
    if (match) return match.id;

    // 2) Otherwise upsert the synthesized night, keyed deterministically by
    //    `wcl:<date>` so re-runs hit the same row (no duplicate nights).
    const night = await db.raidNight.upsert({
      where: { raidHelperEventId: wclNightId(date) },
      update: {},
      create: {
        raidHelperEventId: wclNightId(date),
        title: `Raid — ${date}`,
        date: isoForTitle,
      },
      select: { id: true },
    });
    return night.id;
  },
};
