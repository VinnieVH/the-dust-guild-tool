import { describe, expect, it, vi } from "vitest";
import type { ExternalGuildAttendance } from "@/lib/domain/external";
import type { IGuildSource } from "@/lib/integrations/interfaces";
import {
  syncAttendance,
  type AttendanceSyncStore,
} from "@/lib/services/sync-attendance-service";

function night(reportCode: string, startTime: number, names: string[]): ExternalGuildAttendance {
  return {
    reportCode,
    startTime: new Date(startTime),
    zone: "SSC / TK",
    players: names.map((name) => ({ name, present: true })),
  };
}

function guildSource(history: ExternalGuildAttendance[]): IGuildSource {
  return {
    fetchAttendance: vi.fn(async () => history),
    fetchZoneRanking: vi.fn(),
  };
}

describe("syncAttendance — feeding layer", () => {
  it("builds the FULL chronology (absent nights count as breaks)", async () => {
    // Vex attends n1 and n3 but NOT n2 -> current streak should be 1 (only n3).
    const history = [
      night("n1", 1000, ["Vex"]),
      night("n2", 2000, ["Other"]),
      night("n3", 3000, ["Vex"]),
    ];
    const persisted: Record<string, number> = {};
    const store: AttendanceSyncStore = {
      resolveNamesToUsers: vi.fn(async (names) => {
        const m = new Map<string, string>();
        for (const n of names) m.set(n, `user:${n}`); // each name = its own user
        return m;
      }),
      persistUserStreak: vi.fn(async (userId, cur) => {
        persisted[userId] = cur;
      }),
    };

    await syncAttendance(guildSource(history), store, 1);
    // Vex missed n2, so the trailing run is just n3 = 1.
    expect(persisted["user:Vex"]).toBe(1);
  });

  it("alt-dedups: a user present on any owned character counts once per night", async () => {
    // Both 'Main' and 'Alt' resolve to the SAME user, present same night.
    const history = [
      night("n1", 1000, ["Main", "Alt"]),
      night("n2", 2000, ["Main"]),
    ];
    let captured = -1;
    const store: AttendanceSyncStore = {
      resolveNamesToUsers: vi.fn(async () =>
        new Map([
          ["Main", "user:1"],
          ["Alt", "user:1"],
        ]),
      ),
      persistUserStreak: vi.fn(async (_u, cur) => {
        captured = cur;
      }),
    };

    const result = await syncAttendance(guildSource(history), store, 1);
    // One user, present BOTH nights (alt-deduped) -> streak 2, not double-counted.
    expect(result.users).toBe(1);
    expect(captured).toBe(2);
  });

  it("drops unresolved names (unclaimed alts/pugs)", async () => {
    const history = [night("n1", 1000, ["Known", "Stranger"])];
    const store: AttendanceSyncStore = {
      resolveNamesToUsers: vi.fn(async () => new Map([["Known", "user:1"]])),
      persistUserStreak: vi.fn(async () => {}),
    };
    const result = await syncAttendance(guildSource(history), store, 1);
    expect(result.users).toBe(1); // Stranger dropped
  });

  it("orders oldest->newest regardless of API order (newest-first input)", async () => {
    // WCL returns newest first; the service must reorder so the streak is right.
    const history = [
      night("n3", 3000, ["Vex"]),
      night("n2", 2000, ["Vex"]),
      night("n1", 1000, ["Vex"]),
    ];
    let cur = -1;
    const store: AttendanceSyncStore = {
      resolveNamesToUsers: vi.fn(async () => new Map([["Vex", "user:1"]])),
      persistUserStreak: vi.fn(async (_u, c) => {
        cur = c;
      }),
    };
    await syncAttendance(guildSource(history), store, 1);
    expect(cur).toBe(3); // present all three consecutive nights
  });
});
