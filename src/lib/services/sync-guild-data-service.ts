import { env } from "@/lib/env.server";
import { WarcraftLogsGuildAdapter } from "@/lib/integrations/warcraftlogs/guild-adapter";
import { attendanceRepository } from "@/lib/repositories/attendance-repository";
import {
  guildCompositionRepository,
  guildRankRepository,
} from "@/lib/repositories/guild-rank-repository";
import { syncAttendance } from "./sync-attendance-service";
import { syncGuildComposition } from "./sync-guild-composition-service";
import { syncGuildRank } from "./sync-guild-rank-service";

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

  return {
    nights: att.nights,
    raiders: att.users,
    milestones: att.milestonesAwarded,
    zonesRanked: rank.zonesRefreshed,
    compositionMembers: comp.members,
  };
}
