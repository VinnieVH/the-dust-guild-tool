import { describe, expect, it } from "vitest";
import {
  CLASS_SPECS,
  WOW_CLASSES,
  classColor,
  isValidClass,
  isValidSpec,
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
