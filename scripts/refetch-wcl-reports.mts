// Maintenance backfill: RE-FETCH every stored WCL report from the API and
// re-ingest it, then re-run the per-night engine + speed records. Use this when
// a stored FIELD changes meaning or is newly captured — e.g. the 2026-06-17
// `totalDeaths` addition (Floor Inspector now counts wipes + trash). The
// engine-only rerun-night-engine.mts CANNOT do this: it recomputes from stored
// rows, which lack the new field until a re-fetch repopulates them.
//
// Idempotent: syncWclReport upserts by reportCode and replacePerformances
// deletes+recreates the rows, so re-runs converge. Safe to run repeatedly.
//
//   yarn tsx scripts/refetch-wcl-reports.mts
//
import "dotenv/config";
import { env } from "@/lib/env.server";
import { WarcraftLogsAdapter } from "@/lib/integrations/warcraftlogs/adapter";
import { IntegrationError } from "@/lib/integrations/errors";
import {
  nightEngineRepository,
  speedRecordRepository,
  wclSyncRepository,
} from "@/lib/repositories/wcl-repository";
import { runNightEngineForNight } from "@/lib/services/run-night-engine-service";
import { runSpeedRecords } from "@/lib/services/run-speed-record-service";
import { syncWclReport } from "@/lib/services/sync-wcl-service";
import { db } from "@/lib/db";

async function main() {
  if (!env.WCL_CLIENT_ID || !env.WCL_CLIENT_SECRET) {
    throw new Error("WCL creds missing (WCL_CLIENT_ID / WCL_CLIENT_SECRET).");
  }
  const adapter = new WarcraftLogsAdapter({
    clientId: env.WCL_CLIENT_ID,
    clientSecret: env.WCL_CLIENT_SECRET,
  });

  const reports = await db.wclReport.findMany({
    select: { reportCode: true, raidNightId: true },
    orderBy: { raidNight: { date: "asc" } },
  });
  console.log(`Re-fetching ${reports.length} report(s) from WCL…`);

  const affectedNights = new Set<string>();
  let ok = 0;
  let skipped = 0;
  for (const r of reports) {
    try {
      const res = await syncWclReport(
        adapter,
        wclSyncRepository,
        r.raidNightId,
        r.reportCode,
      );
      affectedNights.add(r.raidNightId);
      ok += 1;
      console.log(`  ${r.reportCode}: ${res.performances} performers (${res.matched} matched)`);
    } catch (err) {
      // A stored report that is no longer 25-man (shouldn't happen) is skipped,
      // not fatal — keep going so one bad code can't block the whole backfill.
      skipped += 1;
      const msg = err instanceof IntegrationError ? err.message : String(err);
      console.warn(`  ${r.reportCode}: SKIPPED — ${msg}`);
    }
  }

  console.log(`Re-running the night engine over ${affectedNights.size} night(s)…`);
  for (const nightId of affectedNights) {
    await runNightEngineForNight(nightEngineRepository, nightId);
  }
  if (affectedNights.size > 0) await runSpeedRecords(speedRecordRepository);

  console.log(`Done. Re-fetched ${ok}, skipped ${skipped}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
