// Static WoW TBC reference data: classes, their specs, and canonical class
// colors. Used by the claim form and (later) class-colored names in the UI.

export const CLASS_COLORS: Record<string, string> = {
  Warrior: "#C79C6E",
  Paladin: "#F58CBA",
  Hunter: "#ABD473",
  Rogue: "#FFF569",
  Priest: "#FFFFFF",
  Shaman: "#0070DE",
  Mage: "#69CCF0",
  Warlock: "#9482C9",
  Druid: "#FF7D0A",
};

// TBC (Burning Crusade) — no Death Knight, no Monk/DH/Evoker.
export const CLASS_SPECS: Record<string, readonly string[]> = {
  Warrior: ["Arms", "Fury", "Protection"],
  Paladin: ["Holy", "Protection", "Retribution"],
  Hunter: ["Beast Mastery", "Marksmanship", "Survival"],
  Rogue: ["Assassination", "Combat", "Subtlety"],
  Priest: ["Discipline", "Holy", "Shadow"],
  Shaman: ["Elemental", "Enhancement", "Restoration"],
  Mage: ["Arcane", "Fire", "Frost"],
  Warlock: ["Affliction", "Demonology", "Destruction"],
  Druid: ["Balance", "Feral", "Restoration"],
};

export const WOW_CLASSES = Object.keys(CLASS_SPECS);

export function isValidClass(value: string): boolean {
  return value in CLASS_SPECS;
}

export function isValidSpec(wowClass: string, spec: string): boolean {
  return CLASS_SPECS[wowClass]?.includes(spec) ?? false;
}

export function classColor(wowClass: string): string {
  return CLASS_COLORS[wowClass] ?? "#FFFFFF";
}

// Boss counts per WCL zone NAME (TBC), for the Clean Sweep guild achievement
// ("all bosses killed"). Keyed by the zone name WCL reports — note SSC/TK is a
// combined WCL zone (one "clear" spans both raids). Unknown zones return null,
// and Clean Sweep simply won't fire for them (safe default).
const ZONE_BOSS_COUNT: Record<string, number> = {
  "SSC / TK": 11, // Serpentshrine (6) + The Eye (5)
  Karazhan: 11,
  "Gruul / Magtheridon": 3, // Gruul (2) + Magtheridon (1)
  "BT / Hyjal": 14, // Black Temple (9) + Hyjal (5)
  "Zul'Aman": 6,
};

export function zoneBossCount(zoneName: string): number | null {
  return ZONE_BOSS_COUNT[zoneName] ?? null;
}
