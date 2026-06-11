import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { env } from "@/lib/env.server";
import { IntegrationError } from "@/lib/integrations/errors";
import { RaidHelperAdapter } from "@/lib/integrations/raid-helper/adapter";
import { raidNightRepository } from "@/lib/repositories/raid-night-repository";
import { syncRaidHelper } from "@/lib/services/sync-service";

// Cron-triggered Raid-Helper sync. Guarded by a bearer token so only the
// scheduler can trigger it. Vercel Cron sends GET with the bearer
// automatically; a self-hosted worker can POST with the same header — both
// route through `run`.
async function run(req: Request): Promise<NextResponse> {
  if (!isAuthorizedCron(req.headers.get("authorization"), env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!env.RAID_HELPER_API_KEY || !env.RAID_HELPER_SERVER_ID) {
    return NextResponse.json(
      { error: "Raid-Helper not configured" },
      { status: 503 },
    );
  }

  const adapter = new RaidHelperAdapter({
    apiKey: env.RAID_HELPER_API_KEY,
    serverId: env.RAID_HELPER_SERVER_ID,
  });

  try {
    const result = await syncRaidHelper(adapter, raidNightRepository);
    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof IntegrationError ? err.message : "Sync failed";
    console.error("[cron/sync-raid-helper]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
