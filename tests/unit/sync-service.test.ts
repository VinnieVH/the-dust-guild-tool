import { beforeEach, describe, expect, it } from "vitest";
import {
  type ExternalRaidEvent,
  type ExternalSignup,
  SignupStatus,
} from "@/lib/domain/external";
import type { IEventSource } from "@/lib/integrations/interfaces";
import type { RaidSyncStore } from "@/lib/repositories/raid-night-repository";
import { syncRaidHelper } from "@/lib/services/sync-service";

// Fake event source returning canned events/signups.
class FakeEventSource implements IEventSource {
  constructor(
    private events: ExternalRaidEvent[],
    private signupsByEvent: Record<string, ExternalSignup[]>,
  ) {}
  async fetchUpcomingEvents() {
    return this.events;
  }
  async fetchSignups(eventId: string) {
    return this.signupsByEvent[eventId] ?? [];
  }
}

// In-memory store mirroring the upsert semantics of the real repository.
class FakeStore implements RaidSyncStore {
  nights = new Map<string, { id: string; title: string; date: Date }>(); // by rhEventId
  users = new Map<string, string>(); // discordId -> userId
  signups = new Map<string, { status: string; specSignedAs: string }>(); // `${nightId}:${userId}`
  private seq = 0;

  async upsertRaidNight({
    raidHelperEventId,
    title,
    date,
  }: {
    raidHelperEventId: string;
    title: string;
    date: Date;
  }) {
    const existing = this.nights.get(raidHelperEventId);
    if (existing) {
      existing.title = title;
      existing.date = date;
      return { id: existing.id, created: false };
    }
    const id = `n${++this.seq}`;
    this.nights.set(raidHelperEventId, { id, title, date });
    return { id, created: true };
  }

  names = new Map<string, string>(); // discordId -> name (faithful to repo)
  async ensureUserByDiscordId(discordId: string, discordName: string) {
    const existing = this.users.get(discordId);
    if (existing) return existing;
    const id = `u${++this.seq}`;
    this.users.set(discordId, id);
    this.names.set(discordId, discordName);
    return id;
  }

  async upsertSignup({
    raidNightId,
    userId,
    status,
    specSignedAs,
  }: {
    raidNightId: string;
    userId: string;
    status: string;
    specSignedAs: string;
  }) {
    const key = `${raidNightId}:${userId}`;
    const existing = this.signups.get(key);
    if (!existing) {
      this.signups.set(key, { status, specSignedAs });
      return { created: true, updated: false };
    }
    const changed =
      existing.status !== status || existing.specSignedAs !== specSignedAs;
    if (changed) this.signups.set(key, { status, specSignedAs });
    return { created: false, updated: changed };
  }
}

const event: ExternalRaidEvent = {
  eventId: "evt-1",
  title: "SSC & TK",
  startTime: new Date("2026-06-20T18:00:00Z"),
};
const signup = (over: Partial<ExternalSignup> = {}): ExternalSignup => ({
  discordId: "d1",
  name: "Skreamo",
  class: "Warrior",
  spec: "Arms",
  status: SignupStatus.CONFIRMED,
  ...over,
});

let store: FakeStore;
beforeEach(() => {
  store = new FakeStore();
});

describe("syncRaidHelper", () => {
  it("creates a night and its signups on first sync", async () => {
    const src = new FakeEventSource([event], { "evt-1": [signup()] });
    const res = await syncRaidHelper(src, store);
    expect(res).toEqual({ events: 1, signups: 1, created: 1, updated: 0 });
    expect(store.nights.size).toBe(1);
    expect(store.signups.size).toBe(1);
  });

  it("is idempotent: re-syncing identical data changes nothing", async () => {
    const src = new FakeEventSource([event], { "evt-1": [signup()] });
    await syncRaidHelper(src, store);
    const second = await syncRaidHelper(src, store);
    expect(second).toEqual({ events: 1, signups: 1, created: 0, updated: 0 });
    expect(store.nights.size).toBe(1);
    expect(store.signups.size).toBe(1);
  });

  it("updates a signup whose status changed (e.g. confirmed -> absent)", async () => {
    const src1 = new FakeEventSource([event], { "evt-1": [signup()] });
    await syncRaidHelper(src1, store);

    const src2 = new FakeEventSource([event], {
      "evt-1": [signup({ status: SignupStatus.ABSENT, spec: null })],
    });
    const res = await syncRaidHelper(src2, store);
    expect(res.updated).toBe(1);
    expect(store.signups.get("n1:u2")?.status).toBe(SignupStatus.ABSENT);
  });

  it("stubs a user row for an unknown Discord id so signups are never dropped", async () => {
    const src = new FakeEventSource([event], {
      "evt-1": [signup({ discordId: "never-logged-in" })],
    });
    await syncRaidHelper(src, store);
    expect(store.users.has("never-logged-in")).toBe(true);
    expect(store.signups.size).toBe(1);
  });
});
