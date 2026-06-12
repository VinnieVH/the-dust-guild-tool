import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type {
  WclReportDetail,
  WclReportMeta,
} from "@/lib/integrations/warcraftlogs/dto";
import { mapReport } from "@/lib/integrations/warcraftlogs/mapper";

// Runs the WCL mapper against the REAL recorded report (fixture). No network, no
// DB — the fixture is the contract. The fixture is a full SSC/TK clear:
// 10 boss kills, 25 performers, recorded from report NYh79GKXvVqMA6rW.
const dir = join(process.cwd(), "tests/fixtures/warcraftlogs");
const load = <T>(f: string): T =>
  JSON.parse(readFileSync(join(dir, f), "utf8")) as T;

describe("WCL mapper (recorded fixture)", () => {
  const meta = load<WclReportMeta>("report-meta.json");
  const detail = load<WclReportDetail>("report-detail.json");
  const report = mapReport(meta, detail);

  it("reads zone name as a free string (combined SSC/TK zone)", () => {
    expect(report.zone).toBe("SSC / TK");
  });

  it("counts only boss KILLS as boss fights (wipes excluded)", () => {
    // 13 encounter fights, 3 wipes (Void Reaver, Kael'thas x1, Fathom-Lord x1).
    expect(report.totalBossFights).toBe(10);
  });

  it("produces one performance per distinct character", () => {
    expect(report.performances).toHaveLength(25);
    const names = new Set(report.performances.map((p) => p.name));
    expect(names.size).toBe(25);
  });

  it("assigns roles from WCL's own bucketing", () => {
    const roles = new Set(report.performances.map((p) => p.role));
    expect(roles).toContain("TANK");
    expect(roles).toContain("HEALER");
    expect(roles).toContain("DPS");
  });

  it("yields realistic parse percentiles (0-100)", () => {
    for (const p of report.performances) {
      expect(p.parseAvg).toBeGreaterThanOrEqual(0);
      expect(p.parseAvg).toBeLessThanOrEqual(100);
    }
  });

  it("counts successful interrupts by source (Kyrem = 4)", () => {
    const kyrem = report.performances.find((p) => p.name === "Kyrem");
    expect(kyrem?.interrupts).toBe(4);
  });

  it("counts dispels by source (Sajkol = 2)", () => {
    const sajkol = report.performances.find((p) => p.name === "Sajkol");
    expect(sajkol?.dispels).toBe(2);
  });

  it("detects self-applied consumables, not raid buffs", () => {
    // Skreamo ran a flask + food + elixir (all 3 categories) in this report.
    const skreamo = report.performances.find((p) => p.name === "Skreamo");
    expect(skreamo).toBeDefined();
    expect(
      [skreamo!.hadFlask, skreamo!.hadFood, skreamo!.hadElixir].filter(Boolean)
        .length,
    ).toBe(3);

    // Sanity: NOT everyone is "fully buffed" — the self-source + allowlist
    // filter must exclude raid buffs, or this whole achievement is meaningless.
    const fullyBuffed = report.performances.filter(
      (p) => p.hadFlask && p.hadFood && p.hadElixir,
    );
    expect(fullyBuffed.length).toBeGreaterThan(0);
    expect(fullyBuffed.length).toBeLessThan(report.performances.length);
  });
});
