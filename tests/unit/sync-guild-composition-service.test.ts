import { describe, expect, it, vi } from "vitest";
import { MainRole } from "@/lib/domain/enums";
import type {
  ExternalCompositionMember,
  ExternalGuildAttendance,
} from "@/lib/domain/external";
import type { IGuildSource } from "@/lib/integrations/interfaces";
import {
  syncGuildComposition,
  type GuildCompositionStore,
} from "@/lib/services/sync-guild-composition-service";

const NOW = new Date("2026-06-13T12:00:00Z");

function night(code: string, startTime: number, zone: string): ExternalGuildAttendance {
  return { reportCode: code, startTime: new Date(startTime), zone, players: [] };
}

function source(
  history: ExternalGuildAttendance[],
  comp: ExternalCompositionMember[],
  spy?: (code: string) => void,
): IGuildSource {
  return {
    fetchAttendance: vi.fn(async () => history),
    fetchZoneRanking: vi.fn(),
    fetchComposition: vi.fn(async (code: string) => {
      spy?.(code);
      return comp;
    }),
    fetchReports: vi.fn(),
  };
}

const COMP: ExternalCompositionMember[] = [
  { name: "Guntrip", role: MainRole.TANK, className: "Warrior", spec: "Gladiator", maxItemLevel: 127 },
  { name: "Kociak", role: MainRole.DPS, className: "Druid", spec: "Feral", maxItemLevel: 120 },
];

describe("syncGuildComposition", () => {
  it("sources from the NEWEST 25-man report, ignoring 10-man and older", async () => {
    const history = [
      night("old-ssc", 1000, "SSC / TK"),
      night("kara", 5000, "Karazhan"), // newest overall, but 10-man -> skipped
      night("latest-gm", 3000, "Gruul / Magtheridon"), // newest 25-man
    ];
    let fetched = "";
    const src = source(history, COMP, (c) => {
      fetched = c;
    });
    const store: GuildCompositionStore = { replaceComposition: vi.fn(async () => {}) };

    const result = await syncGuildComposition(src, store, 809103, NOW);

    expect(fetched).toBe("latest-gm"); // newest 25-man, not the newer Kara
    expect(result.sourceReportCode).toBe("latest-gm");
    expect(result.members).toBe(2);
    expect(store.replaceComposition).toHaveBeenCalledWith(COMP, "latest-gm", NOW);
  });

  it("no-ops cleanly when there's no logged 25-man report", async () => {
    const history = [night("kara", 5000, "Karazhan")];
    const store: GuildCompositionStore = { replaceComposition: vi.fn(async () => {}) };
    const result = await syncGuildComposition(source(history, COMP), store, 809103, NOW);
    expect(result).toEqual({ sourceReportCode: null, members: 0 });
    expect(store.replaceComposition).not.toHaveBeenCalled();
  });
});
