import type { Instance } from "@/lib/domain/enums";
import { db } from "@/lib/db";

// Read-side view models for the officer unmatched queue. UI reads only these.

export interface UnmatchedReservation {
  id: string;
  rawName: string;
  rawClass: string | null;
  discordId: string | null;
  instance: Instance;
  raidNightId: string;
  raidNightTitle: string;
  /** dId-based suggestion, if the sync found one. */
  suggestion: { characterId: string; name: string } | null;
}

// The queue: reservations with no character AND not ignored. `suggested` rows
// (characterId null, suggestedCharacterId set) DO appear here — the suggestion
// is shown for one-click accept. Ignored rows drop out.
export async function listUnmatchedReservations(): Promise<
  UnmatchedReservation[]
> {
  const rows = await db.reservation.findMany({
    where: { characterId: null, ignored: false },
    orderBy: { rawName: "asc" },
    select: {
      id: true,
      rawName: true,
      rawClass: true,
      discordId: true,
      suggestedCharacterId: true,
      softresSheet: {
        select: {
          instance: true,
          raidNight: { select: { id: true, title: true } },
        },
      },
    },
  });

  // Resolve suggestion names in one extra query (small set).
  const suggestionIds = [
    ...new Set(rows.map((r) => r.suggestedCharacterId).filter((x): x is string => x !== null)),
  ];
  const names = new Map<string, string>();
  if (suggestionIds.length > 0) {
    const chars = await db.character.findMany({
      where: { id: { in: suggestionIds } },
      select: { id: true, name: true },
    });
    for (const c of chars) names.set(c.id, c.name);
  }

  return rows.map((r) => ({
    id: r.id,
    rawName: r.rawName,
    rawClass: r.rawClass,
    discordId: r.discordId,
    instance: r.softresSheet.instance as Instance,
    raidNightId: r.softresSheet.raidNight.id,
    raidNightTitle: r.softresSheet.raidNight.title,
    suggestion:
      r.suggestedCharacterId && names.has(r.suggestedCharacterId)
        ? { characterId: r.suggestedCharacterId, name: names.get(r.suggestedCharacterId)! }
        : null,
  }));
}
