import { GUILD_ACHIEVEMENTS, PERSONAL_ACHIEVEMENTS } from "@/lib/domain/achievements";
import { db } from "@/lib/db";

// Read-side view model for a raid night's achievement results. Groups awards by
// achievement, with class-colored winner info. Personal + guild awards both
// live in achievement_awards (characterId-keyed); streaks are per-user and
// surface on profiles, not the night page.

export interface NightAwardWinner {
  characterName: string;
  characterClass: string;
}

export interface NightAward {
  key: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  winners: NightAwardWinner[];
}

// Stable display order: guild awards first (collective), then personal.
const ORDER = [...GUILD_ACHIEVEMENTS, ...PERSONAL_ACHIEVEMENTS].map((a) => a.key);

export async function getNightResults(raidNightId: string): Promise<NightAward[]> {
  const rows = await db.achievementAward.findMany({
    where: { raidNightId },
    select: {
      achievement: { select: { key: true, name: true, description: true, icon: true, category: true } },
      character: { select: { name: true, class: true } },
    },
  });

  const byKey = new Map<string, NightAward>();
  for (const r of rows) {
    const a = r.achievement;
    let entry = byKey.get(a.key);
    if (!entry) {
      entry = { key: a.key, name: a.name, description: a.description, icon: a.icon, category: a.category, winners: [] };
      byKey.set(a.key, entry);
    }
    entry.winners.push({ characterName: r.character.name, characterClass: r.character.class });
  }

  // Sort winners within an award by name (stable display); order awards by ORDER.
  for (const award of byKey.values()) {
    award.winners.sort((x, y) => x.characterName.localeCompare(y.characterName));
  }
  return [...byKey.values()].sort(
    (a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key),
  );
}
