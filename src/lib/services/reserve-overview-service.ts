import { Instance } from "@/lib/domain/enums";

// One row of the SR matrix: a confirmed signup and whether they've reserved on
// each instance's sheet. "Done" for an instance = ANY reservation on that
// instance's sheet resolves to ANY character this member owns (covers alts).
export interface OverviewRow {
  discordId: string;
  /** Claimed character name if any, else the Discord display name. */
  displayName: string;
  /** No character claimed -> can never be matched; UI hints at this. */
  hasCharacter: boolean;
  ssc: boolean;
  tk: boolean;
}

export interface ReserveOverview {
  rows: OverviewRow[];
  /** Sheets actually linked for this night — columns the UI should show. */
  linkedInstances: Instance[];
  /** Completion across linked sheets: a member counts as complete when they've
   *  done every LINKED instance. */
  completed: number;
  total: number;
}

// Input the overview is built from — supplied by a query port (no Prisma here).
export interface OverviewData {
  /** Confirmed signups for the night. */
  members: {
    discordId: string;
    displayName: string;
    /** Character ids this member owns (across alts). Empty if none claimed. */
    characterIds: string[];
  }[];
  /** Which instances have a linked sheet. */
  linkedInstances: Instance[];
  /** Matched reservations: which characterId reserved on which instance. */
  reservations: { instance: Instance; characterId: string }[];
}

// Pure: turn signups + linked sheets + matched reservations into the matrix.
// Idempotent and side-effect-free — fully unit-testable.
export function buildOverview(data: OverviewData): ReserveOverview {
  // instance -> set of characterIds that reserved on it.
  const reservedBy = new Map<Instance, Set<string>>();
  for (const r of data.reservations) {
    if (!reservedBy.has(r.instance)) reservedBy.set(r.instance, new Set());
    reservedBy.get(r.instance)!.add(r.characterId);
  }

  const linked = new Set(data.linkedInstances);
  const done = (instance: Instance, owned: string[]): boolean => {
    if (!linked.has(instance)) return false;
    const reserved = reservedBy.get(instance);
    if (!reserved) return false;
    return owned.some((id) => reserved.has(id));
  };

  const rows: OverviewRow[] = data.members.map((m) => ({
    discordId: m.discordId,
    displayName: m.displayName,
    hasCharacter: m.characterIds.length > 0,
    ssc: done(Instance.SSC, m.characterIds),
    tk: done(Instance.TK, m.characterIds),
  }));

  // A member is complete when they've done every LINKED instance.
  const isComplete = (row: OverviewRow): boolean =>
    data.linkedInstances.every((i) => (i === Instance.SSC ? row.ssc : row.tk));

  return {
    rows,
    linkedInstances: data.linkedInstances,
    completed: rows.filter(isComplete).length,
    total: rows.length,
  };
}

// The poke list: members missing ≥1 linked sheet, with which they're missing.
// Drives the "Copy Discord reminder" button (<@discordId> mentions).
export interface PokeEntry {
  discordId: string;
  displayName: string;
  missing: Instance[];
  hasCharacter: boolean;
}

export function buildPokeList(overview: ReserveOverview): PokeEntry[] {
  return overview.rows
    .map((row) => {
      const missing = overview.linkedInstances.filter((i) =>
        i === Instance.SSC ? !row.ssc : !row.tk,
      );
      return {
        discordId: row.discordId,
        displayName: row.displayName,
        missing,
        hasCharacter: row.hasCharacter,
      };
    })
    .filter((e) => e.missing.length > 0);
}

// Build the copy-paste Discord reminder text. Mentions resolve in Discord.
export function buildReminderText(poke: PokeEntry[]): string {
  if (poke.length === 0) return "Everyone has soft-reserved. 🎉";
  const lines = poke.map((e) => {
    const what = e.missing.join(" + ");
    const hint = e.hasCharacter ? "" : " (no character claimed — claim one first)";
    return `<@${e.discordId}> — missing ${what}${hint}`;
  });
  return `**Soft-res reminder** — please reserve before raid:\n${lines.join("\n")}`;
}
