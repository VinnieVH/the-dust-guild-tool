import { describe, expect, it } from "vitest";
import {
  type OverviewData,
  buildOverview,
  buildPokeList,
  buildReminderText,
} from "@/lib/services/reserve-overview-service";

// Two named sheets, keyed by id (names are display-only / collidable).
const SSC = { sheetId: "s-ssc", name: "SSC" };
const TK = { sheetId: "s-tk", name: "TK" };
const TWO_SHEETS = [SSC, TK];

describe("buildOverview", () => {
  it("marks a member done on both when they reserved on both", () => {
    const data: OverviewData = {
      members: [{ discordId: "d1", displayName: "Skreamo", characterIds: ["c1"] }],
      sheets: TWO_SHEETS,
      reservations: [
        { sheetId: SSC.sheetId, characterId: "c1" },
        { sheetId: TK.sheetId, characterId: "c1" },
      ],
    };
    const o = buildOverview(data);
    expect(o.rows[0].done).toEqual({ [SSC.sheetId]: true, [TK.sheetId]: true });
    expect(o.rows[0].hasCharacter).toBe(true);
    expect(o).toMatchObject({ completed: 1, total: 1 });
  });

  it("marks done on one, missing on the other", () => {
    const o = buildOverview({
      members: [{ discordId: "d1", displayName: "Skreamo", characterIds: ["c1"] }],
      sheets: TWO_SHEETS,
      reservations: [{ sheetId: SSC.sheetId, characterId: "c1" }],
    });
    expect(o.rows[0].done).toEqual({ [SSC.sheetId]: true, [TK.sheetId]: false });
    expect(o.completed).toBe(0);
    // Per-sheet bars: SSC ahead of TK.
    expect(o.perSheet).toEqual([
      { sheetId: SSC.sheetId, name: "SSC", done: 1, total: 1 },
      { sheetId: TK.sheetId, name: "TK", done: 0, total: 1 },
    ]);
  });

  it("handles three or more sheets (column per sheet, complete only when all done)", () => {
    const sheets = [SSC, TK, { sheetId: "s-kara", name: "Kara" }];
    const o = buildOverview({
      members: [
        { discordId: "all", displayName: "All", characterIds: ["c1"] },
        { discordId: "some", displayName: "Some", characterIds: ["c2"] },
      ],
      sheets,
      reservations: [
        { sheetId: SSC.sheetId, characterId: "c1" },
        { sheetId: TK.sheetId, characterId: "c1" },
        { sheetId: "s-kara", characterId: "c1" },
        { sheetId: SSC.sheetId, characterId: "c2" }, // only one of three
      ],
    });
    expect(o.sheets).toHaveLength(3);
    expect(o.completed).toBe(1); // only "All"
    expect(o.perSheet.find((p) => p.name === "Kara")).toMatchObject({ done: 1, total: 2 });
  });

  it("handles zero sheets: no columns, completed 0/0 (UI hides the block)", () => {
    const o = buildOverview({
      members: [{ discordId: "d1", displayName: "X", characterIds: ["c1"] }],
      sheets: [],
      reservations: [],
    });
    expect(o.sheets).toHaveLength(0);
    expect(o.perSheet).toHaveLength(0);
    expect(o).toMatchObject({ completed: 0, total: 1 });
    expect(o.rows[0].done).toEqual({});
  });

  it("marks missing on both when they reserved nothing", () => {
    const o = buildOverview({
      members: [{ discordId: "d1", displayName: "Skreamo", characterIds: ["c1"] }],
      sheets: TWO_SHEETS,
      reservations: [],
    });
    expect(o.rows[0].done).toEqual({ [SSC.sheetId]: false, [TK.sheetId]: false });
  });

  it("counts an ALT's reservation as the member being done (any owned char)", () => {
    const o = buildOverview({
      members: [{ discordId: "d1", displayName: "Skreamo", characterIds: ["main", "alt"] }],
      sheets: TWO_SHEETS,
      // The alt reserved SSC, the main reserved TK — member is done on both.
      reservations: [
        { sheetId: SSC.sheetId, characterId: "alt" },
        { sheetId: TK.sheetId, characterId: "main" },
      ],
    });
    expect(o.rows[0].done).toEqual({ [SSC.sheetId]: true, [TK.sheetId]: true });
    expect(o.completed).toBe(1);
  });

  it("a signup with no claimed character is never done and is flagged", () => {
    const o = buildOverview({
      members: [{ discordId: "d1", displayName: "Roshlock", characterIds: [] }],
      sheets: TWO_SHEETS,
      reservations: [{ sheetId: SSC.sheetId, characterId: "someone-else" }],
    });
    expect(o.rows[0].done).toEqual({ [SSC.sheetId]: false, [TK.sheetId]: false });
    expect(o.rows[0].hasCharacter).toBe(false);
  });

  it("completion is over linked sheets only", () => {
    // Only SSC linked; a member who did SSC is complete.
    const o = buildOverview({
      members: [{ discordId: "d1", displayName: "Skreamo", characterIds: ["c1"] }],
      sheets: [SSC],
      reservations: [{ sheetId: SSC.sheetId, characterId: "c1" }],
    });
    expect(o).toMatchObject({ completed: 1, total: 1 });
  });
});

describe("buildPokeList + buildReminderText", () => {
  const data: OverviewData = {
    members: [
      { discordId: "d-done", displayName: "Done", characterIds: ["c1"] },
      { discordId: "d-partial", displayName: "Partial", characterIds: ["c2"] },
      { discordId: "d-none", displayName: "NoChar", characterIds: [] },
    ],
    sheets: TWO_SHEETS,
    reservations: [
      { sheetId: SSC.sheetId, characterId: "c1" },
      { sheetId: TK.sheetId, characterId: "c1" },
      { sheetId: SSC.sheetId, characterId: "c2" }, // partial: SSC only
    ],
  };

  it("lists only members missing at least one sheet, by sheet name", () => {
    const poke = buildPokeList(buildOverview(data));
    expect(poke.map((p) => p.discordId).sort()).toEqual(["d-none", "d-partial"]);
    expect(poke.find((p) => p.discordId === "d-partial")?.missing).toEqual(["TK"]);
    expect(poke.find((p) => p.discordId === "d-none")?.missing).toEqual(["SSC", "TK"]);
  });

  it("builds Discord mention text with a no-character hint", () => {
    const text = buildReminderText(buildPokeList(buildOverview(data)));
    expect(text).toContain("<@d-partial> — missing TK");
    expect(text).toContain("<@d-none> — missing SSC + TK (no character claimed");
    expect(text).not.toContain("<@d-done>");
  });

  it("celebrates when nobody is missing", () => {
    const o = buildOverview({
      members: [{ discordId: "d1", displayName: "X", characterIds: ["c1"] }],
      sheets: [SSC],
      reservations: [{ sheetId: SSC.sheetId, characterId: "c1" }],
    });
    expect(buildReminderText(buildPokeList(o))).toContain("Everyone has soft-reserved");
  });
});
