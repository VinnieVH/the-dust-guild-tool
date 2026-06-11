import type { IEventSource } from "@/lib/integrations/interfaces";
import type { RaidSyncStore } from "@/lib/repositories/raid-night-repository";

export interface RaidHelperSyncResult {
  events: number;
  signups: number;
  created: number; // raid nights newly created
  updated: number; // signups whose status/spec changed
}

// Pure domain logic: pull events + signups from any IEventSource and write them
// through any RaidSyncStore. No HTTP, no Prisma — fully unit-testable with fakes.
//
// Idempotent by construction: raid nights upsert by raidHelperEventId, signups
// by (raidNightId, userId). Users unknown to the app (signed up on Discord but
// never logged in) get a stub row so signups are never dropped.
export async function syncRaidHelper(
  eventSource: IEventSource,
  store: RaidSyncStore,
): Promise<RaidHelperSyncResult> {
  const events = await eventSource.fetchUpcomingEvents();
  const result: RaidHelperSyncResult = {
    events: events.length,
    signups: 0,
    created: 0,
    updated: 0,
  };

  for (const event of events) {
    const night = await store.upsertRaidNight({
      raidHelperEventId: event.eventId,
      title: event.title,
      date: event.startTime,
    });
    if (night.created) result.created += 1;

    const signups = await eventSource.fetchSignups(event.eventId);
    for (const signup of signups) {
      const userId = await store.ensureUserByDiscordId(
        signup.discordId,
        signup.name,
      );
      const outcome = await store.upsertSignup({
        raidNightId: night.id,
        userId,
        status: signup.status,
        specSignedAs: signup.spec ?? "",
        role: signup.role,
        characterName: signup.name,
        class: signup.class,
      });
      result.signups += 1;
      if (outcome.updated) result.updated += 1;
    }
  }

  return result;
}
