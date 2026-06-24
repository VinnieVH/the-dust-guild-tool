import type { ExternalReservation } from "@/lib/domain/external";
import type { IReserveSource } from "@/lib/integrations/interfaces";

// A sheet to sync: its softres id + which raid-night sheet row it belongs to.
export interface SoftresSheetRef {
  /** Internal SoftresSheet id (FK target for reservations). */
  sheetId: string;
  /** softres raid id to fetch. */
  softresId: string;
  token?: string;
}

// Outcome of resolving one reservation's rawName to a character.
//   matched   -> exact name or confirmed alias hit; characterId set
//   suggested -> the reserver (via dId) owns exactly one character whose name
//                differs; stored as a suggestion for an officer to confirm
//   unmatched -> no link; surfaces in the officer queue
export type ReservationResolution =
  | { kind: "matched"; characterId: string }
  | { kind: "suggested"; characterId: string }
  | { kind: "unmatched" };

// Port the softres sync depends on. The repository implements it; the service
// stays Prisma-free and unit-testable. Mirrors the link-only decision: sync
// NEVER creates characters (a reservation lacks an honest spec/role) and NEVER
// overwrites an officer's resolution — character creation + role assignment are
// officer queue actions (implementation-plan §3.4).
//
// ONE exception (the self-heal below): sync MAY fill an UNOWNED character's owner
// from the reserver's dId. This never reassigns an existing owner, so it can't
// clobber an officer override — same guard linkReservation already uses. It
// exists because a character can be born unowned: when a softres reserve arrives
// before the raid-helper signup creates the reserver's (stubbed) User, the
// officer's "Create & link" runs with no User to attribute to. The matrix reads
// ownership from the signup's User, so without this back-fill the member shows
// "no character claimed" forever (sync re-links the reservation but never the
// owner). Heals on the next sync once the User exists.
export interface SoftresSyncStore {
  /** Exact character name or confirmed alias -> character id, else null. */
  findCharacterIdByNameOrAlias(name: string): Promise<string | null>;

  /** Character ids owned by a Discord user (for the dId typo-suggestion tier). */
  listCharacterIdsByDiscordId(discordId: string): Promise<string[]>;

  /**
   * Self-heal an UNOWNED character's owner from the reserver's Discord id.
   * No-op unless the character has no owner AND a User exists for `discordId`.
   * NEVER reassigns an existing owner (preserves the officer-override invariant).
   * Returns true iff it actually assigned an owner.
   */
  assignOwnerIfUnowned(characterId: string, discordId: string): Promise<boolean>;

  /**
   * Upsert a reservation by (sheetId, rawName). Stores rawName/class/dId/items/
   * reservedAt and the resolution. CRITICAL idempotency contract:
   *  - never clears or overwrites a characterId an officer already set;
   *  - never touches the `ignored` flag (officer-owned);
   *  - only writes a fresh `characterId`/`suggestedCharacterId` for rows that
   *    don't already have an officer-confirmed link.
   * Returns whether the row was created and whether it ended up matched.
   */
  upsertReservation(input: {
    sheetId: string;
    rawName: string;
    rawClass: string | null;
    discordId: string | null;
    items: number[];
    reservedAt: Date | null;
    resolution: ReservationResolution;
  }): Promise<{ created: boolean; matched: boolean }>;
}

export interface SoftresSyncResult {
  reservations: number;
  created: number; // reservation rows newly inserted
  matched: number; // reservations linked to a character (exact/alias)
  suggested: number; // reservations with a dId-based suggestion, awaiting confirm
  unmatched: number; // reservations with no link -> officer queue
  adopted: number; // unowned matched characters back-filled with an owner (self-heal)
}

// Resolve one reservation's rawName to a character, link-only.
//   1. exact name / confirmed alias  -> matched (the @unique name IS the link)
//   2. else dId owns exactly one char -> suggested (typo bridge, officer confirms)
//   3. else                           -> unmatched (queue)
async function resolve(
  store: SoftresSyncStore,
  res: ExternalReservation,
): Promise<ReservationResolution> {
  const direct = await store.findCharacterIdByNameOrAlias(res.rawName);
  if (direct) return { kind: "matched", characterId: direct };

  if (res.discordId) {
    const owned = await store.listCharacterIdsByDiscordId(res.discordId);
    // Exactly one character: a confident typo suggestion ("Skreemo" -> "Skreamo").
    // Several characters: ambiguous — leave unmatched so the queue shows the
    // reserver's chars as candidates rather than guessing.
    if (owned.length === 1) return { kind: "suggested", characterId: owned[0] };
  }

  return { kind: "unmatched" };
}

// Sync reservations for a set of sheets. Pure logic over injected ports:
// no HTTP beyond the adapter, no Prisma. Idempotent — re-running yields the
// same end state and never disturbs officer-resolved or ignored rows.
export async function syncSoftres(
  reserveSource: IReserveSource,
  store: SoftresSyncStore,
  sheets: SoftresSheetRef[],
): Promise<SoftresSyncResult> {
  const result: SoftresSyncResult = {
    reservations: 0,
    created: 0,
    matched: 0,
    suggested: 0,
    unmatched: 0,
    adopted: 0,
  };

  for (const sheet of sheets) {
    const reservations = await reserveSource.fetchReservations(
      sheet.softresId,
      sheet.token,
    );
    for (const res of reservations) {
      const resolution = await resolve(store, res);
      const outcome = await store.upsertReservation({
        sheetId: sheet.sheetId,
        rawName: res.rawName,
        rawClass: res.rawClass,
        discordId: res.discordId,
        items: res.items,
        reservedAt: res.reservedAt,
        resolution,
      });

      result.reservations += 1;
      if (outcome.created) result.created += 1;
      if (resolution.kind === "matched") result.matched += 1;
      else if (resolution.kind === "suggested") result.suggested += 1;
      else result.unmatched += 1;

      // Self-heal ownership: a matched character may be unowned (born before its
      // reserver's User existed). Back-fill the owner from the dId so the member
      // gets SR-matrix credit. No-op when already owned or no User for the dId.
      if (resolution.kind === "matched" && res.discordId) {
        const adopted = await store.assignOwnerIfUnowned(
          resolution.characterId,
          res.discordId,
        );
        if (adopted) result.adopted += 1;
      }
    }
  }

  return result;
}
