"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MainRole } from "@/lib/domain/enums";
import { isValidClass, isValidSpec } from "@/lib/domain/wow";
import { characterRepository } from "@/lib/repositories/character-repository";
import { claimCharacter } from "@/lib/services/character-claim";
import { auth } from "@/lib/auth";

const claimSchema = z
  .object({
    name: z.string().trim().min(2).max(24),
    class: z.string().refine(isValidClass, "Unknown class"),
    spec: z.string(),
    mainRole: z.enum([MainRole.TANK, MainRole.HEALER, MainRole.DPS]),
  })
  .refine((d) => isValidSpec(d.class, d.spec), {
    message: "Spec does not belong to that class",
    path: ["spec"],
  });

export type ClaimActionState = { error?: string; success?: string };

export async function claimCharacterAction(
  _prev: ClaimActionState,
  formData: FormData,
): Promise<ClaimActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in." };
  }

  const parsed = claimSchema.safeParse({
    name: formData.get("name"),
    class: formData.get("class"),
    spec: formData.get("spec"),
    mainRole: formData.get("mainRole"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const result = await claimCharacter(
    characterRepository,
    session.user.id,
    parsed.data,
  );

  if (!result.ok) {
    return {
      error:
        result.reason === "already_yours"
          ? "You already own that character."
          : "That character is claimed by someone else. Contact an officer to transfer it.",
    };
  }

  revalidatePath("/profile");
  return {
    success: result.created
      ? `Claimed ${result.character.name}.`
      : `Took ownership of ${result.character.name}.`,
  };
}
