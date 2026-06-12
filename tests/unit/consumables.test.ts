import { describe, expect, it } from "vitest";
import { consumableCategory } from "@/lib/domain/consumables";

describe("consumableCategory", () => {
  it("classifies known flasks", () => {
    expect(consumableCategory(28540)).toBe("flask"); // Pure Death
    expect(consumableCategory(28520)).toBe("flask"); // Relentless Assault
  });

  it("classifies known battle/guardian elixirs", () => {
    expect(consumableCategory(17538)).toBe("elixir"); // Mongoose
    expect(consumableCategory(33721)).toBe("elixir"); // Spellpower
  });

  it("classifies Well Fed food guids", () => {
    expect(consumableCategory(33256)).toBe("food");
    expect(consumableCategory(43764)).toBe("food");
  });

  it("returns null for raid buffs and unknown abilities", () => {
    expect(consumableCategory(27127)).toBeNull(); // Arcane Brilliance (raid buff)
    expect(consumableCategory(2048)).toBeNull(); // Battle Shout
    expect(consumableCategory(999999)).toBeNull(); // unknown
  });
});
