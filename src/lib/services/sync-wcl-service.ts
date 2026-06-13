import type { ExternalPerformance } from "@/lib/domain/external";
import type { IPerformanceSource } from "@/lib/integrations/interfaces";

// Ingest one WCL report into the DB: fetch it, resolve each performer's name to
// a Character (exact name or confirmed alias — WCL names ARE real in-game names,
// the strong linking key, so no dId/fuzzy tier is needed), and upsert the report
// + performances. Idempotent: re-ingesting a report replaces its performance
// rows. Pure over an injected store (no Prisma here).
//
// Unmatched names (no Character yet) are kept with characterId=null + rawName so
// they surface in the officer queue, exactly like softres reservations.

export interface WclSyncStore {
  /** Exact character name or confirmed alias -> character id, else null. */
  findCharacterIdByNameOrAlias(name: string): Promise<string | null>;

  /**
   * Upsert the wcl_reports row for this raid night + code, returning its id.
   * Idempotent by reportCode (@unique).
   */
  upsertReport(input: {
    raidNightId: string;
    reportCode: string;
    zone: string;
    clearMs: number;
  }): Promise<{ wclReportId: string }>;

  /**
   * Replace ALL performance rows for a report with the given set (re-ingest
   * semantics). Each row carries the resolved characterId (or null) + rawName.
   */
  /** Delete a report and its performances (cascade). */
  deleteReport(reportId: string): Promise<void>;

  replacePerformances(
    wclReportId: string,
    rows: Array<{
      characterId: string | null;
      rawName: string;
      role: ExternalPerformance["role"];
      parseAvg: number;
      dpsOrHps: number;
      deaths: number;
      interrupts: number;
      dispels: number;
      hadFlask: boolean;
      hadFood: boolean;
      hadElixir: boolean;
      fightsPresent: number;
    }>,
  ): Promise<void>;
}

export interface WclSyncResult {
  reportCode: string;
  zone: string;
  totalBossFights: number;
  performances: number;
  matched: number;
  unmatched: number;
}

/** Ingest a single report for a raid night. */
export async function syncWclReport(
  source: IPerformanceSource,
  store: WclSyncStore,
  raidNightId: string,
  reportCode: string,
): Promise<WclSyncResult> {
  const report = await source.fetchReport(reportCode);

  const { wclReportId } = await store.upsertReport({
    raidNightId,
    reportCode: report.reportCode,
    zone: report.zone,
    clearMs: report.clearMs,
  });

  let matched = 0;
  let unmatched = 0;
  const rows = [];
  for (const p of report.performances) {
    const characterId = await store.findCharacterIdByNameOrAlias(p.name);
    if (characterId) matched += 1;
    else unmatched += 1;
    rows.push({
      characterId,
      rawName: p.name,
      role: p.role,
      parseAvg: p.parseAvg,
      dpsOrHps: p.dpsOrHps,
      deaths: p.deaths,
      interrupts: p.interrupts,
      dispels: p.dispels,
      hadFlask: p.hadFlask,
      hadFood: p.hadFood,
      hadElixir: p.hadElixir,
      fightsPresent: p.fightsPresent,
    });
  }

  await store.replacePerformances(wclReportId, rows);

  return {
    reportCode: report.reportCode,
    zone: report.zone,
    totalBossFights: report.totalBossFights,
    performances: report.performances.length,
    matched,
    unmatched,
  };
}
