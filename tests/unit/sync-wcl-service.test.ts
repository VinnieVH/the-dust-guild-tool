import { describe, expect, it, vi } from "vitest";
import { MainRole } from "@/lib/domain/enums";
import type { ExternalReport } from "@/lib/domain/external";
import type { IPerformanceSource } from "@/lib/integrations/interfaces";
import { syncWclReport, type WclSyncStore } from "@/lib/services/sync-wcl-service";

function report(over: Partial<ExternalReport> = {}): ExternalReport {
  return {
    reportCode: "RPT",
    zone: "Karazhan",
    totalBossFights: 2,
    performances: [
      {
        name: "Vex", role: MainRole.DPS, parseAvg: 90, dpsOrHps: 1000,
        deaths: 0, interrupts: 1, dispels: 0,
        hadFlask: true, hadFood: true, hadElixir: false, fightsPresent: 2,
      },
      {
        name: "Ghostname", role: MainRole.HEALER, parseAvg: 70, dpsOrHps: 0,
        deaths: 1, interrupts: 0, dispels: 3,
        hadFlask: false, hadFood: false, hadElixir: false, fightsPresent: 2,
      },
    ],
    ...over,
  };
}

type Rows = Parameters<WclSyncStore["replacePerformances"]>[1];

function fakeStore(known: Record<string, string>) {
  const captured: { rows: Rows | null } = { rows: null };
  const store: WclSyncStore = {
    async findCharacterIdByNameOrAlias(name) {
      return known[name] ?? null;
    },
    async upsertReport() {
      return { wclReportId: "wr1" };
    },
    async deleteReport() {},
    async replacePerformances(_id, rows) {
      captured.rows = rows;
    },
  };
  return { store, captured };
}

describe("syncWclReport", () => {
  it("resolves known names and leaves unknown ones unmatched (queue)", async () => {
    const source: IPerformanceSource = { fetchReport: vi.fn(async () => report()) };
    const { store, captured } = fakeStore({ Vex: "char-vex" }); // Ghostname unknown

    const result = await syncWclReport(source, store, "night-1", "RPT");

    expect(result.matched).toBe(1);
    expect(result.unmatched).toBe(1);
    expect(result.totalBossFights).toBe(2);

    const rows = captured.rows!;
    const vex = rows.find((r) => r.rawName === "Vex")!;
    const ghost = rows.find((r) => r.rawName === "Ghostname")!;
    expect(vex.characterId).toBe("char-vex");
    expect(ghost.characterId).toBeNull(); // kept with rawName for the queue
    expect(ghost.rawName).toBe("Ghostname");
  });

  it("passes through consumable + metric fields faithfully", async () => {
    const source: IPerformanceSource = { fetchReport: vi.fn(async () => report()) };
    const { store, captured } = fakeStore({ Vex: "char-vex" });
    await syncWclReport(source, store, "night-1", "RPT");
    const vex = captured.rows!.find((r) => r.rawName === "Vex")!;
    expect(vex.hadFlask).toBe(true);
    expect(vex.hadFood).toBe(true);
    expect(vex.interrupts).toBe(1);
  });
});
