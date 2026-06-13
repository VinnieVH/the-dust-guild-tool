import { db } from "@/lib/db";

// Read-side view model for a member's profile + trophy cabinet. CRITICAL: a
// user's achievements span THREE keyspaces (see the achievement schema):
//   - achievement_awards  (characterId-keyed — personal + guild awards)
//   - streak_milestones   (userId-keyed)
//   - User.currentStreak  (a live stat column)
// Building the cabinet off achievement_awards alone silently omits streaks, so
// this query unions all three.

export interface TrophyGroup {
  key: string;
  name: string;
  icon: string;
  category: string;
  /** How many times this user earned it (across all their characters / nights). */
  count: number;
}

export interface ProfileView {
  discordName: string;
  currentStreak: number | null;
  characters: Array<{ name: string; class: string }>;
  trophies: TrophyGroup[];
}

export async function getProfile(userId: string): Promise<ProfileView | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      discordName: true,
      currentStreak: true,
      characters: { select: { id: true, name: true, class: true } },
    },
  });
  if (!user) return null;

  const characterIds = user.characters.map((c) => c.id);

  // (1) Per-character awards (personal + guild).
  const awards = characterIds.length
    ? await db.achievementAward.findMany({
        where: { characterId: { in: characterIds } },
        select: { achievement: { select: { key: true, name: true, icon: true, category: true } } },
      })
    : [];

  // (2) Per-user streak milestones.
  const milestones = await db.streakMilestone.findMany({
    where: { userId },
    select: { achievement: { select: { key: true, name: true, icon: true, category: true } } },
  });

  // Group + count across both award sources.
  const byKey = new Map<string, TrophyGroup>();
  for (const a of [...awards, ...milestones]) {
    const ach = a.achievement;
    const entry = byKey.get(ach.key);
    if (entry) entry.count += 1;
    else byKey.set(ach.key, { key: ach.key, name: ach.name, icon: ach.icon, category: ach.category, count: 1 });
  }

  // Sort: most-earned first, then name.
  const trophies = [...byKey.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );

  return {
    discordName: user.discordName,
    currentStreak: user.currentStreak,
    characters: user.characters.map((c) => ({ name: c.name, class: c.class })),
    trophies,
  };
}
