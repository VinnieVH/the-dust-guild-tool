import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { MainRole } from "@/lib/domain/enums";
import { characterRepository } from "@/lib/repositories/character-repository";
import { claimCharacter } from "@/lib/services/character-claim";
import { db } from "@/lib/db";

// Exercises the real repository against Postgres: claim flow, ownership
// rejection, and alias resolution (the resolve-once guarantee).
const NAME = "ItestThunderfurry";
const ALIAS = "ItestThûnderfurry";

const input = {
  name: NAME,
  class: "Shaman",
  spec: "Enhancement",
  mainRole: MainRole.DPS,
};

async function cleanup() {
  await db.characterAlias.deleteMany({ where: { alias: ALIAS } });
  await db.character.deleteMany({ where: { name: NAME } });
  await db.user.deleteMany({ where: { discordId: { in: ["it-u1", "it-u2"] } } });
}

beforeEach(async () => {
  await cleanup();
  await db.user.createMany({
    data: [
      { id: "it-u1", discordId: "it-u1", discordName: "u1" },
      { id: "it-u2", discordId: "it-u2", discordName: "u2" },
    ],
  });
});

afterEach(cleanup);
afterAll(async () => {
  await db.$disconnect();
});

describe("characterRepository + claim service (live DB)", () => {
  it("claims a free name then rejects another user's claim", async () => {
    const first = await claimCharacter(characterRepository, "it-u1", input);
    expect(first).toMatchObject({ ok: true, created: true });

    const second = await claimCharacter(characterRepository, "it-u2", input);
    expect(second).toEqual({ ok: false, reason: "owned_by_other" });
  });

  it("resolves a confirmed alias back to the owning character", async () => {
    const created = await claimCharacter(characterRepository, "it-u1", input);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await characterRepository.addAlias(created.character.id, ALIAS);

    const found = await characterRepository.findByNameOrAlias(ALIAS);
    expect(found?.id).toBe(created.character.id);
  });

  it("lists characters by owner", async () => {
    await claimCharacter(characterRepository, "it-u1", input);
    const list = await characterRepository.listByUser("it-u1");
    expect(list.map((c) => c.name)).toContain(NAME);
  });
});
