// One row of the SR matrix: a confirmed signup and, per linked sheet, whether
// they've reserved on it. "Done" for a sheet = ANY reservation on that sheet
// resolves to ANY character this member owns (covers alts). Keyed by sheetId
// (names are editable/collidable — never key on the display name).
export interface OverviewRow {
  discordId: string;
  /** Claimed character name if any, else the Discord display name. */
  displayName: string;
  /** WoW class of the displayed character, for class coloring. Null when the
   *  member has no claimed character (displayName is then the Discord name). */
  displayClass: string | null;
  /** No character claimed -> can never be matched; UI hints at this. */
  hasCharacter: boolean;
  /** Done flag per linked sheet, same order/length as overview.sheets. */
  done: Record<string, boolean>; // sheetId -> done
}

export interface SheetColumn {
  sheetId: string;
  name: string;
}

export interface ReserveOverview {
  rows: OverviewRow[];
  /** Sheets linked for this night — the matrix columns, in display order. */
  sheets: SheetColumn[];
  /** Members who've done EVERY linked sheet. */
  completed: number;
  total: number;
  /** Per-sheet completion so the UI can show progress per sheet. */
  perSheet: { sheetId: string; name: string; done: number; total: number }[];
}

// Input the overview is built from — supplied by a query port (no Prisma here).
export interface OverviewData {
  /** Confirmed signups for the night. */
  members: {
    discordId: string;
    displayName: string;
    /** WoW class of the displayed character (null/omitted if none claimed). */
    displayClass?: string | null;
    /** Character ids this member owns (across alts). Empty if none claimed. */
    characterIds: string[];
  }[];
  /** Sheets linked for this night (the matrix columns). */
  sheets: SheetColumn[];
  /** Matched reservations: which characterId reserved on which sheet. */
  reservations: { sheetId: string; characterId: string }[];
}

// Pure: turn signups + linked sheets + matched reservations into the matrix.
// Idempotent and side-effect-free — fully unit-testable.
export function buildOverview(data: OverviewData): ReserveOverview {
  // sheetId -> set of characterIds that reserved on it.
  const reservedBy = new Map<string, Set<string>>();
  for (const r of data.reservations) {
    if (!reservedBy.has(r.sheetId)) reservedBy.set(r.sheetId, new Set());
    reservedBy.get(r.sheetId)!.add(r.characterId);
  }

  const sheetIds = data.sheets.map((s) => s.sheetId);
  const isDone = (sheetId: string, owned: string[]): boolean => {
    const reserved = reservedBy.get(sheetId);
    if (!reserved) return false;
    return owned.some((id) => reserved.has(id));
  };

  const rows: OverviewRow[] = data.members.map((m) => {
    const done: Record<string, boolean> = {};
    for (const id of sheetIds) done[id] = isDone(id, m.characterIds);
    return {
      discordId: m.discordId,
      displayName: m.displayName,
      displayClass: m.displayClass ?? null,
      hasCharacter: m.characterIds.length > 0,
      done,
    };
  });

  // A member is complete when they've done every linked sheet. With zero sheets
  // there's nothing to complete — treat as not-complete so completed stays 0
  // (the UI hides the block entirely in that case).
  const isComplete = (row: OverviewRow): boolean =>
    sheetIds.length > 0 && sheetIds.every((id) => row.done[id]);

  const perSheet = data.sheets.map((s) => ({
    sheetId: s.sheetId,
    name: s.name,
    done: rows.filter((r) => r.done[s.sheetId]).length,
    total: rows.length,
  }));

  return {
    rows,
    sheets: data.sheets,
    completed: rows.filter(isComplete).length,
    total: rows.length,
    perSheet,
  };
}

// The poke list: members missing ≥1 linked sheet, with which they're missing
// (by sheet name). Drives the "Copy Discord reminder" button.
export interface PokeEntry {
  discordId: string;
  displayName: string;
  missing: string[]; // sheet names
  hasCharacter: boolean;
}

export function buildPokeList(overview: ReserveOverview): PokeEntry[] {
  return overview.rows
    .map((row) => {
      const missing = overview.sheets
        .filter((s) => !row.done[s.sheetId])
        .map((s) => s.name);
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
