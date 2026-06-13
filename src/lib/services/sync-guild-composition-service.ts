import type { ExternalCompositionMember } from "@/lib/domain/external";
import { is25ManZone } from "@/lib/domain/wow";
import type { IGuildSource } from "@/lib/integrations/interfaces";

// Refresh the guild's raid composition (display-only) from the MOST RECENT
// 25-man report's WCL playerDetails — like WCL's "Composition" panel: who
// actually raided last, grouped by role with their played spec + item level.
//
// Source selection: the attendance feed already lists logged reports with zone
// + startTime. We pick the newest 25-man one (10-man side-content like Karazhan
// is excluded — the composition is the 25-man raid lineup) and fetch its
// playerDetails. One report = one fetch.

export interface GuildCompositionStore {
  /** Replace the whole composition with this snapshot (delete-all + insert),
   *  recording its source report + fetchedAt. */
  replaceComposition(
    members: ExternalCompositionMember[],
    sourceReportCode: string,
    fetchedAt: Date,
  ): Promise<void>;
}

export interface GuildCompositionResult {
  /** Null when the guild has no logged 25-man report to source from. */
  sourceReportCode: string | null;
  members: number;
}

export async function syncGuildComposition(
  guildSource: IGuildSource,
  store: GuildCompositionStore,
  guildId: number,
  now: Date,
): Promise<GuildCompositionResult> {
  const history = await guildSource.fetchAttendance(guildId);

  // Newest 25-man logged report.
  const latest = history
    .filter((n) => is25ManZone(n.zone))
    .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())[0];

  if (!latest) {
    return { sourceReportCode: null, members: 0 };
  }

  const members = await guildSource.fetchComposition(latest.reportCode);
  await store.replaceComposition(members, latest.reportCode, now);
  return { sourceReportCode: latest.reportCode, members: members.length };
}
