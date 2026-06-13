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

// WCL's OWN class-id enum (NOT Blizzard's) — verified live against the WCL
// gameData.classes query, not memory. The roster's `classID` keys into this to
// recover a class name, which then keys CLASS_COLORS. Includes retail classes
// WCL lists (DK/Monk/DH/Evoker) for completeness even though TBC has none.
const WCL_CLASS_BY_ID: Record<number, string> = {
  1: "Death Knight",
  2: "Druid",
  3: "Hunter",
  4: "Mage",
  5: "Monk",
  6: "Paladin",
  7: "Priest",
  8: "Rogue",
  9: "Shaman",
  10: "Warlock",
  11: "Warrior",
  12: "Demon Hunter",
  13: "Evoker",
};

/** WCL classID -> class name, or "Unknown" for an unmapped id. */
export function wclClassName(classID: number): string {
  return WCL_CLASS_BY_ID[classID] ?? "Unknown";
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

// WCL TBC Classic zone NAME -> zone id, for guild rank queries (verified live
// against the WCL API). SSC/TK reports as id 1056 in current logs; 1010 is the
// older partition. We query the id the live reports use (1056).
const ZONE_ID_BY_NAME: Record<string, number> = {
  Karazhan: 1007,
  "Gruul / Magtheridon": 1008,
  "SSC / TK": 1056,
  "BT / Hyjal": 1011,
  "Zul'Aman": 1012,
};

export function zoneId(zoneName: string): number | null {
  return ZONE_ID_BY_NAME[zoneName] ?? null;
}

// We are a 25-man raiding guild. TBC 10-man content (Karazhan, Zul'Aman) is run
// in separate side-groups and must NOT count toward 25-man attendance streaks,
// crowns, or speed records — a 25-man regular who skips Kara shouldn't lose a
// streak, and a Kara-only attendee shouldn't earn one. ALLOWLIST the known
// 25-man zones (not a denylist) so any future/unknown zone is excluded by
// default rather than silently counted. Keyed on the COMBINED WCL labels the
// attendance + report feeds actually return (verified live: the feed emits
// "Gruul / Magtheridon", "SSC / TK", "Karazhan" — not split zone names).
// Ordered by TBC progression (entry -> end). The UI iterates this for the
// per-zone standings cards (a fixed set, "—" for zones not yet cleared).
export const RAID_25_ZONES = [
  "Gruul / Magtheridon",
  "SSC / TK",
  "BT / Hyjal",
] as const;

const RAID_25_ZONE_SET: ReadonlySet<string> = new Set(RAID_25_ZONES);

/** True when a WCL zone name is 25-man content this guild raids together. */
export function is25ManZone(zoneName: string): boolean {
  return RAID_25_ZONE_SET.has(zoneName);
}
