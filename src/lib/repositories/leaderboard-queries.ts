import {
  GUILD_ACHIEVEMENTS,
  PERSONAL_ACHIEVEMENTS,
  STREAK_ACHIEVEMENTS,
} from "@/lib/domain/achievements";
import { db } from "@/lib/db";

// Read-side view model for the "Hall of Champions" leaderboard. The guiding
// rule (docs/achievement-design.md) is all-positive / everyone-shines: there is
// NO single overall ladder. Instead, for each achievement we surface who has
// earned it the most — spreading crowns so many members are #1 at something.
//
// CRITICAL correctness notes:
//   - Aggregate to USER, not character. A 3-alt owner is one competitor, not
//     three. We resolve each award's character back to its owning user.
//   - Trophies span keyspaces (see profile-queries.ts): personal + guild awards
//     live in achievement_awards (characterId-keyed); streak milestones live in
//     streak_milestones (userId-keyed). The streak board is driven instead by
//     User.currentStreak (the live "longest active streak" stat).
//   - Unclaimed characters (characterId-keyed award on a Character with no
//     userId) still count — we fall back to the character itself as the holder
//     so an unlinked top parser isn't silently dropped from the hall.

export interface ChampionHolder {
  /** Display name: the user's Discord name, or the character name if unclaimed. */
  name: string;
  /** Times this holder earned the achievement (summed across their characters). */
  count: number;
}

export interface ChampionRow {
  key: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  /** Co-holders when tied on the top count; empty when nobody has earned it. */
  holders: ChampionHolder[];
}

export interface StreakLeader {
  name: string;
  streak: number;
}

export interface LeaderboardView {
  champions: ChampionRow[];
  streakLeaders: StreakLeader[];
}

// Display order mirrors the night-results page: guild (collective) achievements
// first, then personal. Streak milestones are represented by the live-streak
// board, not a per-milestone champion row, so they're excluded here.
const CHAMPION_DEFS = [...GUILD_ACHIEVEMENTS, ...PERSONAL_ACHIEVEMENTS];

const STREAK_KEYS = new Set(STREAK_ACHIEVEMENTS.map((a) => a.key));

export async function getLeaderboard(): Promise<LeaderboardView> {
  // (1) Every character-keyed award, joined to its character's owning user.
  const awards = await db.achievementAward.findMany({
    select: {
      achievement: { select: { key: true } },
      character: {
        select: {
          id: true,
          name: true,
          user: { select: { id: true, discordName: true } },
        },
      },
    },
  });

  // Per achievement key: holderId -> { name, count }. holderId is the user id
  // when the character is claimed, else the character id (so unclaimed top
  // parsers still appear, and a user's alts collapse into one holder).
  const byKey = new Map<string, Map<string, ChampionHolder>>();
  for (const a of awards) {
    const key = a.achievement.key;
    if (STREAK_KEYS.has(key)) continue; // defensive; streaks aren't char-keyed
    const holderId = a.character.user?.id ?? `char:${a.character.id}`;
    const holderName = a.character.user?.discordName ?? a.character.name;

    let holders = byKey.get(key);
    if (!holders) {
      holders = new Map();
      byKey.set(key, holders);
    }
    const entry = holders.get(holderId);
    if (entry) entry.count += 1;
    else holders.set(holderId, { name: holderName, count: 1 });
  }

  const champions: ChampionRow[] = CHAMPION_DEFS.map((def) => {
    const holders = byKey.get(def.key);
    let top: ChampionHolder[] = [];
    if (holders && holders.size > 0) {
      const max = Math.max(...[...holders.values()].map((h) => h.count));
      top = [...holders.values()]
        .filter((h) => h.count === max)
        .sort((a, b) => a.name.localeCompare(b.name));
    }
    return {
      key: def.key,
      name: def.name,
      description: def.description,
      icon: def.icon,
      category: def.category,
      holders: top,
    };
  });

  // (2) Longest active attendance streaks (the streak "champion" board). Driven
  // by the live User.currentStreak stat, newest computed by the streak pass.
  const streakUsers = await db.user.findMany({
    where: { currentStreak: { gt: 0 } },
    select: { discordName: true, currentStreak: true },
    orderBy: { currentStreak: "desc" },
    take: 10,
  });
  const streakLeaders: StreakLeader[] = streakUsers.map((u) => ({
    name: u.discordName,
    streak: u.currentStreak ?? 0,
  }));

  return { champions, streakLeaders };
}
