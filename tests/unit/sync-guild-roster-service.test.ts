import { describe, expect, it, vi } from "vitest";
import type { ExternalGuildMember } from "@/lib/domain/external";
import type { IGuildSource } from "@/lib/integrations/interfaces";
import {
  syncGuildRoster,
  type GuildRosterStore,
} from "@/lib/services/sync-guild-roster-service";

const NOW = new Date("2026-06-13T12:00:00Z");

function guildSource(roster: ExternalGuildMember[]): IGuildSource {
  return {
    fetchAttendance: vi.fn(),
    fetchZoneRanking: vi.fn(),
    fetchRoster: vi.fn(async () => roster),
  };
}

describe("syncGuildRoster", () => {
  it("replaces the roster with the fetched snapshot, stamped with now", async () => {
    const roster: ExternalGuildMember[] = [
      { name: "Koczikson", className: "Paladin", level: 70 },
      { name: "Arvuna", className: "Warlock", level: 70 },
    ];
    let captured: { members: ExternalGuildMember[]; at: Date } | null = null;
    const store: GuildRosterStore = {
      replaceRoster: vi.fn(async (members, at) => {
        captured = { members, at };
      }),
    };

    const result = await syncGuildRoster(guildSource(roster), store, 809103, NOW);

    expect(result.members).toBe(2);
    expect(captured!.members).toEqual(roster);
    expect(captured!.at).toBe(NOW);
  });
});
