"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Instance } from "@/lib/domain/enums";
import { IntegrationError } from "@/lib/integrations/errors";
import { SoftresAdapter, parseSoftresUrl } from "@/lib/integrations/softres/adapter";
import { reservationRepository } from "@/lib/repositories/reservation-repository";
import { softresSheetRepository } from "@/lib/repositories/softres-sheet-repository";
import { syncSoftres } from "@/lib/services/sync-softres-service";

export type LinkSheetsState = { error?: string; success?: string };

const urlSchema = z.object({
  raidNightId: z.string().min(1),
  ssc: z.string().trim(),
  tk: z.string().trim(),
});

// Link the SSC + TK softres sheets for a raid night, then sync them immediately
// so the officer sees reservations without waiting for the cron. Either field
// may be left blank (only one instance linked).
export async function linkSheetsAction(
  _prev: LinkSheetsState,
  formData: FormData,
): Promise<LinkSheetsState> {
  const parsed = urlSchema.safeParse({
    raidNightId: formData.get("raidNightId"),
    ssc: formData.get("ssc") ?? "",
    tk: formData.get("tk") ?? "",
  });
  if (!parsed.success) return { error: "Invalid input." };
  const { raidNightId, ssc, tk } = parsed.data;

  const inputs: { instance: Instance; raw: string }[] = [
    { instance: Instance.SSC, raw: ssc },
    { instance: Instance.TK, raw: tk },
  ];

  const linked: { sheetId: string; softresId: string; instance: Instance }[] = [];
  for (const { instance, raw } of inputs) {
    if (!raw) continue;
    const parsedUrl = parseSoftresUrl(raw);
    if (!parsedUrl) return { error: `Could not read a softres id from the ${instance} link.` };
    const { id } = await softresSheetRepository.linkSheet({
      raidNightId,
      instance,
      softresId: parsedUrl.softresId,
    });
    linked.push({ sheetId: id, softresId: parsedUrl.softresId, instance });
  }

  if (linked.length === 0) {
    return { error: "Paste at least one softres link." };
  }

  // Immediate sync of the just-linked sheets.
  try {
    const result = await syncSoftres(
      new SoftresAdapter(),
      reservationRepository,
      linked.map((l) => ({ sheetId: l.sheetId, softresId: l.softresId })),
    );
    revalidatePath(`/admin/raid-nights/${raidNightId}`);
    revalidatePath("/admin/unmatched");
    revalidatePath(`/raids/${raidNightId}`);
    return {
      success:
        `Linked ${linked.map((l) => l.instance).join(" + ")}. ` +
        `Synced ${result.reservations} reservations ` +
        `(${result.matched} matched, ${result.suggested} suggested, ${result.unmatched} unmatched).`,
    };
  } catch (err) {
    const message = err instanceof IntegrationError ? err.message : "Sheet sync failed";
    console.error("[admin/link-sheets]", err);
    return { error: message };
  }
}
