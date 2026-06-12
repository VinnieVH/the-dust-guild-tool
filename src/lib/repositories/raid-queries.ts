import type { MainRole } from "@/lib/domain/enums";
import { db } from "@/lib/db";

// Read-side view models for the raid pages. The UI reads only these (no Prisma
// types leak up, no live API calls — Postgres is the cache).

export interface RaidNightListItem {
  id: string;
  title: string;
  date: Date;
  signupCount: number;
  confirmedCount: number;
  tentativeCount: number;
  roleCounts: Record<MainRole, number>;
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
      signups: { select: { status: true, role: true } },
    },
  });

  return nights.map((n) => {
    const roleCounts: Record<MainRole, number> = { TANK: 0, HEALER: 0, DPS: 0 };
    let confirmedCount = 0;
    let tentativeCount = 0;

    for (const s of n.signups) {
      if (s.status === "CONFIRMED") confirmedCount += 1;
      else if (s.status === "TENTATIVE") tentativeCount += 1;
      if (s.role) roleCounts[s.role] += 1;
    }

    return {
      id: n.id,
      title: n.title,
      date: n.date,
      signupCount: n.signups.length,
      confirmedCount,
      tentativeCount,
      roleCounts,
    };
  });
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
          // The as-signed-up identity, persisted per night. A user owns many
          // characters (main + alts) and signs up as a specific one each night,
          // so the roster MUST read the signup's own name/class — not a character
          // looked up off the user — or an alt's night renders as the main.
          characterName: true,
          class: true,
          user: { select: { discordName: true } },
        },
        orderBy: { specSignedAs: "asc" },
      },
    },
  });

  if (!night) return null;

  const roster: RosterEntry[] = night.signups.map((s) => {
    return {
      // As signed up: Raid-Helper gives the display name + the class for THIS
      // signup. Fall back to the Discord name only when the signup omitted one.
      name: s.characterName ?? s.user.discordName,
      class: s.class,
      spec: s.specSignedAs,
      role: s.role,
      status: s.status,
    };
  });

  return { id: night.id, title: night.title, date: night.date, roster };
}
