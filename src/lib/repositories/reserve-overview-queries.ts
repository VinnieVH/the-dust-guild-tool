import { SignupStatus } from "@/lib/domain/external";
import type { SoftresSheetRef } from "@/lib/services/sync-softres-service";
import type { OverviewData } from "@/lib/services/reserve-overview-service";
import { db } from "@/lib/db";

// Assemble the input for buildOverview: confirmed signups (+ their owned
// character ids, across alts), the night's linked sheets (matrix columns), and
// every matched reservation keyed by sheet. No business logic — the service
// turns this into the matrix.
export async function getOverviewData(
  raidNightId: string,
): Promise<OverviewData> {
  const night = await db.raidNight.findUnique({
    where: { id: raidNightId },
    select: {
      signups: {
        where: { status: SignupStatus.CONFIRMED },
        select: {
          user: {
            select: {
              discordId: true,
              discordName: true,
              characters: {
                select: { id: true, name: true },
                orderBy: { name: "asc" },
              },
            },
          },
        },
      },
      sheets: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          reservations: {
            where: { characterId: { not: null } },
            select: { characterId: true },
          },
        },
      },
    },
  });

  if (!night) {
    return { members: [], sheets: [], reservations: [] };
  }

  const members = night.signups.map((s) => ({
    discordId: s.user.discordId,
    displayName: s.user.characters[0]?.name ?? s.user.discordName,
    characterIds: s.user.characters.map((c) => c.id),
  }));

  const sheets = night.sheets.map((sh) => ({ sheetId: sh.id, name: sh.name }));

  const reservations = night.sheets.flatMap((sh) =>
    sh.reservations.map((r) => ({
      sheetId: sh.id,
      characterId: r.characterId as string, // filtered not-null above
    })),
  );

  return { members, sheets, reservations };
}

// Sheets for a single raid night — used by the officer "Sync now" button to
// re-pull just this night's reservations on demand.
export async function listSheetsForRaidNight(
  raidNightId: string,
): Promise<SoftresSheetRef[]> {
  const sheets = await db.softresSheet.findMany({
    where: { raidNightId },
    select: { id: true, softresId: true, token: true },
  });
  return sheets.map((s) => ({
    sheetId: s.id,
    softresId: s.softresId,
    token: s.token ?? undefined,
  }));
}

// Sheets to sync via cron: every sheet of a raid night happening within the next
// `days` days (and not already past). Returns the SoftresSheetRef[] syncSoftres
// expects.
export async function listSheetsToSync(days = 7): Promise<SoftresSheetRef[]> {
  const now = new Date();
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + days);

  const sheets = await db.softresSheet.findMany({
    where: { raidNight: { date: { gte: startOfDay(now), lte: horizon } } },
    select: { id: true, softresId: true, token: true },
  });

  return sheets.map((s) => ({
    sheetId: s.id,
    softresId: s.softresId,
    token: s.token ?? undefined,
  }));
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}
