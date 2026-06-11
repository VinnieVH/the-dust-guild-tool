"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Role } from "@/lib/domain/enums";
import { IntegrationError } from "@/lib/integrations/errors";
import { SoftresAdapter } from "@/lib/integrations/softres/adapter";
import { listSheetsForRaidNight } from "@/lib/repositories/reserve-overview-queries";
import { reservationRepository } from "@/lib/repositories/reservation-repository";
import { syncSoftres } from "@/lib/services/sync-softres-service";
import { auth } from "@/lib/auth";

export type SyncNightState = { error?: string; success?: string };

const schema = z.object({ raidNightId: z.string().min(1) });

// Officer-triggered re-pull of THIS raid night's softres sheets. Re-checks who
// has reserved since the last sync and writes the result to Postgres (the same
// idempotent path as the cron) — the page then re-renders the matrix.
export async function syncNightAction(
  _prev: SyncNightState,
  formData: FormData,
): Promise<SyncNightState> {
  // Server-side officer gate: the proxy doesn't guard member routes by role, so
  // re-check here rather than trusting the button being hidden client-side.
  const session = await auth();
  if (session?.user?.role !== Role.OFFICER) {
    return { error: "Officers only." };
  }

  const parsed = schema.safeParse({ raidNightId: formData.get("raidNightId") });
  if (!parsed.success) return { error: "Invalid input." };
  const { raidNightId } = parsed.data;

  const sheets = await listSheetsForRaidNight(raidNightId);
  if (sheets.length === 0) {
    return { error: "No softres sheets linked for this night yet." };
  }

  try {
    const result = await syncSoftres(
      new SoftresAdapter(),
      reservationRepository,
      sheets,
    );
    revalidatePath(`/raids/${raidNightId}`);
    revalidatePath("/admin/unmatched");
    return {
      success:
        `Synced ${result.reservations} reservations ` +
        `(${result.matched} matched, ${result.suggested} suggested, ${result.unmatched} unmatched).`,
    };
  } catch (err) {
    const message = err instanceof IntegrationError ? err.message : "Sync failed";
    console.error("[raids/sync-night]", err);
    return { error: message };
  }
}
