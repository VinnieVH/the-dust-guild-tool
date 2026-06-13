import { db } from "@/lib/db";

// Read-side view models for the guild dashboard: live zone rankings + the
// guild's current speed-record nights.

export interface ZoneRankView {
  zoneName: string;
  speedServerRank: number | null;
  speedRegionRank: number | null;
  speedWorldRank: number | null;
  speedColor: string | null;
  progServerRank: number | null;
  fetchedAt: Date;
}

export interface SpeedRecordView {
  raidNightId: string;
  title: string;
  date: Date;
  zone: string | null;
}

export async function getZoneRankings(): Promise<ZoneRankView[]> {
  const rows = await db.guildZoneRanking.findMany({
    orderBy: { zoneName: "asc" },
  });
  return rows.map((r) => ({
    zoneName: r.zoneName,
    speedServerRank: r.speedServerRank,
    speedRegionRank: r.speedRegionRank,
    speedWorldRank: r.speedWorldRank,
    speedColor: r.speedColor,
    progServerRank: r.progServerRank,
    fetchedAt: r.fetchedAt,
  }));
}

// Nights that currently hold a speed record (distinct raid nights with a
// new-speed-record award), newest first.
export async function getSpeedRecordNights(): Promise<SpeedRecordView[]> {
  const awards = await db.achievementAward.findMany({
    where: { achievement: { key: "new-speed-record" } },
    select: {
      raidNight: {
        select: {
          id: true,
          title: true,
          date: true,
          reports: { select: { zone: true }, take: 1 },
        },
      },
    },
  });

  // Distinct by raid night (everyone present shares the award).
  const byNight = new Map<string, SpeedRecordView>();
  for (const a of awards) {
    const n = a.raidNight;
    if (!byNight.has(n.id)) {
      byNight.set(n.id, {
        raidNightId: n.id,
        title: n.title,
        date: n.date,
        zone: n.reports[0]?.zone ?? null,
      });
    }
  }
  return [...byNight.values()].sort((a, b) => b.date.getTime() - a.date.getTime());
}
