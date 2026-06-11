import type { Instance } from "@/lib/domain/enums";
import { db } from "@/lib/db";

// Read-side view models for the officer admin pages.

export interface AdminRaidNightListItem {
  id: string;
  title: string;
  date: Date;
  sheetCount: number;
}

export interface AdminRaidNightDetail {
  id: string;
  title: string;
  date: Date;
  sheets: { instance: Instance; softresId: string }[];
}

// Recent + upcoming nights, soonest-future first then recent past, so officers
// can link sheets ahead of a raid and fix up afterwards.
export async function listRaidNightsForAdmin(): Promise<
  AdminRaidNightListItem[]
> {
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
  return nights.map((n) => ({
    id: n.id,
    title: n.title,
    date: n.date,
    sheetCount: n._count.sheets,
  }));
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
        orderBy: { instance: "asc" },
        select: { instance: true, softresId: true },
      },
    },
  });
  if (!night) return null;
  return {
    id: night.id,
    title: night.title,
    date: night.date,
    sheets: night.sheets.map((s) => ({
      instance: s.instance as Instance,
      softresId: s.softresId,
    })),
  };
}
