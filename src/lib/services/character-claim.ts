import type { CharacterRecord, ClaimInput } from "@/lib/domain/character";

// Port the claim service needs. The repository implements this; the service
// stays pure and Prisma-free so the claim rules are unit-testable.
export interface CharacterClaimStore {
  findByNameOrAlias(name: string): Promise<CharacterRecord | null>;
  create(input: ClaimInput, userId: string): Promise<CharacterRecord>;
  assignOwner(characterId: string, userId: string): Promise<CharacterRecord>;
}

export type ClaimResult =
  | { ok: true; character: CharacterRecord; created: boolean }
  | { ok: false; reason: "owned_by_other" | "already_yours" };

// Claim rules (design doc §2 / plan §1.5):
//   - name free            -> create the character, assign to the user
//   - exists, unowned      -> assign ownership to the user
//   - exists, owned by them -> already yours (no-op)
//   - exists, owned by other -> reject; an officer must transfer it
export async function claimCharacter(
  store: CharacterClaimStore,
  userId: string,
  input: ClaimInput,
): Promise<ClaimResult> {
  const existing = await store.findByNameOrAlias(input.name);

  if (!existing) {
    const character = await store.create(input, userId);
    return { ok: true, character, created: true };
  }

  if (existing.userId === userId) {
    return { ok: false, reason: "already_yours" };
  }

  if (existing.userId !== null) {
    return { ok: false, reason: "owned_by_other" };
  }

  const character = await store.assignOwner(existing.id, userId);
  return { ok: true, character, created: false };
}
