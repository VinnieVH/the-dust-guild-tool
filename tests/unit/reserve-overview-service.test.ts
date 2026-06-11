import { describe, expect, it } from "vitest";
import { Instance } from "@/lib/domain/enums";
import {
  type OverviewData,
  buildOverview,
  buildPokeList,
  buildReminderText,
} from "@/lib/services/reserve-overview-service";

const BOTH_LINKED = [Instance.SSC, Instance.TK];

describe("buildOverview", () => {
  it("marks a member done on both when they reserved on both", () => {
    const data: OverviewData = {
      members: [{ discordId: "d1", displayName: "Skreamo", characterIds: ["c1"] }],
      linkedInstances: BOTH_LINKED,
      reservations: [
        { instance: Instance.SSC, characterId: "c1" },
        { instance: Instance.TK, characterId: "c1" },
      ],
    };
    const o = buildOverview(data);
    expect(o.rows[0]).toMatchObject({ ssc: true, tk: true, hasCharacter: true });
    expect(o).toMatchObject({ completed: 1, total: 1 });
  });

  it("marks done on one, missing on the other", () => {
    const o = buildOverview({
      members: [{ discordId: "d1", displayName: "Skreamo", characterIds: ["c1"] }],
      linkedInstances: BOTH_LINKED,
      reservations: [{ instance: Instance.SSC, characterId: "c1" }],
    });
    expect(o.rows[0]).toMatchObject({ ssc: true, tk: false });
    expect(o.completed).toBe(0);
  });

  it("marks missing on both when they reserved nothing", () => {
    const o = buildOverview({
      members: [{ discordId: "d1", displayName: "Skreamo", characterIds: ["c1"] }],
      linkedInstances: BOTH_LINKED,
      reservations: [],
    });
    expect(o.rows[0]).toMatchObject({ ssc: false, tk: false });
  });

  it("counts an ALT's reservation as the member being done (any owned char)", () => {
    const o = buildOverview({
      members: [{ discordId: "d1", displayName: "Skreamo", characterIds: ["main", "alt"] }],
      linkedInstances: BOTH_LINKED,
      // The alt reserved SSC, the main reserved TK — member is done on both.
      reservations: [
        { instance: Instance.SSC, characterId: "alt" },
        { instance: Instance.TK, characterId: "main" },
      ],
    });
    expect(o.rows[0]).toMatchObject({ ssc: true, tk: true });
    expect(o.completed).toBe(1);
  });

  it("a signup with no claimed character is never done and is flagged", () => {
    const o = buildOverview({
      members: [{ discordId: "d1", displayName: "Roshlock", characterIds: [] }],
      linkedInstances: BOTH_LINKED,
      reservations: [{ instance: Instance.SSC, characterId: "someone-else" }],
    });
    expect(o.rows[0]).toMatchObject({ ssc: false, tk: false, hasCharacter: false });
  });

  it("only counts LINKED instances toward completion", () => {
    // Only SSC linked; a member who did SSC is complete even without TK.
    const o = buildOverview({
      members: [{ discordId: "d1", displayName: "Skreamo", characterIds: ["c1"] }],
      linkedInstances: [Instance.SSC],
      reservations: [{ instance: Instance.SSC, characterId: "c1" }],
    });
    expect(o).toMatchObject({ completed: 1, total: 1 });
    expect(o.rows[0].tk).toBe(false); // TK not linked -> false, but doesn't block completion
  });
});

describe("buildPokeList + buildReminderText", () => {
  const data: OverviewData = {
    members: [
      { discordId: "d-done", displayName: "Done", characterIds: ["c1"] },
      { discordId: "d-partial", displayName: "Partial", characterIds: ["c2"] },
      { discordId: "d-none", displayName: "NoChar", characterIds: [] },
    ],
    linkedInstances: BOTH_LINKED,
    reservations: [
      { instance: Instance.SSC, characterId: "c1" },
      { instance: Instance.TK, characterId: "c1" },
      { instance: Instance.SSC, characterId: "c2" }, // partial: SSC only
    ],
  };

  it("lists only members missing at least one sheet", () => {
    const poke = buildPokeList(buildOverview(data));
    expect(poke.map((p) => p.discordId).sort()).toEqual(["d-none", "d-partial"]);
    expect(poke.find((p) => p.discordId === "d-partial")?.missing).toEqual([Instance.TK]);
    expect(poke.find((p) => p.discordId === "d-none")?.missing).toEqual(BOTH_LINKED);
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
      linkedInstances: [Instance.SSC],
      reservations: [{ instance: Instance.SSC, characterId: "c1" }],
    });
    expect(buildReminderText(buildPokeList(o))).toContain("Everyone has soft-reserved");
  });
});
