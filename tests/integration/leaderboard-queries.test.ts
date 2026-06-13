import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { MainRole, Role } from "@/lib/domain/enums";
import { getLeaderboard } from "@/lib/repositories/leaderboard-queries";
import { db } from "@/lib/db";

// Hall of Champions read model against REAL Postgres. The behaviors that matter:
//   - alts collapse to ONE holder (a 3-alt owner is not 3 competitors)
//   - a tie surfaces co-holders, not an arbitrary single winner
//   - an unclaimed character still appears (by its own name)
//   - streak leaders come from the live currentStreak stat, ordered desc
const PFX = "itest-lb-";

async function cleanup() {
  const nights = await db.raidNight.findMany({
    where: { raidHelperEventId: { startsWith: PFX } },
    select: { id: true },
  });
  for (const n of nights) await db.raidNight.delete({ where: { id: n.id } });
  await db.character.deleteMany({ where: { name: { startsWith: PFX } } });
  await db.user.deleteMany({ where: { discordId: { startsWith: PFX } } });
}

beforeEach(cleanup);
afterEach(cleanup);
afterAll(async () => {
  await db.$disconnect();
});

async function achievementId(key: string): Promise<string> {
  const a = await db.achievement.findUniqueOrThrow({ where: { key }, select: { id: true } });
  return a.id;
}

describe("getLeaderboard (live DB)", () => {
  it("collapses a user's alts into one holder, detects ties, and keeps unclaimed chars", async () => {
    // Alice owns two alts; Bob owns one. Carol's char is unclaimed.
    const alice = await db.user.create({
      // Streaks set absurdly high so this test's users top the global `take: 10`
      // board regardless of any real attendance data already in the dev DB.
      data: { discordId: `${PFX}alice`, discordName: "Alice", role: Role.MEMBER, currentStreak: 9012 },
    });
    const bob = await db.user.create({
      data: { discordId: `${PFX}bob`, discordName: "Bob", role: Role.MEMBER, currentStreak: 9005 },
    });

    const aliceMain = await db.character.create({
      data: { name: `${PFX}AliceMain`, class: "Mage", spec: "Fire", mainRole: MainRole.DPS, userId: alice.id },
    });
    const aliceAlt = await db.character.create({
      data: { name: `${PFX}AliceAlt`, class: "Rogue", spec: "Combat", mainRole: MainRole.DPS, userId: alice.id },
    });
    const bobChar = await db.character.create({
      data: { name: `${PFX}BobChar`, class: "Warrior", spec: "Arms", mainRole: MainRole.DPS, userId: bob.id },
    });
    const carolChar = await db.character.create({
      data: { name: `${PFX}CarolChar`, class: "Priest", spec: "Holy", mainRole: MainRole.HEALER },
    });

    // Two nights so a character can earn the same achievement twice.
    const night1 = await db.raidNight.create({
      data: { raidHelperEventId: `${PFX}n1`, title: `${PFX}n1`, date: new Date("2026-06-01T18:00:00Z") },
    });
    const night2 = await db.raidNight.create({
      data: { raidHelperEventId: `${PFX}n2`, title: `${PFX}n2`, date: new Date("2026-06-08T18:00:00Z") },
    });

    const deadliest = await achievementId("deadliest");
    const lifebinder = await achievementId("lifebinder");

    // Deadliest: Alice's main wins night1, Alice's ALT wins night2 (same user → count 2);
    // Bob wins... nothing on deadliest. So Alice is the sole deadliest holder, count 2.
    await db.achievementAward.createMany({
      data: [
        { achievementId: deadliest, characterId: aliceMain.id, raidNightId: night1.id },
        { achievementId: deadliest, characterId: aliceAlt.id, raidNightId: night2.id },
        // Lifebinder TIE: Carol (unclaimed) once, Bob once → both count 1, co-holders.
        { achievementId: lifebinder, characterId: carolChar.id, raidNightId: night1.id },
        { achievementId: lifebinder, characterId: bobChar.id, raidNightId: night2.id },
      ],
    });

    const { champions, streakLeaders } = await getLeaderboard();

    const dead = champions.find((c) => c.key === "deadliest")!;
    expect(dead.holders).toHaveLength(1);
    expect(dead.holders[0]).toEqual({ name: "Alice", count: 2 });

    const life = champions.find((c) => c.key === "lifebinder")!;
    expect(life.holders).toHaveLength(2); // tie → co-holders
    expect(life.holders.map((h) => h.name).sort()).toEqual([
      "Bob",
      `${PFX}CarolChar`, // unclaimed → shows by character name
    ]);
    expect(life.holders.every((h) => h.count === 1)).toBe(true);

    // An achievement nobody earned is "up for grabs" (empty holders), still present.
    const ironman = champions.find((c) => c.key === "iron-man")!;
    expect(ironman.holders).toHaveLength(0);

    // Streaks ordered by currentStreak desc, only > 0. Our two top the board;
    // assert relative order (other real users may sit elsewhere in the list).
    const ours = streakLeaders.filter((s) => s.name === "Alice" || s.name === "Bob");
    expect(ours).toEqual([
      { name: "Alice", streak: 9012 },
      { name: "Bob", streak: 9005 },
    ]);
  });
});
