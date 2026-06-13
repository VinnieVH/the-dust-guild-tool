import { describe, expect, it } from "vitest";
import {
  CLASS_SPECS,
  RAID_25_ZONES,
  WOW_CLASSES,
  classColor,
  isValidClass,
  isValidSpec,
  zoneDisplayName,
} from "@/lib/domain/wow";

describe("wow reference data", () => {
  it("lists the nine TBC classes (no Death Knight)", () => {
    expect(WOW_CLASSES).toHaveLength(9);
    expect(WOW_CLASSES).not.toContain("Death Knight");
  });

  it("validates classes", () => {
    expect(isValidClass("Shaman")).toBe(true);
    expect(isValidClass("Necromancer")).toBe(false);
  });

  it("validates spec belongs to class", () => {
    expect(isValidSpec("Shaman", "Enhancement")).toBe(true);
    expect(isValidSpec("Shaman", "Fire")).toBe(false);
    expect(isValidSpec("Mage", "Fire")).toBe(true);
  });

  it("returns a class color, defaulting to white", () => {
    expect(classColor("Druid")).toBe("#FF7D0A");
    expect(classColor("Unknown")).toBe("#FFFFFF");
  });

  it("every class has a color", () => {
    for (const c of WOW_CLASSES) {
      expect(classColor(c)).toMatch(/^#[0-9A-F]{6}$/i);
    }
    expect(Object.keys(CLASS_SPECS)).toEqual(WOW_CLASSES);
  });
});

describe("zoneDisplayName", () => {
  it("expands the terse WCL labels to full raid names", () => {
    expect(zoneDisplayName("Gruul / Magtheridon")).toBe("Gruul's Lair / Magtheridon's Lair");
    expect(zoneDisplayName("SSC / TK")).toBe("Serpentshrine Cavern / Tempest Keep");
    expect(zoneDisplayName("BT / Hyjal")).toBe("Black Temple / Hyjal Summit");
  });

  it("falls back to the raw name for unknown zones (never hides one)", () => {
    expect(zoneDisplayName("Sunwell Plateau")).toBe("Sunwell Plateau");
  });

  it("has a display name for every tracked 25-man zone", () => {
    for (const z of RAID_25_ZONES) {
      expect(zoneDisplayName(z)).not.toBe(z); // a real expansion exists
    }
  });
});
