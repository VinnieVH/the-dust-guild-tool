import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { SoftresRaidDto } from "@/lib/integrations/softres/dto";
import { mapReservations } from "@/lib/integrations/softres/mapper";

// Runs the softres mapper against the REAL recorded response (fixture). Makes no
// network calls and needs no DB; lives here so the fixture is the contract.
//
// NOTE: the fixture is n=1 (a single reserve, with Discord login on). It cannot
// exercise the dId-absent path or multiple distinct reservers — those are tested
// with hand-built DTOs below, not claimed as fixture-validated.
const dir = join(process.cwd(), "tests/fixtures/softres");
const load = <T>(f: string): T =>
  JSON.parse(readFileSync(join(dir, f), "utf8")) as T;

describe("softres mapper (recorded fixture)", () => {
  it("maps a reservation with name, class, dId, and items", () => {
    const raid = load<SoftresRaidDto>("raid.json");
    const reservations = mapReservations(raid);
    expect(reservations).toHaveLength(1);
    expect(reservations[0]).toMatchObject({
      rawName: "Skreamo",
      rawClass: "Warrior",
      discordId: "127540852686848000",
      items: [28453, 28505],
    });
    expect(reservations[0].reservedAt).toBeInstanceOf(Date);
    expect(Number.isNaN(reservations[0].reservedAt!.getTime())).toBe(false);
  });

  it("treats the placeholder Discord id \"0\" as absent (name-match fallback)", () => {
    const reservations = mapReservations({
      raidId: "x",
      edition: "tbc",
      discord: false,
      instances: ["ssc"],
      reserved: [
        { name: "Anon", class: "Mage", spec: 0, items: [1], note: "", created: "", updated: "", dId: "0", dU: "" },
      ],
    });
    expect(reservations[0].discordId).toBeNull();
  });

  it("leaves discordId null when the field is absent entirely", () => {
    const reservations = mapReservations({
      raidId: "x",
      edition: "tbc",
      discord: false,
      instances: ["ssc"],
      reserved: [
        { name: "NoDiscord", class: "Rogue", spec: 0, items: [], note: "", created: "", updated: "" },
      ],
    });
    expect(reservations[0].discordId).toBeNull();
    expect(reservations[0].items).toEqual([]);
  });

  it("yields null reservedAt for an unparseable timestamp", () => {
    const reservations = mapReservations({
      raidId: "x",
      edition: "tbc",
      discord: true,
      instances: ["tk"],
      reserved: [
        { name: "Bad", class: "Priest", spec: 0, items: [], note: "", created: "", updated: "not-a-date" },
      ],
    });
    expect(reservations[0].reservedAt).toBeNull();
  });
});
