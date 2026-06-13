import { describe, expect, it, vi } from "vitest";
import {
  ignoreAllUnmatchedWclNames,
  ignoreWclName,
  type IgnoreWclNameStore,
} from "@/lib/services/ignore-wcl-name-service";

function store(unmatched: string[] = []): IgnoreWclNameStore & { ignored: string[] } {
  const ignored: string[] = [];
  return {
    ignored,
    ignoreName: vi.fn(async (n: string) => {
      if (!ignored.includes(n)) ignored.push(n);
    }),
    listUnmatchedNotIgnored: vi.fn(async () => unmatched.filter((n) => !ignored.includes(n))),
    ignoreNames: vi.fn(async (names: string[]) => {
      for (const n of names) if (!ignored.includes(n)) ignored.push(n);
    }),
    unignoreName: vi.fn(async (n: string) => {
      const i = ignored.indexOf(n);
      if (i >= 0) ignored.splice(i, 1);
    }),
  };
}

describe("ignoreWclName", () => {
  it("adds one name to the ignore list", async () => {
    const s = store();
    await ignoreWclName(s, "Pugzor");
    expect(s.ignored).toEqual(["Pugzor"]);
  });
});

describe("ignoreAllUnmatchedWclNames", () => {
  it("dismisses every currently-unmatched name and reports the count", async () => {
    const s = store(["Pug1", "Pug2", "Pug3"]);
    const res = await ignoreAllUnmatchedWclNames(s);
    expect(res.dismissed).toBe(3);
    expect(s.ignored.sort()).toEqual(["Pug1", "Pug2", "Pug3"]);
  });

  it("is idempotent: a second run dismisses nothing new", async () => {
    const s = store(["Pug1", "Pug2"]);
    await ignoreAllUnmatchedWclNames(s);
    const second = await ignoreAllUnmatchedWclNames(s);
    expect(second.dismissed).toBe(0); // all already ignored -> none left to dismiss
    expect(s.ignored.sort()).toEqual(["Pug1", "Pug2"]);
  });

  it("dismisses zero cleanly when the queue is empty", async () => {
    const res = await ignoreAllUnmatchedWclNames(store([]));
    expect(res.dismissed).toBe(0);
  });
});
