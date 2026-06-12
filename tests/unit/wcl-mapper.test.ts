import { describe, expect, it } from "vitest";
import type {
  WclReportDetail,
  WclReportMeta,
} from "@/lib/integrations/warcraftlogs/dto";
import { killFightIds, mapReport } from "@/lib/integrations/warcraftlogs/mapper";

// Pure unit tests for the WCL mapper logic, using hand-built minimal DTOs to
// exercise edges the recorded fixture can't (role tie-breaks, raid-buff
// rejection, multi-fight averaging, empty report). The fixture proves the real
// shape; these prove the rules.

function meta(
  opts: {
    zone?: string;
    actors?: Array<{ id: number; name: string; subType: string }>;
    fights?: Array<{ id: number; kill: boolean; friendlyPlayers?: number[] }>;
  } = {},
): WclReportMeta {
  return {
    reportData: {
      report: {
        code: "ABC",
        zone: { id: 1, name: opts.zone ?? "Karazhan" },
        masterData: { actors: opts.actors ?? [] },
        fights: (opts.fights ?? []).map((f) => ({
          id: f.id,
          name: `Fight ${f.id}`,
          encounterID: 100 + f.id,
          kill: f.kill,
          friendlyPlayers: f.friendlyPlayers ?? [],
        })),
      },
    },
  };
}

function emptyStreams() {
  return {
    deaths: { data: { entries: [] } },
    interrupts: { data: [], nextPageTimestamp: null },
    dispels: { data: [], nextPageTimestamp: null },
    combatantInfo: { data: [], nextPageTimestamp: null },
  };
}

