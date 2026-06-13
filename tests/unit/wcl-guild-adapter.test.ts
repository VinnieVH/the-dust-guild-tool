import { describe, expect, it, vi } from "vitest";
import type { WclQuerier } from "@/lib/integrations/warcraftlogs/client";
import { WarcraftLogsGuildAdapter } from "@/lib/integrations/warcraftlogs/guild-adapter";
import {
  GUILD_ATTENDANCE,
  GUILD_MEMBERS,
  GUILD_ZONE_RANKING,
} from "@/lib/integrations/warcraftlogs/queries";

describe("WarcraftLogsGuildAdapter — attendance pagination", () => {
  it("pages through has_more_pages and concatenates nights", async () => {
    const query = vi.fn(async (doc: string, vars: Record<string, unknown>) => {
      if (doc !== GUILD_ATTENDANCE) throw new Error("unexpected doc");
      const page = vars.page as number;
      if (page === 1) {
        return {
          guildData: { guild: { attendance: {
            total: 3, current_page: 1, last_page: 2, has_more_pages: true,
            data: [
              { code: "r1", startTime: 1000, zone: { name: "Karazhan" }, players: [{ name: "Vex", presence: 1 }] },
              { code: "r2", startTime: 2000, zone: { name: "SSC / TK" }, players: [{ name: "Vex", presence: 1 }] },
            ],
          } } } };
      }
      return {
        guildData: { guild: { attendance: {
          total: 3, current_page: 2, last_page: 2, has_more_pages: false,
          data: [
            { code: "r3", startTime: 3000, zone: { name: "SSC / TK" }, players: [{ name: "Vex", presence: 2 }] },
          ],
        } } } };
    });

    const adapter = new WarcraftLogsGuildAdapter(
      { clientId: "x", clientSecret: "y" },
      { query } as unknown as WclQuerier,
    );
    const nights = await adapter.fetchAttendance(809103);
    expect(nights.map((n) => n.reportCode)).toEqual(["r1", "r2", "r3"]);
    expect(query).toHaveBeenCalledTimes(2); // followed pagination
    // presence 2 (partial) still counts as present.
    expect(nights[2].players[0].present).toBe(true);
    expect(nights[0].startTime).toBeInstanceOf(Date);
  });
});

describe("WarcraftLogsGuildAdapter — roster", () => {
  it("pages through members and maps WCL classID -> class name", async () => {
    const query = vi.fn(async (doc: string, vars: Record<string, unknown>) => {
      if (doc !== GUILD_MEMBERS) throw new Error("unexpected doc");
      const page = vars.page as number;
      if (page === 1) {
        return {
          guildData: { guild: { members: {
            total: 3, current_page: 1, last_page: 2, has_more_pages: true,
            data: [
              { name: "Koczikson", classID: 6, level: 70 }, // Paladin
              { name: "Arvuna", classID: 10, level: 70 }, // Warlock
            ],
          } } } };
      }
      return {
        guildData: { guild: { members: {
          total: 3, current_page: 2, last_page: 2, has_more_pages: false,
          data: [{ name: "Bigmacks", classID: 2, level: 68 }], // Druid
        } } } };
    });

    const adapter = new WarcraftLogsGuildAdapter(
      { clientId: "x", clientSecret: "y" },
      { query } as unknown as WclQuerier,
    );
    const roster = await adapter.fetchRoster(809103);
    expect(query).toHaveBeenCalledTimes(2); // followed pagination
    expect(roster).toEqual([
      { name: "Koczikson", className: "Paladin", level: 70 },
      { name: "Arvuna", className: "Warlock", level: 70 },
      { name: "Bigmacks", className: "Druid", level: 68 },
    ]);
  });
});

describe("WarcraftLogsGuildAdapter — zone ranking", () => {
  it("maps speed/progress ranks + color", async () => {
    const query = vi.fn(async (doc: string) => {
      if (doc !== GUILD_ZONE_RANKING) throw new Error("unexpected doc");
      return {
        guildData: { guild: { zoneRanking: {
          progress: { worldRank: { number: 1315 }, regionRank: { number: 595 }, serverRank: { number: 210 } },
          speed: { worldRank: { number: 363, color: "rare" }, regionRank: { number: 204 }, serverRank: { number: 45 } },
        } } },
      };
    });
    const adapter = new WarcraftLogsGuildAdapter(
      { clientId: "x", clientSecret: "y" },
      { query } as unknown as WclQuerier,
    );
    const r = await adapter.fetchZoneRanking(809103, 1056);
    expect(r.speedServerRank).toBe(45);
    expect(r.speedColor).toBe("rare");
    expect(r.progWorldRank).toBe(1315);
  });

  it("tolerates a guild with no ranking yet (all null)", async () => {
    const query = vi.fn(async () => ({
      guildData: { guild: { zoneRanking: { progress: null, speed: null } } },
    }));
    const adapter = new WarcraftLogsGuildAdapter(
      { clientId: "x", clientSecret: "y" },
      { query } as unknown as WclQuerier,
    );
    const r = await adapter.fetchZoneRanking(809103, 9999);
    expect(r.speedServerRank).toBeNull();
    expect(r.speedColor).toBeNull();
  });
});
