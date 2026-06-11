"use server";

import { revalidatePath } from "next/cache";
import { Role } from "@/lib/domain/enums";
import { env } from "@/lib/env.server";
import { IntegrationError } from "@/lib/integrations/errors";
import { RaidHelperAdapter } from "@/lib/integrations/raid-helper/adapter";
import { raidNightRepository } from "@/lib/repositories/raid-night-repository";
import { syncRaidHelper } from "@/lib/services/sync-service";
import { auth } from "@/lib/auth";

export type SyncEventsState = { error?: string; success?: string };

// Officer-triggered Raid-Helper pull: refreshes upcoming events + signups from
// Raid-Helper into Postgres (same idempotent path as the cron). Creates raid
// nights and stub users as needed, then the list re-renders.
export async function syncRaidHelperAction(
  _prev: SyncEventsState,
): Promise<SyncEventsState> {
  const session = await auth();
  if (session?.user?.role !== Role.OFFICER) {
    return { error: "Officers only." };
  }

  if (!env.RAID_HELPER_API_KEY || !env.RAID_HELPER_SERVER_ID) {
    return { error: "Raid-Helper is not configured (missing API key / server id)." };
  }

  const adapter = new RaidHelperAdapter({
    apiKey: env.RAID_HELPER_API_KEY,
    serverId: env.RAID_HELPER_SERVER_ID,
  });

  try {
    const result = await syncRaidHelper(adapter, raidNightRepository);
    revalidatePath("/admin/raid-nights");
    revalidatePath("/raids");
    return {
      success:
        `Synced ${result.events} events, ${result.signups} signups ` +
        `(${result.created} new nights, ${result.updated} updated).`,
    };
  } catch (err) {
    const message = err instanceof IntegrationError ? err.message : "Sync failed";
    console.error("[admin/sync-raid-helper]", err);
    return { error: message };
  }
}
