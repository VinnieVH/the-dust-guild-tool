import type { MainRole } from "@/lib/domain/enums";
import {
  type CharacterClaimStore,
  claimCharacter,
} from "@/lib/services/character-claim";

// A signup eligible for auto-claim: the player named a real character, class,
// and role. Role-only signups ("Tank" with no class) are filtered out upstream.
export interface ClaimableSignup {
  characterName: string;
  class: string;
  specSignedAs: string;
  role: MainRole;
}

// Port: read a user's eligible signups, keyed by Discord id via the relation.
// Keying off discordId (not the DB user id) keeps the caller independent of how
// the session strategy populates user.id, and the reconciling adapter already
// points stub signups at the right user row.
export interface AutoClaimStore extends CharacterClaimStore {
  listClaimableSignups(discordId: string): Promise<ClaimableSignup[]>;
}

export interface AutoClaimResult {
  claimed: number; // characters newly created or assigned to this user
  skipped: number; // already theirs, or owned by someone else
}

// Auto-claim every character a user signed up as, on login. Idempotent:
// re-running yields `already_yours` for prior claims (skipped). Characters owned
// by another user are skipped silently — an officer resolves those by hand.
//
// Dedupes by character name first: a user has one signup per raid night, so the
// same character recurs across nights; we only need to claim it once, and which
// night's spec wins shouldn't depend on row order.
export async function autoClaimFromSignups(
  store: AutoClaimStore,
  userId: string,
  discordId: string,
): Promise<AutoClaimResult> {
  const signups = await store.listClaimableSignups(discordId);
  const byName = new Map<string, ClaimableSignup>();
  for (const s of signups) byName.set(s.characterName, s);

  const result: AutoClaimResult = { claimed: 0, skipped: 0 };
  for (const s of byName.values()) {
    const outcome = await claimCharacter(store, userId, {
      name: s.characterName,
      class: s.class,
      spec: s.specSignedAs,
      mainRole: s.role,
    });
    if (outcome.ok) result.claimed += 1;
    else result.skipped += 1;
  }
  return result;
}
