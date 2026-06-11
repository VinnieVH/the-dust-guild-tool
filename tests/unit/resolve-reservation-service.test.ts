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
  ignored: boolean;
}

class FakeStore implements ResolveReservationStore {
  reservations = new Map<string, Res>();
  charNames = new Map<string, string>(); // id -> name
  aliases = new Map<string, string>(); // alias -> characterId
  takenNames = new Set<string>(); // names that already exist (for createCharacter)
  private seq = 0;

  async getReservation(id: string) {
    const r = this.reservations.get(id);
    return r
      ? { rawName: r.rawName, characterId: r.characterId, suggestedCharacterId: r.suggestedCharacterId }
      : null;
  }
  async getCharacterName(characterId: string) {
    return this.charNames.get(characterId) ?? null;
  }
  async setReservationCharacter(id: string, characterId: string) {
    const r = this.reservations.get(id)!;
    r.characterId = characterId;
    r.suggestedCharacterId = null;
  }
  async ensureAlias(characterId: string, alias: string) {
    this.aliases.set(alias, characterId);
  }
  async createCharacter(input: ClaimInput) {
    if (this.takenNames.has(input.name)) throw new Error("unique violation");
    const id = `new-${++this.seq}`;
    this.charNames.set(id, input.name);
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

let store: FakeStore;
beforeEach(() => {
  store = new FakeStore();
});

describe("linkReservation", () => {
  it("inserts an alias when rawName differs from the character name (resolve-once)", async () => {
    store.reservations.set("r1", { rawName: "Skreemo", characterId: null, suggestedCharacterId: null, ignored: false });
    store.charNames.set("c1", "Skreamo");
    const res = await linkReservation(store, "r1", "c1");
    expect(res.ok).toBe(true);
    expect(store.reservations.get("r1")?.characterId).toBe("c1");
    expect(store.aliases.get("Skreemo")).toBe("c1"); // <- the contract
  });

  it("does NOT insert an alias when rawName already equals the character name", async () => {
    store.reservations.set("r1", { rawName: "Skreamo", characterId: null, suggestedCharacterId: null, ignored: false });
    store.charNames.set("c1", "Skreamo");
    await linkReservation(store, "r1", "c1");
    expect(store.aliases.size).toBe(0);
  });

  it("returns not_found for a missing reservation or character", async () => {
    expect(await linkReservation(store, "nope", "c1")).toEqual({ ok: false, reason: "not_found" });
    store.reservations.set("r1", { rawName: "X", characterId: null, suggestedCharacterId: null, ignored: false });
    expect(await linkReservation(store, "r1", "ghost")).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("acceptSuggestion", () => {
  it("links via the stored suggestion and inserts the alias", async () => {
    store.reservations.set("r1", { rawName: "Skreemo", characterId: null, suggestedCharacterId: "c1", ignored: false });
    store.charNames.set("c1", "Skreamo");
    const res = await acceptSuggestion(store, "r1");
    expect(res.ok).toBe(true);
    expect(store.reservations.get("r1")?.characterId).toBe("c1");
    expect(store.aliases.get("Skreemo")).toBe("c1");
  });

  it("returns not_found when there is no suggestion", async () => {
    store.reservations.set("r1", { rawName: "X", characterId: null, suggestedCharacterId: null, ignored: false });
    expect(await acceptSuggestion(store, "r1")).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("createAndLinkReservation", () => {
  it("creates an unowned character and links without an alias (name == rawName)", async () => {
    store.reservations.set("r1", { rawName: "Newchar", characterId: null, suggestedCharacterId: null, ignored: false });
    const res = await createAndLinkReservation(store, "r1", claimInput({ name: "Newchar" }));
    expect(res.ok).toBe(true);
    expect(store.reservations.get("r1")?.characterId).toMatch(/^new-/);
    expect(store.aliases.size).toBe(0);
  });

  it("returns name_taken when the character name already exists", async () => {
    store.takenNames.add("Newchar");
    store.reservations.set("r1", { rawName: "Newchar", characterId: null, suggestedCharacterId: null, ignored: false });
    const res = await createAndLinkReservation(store, "r1", claimInput({ name: "Newchar" }));
    expect(res).toEqual({ ok: false, reason: "name_taken" });
    expect(store.reservations.get("r1")?.characterId).toBeNull();
  });
});

describe("ignoreReservation", () => {
  it("marks the reservation ignored", async () => {
    store.reservations.set("r1", { rawName: "Junk", characterId: null, suggestedCharacterId: null, ignored: false });
    const res = await ignoreReservation(store, "r1");
    expect(res.ok).toBe(true);
    expect(store.reservations.get("r1")?.ignored).toBe(true);
  });
});
