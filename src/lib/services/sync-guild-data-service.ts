import { env } from "@/lib/env.server";
import { WarcraftLogsAdapter } from "@/lib/integrations/warcraftlogs/adapter";
import { WarcraftLogsGuildAdapter } from "@/lib/integrations/warcraftlogs/guild-adapter";
import { attendanceRepository } from "@/lib/repositories/attendance-repository";
import {
  guildCompositionRepository,
  guildRankRepository,
} from "@/lib/repositories/guild-rank-repository";
import {
  autoIngestRepository,
  nightEngineRepository,
  speedRecordRepository,
} from "@/lib/repositories/wcl-repository";
import { autoIngestReports } from "./auto-ingest-service";
import { runNightEngineForNight } from "./run-night-engine-service";
import { runSpeedRecords } from "./run-speed-record-service";
import { syncAttendance } from "./sync-attendance-service";
import { syncGuildComposition } from "./sync-guild-composition-service";
import { syncGuildRank } from "./sync-guild-rank-service";

// How many recent reports to scan for auto-discovery each run. The backlog is a
// one-time cost (new codes only); steady-state is "last night's report".
const REPORT_SCAN_LIMIT = 50;

// One place that orchestrates the guild-level WCL refresh (the zero-ingestion
// feeds: attendance/streaks, zone rankings, composition). Shared by the manual
// officer button AND the cron route so both sync exactly the same things. NONE
// of this needs an ingested report — it reads WCL guild feeds directly.

export type GuildSyncSummary = {
  nights: number;
  raiders: number;
  milestones: number;
  zonesRanked: number;
  compositionMembers: number;
  reportsIngested: number;
  reportsSkipped: number;
};

/** Throws if WCL guild sync isn't configured; surfaces missing env clearly. */
export function assertGuildSyncConfigured(): void {
  if (!env.WCL_CLIENT_ID || !env.WCL_CLIENT_SECRET || !env.WCL_GUILD_ID) {
    throw new Error(
      "Warcraft Logs guild sync is not configured (WCL client id/secret + WCL_GUILD_ID).",
    );
  }
}

export async function syncAllGuildData(now: Date): Promise<GuildSyncSummary> {
  assertGuildSyncConfigured();
  const guild = new WarcraftLogsGuildAdapter({
    clientId: env.WCL_CLIENT_ID!,
    clientSecret: env.WCL_CLIENT_SECRET!,
  });
  const guildId = env.WCL_GUILD_ID!;

  const att = await syncAttendance(guild, attendanceRepository, guildId);
  const rank = await syncGuildRank(guild, guildRankRepository, guildId, now);
  const comp = await syncGuildComposition(guild, guildCompositionRepository, guildId, now);

  // Auto-discover + ingest new 25-man reports (achievements), then run the
  // per-night engine over each affected night and recompute speed records once.
  const reports = new WarcraftLogsAdapter({
    clientId: env.WCL_CLIENT_ID!,
    clientSecret: env.WCL_CLIENT_SECRET!,
  });
  const ingest = await autoIngestReports(
    guild,
    reports,
    autoIngestRepository,
    guildId,
    REPORT_SCAN_LIMIT,
  );
  for (const nightId of ingest.affectedNightIds) {
    await runNightEngineForNight(nightEngineRepository, nightId);
  }
  if (ingest.affectedNightIds.length > 0) {
    await runSpeedRecords(speedRecordRepository);
  }

  return {
    nights: att.nights,
    raiders: att.users,
    milestones: att.milestonesAwarded,
    zonesRanked: rank.zonesRefreshed,
    compositionMembers: comp.members,
    reportsIngested: ingest.ingested,
    reportsSkipped: ingest.skipped,
  };
}
