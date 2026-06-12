import { beforeEach, describe, expect, it } from "vitest";
import type { ClaimInput } from "@/lib/domain/character";
import { MainRole } from "@/lib/domain/enums";
import {
  type ResolveReservationStore,
  acceptSuggestion,
  createAndLinkReservation,
  ignoreReservation,
  linkReservation,
} from "@/lib/services/resolve-reservation-service";

interface Res {
  rawName: string;
  characterId: string | null;
  suggestedCharacterId: string | null;
  discordId: string | null;
  ignored: boolean;
}

class FakeStore implements ResolveReservationStore {
  reservations = new Map<string, Res>();
  charNames = new Map<string, string>(); // id -> name
  charOwners = new Map<string, string | null>(); // id -> userId
  usersByDiscord = new Map<string, string>(); // discordId -> userId
  aliases = new Map<string, string>(); // alias -> characterId
  takenNames = new Set<string>(); // names that already exist (for createCharacter)
  private seq = 0;

  async getReservation(id: string) {
    const r = this.reservations.get(id);
    return r
      ? {
          rawName: r.rawName,
          characterId: r.characterId,
          suggestedCharacterId: r.suggestedCharacterId,
          discordId: r.discordId,
        }
      : null;
  }
  async getCharacterName(characterId: string) {
    return this.charNames.get(characterId) ?? null;
  }
  async getCharacterOwner(characterId: string) {
    return this.charOwners.get(characterId) ?? null;
  }
  async findUserIdByDiscordId(discordId: string) {
    return this.usersByDiscord.get(discordId) ?? null;
  }
  async setReservationCharacter(id: string, characterId: string) {
    const r = this.reservations.get(id)!;
    r.characterId = characterId;
    r.suggestedCharacterId = null;
  }
  async assignOwner(characterId: string, userId: string) {
    this.charOwners.set(characterId, userId);
  }
  async ensureAlias(characterId: string, alias: string) {
    this.aliases.set(alias, characterId);
  }
  async createCharacter(input: ClaimInput, userId: string | null) {
    if (this.takenNames.has(input.name)) throw new Error("unique violation");
    const id = `new-${++this.seq}`;
    this.charNames.set(id, input.name);
    this.charOwners.set(id, userId);
    this.takenNames.add(input.name);
    return id;
  }
  async ignoreReservation(id: string) {
    this.reservations.get(id)!.ignored = true;
  }
}

const claimInput = (over: Partial<ClaimInput> = {}): ClaimInput => ({
  name: "Newchar",
  class: "Mage",
  spec: "Frost",
  mainRole: MainRole.DPS,
  ...over,
});

const res = (over: Partial<Res> = {}): Res => ({
  rawName: "Skreemo",
  characterId: null,
  suggestedCharacterId: null,
  discordId: null,
  ignored: false,
  ...over,
});

let store: FakeStore;
beforeEach(() => {
  store = new FakeStore();
});

