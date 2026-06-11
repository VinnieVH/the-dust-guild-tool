import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ExternalReservation } from "@/lib/domain/external";
import { Instance, MainRole } from "@/lib/domain/enums";
import type { IReserveSource } from "@/lib/integrations/interfaces";
import { listUnmatchedReservations } from "@/lib/repositories/reservation-queries";
import {
  reservationRepository,
  reservationResolveRepository,
} from "@/lib/repositories/reservation-repository";
import { getOverviewData } from "@/lib/repositories/reserve-overview-queries";
import { buildOverview, buildPokeList } from "@/lib/services/reserve-overview-service";
import { linkReservation } from "@/lib/services/resolve-reservation-service";
import { syncSoftres } from "@/lib/services/sync-softres-service";
import { db } from "@/lib/db";

// Step 3.5 acceptance against REAL Postgres: sync reservations -> matrix shows
// correct red/green -> resolve-once via alias. Uses a FakeReserveSource with a
// uniquely-named character so it never collides with real data (no live API).
const PFX = "itest-sr-";
const DISCORD_ID = `${PFX}d1`;
const CHAR_NAME = `${PFX}Mainchar`; // unique -> exact-name match, no collision

class FakeReserveSource implements IReserveSource {
  constructor(private reservations: ExternalReservation[]) {}
  async fetchReservations() {
    return this.reservations;
  }
}

const reservation = (rawName: string): ExternalReservation => ({
  rawName,
  rawClass: "Warrior",
  discordId: DISCORD_ID,
  items: [28453, 28505],
  reservedAt: new Date("2026-06-11T19:42:50Z"),
});

// Seed a user + claimed character + raid night + confirmed signup + SSC sheet.
async function seed() {
  const user = await db.user.create({
    data: { discordId: DISCORD_ID, discordName: `${PFX}user` },
  });
  const character = await db.character.create({
    data: { name: CHAR_NAME, class: "Warrior", spec: "Arms", mainRole: MainRole.DPS, userId: user.id },
  });
  const night = await db.raidNight.create({
    data: { raidHelperEventId: `${PFX}evt`, title: `${PFX}night`, date: new Date("2026-06-12T18:00:00Z") },
  });
  await db.signup.create({
    data: { raidNightId: night.id, userId: user.id, status: "CONFIRMED", specSignedAs: "Arms", role: MainRole.DPS, characterName: CHAR_NAME, class: "Warrior" },
  });
  const sheet = await db.softresSheet.create({
    data: { raidNightId: night.id, instance: Instance.SSC, softresId: `${PFX}softres` },
  });
  return { userId: user.id, characterId: character.id, nightId: night.id, sheetId: sheet.id };
}

async function cleanup() {
  // Children cascade off raidNight/softresSheet; remove user + aliases explicitly.
  const night = await db.raidNight.findUnique({ where: { raidHelperEventId: `${PFX}evt` }, select: { id: true } });
  if (night) await db.raidNight.delete({ where: { id: night.id } });
  await db.characterAlias.deleteMany({ where: { alias: { startsWith: PFX } } });
  await db.character.deleteMany({ where: { name: { startsWith: PFX } } });
  await db.user.deleteMany({ where: { discordId: DISCORD_ID } });
}

beforeEach(cleanup);
afterEach(cleanup);
afterAll(async () => {
  await db.$disconnect();
});

describe("syncSoftres -> SR matrix (live DB)", () => {
  it("matches a reservation by exact name and the matrix shows the member done", async () => {
    const { sheetId, nightId, characterId } = await seed();
    const src = new FakeReserveSource([reservation(CHAR_NAME)]);

    const res = await syncSoftres(src, reservationRepository, [{ sheetId, softresId: `${PFX}softres` }]);
    expect(res).toMatchObject({ reservations: 1, created: 1, matched: 1 });

    const row = await db.reservation.findFirst({ where: { softresSheetId: sheetId } });
    expect(row?.characterId).toBe(characterId);
    expect(row?.items).toEqual([28453, 28505]); // items array round-trips
    expect(row?.discordId).toBe(DISCORD_ID);

    const overview = buildOverview(await getOverviewData(nightId));
    expect(overview).toMatchObject({ completed: 1, total: 1, linkedInstances: [Instance.SSC] });
    expect(overview.rows[0]).toMatchObject({ ssc: true, hasCharacter: true });
    expect(buildPokeList(overview)).toHaveLength(0);
  });

  it("resolve-once: officer link inserts an alias, so a re-sync auto-matches with no queue entry", async () => {
    const { sheetId, nightId, characterId } = await seed();
    // Reserve under a typo'd name -> no exact match, dId owns exactly one char -> suggested.
    const typo = `${PFX}Typo`;
    const src = new FakeReserveSource([reservation(typo)]);

    const first = await syncSoftres(src, reservationRepository, [{ sheetId, softresId: `${PFX}softres` }]);
    expect(first).toMatchObject({ suggested: 1, matched: 0 });

    // It's in the queue with a suggestion; officer links it (rawName != charName -> alias inserted).
    const queue = (await listUnmatchedReservations()).filter((r) => r.raidNightId === nightId);
    expect(queue).toHaveLength(1);
    expect(queue[0].suggestion?.characterId).toBe(characterId);
    const linkRes = await linkReservation(reservationResolveRepository, queue[0].id, characterId);
    expect(linkRes.ok).toBe(true);

    // Alias persisted -> matrix is now green and the queue is empty.
    const overview = buildOverview(await getOverviewData(nightId));
    expect(overview.rows[0].ssc).toBe(true);
    expect((await listUnmatchedReservations()).filter((r) => r.raidNightId === nightId)).toHaveLength(0);

    // Re-sync: the alias makes it match by name with no new queue entry.
    const second = await syncSoftres(src, reservationRepository, [{ sheetId, softresId: `${PFX}softres` }]);
    expect(second).toMatchObject({ matched: 1, created: 0 });
    expect((await listUnmatchedReservations()).filter((r) => r.raidNightId === nightId)).toHaveLength(0);
  });
});
