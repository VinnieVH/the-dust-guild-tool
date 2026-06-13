import { db } from "@/lib/db";

// Read-side view models for the WCL side of the officer unmatched queue:
// player_performances whose name didn't resolve to a Character. Distinct by
// rawName (the same name may appear in several reports/nights) so the officer
// resolves a name once.
//
// Names on the IgnoredWclName list (pugs who'll never be guild members) are
// FILTERED OUT of both the list and the count — the performance rows stay in
// the DB (harmless: never scored, since the engine only reads characterId !=
// null), they're just hidden from the officer. Both functions must apply the
// same filter, or the queue badge and the list disagree.

export interface UnmatchedPerformance {
  /** The unresolved character name (the key the officer links). */
  rawName: string;
  /** A representative role/parse for context (from the most recent row). */
  role: string;
  /** How many performance rows carry this name (across reports/nights). */
  occurrences: number;
}

async function ignoredNames(): Promise<Set<string>> {
  const rows = await db.ignoredWclName.findMany({ select: { rawName: true } });
  return new Set(rows.map((r) => r.rawName));
}

export async function countUnmatchedPerformances(): Promise<number> {
  const [rows, ignored] = await Promise.all([
    db.playerPerformance.findMany({
      where: { characterId: null },
      select: { rawName: true },
      distinct: ["rawName"],
    }),
    ignoredNames(),
  ]);
  return rows.filter((r) => !ignored.has(r.rawName)).length;
}

export async function listUnmatchedPerformances(): Promise<UnmatchedPerformance[]> {
  const [rows, ignored] = await Promise.all([
    db.playerPerformance.findMany({
      where: { characterId: null },
      select: { rawName: true, role: true },
      orderBy: { rawName: "asc" },
    }),
    ignoredNames(),
  ]);

  // Group by rawName in memory (small set), skipping ignored names.
  const byName = new Map<string, { role: string; count: number }>();
  for (const r of rows) {
    if (ignored.has(r.rawName)) continue;
    const cur = byName.get(r.rawName);
    if (cur) cur.count += 1;
    else byName.set(r.rawName, { role: r.role, count: 1 });
  }

  return [...byName.entries()].map(([rawName, v]) => ({
    rawName,
    role: v.role,
    occurrences: v.count,
  }));
}
