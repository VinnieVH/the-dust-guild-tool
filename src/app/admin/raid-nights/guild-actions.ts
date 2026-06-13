"use server";

import { revalidatePath } from "next/cache";
import { Role } from "@/lib/domain/enums";
import { env } from "@/lib/env.server";
import { IntegrationError } from "@/lib/integrations/errors";
import { WarcraftLogsGuildAdapter } from "@/lib/integrations/warcraftlogs/guild-adapter";
import { attendanceRepository } from "@/lib/repositories/attendance-repository";
import {
  guildCompositionRepository,
  guildRankRepository,
} from "@/lib/repositories/guild-rank-repository";
import { syncAttendance } from "@/lib/services/sync-attendance-service";
import { syncGuildComposition } from "@/lib/services/sync-guild-composition-service";
import { syncGuildRank } from "@/lib/services/sync-guild-rank-service";
import { auth } from "@/lib/auth";

export type GuildSyncState = { error?: string; success?: string };

// Officer-triggered guild-level refresh: recomputes attendance streaks from the
// WCL guild attendance history. (Guild zone rankings are refreshed here too —
// see the rank task.) Guild-level data isn't report-derived, so it has its own
// trigger rather than running on each report ingest.
export async function refreshGuildDataAction(
  _prev: GuildSyncState,
): Promise<GuildSyncState> {
  const session = await auth();
  if (session?.user?.role !== Role.OFFICER) return { error: "Officers only." };

  if (!env.WCL_CLIENT_ID || !env.WCL_CLIENT_SECRET || !env.WCL_GUILD_ID) {
    return { error: "Warcraft Logs guild sync is not configured (client id/secret + WCL_GUILD_ID)." };
  }

  const guild = new WarcraftLogsGuildAdapter({
    clientId: env.WCL_CLIENT_ID,
    clientSecret: env.WCL_CLIENT_SECRET,
  });

  try {
    const now = new Date();
    const att = await syncAttendance(guild, attendanceRepository, env.WCL_GUILD_ID);
    const rank = await syncGuildRank(guild, guildRankRepository, env.WCL_GUILD_ID, now);
    const comp = await syncGuildComposition(
      guild,
      guildCompositionRepository,
      env.WCL_GUILD_ID,
      now,
    );
    revalidatePath("/leaderboard");
    revalidatePath("/profile");
    revalidatePath("/guild");
    return {
      success:
        `Refreshed attendance (${att.nights} nights, ${att.users} raiders, ` +
        `${att.milestonesAwarded} milestones), ${rank.zonesRefreshed} zone rankings, ` +
        `and composition (${comp.members} raiders from the latest raid).`,
    };
  } catch (err) {
    const message = err instanceof IntegrationError ? err.message : "Guild refresh failed";
    console.error("[admin/refresh-guild]", err);
    return { error: message };
  }
}
