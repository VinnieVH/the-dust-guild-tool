import type { ExternalReport } from "@/lib/domain/external";
import { IntegrationError } from "@/lib/integrations/errors";
import type { IPerformanceSource } from "@/lib/integrations/interfaces";
import type { WclCredentials } from "./auth";
import { WclClient } from "./client";
import type {
  WclEventStream,
  WclReportDetail,
  WclReportMeta,
} from "./dto";
import { EVENTS_START_TIME, killFightIds, mapReport } from "./mapper";
import { EVENTS_PAGE, REPORT_DETAIL, REPORT_META } from "./queries";

// Warcraft Logs v2 adapter. Implements IPerformanceSource. Two-step fetch:
// meta (zone + kill fights) -> detail (rankings/deaths/events scoped to those
// fights), then maps to a domain ExternalReport. Event streams are paged
// defensively via nextPageTimestamp so a long pull can't silently undercount.

type EventDataType = "Interrupts" | "Dispels" | "CombatantInfo";

export class WarcraftLogsAdapter implements IPerformanceSource {
  private readonly client: WclClient;

  constructor(creds: WclCredentials) {
    this.client = new WclClient(creds);
  }

  async fetchReport(reportCode: string): Promise<ExternalReport> {
    const meta = await this.client.query<WclReportMeta>(REPORT_META, {
      code: reportCode,
    });
    if (!meta.reportData.report) {
      throw new IntegrationError(
        "warcraftlogs",
        `report ${reportCode} not found`,
      );
    }

    const fids = killFightIds(meta);
    if (fids.length === 0) {
      // No boss kills — nothing to score. Return an empty-but-valid report.
      return mapReport(meta, emptyDetail());
    }

    const detail = await this.client.query<WclReportDetail>(REPORT_DETAIL, {
      code: reportCode,
      fids,
      startTime: EVENTS_START_TIME,
    });
    const report = detail.reportData.report;
    if (!report) {
      throw new IntegrationError(
        "warcraftlogs",
        `report ${reportCode} detail missing`,
      );
    }

    // Follow pagination on each event stream until exhausted.
    report.interrupts = await this.drain(
      reportCode,
      fids,
      "Interrupts",
      report.interrupts,
    );
    report.dispels = await this.drain(reportCode, fids, "Dispels", report.dispels);
    report.combatantInfo = await this.drain(
      reportCode,
      fids,
      "CombatantInfo",
      report.combatantInfo,
    );

    return mapReport(meta, detail);
  }

  // Pulls subsequent pages of an event stream and concatenates their data.
  private async drain<T>(
    code: string,
    fids: number[],
    dataType: EventDataType,
    first: WclEventStream<T>,
  ): Promise<WclEventStream<T>> {
    const all = [...first.data];
    let next = first.nextPageTimestamp;
    // Bound the loop defensively; a night never approaches this.
    for (let guard = 0; next != null && guard < 50; guard++) {
      const page = await this.client.query<{
        reportData: { report: { events: WclEventStream<T> } | null };
      }>(EVENTS_PAGE, { code, fids, dataType, startTime: next });
      const events = page.reportData.report?.events;
      if (!events) break;
      all.push(...events.data);
      next = events.nextPageTimestamp;
    }
    return { data: all, nextPageTimestamp: null };
  }
}

function emptyDetail(): WclReportDetail {
  return {
    reportData: {
      report: {
        rankings: { data: [] },
        deaths: { data: { entries: [] } },
        interrupts: { data: [], nextPageTimestamp: null },
        dispels: { data: [], nextPageTimestamp: null },
        combatantInfo: { data: [], nextPageTimestamp: null },
      },
    },
  };
}
