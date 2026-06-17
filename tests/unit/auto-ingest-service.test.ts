import { describe, expect, it, vi } from "vitest";
import { MainRole } from "@/lib/domain/enums";
import type {
  ExternalGuildReportRef,
  ExternalReport,
} from "@/lib/domain/external";
import type { IGuildSource, IPerformanceSource } from "@/lib/integrations/interfaces";
import {
  autoIngestReports,
  brusselsDate,
  wclNightId,
  type AutoIngestStore,
} from "@/lib/services/auto-ingest-service";

function ref(code: string, iso: string, zone = "SSC / TK"): ExternalGuildReportRef {
  return { reportCode: code, startTime: new Date(iso), zone };
}

function guildSource(reports: ExternalGuildReportRef[]): IGuildSource {
  return {
    fetchAttendance: vi.fn(),
    fetchZoneRanking: vi.fn(),
    fetchComposition: vi.fn(),
    fetchReports: vi.fn(async () => reports),
  };
}

const perfSource: IPerformanceSource = {
  fetchReport: vi.fn(async (code: string): Promise<ExternalReport> => ({
    reportCode: code,
    zone: "SSC / TK",
    totalBossFights: 11,
    clearMs: 3_600_000,
    performances: [
      { name: "Vex", role: MainRole.DPS, parseAvg: 90, dpsOrHps: 1, deaths: 0,
        totalDeaths: 0, interrupts: 0, dispels: 0, hadFlask: true, hadFood: true, hadElixir: true, fightsPresent: 11 },
    ],
  })),
};

// A store that records which nights/reports it saw; resolveNightForDate keys by
// date (the determinism guarantee under test).
function store(ingested: string[] = []): AutoIngestStore & { reports: string[] } {
  const have = new Set(ingested);
  const reports: string[] = [];
  return {
    reports,
    findCharacterIdByNameOrAlias: vi.fn(async () => null),
    upsertReport: vi.fn(async ({ reportCode }) => {
      reports.push(reportCode);
      have.add(reportCode);
      return { wclReportId: `wr-${reportCode}` };
    }),
    deleteReport: vi.fn(),
    replacePerformances: vi.fn(),
    listIngestedReportCodes: vi.fn(async () => have),
    resolveNightForDate: vi.fn(async (date: string) => wclNightId(date)),
  };
}

describe("brusselsDate", () => {
  it("keeps an evening EU raid that crosses midnight UTC on its start day", () => {
    // 22:30 UTC on 2026-06-10 = 00:30 CEST on 2026-06-11 -> Brussels day is the 11th.
    expect(brusselsDate(new Date("2026-06-10T22:30:00Z"))).toBe("2026-06-11");
    // 19:00 UTC on 2026-06-10 = 21:00 CEST same day.
    expect(brusselsDate(new Date("2026-06-10T19:00:00Z"))).toBe("2026-06-10");
  });
});

describe("autoIngestReports", () => {
  it("ingests only NEW 25-man reports, skipping Kara + already-ingested", async () => {
    const reports = [
      ref("new-ssc", "2026-06-10T19:00:00Z", "SSC / TK"),
      ref("old-ssc", "2026-06-03T19:00:00Z", "SSC / TK"), // already ingested
      ref("kara", "2026-06-08T19:00:00Z", "Karazhan"), // 10-man -> skip
    ];
    const s = store(["old-ssc"]);
    const result = await autoIngestReports(guildSource(reports), perfSource, s, 809103, 50);

    expect(s.reports).toEqual(["new-ssc"]); // only the new 25-man one ingested
    expect(result.ingested).toBe(1);
    expect(result.skipped).toBe(2); // kara + already-ingested
    expect(result.affectedNightIds).toEqual([wclNightId("2026-06-10")]);
  });

  it("is idempotent: a second run with everything ingested does nothing", async () => {
    const reports = [ref("a", "2026-06-10T19:00:00Z"), ref("b", "2026-06-11T19:00:00Z")];
    const s = store(["a", "b"]);
    const result = await autoIngestReports(guildSource(reports), perfSource, s, 809103, 50);
    expect(result.ingested).toBe(0);
    expect(s.reports).toEqual([]);
  });
});
