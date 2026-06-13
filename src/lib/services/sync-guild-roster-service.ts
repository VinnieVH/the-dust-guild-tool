import type { ExternalGuildMember } from "@/lib/domain/external";
import type { IGuildSource } from "@/lib/integrations/interfaces";

// Refresh the guild's WCL member roster (display-only, never awarded). The WHOLE
// guild — NOT filtered by 25-man content (membership ≠ content). A full-snapshot
// replace: the roster reflects current membership, so members who left WCL drop
// out and new ones appear. Runs on the guild-level refresh alongside attendance
// + rank.

export interface GuildRosterStore {
  /** Replace the entire roster with this snapshot (delete-all + insert),
   *  stamping fetchedAt. */
  replaceRoster(members: ExternalGuildMember[], fetchedAt: Date): Promise<void>;
}

export interface GuildRosterResult {
  members: number;
}

export async function syncGuildRoster(
  guildSource: IGuildSource,
  store: GuildRosterStore,
  guildId: number,
  now: Date,
): Promise<GuildRosterResult> {
  const roster = await guildSource.fetchRoster(guildId);
  await store.replaceRoster(roster, now);
  return { members: roster.length };
}
