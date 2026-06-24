import { beforeEach, describe, expect, it } from "vitest";
import type { ExternalReservation } from "@/lib/domain/external";
import type { IReserveSource } from "@/lib/integrations/interfaces";
import {
  type SoftresSyncStore,
  syncSoftres,
} from "@/lib/services/sync-softres-service";

// Fake reserve source: canned reservations keyed by softres id.
class FakeReserveSource implements IReserveSource {
  constructor(private byId: Record<string, ExternalReservation[]>) {}
  async fetchReservations(softresId: string) {
    return this.byId[softresId] ?? [];
  }
}

// In-memory store mirroring the repository's idempotency contract: never clears
// an officer-confirmed characterId, never touches `ignored`.
interface Row {
  characterId: string | null;
  suggestedCharacterId: string | null;
  ignored: boolean;
  discordId: string | null;
}
class FakeStore implements SoftresSyncStore {
  chars = new Map<string, { id: string; discordId: string | null }>(); // name -> char
  aliases = new Map<string, string>(); // alias -> characterId
  rows = new Map<string, Row>(); // `${sheetId}:${rawName}`
  owners = new Map<string, string>(); // characterId -> owning userId
  usersByDiscordId = new Map<string, string>(); // discordId -> userId

  async findCharacterIdByNameOrAlias(name: string) {
    return this.chars.get(name)?.id ?? this.aliases.get(name) ?? null;
  }
  async listCharacterIdsByDiscordId(discordId: string) {
    return [...this.chars.values()]
      .filter((c) => c.discordId === discordId)
      .map((c) => c.id);
  }
  async assignOwnerIfUnowned(characterId: string, discordId: string) {
    const userId = this.usersByDiscordId.get(discordId);
    if (!userId) return false; // no User for the dId yet
    if (this.owners.has(characterId)) return false; // already owned — never clobber
    this.owners.set(characterId, userId);
    return true;
  }
  async upsertReservation({ sheetId, rawName, discordId, resolution }: Parameters<SoftresSyncStore["upsertReservation"]>[0]) {
    const key = `${sheetId}:${rawName}`;
    const existing = this.rows.get(key);
    if (!existing) {
      this.rows.set(key, {
        characterId: resolution.kind === "matched" ? resolution.characterId : null,
        suggestedCharacterId: resolution.kind === "suggested" ? resolution.characterId : null,
        ignored: false,
        discordId,
      });
      return { created: true, matched: resolution.kind === "matched" };
    }
    // Guard: officer-confirmed link is never cleared; ignored never touched.
    if (existing.characterId) {
      existing.discordId = discordId;
      return { created: false, matched: true };
    }
    existing.discordId = discordId;
    if (resolution.kind === "matched") {
      existing.characterId = resolution.characterId;
      existing.suggestedCharacterId = null;
    } else if (resolution.kind === "suggested") {
      existing.suggestedCharacterId = resolution.characterId;
    } else {
      existing.suggestedCharacterId = null;
    }
    return { created: false, matched: resolution.kind === "matched" };
  }
}

const reservation = (over: Partial<ExternalReservation> = {}): ExternalReservation => ({
  rawName: "Skreamo",
  rawClass: "Warrior",
  discordId: "d1",
  items: [28453],
  reservedAt: new Date("2026-06-11T19:42:50Z"),
  ...over,
});

const SHEET = { sheetId: "sheet-1", softresId: "raid-1" };

let store: FakeStore;
beforeEach(() => {
  store = new FakeStore();
});

