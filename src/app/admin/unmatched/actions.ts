"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MainRole } from "@/lib/domain/enums";
import { isValidClass, isValidSpec } from "@/lib/domain/wow";
import { db } from "@/lib/db";
import { reservationResolveRepository } from "@/lib/repositories/reservation-repository";
import {
  nightEngineRepository,
  resolvePerformanceRepository,
  speedRecordRepository,
} from "@/lib/repositories/wcl-repository";
import {
  acceptSuggestion,
  createAndLinkReservation,
  ignoreReservation,
  linkReservation,
} from "@/lib/services/resolve-reservation-service";
import { linkPerformanceName } from "@/lib/services/resolve-performance-service";
import { runNightEngineForNight } from "@/lib/services/run-night-engine-service";
import { runSpeedRecords } from "@/lib/services/run-speed-record-service";

export type ResolveActionState = { error?: string; success?: string };

function revalidate() {
  revalidatePath("/admin/unmatched");
}

const linkSchema = z.object({
  reservationId: z.string().min(1),
  characterId: z.string().min(1),
});

// Link to an existing character. Inserts an alias for rawName (resolve-once).
export async function linkAction(
  _prev: ResolveActionState,
  formData: FormData,
): Promise<ResolveActionState> {
  const parsed = linkSchema.safeParse({
    reservationId: formData.get("reservationId"),
    characterId: formData.get("characterId"),
  });
  if (!parsed.success) return { error: "Pick a character to link." };

  const res = await linkReservation(
    reservationResolveRepository,
    parsed.data.reservationId,
    parsed.data.characterId,
  );
  if (!res.ok) return { error: "Could not link — reservation or character missing." };
  revalidate();
  return { success: "Linked." };
}

const idSchema = z.object({ reservationId: z.string().min(1) });

export async function acceptSuggestionAction(
  _prev: ResolveActionState,
  formData: FormData,
): Promise<ResolveActionState> {
  const parsed = idSchema.safeParse({ reservationId: formData.get("reservationId") });
  if (!parsed.success) return { error: "Invalid input." };
  const res = await acceptSuggestion(reservationResolveRepository, parsed.data.reservationId);
  if (!res.ok) return { error: "No suggestion to accept." };
  revalidate();
  return { success: "Accepted suggestion." };
}

export async function ignoreAction(
  _prev: ResolveActionState,
  formData: FormData,
): Promise<ResolveActionState> {
  const parsed = idSchema.safeParse({ reservationId: formData.get("reservationId") });
  if (!parsed.success) return { error: "Invalid input." };
  const res = await ignoreReservation(reservationResolveRepository, parsed.data.reservationId);
  if (!res.ok) return { error: "Reservation not found." };
  revalidate();
  return { success: "Ignored." };
}

const createSchema = z
  .object({
    reservationId: z.string().min(1),
    name: z.string().trim().min(2).max(24),
    class: z.string().refine(isValidClass, "Unknown class"),
    spec: z.string(),
    mainRole: z.enum([MainRole.TANK, MainRole.HEALER, MainRole.DPS]),
  })
  .refine((d) => isValidSpec(d.class, d.spec), {
    message: "Spec does not belong to that class",
    path: ["spec"],
  });

// Create an unowned character with officer-supplied spec/role and link it.
export async function createAndLinkAction(
  _prev: ResolveActionState,
  formData: FormData,
): Promise<ResolveActionState> {
  const parsed = createSchema.safeParse({
    reservationId: formData.get("reservationId"),
    name: formData.get("name"),
    class: formData.get("class"),
    spec: formData.get("spec"),
    mainRole: formData.get("mainRole"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const { reservationId, ...input } = parsed.data;
  const res = await createAndLinkReservation(
    reservationResolveRepository,
    reservationId,
    input,
  );
  if (!res.ok) {
    return {
      error:
        res.reason === "name_taken"
          ? "A character with that name already exists — link to it instead."
          : "Reservation not found.",
    };
  }
  revalidate();
  return { success: `Created ${input.name} and linked.` };
}

const linkPerfSchema = z.object({
  rawName: z.string().min(1),
  characterId: z.string().min(1),
});

// Link an unmatched WCL performance name to a character. Inserts an alias
// (future syncs auto-resolve), backfills already-ingested rows, then re-runs the
// affected nights' engines (a newly-matched top parser can change a crown).
export async function linkPerformanceAction(
  _prev: ResolveActionState,
  formData: FormData,
): Promise<ResolveActionState> {
  const parsed = linkPerfSchema.safeParse({
    rawName: formData.get("rawName"),
    characterId: formData.get("characterId"),
  });
  if (!parsed.success) return { error: "Pick a character to link." };

  const res = await linkPerformanceName(
    resolvePerformanceRepository,
    parsed.data.rawName,
    parsed.data.characterId,
  );
  if (!res.ok) return { error: "Could not link — character missing." };

  // Re-award the affected nights now that this name resolves.
  for (const raidNightId of res.affectedRaidNightIds) {
    await runNightEngineForNight(nightEngineRepository, raidNightId);
    revalidatePath(`/raids/${raidNightId}`);
  }
  // Speed records too: a now-resolved performer on a record night should get
  // new-speed-record like everyone else who was there ("everyone who was there
  // gets it"). The pass recomputes the present-set from resolved performances.
  if (res.affectedRaidNightIds.length > 0) {
    await runSpeedRecords(speedRecordRepository);
  }
  revalidate();
  return { success: `Linked ${parsed.data.rawName} (${res.affectedRaidNightIds.length} night(s) re-scored).` };
}

// Character name search for the Link picker (server action, called from client).
export async function searchCharacters(
  query: string,
): Promise<{ id: string; name: string; class: string }[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const rows = await db.character.findMany({
    where: { name: { contains: q, mode: "insensitive" } },
    orderBy: { name: "asc" },
    take: 10,
    select: { id: true, name: true, class: true },
  });
  return rows;
}
