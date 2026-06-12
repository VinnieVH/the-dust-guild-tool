import { db } from "@/lib/db";

// Read-side view models for the officer admin pages.

export interface AdminRaidNightListItem {
  id: string;
  title: string;
  date: Date;
  sheetCount: number;
}

export interface AdminSheet {
  id: string;
  name: string;
  softresId: string;
}

export interface AdminRaidNightDetail {
  id: string;
  title: string;
  date: Date;
  sheets: AdminSheet[];
}

// Recent + upcoming nights, split into upcoming (soonest first) and past
// (most recent first). Partitioning here keeps `Date.now()` out of the render
// (React purity rule) — the server query is the right place for "now".
export async function listRaidNightsForAdmin(): Promise<{
  upcoming: AdminRaidNightListItem[];
  past: AdminRaidNightListItem[];
}> {
  const nights = await db.raidNight.findMany({
    orderBy: { date: "desc" },
    take: 30,
    select: {
      id: true,
      title: true,
      date: true,
      _count: { select: { sheets: true } },
    },
  });
  const items = nights.map((n) => ({
    id: n.id,
    title: n.title,
    date: n.date,
    sheetCount: n._count.sheets,
  }));

  const now = Date.now();
  const upcoming = items
    .filter((n) => n.date.getTime() >= now)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const past = items.filter((n) => n.date.getTime() < now);
  return { upcoming, past };
}

export async function getRaidNightForAdmin(
  id: string,
): Promise<AdminRaidNightDetail | null> {
  const night = await db.raidNight.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      date: true,
      sheets: {
        orderBy: { name: "asc" },
        select: { id: true, name: true, softresId: true },
      },
    },
  });
  if (!night) return null;
  return {
    id: night.id,
    title: night.title,
    date: night.date,
    sheets: night.sheets.map((s) => ({
      id: s.id,
      name: s.name,
      softresId: s.softresId,
    })),
  };
}