describe("syncSoftres resolution", () => {
  it("matches a reservation by exact character name", async () => {
    store.chars.set("Skreamo", { id: "c1", discordId: "d1" });
    const src = new FakeReserveSource({ "raid-1": [reservation()] });
    const res = await syncSoftres(src, store, [SHEET]);
    expect(res).toMatchObject({ reservations: 1, created: 1, matched: 1, unmatched: 0 });
    expect(store.rows.get("sheet-1:Skreamo")?.characterId).toBe("c1");
  });

  it("matches by confirmed alias", async () => {
    store.chars.set("Skreamo", { id: "c1", discordId: "d1" });
    store.aliases.set("Skreemo", "c1");
    const src = new FakeReserveSource({ "raid-1": [reservation({ rawName: "Skreemo" })] });
    const res = await syncSoftres(src, store, [SHEET]);
    expect(res.matched).toBe(1);
    expect(store.rows.get("sheet-1:Skreemo")?.characterId).toBe("c1");
  });

  it("suggests via dId when the reserver owns exactly one character", async () => {
    // Typo name, no exact/alias hit, but dId resolves to a single owned char.
    store.chars.set("Skreamo", { id: "c1", discordId: "d1" });
    const src = new FakeReserveSource({ "raid-1": [reservation({ rawName: "Skreemo" })] });
    const res = await syncSoftres(src, store, [SHEET]);
    expect(res).toMatchObject({ matched: 0, suggested: 1, unmatched: 0 });
    const row = store.rows.get("sheet-1:Skreemo");
    expect(row?.characterId).toBeNull();
    expect(row?.suggestedCharacterId).toBe("c1");
  });

  it("leaves unmatched when the reserver owns several characters (ambiguous)", async () => {
    store.chars.set("Skreamo", { id: "c1", discordId: "d1" });
    store.chars.set("Skreamalt", { id: "c2", discordId: "d1" });
    const src = new FakeReserveSource({ "raid-1": [reservation({ rawName: "Typo" })] });
    const res = await syncSoftres(src, store, [SHEET]);
    expect(res).toMatchObject({ matched: 0, suggested: 0, unmatched: 1 });
    expect(store.rows.get("sheet-1:Typo")?.suggestedCharacterId).toBeNull();
  });

  it("leaves unmatched when no name, alias, or dId resolves", async () => {
    const src = new FakeReserveSource({ "raid-1": [reservation({ rawName: "Ghost", discordId: null })] });
    const res = await syncSoftres(src, store, [SHEET]);
    expect(res).toMatchObject({ matched: 0, suggested: 0, unmatched: 1 });
  });
});

describe("syncSoftres idempotency", () => {
  it("re-syncing clean data changes nothing", async () => {
    store.chars.set("Skreamo", { id: "c1", discordId: "d1" });
    const src = new FakeReserveSource({ "raid-1": [reservation()] });
    await syncSoftres(src, store, [SHEET]);
    const second = await syncSoftres(src, store, [SHEET]);
    expect(second).toMatchObject({ reservations: 1, created: 0, matched: 1 });
    expect(store.rows.size).toBe(1);
  });

  // The load-bearing case (Step 3.4 acceptance): after an officer resolves a row,
  // a re-sync must NOT disturb the link or resurface an ignored row.
  it("preserves an officer-confirmed link and an ignored flag across re-sync", async () => {
    // No character named "Mystery" exists, so sync alone would leave it unmatched.
    // Simulate the officer having linked it (characterId set) and ignored another.
    const src = new FakeReserveSource({
      "raid-1": [reservation({ rawName: "Mystery", discordId: null }), reservation({ rawName: "Junk", discordId: null })],
    });
    await syncSoftres(src, store, [SHEET]); // both land unmatched
    // Officer actions:
    store.rows.get("sheet-1:Mystery")!.characterId = "officer-linked";
    store.rows.get("sheet-1:Junk")!.ignored = true;

    await syncSoftres(src, store, [SHEET]); // re-sync

    expect(store.rows.get("sheet-1:Mystery")?.characterId).toBe("officer-linked");
    expect(store.rows.get("sheet-1:Junk")?.ignored).toBe(true);
  });

  it("promotes a previously-unmatched row once its character exists (resolve-once via alias)", async () => {
    const src = new FakeReserveSource({ "raid-1": [reservation({ rawName: "Latecomer", discordId: null })] });
    await syncSoftres(src, store, [SHEET]);
    expect(store.rows.get("sheet-1:Latecomer")?.characterId).toBeNull();

    // Officer links it -> inserts an alias; next sync finds it by alias.
    store.aliases.set("Latecomer", "c9");
    const second = await syncSoftres(src, store, [SHEET]);
    expect(second.matched).toBe(1);
    expect(store.rows.get("sheet-1:Latecomer")?.characterId).toBe("c9");
  });
});

