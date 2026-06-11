import type { MainRole } from "@/lib/domain/enums";
import { db } from "@/lib/db";

// Read-side view models for the raid pages. The UI reads only these (no Prisma
// types leak up, no live API calls — Postgres is the cache).

export interface RaidNightListItem {
  id: string;
  title: string;
  date: Date;
  signupCount: number;
}

export interface RosterEntry {
  name: string; // claimed character name if any, else Discord display name
  class: string | null;
  spec: string;
  role: MainRole | null;
  status: string;
}

export interface RaidNightDetail {
  id: string;
  title: string;
  date: Date;
  roster: RosterEntry[];
}

// Upcoming nights (today onward), soonest first.
export async function listUpcomingRaidNights(): Promise<RaidNightListItem[]> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const nights = await db.raidNight.findMany({
    where: { date: { gte: startOfToday } },
    orderBy: { date: "asc" },
    select: {
      id: true,
      title: true,
      date: true,
      _count: { select: { signups: true } },
    },
  });

  return nights.map((n) => ({
    id: n.id,
    title: n.title,
    date: n.date,
    signupCount: n._count.signups,
  }));
}

export async function getRaidNightDetail(
  id: string,
): Promise<RaidNightDetail | null> {
  const night = await db.raidNight.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      date: true,
      signups: {
        select: {
          status: true,
          specSignedAs: true,
          role: true,
          user: {
            select: {
              discordName: true,
              // A user may own multiple characters; for the roster we show the
              // first claimed character's name/class if present.
              characters: {
                select: { name: true, class: true },
                orderBy: { name: "asc" },
                take: 1,
              },
            },
          },
        },
        orderBy: { specSignedAs: "asc" },
      },
    },
  });

  if (!night) return null;

  const roster: RosterEntry[] = night.signups.map((s) => {
    const character = s.user.characters[0];
    return {
      name: character?.name ?? s.user.discordName,
      class: character?.class ?? null,
      spec: s.specSignedAs,
      role: s.role,
      status: s.status,
    };
  });

  return { id: night.id, title: night.title, date: night.date, roster };
}
