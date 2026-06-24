"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Role } from "@/lib/domain/enums";
import { IntegrationError } from "@/lib/integrations/errors";
import { SoftresAdapter, parseSoftresUrl } from "@/lib/integrations/softres/adapter";
import { reservationRepository } from "@/lib/repositories/reservation-repository";
import { softresSheetRepository } from "@/lib/repositories/softres-sheet-repository";
import { syncSoftres } from "@/lib/services/sync-softres-service";
import { auth } from "@/lib/auth";

export type SheetActionState = { error?: string; success?: string };

async function requireOfficer(): Promise<boolean> {
  const session = await auth();
  return session?.user?.role === Role.OFFICER;
}

function revalidate(raidNightId: string) {
  revalidatePath(`/admin/raid-nights/${raidNightId}`);
  revalidatePath("/admin/unmatched");
  revalidatePath(`/raids/${raidNightId}`);
}

const addSchema = z.object({
  raidNightId: z.string().min(1),
  name: z.string().trim().min(1).max(40),
  url: z.string().trim().min(1),
});

// Add one named soft-res sheet to a raid night, then sync it immediately so the
// officer sees reservations without waiting for the cron.
export async function addSheetAction(
  _prev: SheetActionState,
  formData: FormData,
): Promise<SheetActionState> {
  if (!(await requireOfficer())) return { error: "Officers only." };

  const parsed = addSchema.safeParse({
    raidNightId: formData.get("raidNightId"),
    name: formData.get("name"),
    url: formData.get("url"),
  });
  if (!parsed.success) return { error: "Give the sheet a name and a softres link." };
  const { raidNightId, name, url } = parsed.data;

  const parsedUrl = parseSoftresUrl(url);
  if (!parsedUrl) return { error: "Could not read a softres id from that link." };

  let sheetId: string;
  try {
    ({ id: sheetId } = await softresSheetRepository.addSheet({
      raidNightId,
      name,
      softresId: parsedUrl.softresId,
    }));
  } catch {
    return { error: `A sheet named “${name}” already exists for this night.` };
  }

  try {
    const result = await syncSoftres(new SoftresAdapter(), reservationRepository, [
      { sheetId, softresId: parsedUrl.softresId },
    ]);
    revalidate(raidNightId);
    return {
      success:
        `Added “${name}”. Synced ${result.reservations} reservations ` +
        `(${result.matched} matched, ${result.suggested} suggested, ${result.unmatched} unmatched)` +
        (result.adopted ? `, auto-linked ${result.adopted} to their member.` : "."),
    };
  } catch (err) {
    const message = err instanceof IntegrationError ? err.message : "Sheet sync failed";
    console.error("[admin/add-sheet]", err);
    // The sheet was created; surface the sync failure but don't roll it back —
    // a later "Sync now" / cron retries it.
    return { error: `Added “${name}”, but the sync failed: ${message}` };
  }
}

const setTokenSchema = z.object({
  raidNightId: z.string().min(1),
  sheetId: z.string().min(1),
  // The softres edit token (admin key). Empty string clears it. Stored plain
  // text — it only guards a softres sheet, which is cheap to recreate.
  token: z.string().trim().max(200),
});

// Store (or clear) a sheet's softres edit token. This is the admin key a raid
// leader needs to edit the soft-res sheet; we keep a copy so it can't be lost.
export async function setTokenAction(
  _prev: SheetActionState,
  formData: FormData,
): Promise<SheetActionState> {
  if (!(await requireOfficer())) return { error: "Officers only." };

  const parsed = setTokenSchema.safeParse({
    raidNightId: formData.get("raidNightId"),
    sheetId: formData.get("sheetId"),
    token: formData.get("token"),
  });
  if (!parsed.success) return { error: "Invalid input." };

  const { raidNightId, sheetId, token } = parsed.data;
  await softresSheetRepository.updateToken(sheetId, token);
  revalidate(raidNightId);
  return { success: token ? "Admin key saved." : "Admin key cleared." };
}

const removeSchema = z.object({
  raidNightId: z.string().min(1),
  sheetId: z.string().min(1),
});

// Remove a sheet (and its reservations, via cascade).
export async function removeSheetAction(
  _prev: SheetActionState,
  formData: FormData,
): Promise<SheetActionState> {
  if (!(await requireOfficer())) return { error: "Officers only." };

  const parsed = removeSchema.safeParse({
    raidNightId: formData.get("raidNightId"),
    sheetId: formData.get("sheetId"),
  });
  if (!parsed.success) return { error: "Invalid input." };

  await softresSheetRepository.removeSheet(parsed.data.sheetId);
  revalidate(parsed.data.raidNightId);
  return { success: "Sheet removed." };
}
