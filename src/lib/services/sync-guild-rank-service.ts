import type { ExternalZoneRanking } from "@/lib/domain/external";
import { RAID_25_ZONES, zoneId } from "@/lib/domain/wow";
import type { IGuildSource } from "@/lib/integrations/interfaces";

// Refresh the live guild zone rankings (display-only, never awarded) for EVERY
// 25-man raid we care about — pulled straight from WCL's guild zoneRanking,
// with NO dependency on whether we've ingested a report for that zone. (This is
// the same data WCL shows in its own "Rankings" panel.) Runs on the guild-level
// refresh / cron.

export interface GuildRankStore {
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
  let refreshed = 0;
  let skipped = 0;

  // The fixed set of 25-man raids — not "zones we've logged". Rankings exist on
  // WCL regardless of our own ingestion.
  for (const name of RAID_25_ZONES) {
    const id = zoneId(name);
    if (id == null) {
      skipped += 1; // no known WCL zone id -> can't query its rank
      continue;
    }
    const ranking = await guildSource.fetchZoneRanking(guildId, id);
    // The ranking response doesn't echo the zone name; supply it from the map.
    await store.upsertZoneRanking({ ...ranking, zoneName: name }, now);
    refreshed += 1;
  }

  return { zonesRefreshed: refreshed, zonesSkipped: skipped };
}
