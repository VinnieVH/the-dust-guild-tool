import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MainRole } from "@/lib/domain/enums";
import { SignupStatus } from "@/lib/domain/external";
import type {
  RhEventDetailDto,
  RhEventsListDto,
} from "@/lib/integrations/raid-helper/dto";
import {
  mapEventSummary,
  mapSignups,
} from "@/lib/integrations/raid-helper/mapper";

// Runs the mapper against REAL recorded Raid-Helper responses (fixtures).
// This is an "integration" test only in that it exercises recorded API shapes;
// it makes no network calls and needs no DB. It lives here so the fixtures are
// the contract.
const dir = join(process.cwd(), "tests/fixtures/raid-helper");
const load = <T>(f: string): T =>
  JSON.parse(readFileSync(join(dir, f), "utf8")) as T;

describe("raid-helper mapper (recorded fixtures)", () => {
  it("maps the events list to domain events", () => {
    const list = load<RhEventsListDto>("events.json");
    const events = list.postedEvents.map(mapEventSummary);
    expect(events.length).toBeGreaterThan(0);
    const e = events[0];
    expect(e.eventId).toMatch(/^\d+$/);
    expect(e.title).toBeTruthy();
    expect(e.startTime).toBeInstanceOf(Date);
    expect(Number.isNaN(e.startTime.getTime())).toBe(false);
  });

  it("maps attending signups as CONFIRMED with class/spec", () => {
    const detail = load<RhEventDetailDto>("event.json");
    const signups = mapSignups(detail);
    expect(signups.length).toBe(17);
    expect(signups.every((s) => s.status === SignupStatus.CONFIRMED)).toBe(true);

    const skreamo = signups.find((s) => s.name === "Skreamo");
    expect(skreamo).toMatchObject({
      status: SignupStatus.CONFIRMED,
      class: "Warrior",
      spec: "Arms",
    });
  });

  it("maps a role signup (Tank) as CONFIRMED with null class", () => {
    const detail = load<RhEventDetailDto>("event.json");
    const tank = mapSignups(detail).find((s) => s.name === "Guntrip");
    expect(tank?.status).toBe(SignupStatus.CONFIRMED);
    expect(tank?.class).toBeNull(); // "Tank" is a role, not a class
    expect(tank?.spec).toBe("Protection");
  });

  it("maps Raid-Helper roleName to MainRole", () => {
    const detail = load<RhEventDetailDto>("event.json");
    const signups = mapSignups(detail);
    expect(signups.find((s) => s.name === "Guntrip")?.role).toBe(MainRole.TANK); // Tanks
    expect(signups.find((s) => s.name === "Skreamo")?.role).toBe(MainRole.DPS); // Melee
    expect(signups.find((s) => s.name === "Sajkol")?.role).toBe(MainRole.DPS); // Ranged
    // Every CONFIRMED signup in this fixture has a role.
    expect(signups.filter((s) => s.role === null)).toHaveLength(0);
  });

  it("leaves role null for an absence (no roleName)", () => {
    const detail = load<RhEventDetailDto>("event-absence.json");
    const skreamo = mapSignups(detail).find((s) => s.name === "Skreamo");
    expect(skreamo?.role).toBeNull();
  });

  it("strips Raid-Helper's dual-spec digit suffix for display", () => {
    const detail = load<RhEventDetailDto>("event.json");
    const varuska = mapSignups(detail).find((s) => s.name === "Varuska");
    expect(varuska?.spec).toBe("Protection"); // from "Protection1"
  });

  // The load-bearing case: an Absence keeps status:"primary" but className
  // "Absence". Keying on status would wrongly mark them CONFIRMED.
  it("maps an Absence (className=Absence, status=primary) as ABSENT", () => {
    const detail = load<RhEventDetailDto>("event-absence.json");
    const skreamo = mapSignups(detail).find((s) => s.name === "Skreamo");
    expect(skreamo?.status).toBe(SignupStatus.ABSENT);
    expect(skreamo?.class).toBeNull();
    expect(skreamo?.spec).toBeNull();
  });
});
