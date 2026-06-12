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
// Raid-Helper gives one display name per signup (the Discord nickname), not the
// alt's real in-game name. So all of a user's signups — main and alts — share one
// `characterName`, and we can register at most ONE Character per Discord name from
// this path. The alt's real Character enters via self-claim or softres/WCL
// real-name resolution; see implementation-plan "Alts" note.
//
// We therefore dedupe by name and pick the **most-frequent class** as the
// representative (you raid most as your main), with an alphabetical class
// tie-break so the choice is deterministic regardless of signup row order. Claim
// then no-ops on every subsequent login (`already_yours`), so this pick is stable.
export async function autoClaimFromSignups(
  store: AutoClaimStore,
  userId: string,
  discordId: string,
): Promise<AutoClaimResult> {
  const signups = await store.listClaimableSignups(discordId);
  const byName = pickRepresentativePerName(signups);

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

// Collapse a user's signups to one representative per character name. When a name
// appears with several classes (a Discord-name-sharing alt), the most-frequent
// class wins, breaking ties alphabetically so the result is independent of row
// order. Among signups of the winning class, the first is kept for its spec/role.
function pickRepresentativePerName(
  signups: ClaimableSignup[],
): Map<string, ClaimableSignup> {
  const byName = new Map<string, ClaimableSignup[]>();
  for (const s of signups) {
    const group = byName.get(s.characterName);
    if (group) group.push(s);
    else byName.set(s.characterName, [s]);
  }

  const result = new Map<string, ClaimableSignup>();
  for (const [name, group] of byName) {
    const counts = new Map<string, number>();
    for (const s of group) counts.set(s.class, (counts.get(s.class) ?? 0) + 1);

    let bestClass = group[0].class;
    let bestCount = 0;
    for (const [cls, count] of counts) {
      if (count > bestCount || (count === bestCount && cls < bestClass)) {
        bestClass = cls;
        bestCount = count;
      }
    }

    const representative = group.find((s) => s.class === bestClass) ?? group[0];
    result.set(name, representative);
  }
  return result;
}