describe("linkReservation", () => {
  it("inserts an alias when rawName differs from the character name (resolve-once)", async () => {
    store.reservations.set("r1", res({ rawName: "Skreemo" }));
    store.charNames.set("c1", "Skreamo");
    const result = await linkReservation(store, "r1", "c1");
    expect(result.ok).toBe(true);
    expect(store.reservations.get("r1")?.characterId).toBe("c1");
    expect(store.aliases.get("Skreemo")).toBe("c1"); // <- the contract
  });

  it("does NOT insert an alias when rawName already equals the character name", async () => {
    store.reservations.set("r1", res({ rawName: "Skreamo" }));
    store.charNames.set("c1", "Skreamo");
    await linkReservation(store, "r1", "c1");
    expect(store.aliases.size).toBe(0);
  });

  it("attributes an unowned character to the reserver (via dId) so the member gets credit", async () => {
    store.reservations.set("r1", res({ rawName: "Skreamo", discordId: "d1" }));
    store.charNames.set("c1", "Skreamo");
    store.charOwners.set("c1", null); // unowned (officer-created)
    store.usersByDiscord.set("d1", "user-1");
    await linkReservation(store, "r1", "c1");
    expect(store.charOwners.get("c1")).toBe("user-1");
  });

  it("does NOT clobber an existing owner (officer override is respected)", async () => {
    store.reservations.set("r1", res({ rawName: "Skreamo", discordId: "d1" }));
    store.charNames.set("c1", "Skreamo");
    store.charOwners.set("c1", "owner-existing");
    store.usersByDiscord.set("d1", "user-1");
    await linkReservation(store, "r1", "c1");
    expect(store.charOwners.get("c1")).toBe("owner-existing");
  });

  it("leaves the character unowned when the dId has no user row", async () => {
    store.reservations.set("r1", res({ rawName: "Skreamo", discordId: "ghost" }));
    store.charNames.set("c1", "Skreamo");
    store.charOwners.set("c1", null);
    await linkReservation(store, "r1", "c1");
    expect(store.charOwners.get("c1")).toBeNull();
  });

  it("returns not_found for a missing reservation or character", async () => {
    expect(await linkReservation(store, "nope", "c1")).toEqual({ ok: false, reason: "not_found" });
    store.reservations.set("r1", res({ rawName: "X" }));
    expect(await linkReservation(store, "r1", "ghost")).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("acceptSuggestion", () => {
  it("links via the stored suggestion and inserts the alias", async () => {
    store.reservations.set("r1", res({ rawName: "Skreemo", suggestedCharacterId: "c1" }));
    store.charNames.set("c1", "Skreamo");
    const result = await acceptSuggestion(store, "r1");
    expect(result.ok).toBe(true);
    expect(store.reservations.get("r1")?.characterId).toBe("c1");
    expect(store.aliases.get("Skreemo")).toBe("c1");
  });

  it("returns not_found when there is no suggestion", async () => {
    store.reservations.set("r1", res({ rawName: "X" }));
    expect(await acceptSuggestion(store, "r1")).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("createAndLinkReservation", () => {
  it("creates a character owned by the reserver (via dId) and links it", async () => {
    store.reservations.set("r1", res({ rawName: "Newchar", discordId: "d1" }));
    store.usersByDiscord.set("d1", "user-1");
    const result = await createAndLinkReservation(store, "r1", claimInput({ name: "Newchar" }));
    expect(result.ok).toBe(true);
    const charId = store.reservations.get("r1")?.characterId;
    expect(charId).toMatch(/^new-/);
    expect(store.charOwners.get(charId!)).toBe("user-1"); // member gets credit
    expect(store.aliases.size).toBe(0); // name == rawName
  });

  it("creates an unowned character when the dId has no user row", async () => {
    store.reservations.set("r1", res({ rawName: "Newchar", discordId: "ghost" }));
    const result = await createAndLinkReservation(store, "r1", claimInput({ name: "Newchar" }));
    expect(result.ok).toBe(true);
    const charId = store.reservations.get("r1")?.characterId;
    expect(store.charOwners.get(charId!)).toBeNull();
  });

  it("returns name_taken when the character name already exists", async () => {
    store.takenNames.add("Newchar");
    store.reservations.set("r1", res({ rawName: "Newchar" }));
    const result = await createAndLinkReservation(store, "r1", claimInput({ name: "Newchar" }));
    expect(result).toEqual({ ok: false, reason: "name_taken" });
    expect(store.reservations.get("r1")?.characterId).toBeNull();
  });
});

describe("ignoreReservation", () => {
  it("marks the reservation ignored", async () => {
    store.reservations.set("r1", res({ rawName: "Junk" }));
    const result = await ignoreReservation(store, "r1");
    expect(result.ok).toBe(true);
    expect(store.reservations.get("r1")?.ignored).toBe(true);
  });
});
