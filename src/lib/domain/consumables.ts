// Curated TBC consumable ability GUIDs, by category. Used to score the
// "Fully Buffed" achievement from a player's self-applied auras (see
// docs/achievement-design.md "Consumable detection").
//
// WHY an allowlist: WCL CombatantInfo lists every buff a player had at pull
// start — mostly raid buffs cast by OTHERS (Arcane Brilliance, Blessings,
// Battle Shout). Counting auras would reward "got buffed by the raid", which is
// the opposite of a diligence signal. The mapper keeps only auras that are both
// (a) self-applied (aura.source === the player's actor id) AND (b) in this
// allowlist — which also drops class self-buffs like Mage Armor / stances.
//
// GUIDs were observed in a real SSC/TK report; the lists are intentionally
// generous within each TBC category. Adding a missing consumable = add its GUID
// here; no code change.

// Flasks (the big single-buff consumable: persists through death).
const FLASK_GUIDS = new Set<number>([
  28518, // Flask of Fortification
  28519, // Flask of Mighty Restoration
  28520, // Flask of Relentless Assault
  28521, // Flask of Blinding Light
  28540, // Flask of Pure Death
  17628, // Supreme Power (Flask of Supreme Power, classic-era)
  17626, // Flask of the Titans
  17627, // Distilled Wisdom (flask-tier)
  41608, // Flask of Chromatic Wonder
]);

// Battle / Guardian elixirs (the two-elixir alternative to a flask).
const ELIXIR_GUIDS = new Set<number>([
  17538, // Elixir of the Mongoose
  28491, // Healing Power (Elixir of Healing Power)
  28497, // Mighty Agility (Elixir of Major Agility)
  28503, // Major Shadow Power
  33721, // Spellpower Elixir (Adept's Elixir / Greater Arcane)
  33726, // Elixir of Mastery
  39625, // Elixir of Major Fortitude
  39627, // Elixir of Draenic Wisdom
  11371, // Gift of Arthas
  28509, // Greater Versatility (Elixir of Major Defense)
  33063, // Drums of Battle-adjacent? (kept generous; harmless if unused)
  28501, // Major Firepower (Elixir of Major Firepower)
  28502, // Major Frost Power
  28490, // Major Strength (Elixir of Major Strength)
  39628, // Elixir of Ironskin
  22831, // Adept's Elixir
]);

// Food — every "Well Fed" GUID seen, plus the common TBC food buffs.
const FOOD_GUIDS = new Set<number>([
  33256, 33257, 33258, 33259, 33260, 33261, 33262, 33263, 33264, 33265, 33268,
  35272, 43764, 46899, // assorted "Well Fed" variants
  18125, // Blessed Sunfruit (classic-era, harmless)
]);

export type ConsumableCategory = "flask" | "food" | "elixir";

/** Classify a single ability GUID into a consumable category, or null. */
export function consumableCategory(guid: number): ConsumableCategory | null {
  if (FLASK_GUIDS.has(guid)) return "flask";
  if (ELIXIR_GUIDS.has(guid)) return "elixir";
  if (FOOD_GUIDS.has(guid)) return "food";
  return null;
}
