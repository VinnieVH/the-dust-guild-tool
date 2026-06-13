import { STREAK_MILESTONES } from "./constants";

// The achievement catalog — ONE source of truth for every achievement's
// key/name/description/icon/category. The seed writes these rows; the engine
// and rules reference achievements by `key`; the UI reads name/icon/category.
//
// category drives both grouping and the lifecycle:
//   "personal" — per-night, per-character, written by the achievement engine
//   "guild"    — per-night, awarded to every present character
//   "streak"   — per-USER milestone, written by the attendance service into the
//                separate streak_milestones table (NOT achievement_awards)

export type AchievementCategory = "personal" | "guild" | "streak";

export interface AchievementDef {
  key: string;
  name: string;
  description: string;
  /** Emoji for now; can become an asset path later. */
  icon: string;
  category: AchievementCategory;
}

// --- Personal (per-night, per-character) ---
export const PERSONAL_ACHIEVEMENTS: AchievementDef[] = [
  {
    key: "deadliest",
    name: "Deadliest",
    description: "Highest DPS parse of the night.",
    icon: "🗡️",
    category: "personal",
  },
  {
    key: "lifebinder",
    name: "Lifebinder",
    description: "Highest healer parse of the night.",
    icon: "✨",
    category: "personal",
  },
  {
    key: "immovable-object",
    name: "Immovable Object",
    description: "Highest tank parse of the night.",
    icon: "🛡️",
    category: "personal",
  },
  {
    key: "fully-buffed",
    name: "Fully Buffed",
    description: "Came prepared with the most consumables (flask, food, elixir).",
    icon: "🧪",
    category: "personal",
  },
  {
    key: "iron-man",
    name: "Iron Man",
    description: "Survived the whole night without dying.",
    icon: "🥇",
    category: "personal",
  },
  {
    key: "kick-commander",
    name: "Kick Commander",
    description: "Most successful interrupts of the night.",
    icon: "👢",
    category: "personal",
  },
  {
    key: "cleanse-crusader",
    name: "Cleanse Crusader",
    description: "Most dispels of the night.",
    icon: "🧼",
    category: "personal",
  },
  {
    key: "floor-inspector",
    name: "Floor Inspector",
    description: "The floor missed you. (Awarded only on a genuinely unlucky night.)",
    icon: "💀",
    category: "personal",
  },
];

// --- Guild (per-night, awarded to everyone present) ---
export const GUILD_ACHIEVEMENTS: AchievementDef[] = [
  {
    key: "new-speed-record",
    name: "New Speed Record",
    description: "The guild's fastest clear of this raid yet.",
    icon: "🏆",
    category: "guild",
  },
  {
    key: "clean-sweep",
    name: "Clean Sweep",
    description: "Cleared every boss in the raid.",
    icon: "🧹",
    category: "guild",
  },
  {
    key: "well-oiled-machine",
    name: "Well-Oiled Machine",
    description: "A night where the whole raid parsed high.",
    icon: "⚙️",
    category: "guild",
  },
];

/** Stable key for an attendance-streak milestone of N raids. */
export function streakKey(n: number): string {
  return `streak-${n}`;
}

// --- Streak milestones (per-User, generated from STREAK_MILESTONES) ---
export const STREAK_ACHIEVEMENTS: AchievementDef[] = STREAK_MILESTONES.map((n) => ({
  key: streakKey(n),
  name: `${n} in a Row`,
  description: `Attended ${n} guild raids in a row.`,
  icon: "🔥",
  category: "streak" as const,
}));

/** Every achievement, for seeding. */
export const ALL_ACHIEVEMENTS: AchievementDef[] = [
  ...PERSONAL_ACHIEVEMENTS,
  ...GUILD_ACHIEVEMENTS,
  ...STREAK_ACHIEVEMENTS,
];
