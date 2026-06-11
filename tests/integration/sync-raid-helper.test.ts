import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type ExternalRaidEvent,
  type ExternalSignup,
  SignupStatus,
} from "@/lib/domain/external";
import type { IEventSource } from "@/lib/integrations/interfaces";
import { raidNightRepository } from "@/lib/repositories/raid-night-repository";
import { syncRaidHelper } from "@/lib/services/sync-service";
import { db } from "@/lib/db";

// Verifies the §2.3 acceptance against the REAL repository + Postgres:
// running the sync twice yields identical DB state (idempotent).
const EVENT_ID = "itest-evt-1";
const DISCORD_ID = "itest-d1";

class FakeEventSource implements IEventSource {
  constructor(private signups: ExternalSignup[]) {}
  async fetchUpcomingEvents(): Promise<ExternalRaidEvent[]> {
    return [
      {
        eventId: EVENT_ID,
        title: "ITest SSC & TK",
        startTime: new Date("2026-06-20T18:00:00Z"),
      },
    ];
  }
  async fetchSignups(): Promise<ExternalSignup[]> {
    return this.signups;
  }
}

const signup: ExternalSignup = {
  discordId: DISCORD_ID,
  name: "ITestSkreamo",
  class: "Warrior",
  spec: "Arms",
  status: SignupStatus.CONFIRMED,
};

async function cleanup() {
  const night = await db.raidNight.findUnique({
    where: { raidHelperEventId: EVENT_ID },
    select: { id: true },
  });
  if (night) {
    await db.signup.deleteMany({ where: { raidNightId: night.id } });
    await db.raidNight.delete({ where: { id: night.id } });
  }
  await db.user.deleteMany({ where: { discordId: DISCORD_ID } });
}

beforeEach(cleanup);
afterEach(cleanup);
afterAll(async () => {
  await db.$disconnect();
});

describe("syncRaidHelper (live DB)", () => {
  it("is idempotent: two runs produce identical state", async () => {
    const src = new FakeEventSource([signup]);

    const first = await syncRaidHelper(src, raidNightRepository);
    expect(first).toMatchObject({ events: 1, signups: 1, created: 1 });

    const second = await syncRaidHelper(src, raidNightRepository);
    expect(second).toMatchObject({ created: 0, updated: 0 });

    const nights = await db.raidNight.count({
      where: { raidHelperEventId: EVENT_ID },
    });
    const signups = await db.signup.count({
      where: { user: { discordId: DISCORD_ID } },
    });
    expect(nights).toBe(1);
    expect(signups).toBe(1);
  });

  it("stubs a user for an unknown Discord id", async () => {
    await syncRaidHelper(new FakeEventSource([signup]), raidNightRepository);
    const user = await db.user.findUnique({ where: { discordId: DISCORD_ID } });
    expect(user).not.toBeNull();
  });
});
