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
// Boss counts MUST match what WCL counts as "X/X" for the combined zone, since
// the full-clear gate compares bossKills to this. Verified against WCL's own
// Rankings panel: SSC/TK shows "10/10", Gruul/Mag "3/3".
const ZONE_BOSS_COUNT: Record<string, number> = {
  "SSC / TK": 10, // Serpentshrine (6) + The Eye (4) — WCL: "10/10"
  Karazhan: 11,
  "Gruul / Magtheridon": 3, // Gruul (2) + Magtheridon (1) — WCL: "3/3"
  "BT / Hyjal": 14, // Black Temple (9) + Hyjal (5) — UNVERIFIED until logged
  "Zul'Aman": 6,
};

export function zoneBossCount(zoneName: string): number | null {
  return ZONE_BOSS_COUNT[zoneName] ?? null;
}

// WCL TBC Classic zone NAME -> zone id, for guild rank queries. The ids below
// marked "verified" were read live from this guild's own reports (zone.id) +
// confirmed to return a zoneRanking — NOT guessed. SSC/TK=1056, Gruul/Mag=1048,
// Karazhan=1047 all confirmed. BT/Hyjal is UNVERIFIED (the guild hasn't raided
// it yet, so no report carries its id) — its rank will read "—" until then;
// fix the id from a live report once BT is logged.
const ZONE_ID_BY_NAME: Record<string, number> = {
  Karazhan: 1047, // verified live
  "Gruul / Magtheridon": 1048, // verified live
  "SSC / TK": 1056, // verified live
  "BT / Hyjal": 1049, // UNVERIFIED — best guess until BT is logged
  "Zul'Aman": 1050, // UNVERIFIED
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