describe("WCL mapper — pure logic", () => {
  it("averages parse percentile across the fights a player is present for", () => {
    const detail: WclReportDetail = {
      reportData: {
        report: {
          rankings: {
            data: [
              {
                fightID: 1,
                encounter: { id: 1, name: "A" },
                roles: {
                  dps: {
                    characters: [
                      { id: 1, name: "Vex", class: "Mage", spec: "Fire", amount: 1000, rankPercent: 80 },
                    ],
                  },
                },
              },
              {
                fightID: 2,
                encounter: { id: 2, name: "B" },
                roles: {
                  dps: {
                    characters: [
                      { id: 1, name: "Vex", class: "Mage", spec: "Fire", amount: 2000, rankPercent: 100 },
                    ],
                  },
                },
              },
            ],
          },
          ...emptyStreams(),
        },
      },
    };
    const report = mapReport(
      meta({ fights: [{ id: 1, kill: true }, { id: 2, kill: true }] }),
      detail,
    );
    const vex = report.performances.find((p) => p.name === "Vex")!;
    expect(vex.parseAvg).toBe(90); // mean(80,100)
    expect(vex.dpsOrHps).toBe(1500); // mean(1000,2000)
    expect(vex.fightsPresent).toBe(2);
    expect(vex.role).toBe("DPS");
  });

  it("assigns the dominant role when a player spans buckets (off-spec fight)", () => {
    const detail: WclReportDetail = {
      reportData: {
        report: {
          rankings: {
            data: [
              {
                fightID: 1,
                encounter: { id: 1, name: "A" },
                roles: {
                  tanks: { characters: [{ id: 5, name: "Bear", class: "Druid", spec: "Feral", amount: 1, rankPercent: 50 }] },
                },
              },
              {
                fightID: 2,
                encounter: { id: 2, name: "B" },
                roles: {
                  tanks: { characters: [{ id: 5, name: "Bear", class: "Druid", spec: "Feral", amount: 1, rankPercent: 60 }] },
                },
              },
              {
                fightID: 3,
                encounter: { id: 3, name: "C" },
                roles: {
                  dps: { characters: [{ id: 5, name: "Bear", class: "Druid", spec: "Feral", amount: 1, rankPercent: 70 }] },
                },
              },
            ],
          },
          ...emptyStreams(),
        },
      },
    };
    const report = mapReport(
      meta({ fights: [{ id: 1, kill: true }, { id: 2, kill: true }, { id: 3, kill: true }] }),
      detail,
    );
    // tanked 2 of 3 fights -> TANK for the night.
    expect(report.performances[0].role).toBe("TANK");
  });

  it("counts deaths by name and interrupts/dispels by source actor", () => {
    const detail: WclReportDetail = {
      reportData: {
        report: {
          rankings: {
            data: [
              {
                fightID: 1,
                encounter: { id: 1, name: "A" },
                roles: {
                  dps: {
                    characters: [
                      { id: 1, name: "Vex", class: "Mage", spec: "Fire", amount: 1, rankPercent: 50 },
                      { id: 2, name: "Kik", class: "Rogue", spec: "Combat", amount: 1, rankPercent: 50 },
                    ],
                  },
                },
              },
            ],
          },
          deaths: { data: { entries: [
            { name: "Vex", id: 1, fight: 1 },
            { name: "Vex", id: 1, fight: 1 },
          ] } },
          interrupts: { data: [
            { type: "interrupt", sourceID: 2, fight: 1 },
            { type: "interrupt", sourceID: 2, fight: 1 },
            { type: "interrupt", sourceID: 2, fight: 1 },
          ], nextPageTimestamp: null },
          dispels: { data: [{ type: "dispel", sourceID: 1, fight: 1 }], nextPageTimestamp: null },
          combatantInfo: { data: [], nextPageTimestamp: null },
        },
      },
    };
    const report = mapReport(
      meta({
        actors: [
          { id: 1, name: "Vex", subType: "Mage" },
          { id: 2, name: "Kik", subType: "Rogue" },
        ],
        fights: [{ id: 1, kill: true }],
      }),
      detail,
    );
    const vex = report.performances.find((p) => p.name === "Vex")!;
    const kik = report.performances.find((p) => p.name === "Kik")!;
    expect(vex.deaths).toBe(2);
    expect(kik.interrupts).toBe(3);
    expect(vex.dispels).toBe(1);
    expect(kik.deaths).toBe(0);
  });

  it("counts a consumable only when SELF-applied (raid buffs from others ignored)", () => {
    const detail: WclReportDetail = {
      reportData: {
        report: {
          rankings: {
            data: [
              {
                fightID: 1,
                encounter: { id: 1, name: "A" },
                roles: { dps: { characters: [{ id: 1, name: "Vex", class: "Mage", spec: "Fire", amount: 1, rankPercent: 50 }] } },
              },
            ],
          },
          deaths: { data: { entries: [] } },
          interrupts: { data: [], nextPageTimestamp: null },
          dispels: { data: [], nextPageTimestamp: null },
          combatantInfo: { data: [
            {
              sourceID: 1,
              fight: 1,
              auras: [
                { source: 1, ability: 28540, name: "Flask of Pure Death" }, // self flask -> counts
                { source: 9, ability: 33256, name: "Well Fed" }, // applied by someone else -> ignored
                { source: 1, ability: 27127, name: "Arcane Brilliance" }, // self but NOT a consumable -> ignored
              ],
            },
          ], nextPageTimestamp: null },
        },
      },
    };
    const report = mapReport(
      meta({ actors: [{ id: 1, name: "Vex", subType: "Mage" }], fights: [{ id: 1, kill: true }] }),
      detail,
    );
    const vex = report.performances[0];
    expect(vex.hadFlask).toBe(true); // self-applied flask
    expect(vex.hadFood).toBe(false); // food was applied by another source id
    expect(vex.hadElixir).toBe(false); // Arcane Brilliance is not a consumable
  });

  it("only counts boss KILLS as boss fights", () => {
    const m = meta({ fights: [
      { id: 1, kill: true },
      { id: 2, kill: false },
      { id: 3, kill: true },
    ] });
    expect(killFightIds(m)).toEqual([1, 3]);
  });

  it("counts fightsPresent from friendlyPlayers (presence), not parses", () => {
    // Vex is present (friendlyPlayers) for both kills but only PARSED on fight 1.
    const detail: WclReportDetail = {
      reportData: {
        report: {
          rankings: {
            data: [
              {
                fightID: 1,
                encounter: { id: 1, name: "A" },
                roles: { dps: { characters: [{ id: 1, name: "Vex", class: "Mage", spec: "Fire", amount: 1, rankPercent: 50 }] } },
              },
            ],
          },
          ...emptyStreams(),
        },
      },
    };
    const report = mapReport(
      meta({
        actors: [{ id: 1, name: "Vex", subType: "Mage" }],
        fights: [
          { id: 1, kill: true, friendlyPlayers: [1] },
          { id: 2, kill: true, friendlyPlayers: [1] },
        ],
      }),
      detail,
    );
    const vex = report.performances.find((p) => p.name === "Vex")!;
    // present for 2 kills even though only 1 parse — the 75% gate needs this.
    expect(vex.fightsPresent).toBe(2);
    expect(report.totalBossFights).toBe(2);
  });

  it("surfaces a player who died but never registered a parse", () => {
    const detail: WclReportDetail = {
      reportData: {
        report: {
          rankings: { data: [] },
          deaths: { data: { entries: [{ name: "Ghost", id: 7, fight: 1 }] } },
          interrupts: { data: [], nextPageTimestamp: null },
          dispels: { data: [], nextPageTimestamp: null },
          combatantInfo: { data: [], nextPageTimestamp: null },
        },
      },
    };
    const report = mapReport(
      meta({
        actors: [{ id: 7, name: "Ghost", subType: "Priest" }],
        fights: [{ id: 1, kill: true, friendlyPlayers: [7] }],
      }),
      detail,
    );
    const ghost = report.performances.find((p) => p.name === "Ghost");
    expect(ghost).toBeDefined();
    expect(ghost!.deaths).toBe(1);
    expect(ghost!.fightsPresent).toBe(1);
  });

  it("handles a report with no kills (empty but valid)", () => {
    const detail: WclReportDetail = {
      reportData: {
        report: {
          rankings: { data: [] },
          ...emptyStreams(),
        },
      },
    };
    const report = mapReport(meta({ zone: "Gruul's Lair", fights: [] }), detail);
    expect(report.zone).toBe("Gruul's Lair");
    expect(report.totalBossFights).toBe(0);
    expect(report.performances).toEqual([]);
  });
});
