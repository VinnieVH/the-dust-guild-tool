"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Role } from "@/lib/domain/enums";
import { zoneDisplayName } from "@/lib/domain/wow";
import { env } from "@/lib/env.server";
import { IntegrationError } from "@/lib/integrations/errors";
import {
  WarcraftLogsAdapter,
  parseWclUrl,
} from "@/lib/integrations/warcraftlogs/adapter";
import {
  nightEngineRepository,
  speedRecordRepository,
  wclSyncRepository,
} from "@/lib/repositories/wcl-repository";
import { runNightEngineForNight } from "@/lib/services/run-night-engine-service";
import { runSpeedRecords } from "@/lib/services/run-speed-record-service";
import { syncWclReport } from "@/lib/services/sync-wcl-service";
import { auth } from "@/lib/auth";

export type WclActionState = { error?: string; success?: string };

const addSchema = z.object({
  raidNightId: z.string().min(1),
  url: z.string().trim().min(1),
});

// Officer pastes a WCL report (URL or code). We ingest its performances, resolve
// names to characters (unmatched ones land in the queue), then re-run the
// per-night achievement engine for the whole night (idempotent). Re-pasting the
// same report replaces its rows and re-awards deterministically.
export async function addWclReportAction(
  _prev: WclActionState,
  formData: FormData,
): Promise<WclActionState> {
  const session = await auth();
  if (session?.user?.role !== Role.OFFICER) return { error: "Officers only." };

  if (!env.WCL_CLIENT_ID || !env.WCL_CLIENT_SECRET) {
    return { error: "Warcraft Logs is not configured (missing client id/secret)." };
  }

  const parsed = addSchema.safeParse({
    raidNightId: formData.get("raidNightId"),
    url: formData.get("url"),
  });
  if (!parsed.success) return { error: "Paste a Warcraft Logs report link or code." };

  const code = parseWclUrl(parsed.data.url);
  if (!code) return { error: "Could not read a report code from that link." };

  const adapter = new WarcraftLogsAdapter({
    clientId: env.WCL_CLIENT_ID,
    clientSecret: env.WCL_CLIENT_SECRET,
  });

  try {
    const sync = await syncWclReport(
      adapter,
      wclSyncRepository,
      parsed.data.raidNightId,
      code.reportCode,
    );
    // Re-run the per-night engine over the whole night (all its reports).
    const engine = await runNightEngineForNight(
      nightEngineRepository,
      parsed.data.raidNightId,
    );

    // Recompute speed records across all history (a new clear time may set a
    // record, or re-ingesting slower may drop one). Owns new-speed-record.
    await runSpeedRecords(speedRecordRepository);

    revalidatePath(`/admin/raid-nights/${parsed.data.raidNightId}`);
    revalidatePath(`/raids/${parsed.data.raidNightId}`);
    revalidatePath("/admin/unmatched");

    return {
      success:
        `Ingested ${sync.performances} performers from ${zoneDisplayName(sync.zone)} ` +
        `(${sync.matched} matched, ${sync.unmatched} unmatched). ` +
        `Awarded ${engine.awards} achievements.`,
    };
  } catch (err) {
    const message = err instanceof IntegrationError ? err.message : "Ingestion failed";
    console.error("[admin/add-wcl-report]", err);
    return { error: message };
  }
}

const removeSchema = z.object({
  raidNightId: z.string().min(1),
  reportId: z.string().min(1),
});

// Remove a WCL report (and its performances, via cascade), then re-run the
// per-night engine so awards reflect the remaining reports.
export async function removeWclReportAction(
  _prev: WclActionState,
  formData: FormData,
): Promise<WclActionState> {
  const session = await auth();
  if (session?.user?.role !== Role.OFFICER) return { error: "Officers only." };

  const parsed = removeSchema.safeParse({
    raidNightId: formData.get("raidNightId"),
    reportId: formData.get("reportId"),
  });
  if (!parsed.success) return { error: "Invalid input." };

  await wclSyncRepository.deleteReport(parsed.data.reportId);
  await runNightEngineForNight(nightEngineRepository, parsed.data.raidNightId);
  await runSpeedRecords(speedRecordRepository);

  revalidatePath(`/admin/raid-nights/${parsed.data.raidNightId}`);
  revalidatePath(`/raids/${parsed.data.raidNightId}`);
  return { success: "Report removed." };
}
