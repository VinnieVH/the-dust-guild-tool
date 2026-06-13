"use server";

import { revalidatePath } from "next/cache";
import { Role } from "@/lib/domain/enums";
import { IntegrationError } from "@/lib/integrations/errors";
import { syncAllGuildData } from "@/lib/services/sync-guild-data-service";
import { auth } from "@/lib/auth";

export type GuildSyncState = { error?: string; success?: string };

// Officer "refresh now" button. The data also refreshes automatically on a cron
// (see /api/cron/sync-guild) — this is just the manual trigger for when an
// officer wants it instant. Both go through the same syncAllGuildData.
export async function refreshGuildDataAction(
  _prev: GuildSyncState,
): Promise<GuildSyncState> {
  const session = await auth();
  if (session?.user?.role !== Role.OFFICER) return { error: "Officers only." };

  try {
    const r = await syncAllGuildData(new Date());
    revalidatePath("/leaderboard");
    revalidatePath("/profile");
    revalidatePath("/guild");
    return {
      success:
        `Refreshed attendance (${r.nights} nights, ${r.raiders} raiders, ` +
        `${r.milestones} milestones), ${r.zonesRanked} zone rankings, ` +
        `composition (${r.compositionMembers} raiders), and ingested ` +
        `${r.reportsIngested} new report(s).`,
    };
  } catch (err) {
    const message = err instanceof IntegrationError ? err.message : (err as Error).message;
    console.error("[admin/refresh-guild]", err);
    return { error: message || "Guild refresh failed" };
  }
}
