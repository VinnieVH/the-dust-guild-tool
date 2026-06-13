import type { IGuildSource, IPerformanceSource } from "@/lib/integrations/interfaces";
import { is25ManZone } from "@/lib/domain/wow";
import { syncWclReport, type WclSyncStore } from "./sync-wcl-service";

// Auto-discover the guild's WCL reports and ingest the new 25-man ones — no
// officer paste, no Raid-Helper dependency. Idempotent: only NEW report codes
// are fetched/ingested; re-runs are cheap and produce identical nights/awards.
//
// Night identity = the report's Europe/Brussels calendar DATE (the guild raids
// one event/day). We attach the report to an existing Raid-Helper night on that
// date if one exists, else upsert a synthesized night keyed `wcl:<date>` — a
// deterministic id, so re-runs hit the same row. Reuses RaidNight so the whole
// achievement pipeline (engine, speed-records, scoped delete) is unchanged.

/** Europe/Brussels calendar date (YYYY-MM-DD) for a UTC instant. Evening EU
 *  raids that cross midnight UTC stay on their start day. */
export function brusselsDate(d: Date): string {
  // en-CA gives YYYY-MM-DD; timeZone shifts to Brussels wall-clock first.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Brussels",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** The synthetic raidHelperEventId for a WCL-discovered night on a given date. */
export function wclNightId(date: string): string {
  return `wcl:${date}`;
}

export interface AutoIngestStore extends WclSyncStore {
  /** Report codes already ingested (skip these — re-fetch is wasteful). */
  listIngestedReportCodes(): Promise<Set<string>>;
  /**
   * Resolve the RaidNight for a report on a Brussels date: an existing
   * Raid-Helper night whose own Brussels date matches, else upsert (by the
   * `wcl:<date>` synthetic id) a synthesized night. Returns its id.
   */
  resolveNightForDate(brusselsDate: string, isoForTitle: Date): Promise<string>;
}

export interface AutoIngestResult {
  discovered: number;
  ingested: number;
  skipped: number;
  affectedNightIds: string[];
}

export async function autoIngestReports(
  guildSource: IGuildSource,
  perfSource: IPerformanceSource,
  store: AutoIngestStore,
  guildId: number,
  limit: number,
): Promise<AutoIngestResult> {
  const reports = await guildSource.fetchReports(guildId, limit);
  const alreadyIngested = await store.listIngestedReportCodes();

  // Newest-first from WCL; ingest oldest-first so a night's reports land in date
  // order (engine + speed-record passes are date-ordered anyway, but this keeps
  // ingestion intuitive).
  const todo = reports
    .filter((r) => is25ManZone(r.zone) && !alreadyIngested.has(r.reportCode))
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  const affected = new Set<string>();
  let ingested = 0;

  for (const ref of todo) {
    const date = brusselsDate(ref.startTime);
    const raidNightId = await store.resolveNightForDate(date, ref.startTime);
    // syncWclReport rejects non-25-man at the door (defense-in-depth); 25-man
    // already filtered here. A report with 0 boss kills still ingests (a real
    // raid → achievements), but won't set a speed record (full-clear gate).
    await syncWclReport(perfSource, store, raidNightId, ref.reportCode);
    affected.add(raidNightId);
    ingested += 1;
  }

  return {
    discovered: reports.length,
    ingested,
    skipped: reports.length - todo.length,
    affectedNightIds: [...affected],
  };
}
