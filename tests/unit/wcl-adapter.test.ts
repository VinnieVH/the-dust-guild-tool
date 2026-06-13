import { describe, expect, it, vi } from "vitest";
import { WarcraftLogsAdapter } from "@/lib/integrations/warcraftlogs/adapter";
import type { WclQuerier } from "@/lib/integrations/warcraftlogs/client";
import { EVENTS_PAGE, REPORT_DETAIL, REPORT_META } from "@/lib/integrations/warcraftlogs/queries";

// Exercises the adapter's event-pagination loop (drain). The live fixture fit
// one page (nextPageTimestamp = null), so this is the only thing that proves
// the multi-page concat + EVENTS_PAGE follow-up actually works.

const META = {
  reportData: {
    report: {
      code: "PAGED",
      startTime: 0,
      endTime: 3_600_000,
      zone: { id: 1, name: "Karazhan" },
      masterData: {
        actors: [
          { id: 1, name: "Kicker", subType: "Rogue" },
          { id: 2, name: "Healer", subType: "Priest" },
        ],
      },
      fights: [
        { id: 5, name: "Boss", encounterID: 1, kill: true, friendlyPlayers: [1, 2] },
      ],
    },
  },
};

function rankings() {
  return {
    data: [
      {
        fightID: 5,
        encounter: { id: 1, name: "Boss" },
        roles: {
          dps: { characters: [{ id: 1, name: "Kicker", class: "Rogue", spec: "Combat", amount: 1, rankPercent: 90 }] },
          healers: { characters: [{ id: 2, name: "Healer", class: "Priest", spec: "Holy", amount: 0, rankPercent: 80 }] },
        },
      },
    ],
  };
}

describe("WarcraftLogsAdapter — event pagination", () => {
  it("follows nextPageTimestamp and concatenates event pages", async () => {
    // Page 1 of interrupts carries a nextPageTimestamp; the EVENTS_PAGE
    // follow-up returns the rest and terminates with null.
    const query = vi.fn(async (doc: string, vars: Record<string, unknown>) => {
      if (doc === REPORT_META) return META;
      if (doc === REPORT_DETAIL) {
        return {
          reportData: {
            report: {
              rankings: rankings(),
              deaths: { data: { entries: [] } },
              interrupts: {
                data: [{ type: "interrupt", sourceID: 1, fight: 5 }],
                nextPageTimestamp: 1000, // <-- more pages
              },
              dispels: { data: [], nextPageTimestamp: null },
              combatantInfo: { data: [], nextPageTimestamp: null },
            },
          },
        };
      }
      if (doc === EVENTS_PAGE) {
        // Only interrupts paginates here; return page 2 then stop.
        expect(vars.dataType).toBe("Interrupts");
        expect(vars.startTime).toBe(1000);
        return {
          reportData: {
            report: {
              events: {
                data: [
                  { type: "interrupt", sourceID: 1, fight: 5 },
                  { type: "interrupt", sourceID: 1, fight: 5 },
                ],
                nextPageTimestamp: null,
              },
            },
          },
        };
      }
      throw new Error(`unexpected query: ${doc.slice(0, 30)}`);
    });

    const adapter = new WarcraftLogsAdapter(
      { clientId: "x", clientSecret: "y" },
      { query } as unknown as WclQuerier,
    );

    const report = await adapter.fetchReport("PAGED");
    const kicker = report.performances.find((p) => p.name === "Kicker")!;

    // 1 from page 1 + 2 from page 2 = 3 total interrupts.
    expect(kicker.interrupts).toBe(3);
    // EVENTS_PAGE was actually called (the loop body ran).
    expect(query).toHaveBeenCalledWith(EVENTS_PAGE, expect.anything());
  });

  it("returns an empty-but-valid report when there are no boss kills", async () => {
    const query = vi.fn(async (doc: string) => {
      if (doc === REPORT_META) {
        return {
          reportData: {
            report: {
              code: "WIPES",
              startTime: 0,
              endTime: 1000,
              zone: { id: 1, name: "Gruul's Lair" },
              masterData: { actors: [] },
              fights: [
                { id: 1, name: "Boss", encounterID: 1, kill: false, friendlyPlayers: [] },
              ],
            },
          },
        };
      }
      throw new Error("detail should not be fetched when there are no kills");
    });

    const adapter = new WarcraftLogsAdapter(
      { clientId: "x", clientSecret: "y" },
      { query } as unknown as WclQuerier,
    );
    const report = await adapter.fetchReport("WIPES");
    expect(report.totalBossFights).toBe(0);
    expect(report.performances).toEqual([]);
    // detail query was never issued (only the meta call).
    expect(query).toHaveBeenCalledTimes(1);
  });
});
