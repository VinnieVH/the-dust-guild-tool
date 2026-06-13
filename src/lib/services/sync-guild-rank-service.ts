import type { ExternalZoneRanking } from "@/lib/domain/external";
import { zoneId } from "@/lib/domain/wow";
import type { IGuildSource } from "@/lib/integrations/interfaces";

// Refresh the live guild zone rankings (display-only, never awarded). For each
// zone the guild has actually logged, fetch its world/region/server speed +
// progress ranks and upsert one GuildZoneRanking row. Runs on the guild-level
// refresh (alongside attendance), not per report.

export interface GuildRankStore {
  /** Distinct zone NAMES the guild has logged (from wcl_reports). */
  listLoggedZoneNames(): Promise<string[]>;
  /** Upsert one zone's ranking (by zoneId), stamping fetchedAt. */
  upsertZoneRanking(ranking: ExternalZoneRanking, fetchedAt: Date): Promise<void>;
}

export interface GuildRankResult {
  zonesRefreshed: number;
  zonesSkipped: number;
}

export async function syncGuildRank(
  guildSource: IGuildSource,
  store: GuildRankStore,
  guildId: number,
  now: Date,
): Promise<GuildRankResult> {
  const zoneNames = await store.listLoggedZoneNames();
  let refreshed = 0;
  let skipped = 0;

  for (const name of zoneNames) {
    const id = zoneId(name);
    if (id == null) {
      skipped += 1; // unknown zone name -> can't query its rank
      continue;
    }
    const ranking = await guildSource.fetchZoneRanking(guildId, id);
    // The ranking response doesn't echo the zone name; supply it from the map.
    await store.upsertZoneRanking({ ...ranking, zoneName: name }, now);
    refreshed += 1;
  }

  return { zonesRefreshed: refreshed, zonesSkipped: skipped };
}
