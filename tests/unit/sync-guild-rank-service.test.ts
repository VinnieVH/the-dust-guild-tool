import { describe, expect, it, vi } from "vitest";
import type { ExternalZoneRanking } from "@/lib/domain/external";
import type { IGuildSource } from "@/lib/integrations/interfaces";
import { RAID_25_ZONES } from "@/lib/domain/wow";
import {
  syncGuildRank,
  type GuildRankStore,
} from "@/lib/services/sync-guild-rank-service";

const NOW = new Date("2026-06-13T12:00:00Z");

function ranking(zoneId: number): ExternalZoneRanking {
  return {
    zoneId, zoneName: "",
    speedWorldRank: 100, speedRegionRank: 50, speedServerRank: 10, speedColor: "rare",
    progWorldRank: null, progRegionRank: null, progServerRank: null,
  };
}

describe("syncGuildRank", () => {
  it("fetches ALL 25-man zones directly — no dependency on ingested reports", async () => {
    const fetched: number[] = [];
    const source: IGuildSource = {
      fetchAttendance: vi.fn(),
      fetchComposition: vi.fn(),
      fetchZoneRanking: vi.fn(async (_g: number, zoneId: number) => {
        fetched.push(zoneId);
        return ranking(zoneId);
      }),
    };
    const upserts: Array<{ zoneName: string; zoneId: number }> = [];
    const store: GuildRankStore = {
      upsertZoneRanking: vi.fn(async (r) => {
        upserts.push({ zoneName: r.zoneName, zoneId: r.zoneId });
      }),
    };

    const result = await syncGuildRank(source, store, 809103, NOW);

    // One fetch + upsert per 25-man zone, none skipped (all have known ids).
    expect(result.zonesRefreshed).toBe(RAID_25_ZONES.length);
    expect(result.zonesSkipped).toBe(0);
    // The zone name is supplied from our map (the ranking response omits it).
    expect(upserts.map((u) => u.zoneName).sort()).toEqual([...RAID_25_ZONES].sort());
  });
});
