import { describe, expect, it, vi } from "vitest";
import type { ExternalGuildAttendance } from "@/lib/domain/external";
import type { IGuildSource } from "@/lib/integrations/interfaces";
import {
  syncAttendance,
  type AttendanceSyncStore,
} from "@/lib/services/sync-attendance-service";

function night(
  reportCode: string,
  startTime: number,
  names: string[],
  zone = "SSC / TK",
): ExternalGuildAttendance {
  return {
    reportCode,
    startTime: new Date(startTime),
    zone,
    players: names.map((name) => ({ name, present: true })),
  };
}

function guildSource(history: ExternalGuildAttendance[]): IGuildSource {
  return {
    fetchAttendance: vi.fn(async () => history),
    fetchZoneRanking: vi.fn(),
    fetchRoster: vi.fn(),
  };
}

// Convenience: a store whose resolver maps each name -> a user, with the streak
// captured into `out`. resetMilestones is a no-op spy (the service calls it).
function captureStore(
  resolve: AttendanceSyncStore["resolveNamesToUsers"],
  onPersist: (userId: string, cur: number) => void,
): AttendanceSyncStore & { reset: ReturnType<typeof vi.fn> } {
  const reset = vi.fn(async () => {});
  return {
    resolveNamesToUsers: resolve,
    resetMilestones: reset,
    persistUserStreak: vi.fn(async (userId, cur) => onPersist(userId, cur)),
    reset,
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
    const store = captureStore(
      vi.fn(async (names) => {
        const m = new Map<string, string>();
        for (const n of names) m.set(n, `user:${n}`);
        return m;
      }),
      (userId, cur) => {
        persisted[userId] = cur;
      },
    );

    await syncAttendance(guildSource(history), store, 1);
    expect(persisted["user:Vex"]).toBe(1);
    // The recompute wipes milestones first (authoritative rebuild).
    expect(store.reset).toHaveBeenCalledOnce();
  });

  it("alt-dedups: a user present on any owned character counts once per night", async () => {
    const history = [
      night("n1", 1000, ["Main", "Alt"]),
      night("n2", 2000, ["Main"]),
    ];
    let captured = -1;
    const store = captureStore(
      vi.fn(async () =>
        new Map([
          ["Main", "user:1"],
          ["Alt", "user:1"],
        ]),
      ),
      (_u, cur) => {
        captured = cur;
      },
    );

    const result = await syncAttendance(guildSource(history), store, 1);
    expect(result.users).toBe(1);
    expect(captured).toBe(2);
  });

  it("drops unresolved names (unclaimed alts/pugs)", async () => {
    const history = [night("n1", 1000, ["Known", "Stranger"])];
    const store = captureStore(
      vi.fn(async () => new Map([["Known", "user:1"]])),
      () => {},
    );
    const result = await syncAttendance(guildSource(history), store, 1);
    expect(result.users).toBe(1); // Stranger dropped
  });

  it("orders oldest->newest regardless of API order (newest-first input)", async () => {
    const history = [
      night("n3", 3000, ["Vex"]),
      night("n2", 2000, ["Vex"]),
      night("n1", 1000, ["Vex"]),
    ];
    let cur = -1;
    const store = captureStore(
      vi.fn(async () => new Map([["Vex", "user:1"]])),
      (_u, c) => {
        cur = c;
      },
    );
    await syncAttendance(guildSource(history), store, 1);
    expect(cur).toBe(3);
  });

  it("excludes 10-man content (Karazhan) from the streak chronology", async () => {
    // Vex raids 25-man n1 and n3; a Karazhan night sits between them. It must NOT
    // break the streak (Vex absent there is irrelevant) NOR be a counted night.
    const history = [
      night("n1", 1000, ["Vex"]),
      night("kara", 2000, ["Someone"], "Karazhan"),
      night("n3", 3000, ["Vex"]),
    ];
    let cur = -1;
    const store = captureStore(
      vi.fn(async (names) => {
        const m = new Map<string, string>();
        for (const n of names) m.set(n, `user:${n}`);
        return m;
      }),
      (userId, c) => {
        if (userId === "user:Vex") cur = c;
      },
    );
    const result = await syncAttendance(guildSource(history), store, 1);
    // Only 2 25-man nights counted; Vex present both consecutively -> streak 2.
    expect(result.nights).toBe(2);
    expect(cur).toBe(2);
  });
});
