import type { IGuildSource } from "@/lib/integrations/interfaces";
import { computeStreak, type StreakNight } from "./attendance-streak";

// Recompute attendance streaks for every user from the WCL guild attendance
// history. The history pass that OWNS streak_milestones + User.currentStreak.
//
// Two traps the advisor flagged, both handled in producing the per-User
// chronology (the pure computeStreak only ever sees resolved booleans):
//  1. FULL chronology — every user is crossed against EVERY night (present or
//     absent). Building from "nights a user appears in" would make every streak
//     perfect. We emit `false` for nights a user missed.
//  2. Alt-dedup — a user is present if ANY of their owned characters attended.
//     Resolution maps each attendance name -> userId (via Character -> User);
//     unresolved names (unclaimed alts/pugs) are simply dropped (can't credit a
//     person we don't know — documented limitation).

export interface AttendanceSyncStore {
  /**
   * Resolve a batch of WCL character names to user ids (via Character.name /
   * alias -> Character.userId). Returns a map of name -> userId for the names
   * that resolve to an OWNED character; unresolved/unowned names are omitted.
   */
  resolveNamesToUsers(names: string[]): Promise<Map<string, string>>;

  /** Persist one user's streak result: upsert each milestone (never revoked)
   *  and set User.currentStreak. */
  persistUserStreak(
    userId: string,
    currentStreak: number,
    milestones: Array<{ achievementKey: string; crossedReportCode: string }>,
  ): Promise<void>;
}

export interface AttendanceSyncResult {
  nights: number;
  users: number;
  milestonesAwarded: number;
}

export async function syncAttendance(
  guildSource: IGuildSource,
  store: AttendanceSyncStore,
  guildId: number,
): Promise<AttendanceSyncResult> {
  const history = await guildSource.fetchAttendance(guildId);

  // Order oldest -> newest (WCL returns newest-first). Tie-break on reportCode
  // for a stable total order, mirroring the speed-record ordering rule.
  const ordered = [...history].sort((a, b) => {
    const d = a.startTime.getTime() - b.startTime.getTime();
    return d !== 0 ? d : a.reportCode < b.reportCode ? -1 : 1;
  });

  // Resolve every name seen across all nights in one batch.
  const allNames = [
    ...new Set(ordered.flatMap((n) => n.players.map((p) => p.name))),
  ];
  const nameToUser = await store.resolveNamesToUsers(allNames);

  // Per night, the SET of userIds present (alt-deduped: many names -> one user).
  const presentUsersByNight: Array<{ reportCode: string; users: Set<string> }> =
    ordered.map((night) => {
      const users = new Set<string>();
      for (const p of night.players) {
        if (!p.present) continue;
        const userId = nameToUser.get(p.name);
        if (userId) users.add(userId);
      }
      return { reportCode: night.reportCode, users };
    });

  // Every user that ever attended — the rows we compute streaks for.
  const allUsers = new Set<string>();
  for (const n of presentUsersByNight) for (const u of n.users) allUsers.add(u);

  let milestonesAwarded = 0;
  for (const userId of allUsers) {
    // FULL chronology: this user across EVERY night, present or absent.
    const chronology: StreakNight[] = presentUsersByNight.map((n) => ({
      reportCode: n.reportCode,
      present: n.users.has(userId),
    }));
    const result = computeStreak(chronology);
    await store.persistUserStreak(userId, result.currentStreak, result.milestones);
    milestonesAwarded += result.milestones.length;
  }

  return {
    nights: ordered.length,
    users: allUsers.size,
    milestonesAwarded,
  };
}
