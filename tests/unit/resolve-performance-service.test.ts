import { describe, expect, it, vi } from "vitest";
import {
  linkPerformanceName,
  type ResolvePerformanceStore,
} from "@/lib/services/resolve-performance-service";

function store(over: Partial<ResolvePerformanceStore> = {}): ResolvePerformanceStore {
  return {
    getCharacterName: vi.fn(async () => "Skreamo"),
    ensureAlias: vi.fn(async () => {}),
    backfillPerformances: vi.fn(async () => ["night-1", "night-2"]),
    ...over,
  };
}

describe("linkPerformanceName", () => {
  it("inserts an alias when the typed name differs from the character name", async () => {
    const s = store({ getCharacterName: vi.fn(async () => "Skreamo") });
    const res = await linkPerformanceName(s, "Skreemo", "char-1");
    expect(res.ok).toBe(true);
    expect(s.ensureAlias).toHaveBeenCalledWith("char-1", "Skreemo");
  });

  it("does NOT insert an alias when the name already matches", async () => {
    const s = store({ getCharacterName: vi.fn(async () => "Skreamo") });
    await linkPerformanceName(s, "Skreamo", "char-1");
    expect(s.ensureAlias).not.toHaveBeenCalled();
  });

  it("returns the affected raid nights for re-scoring", async () => {
    const s = store({ backfillPerformances: vi.fn(async () => ["nA", "nB"]) });
    const res = await linkPerformanceName(s, "Vex", "char-1");
    expect(res).toEqual({ ok: true, affectedRaidNightIds: ["nA", "nB"] });
  });

  it("fails when the character doesn't exist", async () => {
    const s = store({ getCharacterName: vi.fn(async () => null) });
    const res = await linkPerformanceName(s, "Vex", "missing");
    expect(res).toEqual({ ok: false, reason: "not_found" });
    expect(s.backfillPerformances).not.toHaveBeenCalled();
  });
});
