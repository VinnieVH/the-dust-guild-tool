import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { env } from "@/lib/env.server";
import { IntegrationError } from "@/lib/integrations/errors";
import { SoftresAdapter } from "@/lib/integrations/softres/adapter";
import { listSheetsToSync } from "@/lib/repositories/reserve-overview-queries";
import { reservationRepository } from "@/lib/repositories/reservation-repository";
import { syncSoftres } from "@/lib/services/sync-softres-service";

// Cron-triggered softres sync. Syncs the sheets of raid nights within the next 7
// days. Guarded by the same bearer token as the Raid-Helper cron. softres reads
// are public (no API key), so there's no "not configured" gate.
async function run(req: Request): Promise<NextResponse> {
  if (!isAuthorizedCron(req.headers.get("authorization"), env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sheets = await listSheetsToSync(7);
    const result = await syncSoftres(
      new SoftresAdapter(),
      reservationRepository,
      sheets,
    );
    return NextResponse.json({ sheets: sheets.length, ...result });
  } catch (err) {
    const message =
      err instanceof IntegrationError ? err.message : "Softres sync failed";
    console.error("[cron/sync-softres]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