// The Brotmann/Kranà bug: a character is born UNOWNED (officer "Create & link"
// ran before the reserver's raid-helper User existed). The matrix reads
// ownership from that User, so the member shows "no character claimed" forever —
// sync re-links the reservation but historically never the owner. Self-heal
// back-fills the owner from the dId once the User exists.
describe("syncSoftres ownership self-heal", () => {
  it("adopts an unowned matched character once a User exists for the dId", async () => {
    store.chars.set("Brotmann", { id: "c1", discordId: "d1" }); // exists, unowned
    store.usersByDiscordId.set("d1", "u1"); // reserver's User now exists
    const src = new FakeReserveSource({ "raid-1": [reservation({ rawName: "Brotmann", discordId: "d1" })] });

    const res = await syncSoftres(src, store, [SHEET]);

    expect(res).toMatchObject({ matched: 1, adopted: 1 });
    expect(store.owners.get("c1")).toBe("u1");
  });

  it("does not adopt when no User exists for the dId yet (heals a later sync)", async () => {
    store.chars.set("Brotmann", { id: "c1", discordId: "d1" });
    // No usersByDiscordId entry: the signup hasn't synced yet.
    const src = new FakeReserveSource({ "raid-1": [reservation({ rawName: "Brotmann", discordId: "d1" })] });

    const res = await syncSoftres(src, store, [SHEET]);

    expect(res).toMatchObject({ matched: 1, adopted: 0 });
    expect(store.owners.has("c1")).toBe(false);

    // The User appears (raid-helper sync), and the NEXT softres sync heals it.
    store.usersByDiscordId.set("d1", "u1");
    const second = await syncSoftres(src, store, [SHEET]);
    expect(second.adopted).toBe(1);
    expect(store.owners.get("c1")).toBe("u1");
  });

  it("never reassigns an existing owner (officer-override invariant)", async () => {
    store.chars.set("Brotmann", { id: "c1", discordId: "d1" });
    store.owners.set("c1", "officer-set"); // already owned
    store.usersByDiscordId.set("d1", "u1");
    const src = new FakeReserveSource({ "raid-1": [reservation({ rawName: "Brotmann", discordId: "d1" })] });

    const res = await syncSoftres(src, store, [SHEET]);

    expect(res.adopted).toBe(0);
    expect(store.owners.get("c1")).toBe("officer-set");
  });

  it("does not adopt when the reservation has no dId", async () => {
    store.chars.set("Brotmann", { id: "c1", discordId: null });
    store.usersByDiscordId.set("d1", "u1");
    const src = new FakeReserveSource({ "raid-1": [reservation({ rawName: "Brotmann", discordId: null })] });

    const res = await syncSoftres(src, store, [SHEET]);

    expect(res.adopted).toBe(0);
    expect(store.owners.has("c1")).toBe(false);
  });

  it("is idempotent: re-syncing an already-adopted character adopts nothing more", async () => {
    store.chars.set("Brotmann", { id: "c1", discordId: "d1" });
    store.usersByDiscordId.set("d1", "u1");
    const src = new FakeReserveSource({ "raid-1": [reservation({ rawName: "Brotmann", discordId: "d1" })] });

    await syncSoftres(src, store, [SHEET]);
    const second = await syncSoftres(src, store, [SHEET]);
    expect(second.adopted).toBe(0);
    expect(store.owners.get("c1")).toBe("u1");
  });
});
