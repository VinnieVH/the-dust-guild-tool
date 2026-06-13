import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { env } from "@/lib/env.server";
import { IntegrationError } from "@/lib/integrations/errors";
import { syncAllGuildData } from "@/lib/services/sync-guild-data-service";

// Cron-triggered guild refresh: attendance/streaks, zone rankings, composition —
// all straight from WCL guild feeds, no report ingestion needed. Guarded by a
// bearer token so only the scheduler can trigger it. The officer "refresh now"
// button runs the same syncAllGuildData.
async function run(req: Request): Promise<NextResponse> {
  if (!isAuthorizedCron(req.headers.get("authorization"), env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncAllGuildData(new Date());
    return NextResponse.json(result);
  } catch (err) {
    // Missing-config is a 503 (not configured), real failures a 500.
    if (err instanceof Error && err.message.includes("not configured")) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof IntegrationError ? err.message : "Sync failed";
    console.error("[cron/sync-guild]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
