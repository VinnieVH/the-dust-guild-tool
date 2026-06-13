import { is25ManZone, RAID_25_ZONES } from "@/lib/domain/wow";
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
  // Fastest clear per zone: min positive clearMs across the guild's reports.
  // Mirrors the speed-record pass's "a zone's clear = its fastest report" rule,
  // so this number agrees with the New Speed Record award.
  const reports = await db.wclReport.findMany({
    where: { clearMs: { gt: 0 } },
    select: { zone: true, clearMs: true },
  });
  const bestByZone = new Map<string, number>();
  for (const r of reports) {
    if (r.clearMs == null || !is25ManZone(r.zone)) continue;
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

// The WCL guild roster, grouped by class for a class-colored grid. Whole guild,
// NOT filtered by content.
export interface RosterMember {
  name: string;
  level: number;
}

export interface RosterClassGroup {
  className: string;
  members: RosterMember[];
}

export interface RosterView {
  total: number;
  fetchedAt: Date | null;
  groups: RosterClassGroup[];
}

export async function getRoster(): Promise<RosterView> {
  const rows = await db.guildMember.findMany({
    orderBy: [{ className: "asc" }, { name: "asc" }],
    select: { name: true, className: true, level: true, fetchedAt: true },
  });

  const byClass = new Map<string, RosterMember[]>();
  for (const r of rows) {
    const list = byClass.get(r.className) ?? [];
    list.push({ name: r.name, level: r.level });
    byClass.set(r.className, list);
  }

  const groups: RosterClassGroup[] = [...byClass.entries()]
    .map(([className, members]) => ({ className, members }))
    .sort((a, b) => a.className.localeCompare(b.className));

  return {
    total: rows.length,
    fetchedAt: rows[0]?.fetchedAt ?? null,
    groups,
  };
}
