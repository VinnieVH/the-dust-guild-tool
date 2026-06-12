import { beforeEach, describe, expect, it } from "vitest";
import type { CharacterRecord, ClaimInput } from "@/lib/domain/character";
import { MainRole } from "@/lib/domain/enums";
import {
  type AutoClaimStore,
  type ClaimableSignup,
  autoClaimFromSignups,
} from "@/lib/services/auto-claim";

// In-memory AutoClaimStore: character ownership + a canned signup list.
class FakeStore implements AutoClaimStore {
  chars: CharacterRecord[] = [];
  signups: ClaimableSignup[] = [];
  private seq = 0;

  async findByNameOrAlias(name: string) {
    return this.chars.find((c) => c.name === name) ?? null;
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
  async listClaimableSignups() {
    return this.signups;
  }
}

const signup = (over: Partial<ClaimableSignup> = {}): ClaimableSignup => ({
  characterName: "Skreamo",
  class: "Warrior",
  specSignedAs: "Arms",
  role: MainRole.DPS,
  ...over,
});

let store: FakeStore;
beforeEach(() => {
  store = new FakeStore();
});

describe("autoClaimFromSignups", () => {
  it("creates and claims a character from a signup on first login", async () => {
    store.signups = [signup()];
    const res = await autoClaimFromSignups(store, "user-1", "d1");
    expect(res).toEqual({ claimed: 1, skipped: 0 });
    expect(store.chars).toMatchObject([{ name: "Skreamo", userId: "user-1" }]);
  });

  it("is idempotent: re-running claims nothing new (already yours)", async () => {
    store.signups = [signup()];
    await autoClaimFromSignups(store, "user-1", "d1");
    const second = await autoClaimFromSignups(store, "user-1", "d1");
    expect(second).toEqual({ claimed: 0, skipped: 1 });
    expect(store.chars).toHaveLength(1);
  });

  it("dedupes multiple signups for the same character into one claim", async () => {
    store.signups = [
      signup({ specSignedAs: "Arms" }),
      signup({ specSignedAs: "Fury" }),
    ];
    const res = await autoClaimFromSignups(store, "user-1", "d1");
    expect(res).toEqual({ claimed: 1, skipped: 0 });
    expect(store.chars).toHaveLength(1);
  });

  // Raid-Helper shares one display name across a main + alts (no real alt name),
  // so signups for "Skreamo" can carry different classes. Auto-claim registers
  // ONE character and picks the most-frequent class — deterministically, so the
  // result doesn't depend on signup row order.
  it("picks the most-frequent class when one name spans classes (alt)", async () => {
    const warlock = signup({ class: "Warlock", specSignedAs: "Destruction" });
    const warrior = signup({ class: "Warrior", specSignedAs: "Arms" });
    // Alt signed up once (Kara), main twice (SSC, TK) — warrior should win
    // regardless of ordering.
    store.signups = [warlock, warrior, warrior];
    const res = await autoClaimFromSignups(store, "user-1", "d1");
    expect(res).toEqual({ claimed: 1, skipped: 0 });
    expect(store.chars).toMatchObject([{ name: "Skreamo", class: "Warrior" }]);

    // Same multiset, reordered — same deterministic winner.
    const store2 = new FakeStore();
    store2.signups = [warrior, warlock, warrior];
    await autoClaimFromSignups(store2, "user-2", "d2");
    expect(store2.chars).toMatchObject([{ class: "Warrior" }]);
  });

  it("breaks a class tie alphabetically (deterministic, order-independent)", async () => {
    store.signups = [
      signup({ class: "Warrior" }),
      signup({ class: "Mage" }),
    ];
    await autoClaimFromSignups(store, "user-1", "d1");
    // 1 each -> alphabetical: "Mage" < "Warrior".
    expect(store.chars).toMatchObject([{ class: "Mage" }]);
  });

  it("skips a character already owned by another user", async () => {
    store.chars.push({
      id: "c0",
      userId: "user-2",
      name: "Skreamo",
      class: "Warrior",
      spec: "Arms",
      mainRole: MainRole.DPS,
    });
    store.signups = [signup()];
    const res = await autoClaimFromSignups(store, "user-1", "d1");
    expect(res).toEqual({ claimed: 0, skipped: 1 });
    expect(store.chars[0].userId).toBe("user-2");
  });

  it("claims an existing unowned character without creating a duplicate", async () => {
    store.chars.push({
      id: "c0",
      userId: null,
      name: "Skreamo",
      class: "Warrior",
      spec: "Arms",
      mainRole: MainRole.DPS,
    });
    store.signups = [signup()];
    const res = await autoClaimFromSignups(store, "user-1", "d1");
    expect(res).toEqual({ claimed: 1, skipped: 0 });
    expect(store.chars).toHaveLength(1);
    expect(store.chars[0].userId).toBe("user-1");
  });
});
