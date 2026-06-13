import { MainRole } from "@/lib/domain/enums";
import { is25ManZone, RAID_25_ZONES, zoneBossCount } from "@/lib/domain/wow";
import { db } from "@/lib/db";

// Read-side view models for the guild dashboard: per-25-man-zone standings
// (our fastest clear + live realm/region/world rank) and the WCL roster.

// One per-zone standings card: the guild's own fastest clear + live R/R/W rank,
// for each 25-man raid (fixed set, in progression order). Either half may be
// null (not cleared yet / not ranked yet) — the card shows "—".
export interface ZoneBestView {
  zoneName: string;
  /** Fastest clear (ms) the guild has logged for this zone, or null. */
  bestClearMs: number | null;
  speedServerRank: number | null;
  speedRegionRank: number | null;
  speedWorldRank: number | null;
  speedColor: string | null;
  rankFetchedAt: Date | null;
}

export async function getZoneBests(): Promise<ZoneBestView[]> {
  // Fastest clear per zone: min positive clearMs across the guild's FULL clears.
  // Only a full clear (every boss killed) counts — a fast partial must not beat
  // a slow real clear (auto-ingest pulls partials too). Mirrors the speed-record
  // pass's full-clear gate so this number agrees with the New Speed Record award.
  const reports = await db.wclReport.findMany({
    where: { clearMs: { gt: 0 } },
    select: { zone: true, clearMs: true, bossKills: true },
  });
  const bestByZone = new Map<string, number>();
  for (const r of reports) {
    if (r.clearMs == null || !is25ManZone(r.zone)) continue;
    const fullClear = r.bossKills != null && r.bossKills >= (zoneBossCount(r.zone) ?? Infinity);
    if (!fullClear) continue;
    const cur = bestByZone.get(r.zone);
    if (cur == null || r.clearMs < cur) bestByZone.set(r.zone, r.clearMs);
  }

  const rankings = await db.guildZoneRanking.findMany();
  const rankByZone = new Map(rankings.map((r) => [r.zoneName, r]));

  // Fixed set, progression order — show every 25-man raid even before a clear.
  return RAID_25_ZONES.map((zoneName) => {
    const rank = rankByZone.get(zoneName);
    return {
      zoneName,
      bestClearMs: bestByZone.get(zoneName) ?? null,
      speedServerRank: rank?.speedServerRank ?? null,
      speedRegionRank: rank?.speedRegionRank ?? null,
      speedWorldRank: rank?.speedWorldRank ?? null,
      speedColor: rank?.speedColor ?? null,
      rankFetchedAt: rank?.fetchedAt ?? null,
    };
  });
}

// The guild's raid composition (from the latest report), grouped by role for a
// Tanks/Healers/DPS layout like WCL's Composition panel. Each raider carries
// their class (for color), played spec, and best item level.
export interface CompositionMember {
  name: string;
  className: string;
  spec: string;
  maxItemLevel: number;
}

export interface CompositionView {
  total: number;
  fetchedAt: Date | null;
  tanks: CompositionMember[];
  healers: CompositionMember[];
  dps: CompositionMember[];
}

export async function getComposition(): Promise<CompositionView> {
  const rows = await db.guildComposition.findMany({
    // Within a role, show the best-geared first (matches "who's carrying").
    orderBy: [{ maxItemLevel: "desc" }, { name: "asc" }],
    select: { name: true, role: true, className: true, spec: true, maxItemLevel: true, fetchedAt: true },
  });

  const pick = (role: MainRole): CompositionMember[] =>
    rows
      .filter((r) => r.role === role)
      .map((r) => ({
        name: r.name,
        className: r.className,
        spec: r.spec,
        maxItemLevel: r.maxItemLevel,
      }));

  return {
    total: rows.length,
    fetchedAt: rows[0]?.fetchedAt ?? null,
    tanks: pick(MainRole.TANK),
    healers: pick(MainRole.HEALER),
    dps: pick(MainRole.DPS),
  };
}
