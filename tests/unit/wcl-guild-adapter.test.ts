import { describe, expect, it, vi } from "vitest";
import type { WclQuerier } from "@/lib/integrations/warcraftlogs/client";
import { WarcraftLogsGuildAdapter } from "@/lib/integrations/warcraftlogs/guild-adapter";
import {
  GUILD_ATTENDANCE,
  GUILD_ZONE_RANKING,
  REPORT_COMPOSITION,
} from "@/lib/integrations/warcraftlogs/queries";
import { MainRole } from "@/lib/domain/enums";

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

describe("WarcraftLogsGuildAdapter — composition", () => {
  it("flattens playerDetails role groups, picks dominant spec + maxItemLevel", async () => {
    const query = vi.fn(async (doc: string, vars: Record<string, unknown>) => {
      if (doc !== REPORT_COMPOSITION) throw new Error("unexpected doc");
      expect(vars.code).toBe("RPT");
      // NOTE the double nesting (data.playerDetails) — matches the live shape.
      return {
        reportData: { report: { playerDetails: { data: { playerDetails: {
          tanks: [
            { name: "Guntrip", type: "Warrior",
              specs: [{ spec: "Gladiator", count: 64 }, { spec: "Protection", count: 10 }],
              minItemLevel: 119, maxItemLevel: 127 },
          ],
          healers: [
            { name: "Lifecoon", type: "Shaman",
              specs: [{ spec: "Restoration", count: 45 }],
              minItemLevel: 121, maxItemLevel: 125 },
          ],
          dps: [
            { name: "Kociak", type: "Druid",
              specs: [{ spec: "Feral", count: 71 }],
              minItemLevel: 113, maxItemLevel: 120 },
          ],
        } } } } },
      };
    });

    const adapter = new WarcraftLogsGuildAdapter(
      { clientId: "x", clientSecret: "y" },
      { query } as unknown as WclQuerier,
    );
    const comp = await adapter.fetchComposition("RPT");
    expect(comp).toEqual([
      { name: "Guntrip", role: MainRole.TANK, className: "Warrior", spec: "Gladiator", maxItemLevel: 127 },
      { name: "Lifecoon", role: MainRole.HEALER, className: "Shaman", spec: "Restoration", maxItemLevel: 125 },
      { name: "Kociak", role: MainRole.DPS, className: "Druid", spec: "Feral", maxItemLevel: 120 },
    ]);
  });

  it("tolerates missing role groups", async () => {
    const query = vi.fn(async () => ({
      reportData: { report: { playerDetails: { data: { playerDetails: {
        dps: [{ name: "Solo", type: "Mage", specs: [{ spec: "Fire", count: 1 }], minItemLevel: 100, maxItemLevel: 110 }],
      } } } } },
    }));
    const adapter = new WarcraftLogsGuildAdapter(
      { clientId: "x", clientSecret: "y" },
      { query } as unknown as WclQuerier,
    );
    const comp = await adapter.fetchComposition("RPT");
    expect(comp).toHaveLength(1);
    expect(comp[0].role).toBe(MainRole.DPS);
  });

  it("dedups a name in two roles, keeping the role with more fights", async () => {
    // Bigmacks off-spec tanked 3 fights but DPS'd 70 — he belongs in DPS.
    const query = vi.fn(async () => ({
      reportData: { report: { playerDetails: { data: { playerDetails: {
        tanks: [{ name: "Bigmacks", type: "Druid", specs: [{ spec: "Guardian", count: 3 }], minItemLevel: 120, maxItemLevel: 127 }],
        dps: [{ name: "Bigmacks", type: "Druid", specs: [{ spec: "Feral", count: 70 }], minItemLevel: 120, maxItemLevel: 127 }],
      } } } } },
    }));
    const adapter = new WarcraftLogsGuildAdapter(
      { clientId: "x", clientSecret: "y" },
      { query } as unknown as WclQuerier,
    );
    const comp = await adapter.fetchComposition("RPT");
    expect(comp).toHaveLength(1); // one entry, not two
    expect(comp[0]).toMatchObject({ name: "Bigmacks", role: MainRole.DPS, spec: "Feral" });
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
