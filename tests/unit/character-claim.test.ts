import { beforeEach, describe, expect, it } from "vitest";
import type { CharacterRecord, ClaimInput } from "@/lib/domain/character";
import { MainRole } from "@/lib/domain/enums";
import {
  type CharacterClaimStore,
  claimCharacter,
} from "@/lib/services/character-claim";

// In-memory fake store keyed by name, with alias support.
class FakeStore implements CharacterClaimStore {
  chars: CharacterRecord[] = [];
  aliases = new Map<string, string>(); // alias -> characterId
  private seq = 0;

  async findByNameOrAlias(name: string) {
    const direct = this.chars.find((c) => c.name === name);
    if (direct) return direct;
    const id = this.aliases.get(name);
    return id ? (this.chars.find((c) => c.id === id) ?? null) : null;
  }

  async create(input: ClaimInput, userId: string) {
    const c: CharacterRecord = { id: `c${++this.seq}`, userId, ...input };
    this.chars.push(c);
    return c;
  }

  async assignOwner(characterId: string, userId: string) {
    const c = this.chars.find((x) => x.id === characterId)!;
    c.userId = userId;
    return c;
  }
}

const input: ClaimInput = {
  name: "Thunderfurry",
  class: "Shaman",
  spec: "Enhancement",
  mainRole: MainRole.DPS,
};

let store: FakeStore;
beforeEach(() => {
  store = new FakeStore();
});

describe("claimCharacter", () => {
  it("creates and assigns a free name", async () => {
    const res = await claimCharacter(store, "user-1", input);
    expect(res).toMatchObject({ ok: true, created: true });
    if (res.ok) expect(res.character.userId).toBe("user-1");
  });

  it("assigns ownership of an existing unowned character", async () => {
    store.chars.push({ id: "c0", userId: null, ...input });
    const res = await claimCharacter(store, "user-1", input);
    expect(res).toMatchObject({ ok: true, created: false });
    if (res.ok) expect(res.character.userId).toBe("user-1");
  });

  it("rejects a character owned by someone else", async () => {
    store.chars.push({ id: "c0", userId: "user-2", ...input });
    const res = await claimCharacter(store, "user-1", input);
    expect(res).toEqual({ ok: false, reason: "owned_by_other" });
  });

  it("treats re-claiming your own character as a no-op", async () => {
    store.chars.push({ id: "c0", userId: "user-1", ...input });
    const res = await claimCharacter(store, "user-1", input);
    expect(res).toEqual({ ok: false, reason: "already_yours" });
  });

  it("resolves a confirmed alias to the owning character (rejects re-claim)", async () => {
    store.chars.push({ id: "c0", userId: "user-2", ...input });
    store.aliases.set("Thûnderfurry", "c0");
    const res = await claimCharacter(store, "user-1", { ...input, name: "Thûnderfurry" });
    expect(res).toEqual({ ok: false, reason: "owned_by_other" });
  });
});
