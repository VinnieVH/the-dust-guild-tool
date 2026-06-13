import { db } from "@/lib/db";

// Read-side view models for the WCL side of the officer unmatched queue:
// player_performances whose name didn't resolve to a Character. Distinct by
// rawName (the same name may appear in several reports/nights) so the officer
// resolves a name once.

export interface UnmatchedPerformance {
  /** The unresolved character name (the key the officer links). */
  rawName: string;
  /** A representative role/parse for context (from the most recent row). */
  role: string;
  /** How many performance rows carry this name (across reports/nights). */
  occurrences: number;
}

export async function countUnmatchedPerformances(): Promise<number> {
  const rows = await db.playerPerformance.findMany({
    where: { characterId: null },
    select: { rawName: true },
    distinct: ["rawName"],
  });
  return rows.length;
}

export async function listUnmatchedPerformances(): Promise<UnmatchedPerformance[]> {
  const rows = await db.playerPerformance.findMany({
    where: { characterId: null },
    select: { rawName: true, role: true },
    orderBy: { rawName: "asc" },
  });

  // Group by rawName in memory (small set).
  const byName = new Map<string, { role: string; count: number }>();
  for (const r of rows) {
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
