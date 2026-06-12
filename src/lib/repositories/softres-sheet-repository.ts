import { db } from "@/lib/db";

export interface SoftresSheetRecord {
  id: string;
  raidNightId: string;
  name: string;
  softresId: string;
  token: string | null;
}

// Thin Prisma wrapper for SoftresSheet. A night has 0..N officer-named sheets;
// names are unique per night. Sheets are added/edited/removed individually
// (keyed by id), not upserted by a fixed instance.
export const softresSheetRepository = {
  async listForRaidNight(raidNightId: string): Promise<SoftresSheetRecord[]> {
    return db.softresSheet.findMany({
      where: { raidNightId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        raidNightId: true,
        name: true,
        softresId: true,
        token: true,
      },
    });
  },

  // Add a new sheet. Throws on the (raidNightId, name) unique violation — the
  // caller translates that to a "name already used" message.
  async addSheet(input: {
    raidNightId: string;
    name: string;
    softresId: string;
    token?: string | null;
  }): Promise<{ id: string }> {
    const { raidNightId, name, softresId, token = null } = input;
    const created = await db.softresSheet.create({
      data: { raidNightId, name, softresId, token },
      select: { id: true },
    });
    return { id: created.id };
  },

  // Edit an existing sheet's name / link. When the softres id changes, the old
  // reservations are orphaned — delete them explicitly (logged) so the queue and
  // matrix never show stale rows from the previous sheet.
  async updateSheet(
    id: string,
    input: { name: string; softresId: string; token?: string | null },
  ): Promise<void> {
    const { name, softresId, token = null } = input;
    const existing = await db.softresSheet.findUnique({
      where: { id },
      select: { softresId: true, raidNightId: true },
    });
    if (!existing) return;

    if (existing.softresId !== softresId) {
      const { count } = await db.reservation.deleteMany({
        where: { softresSheetId: id },
      });
      if (count > 0) {
        console.warn(
          `[softres] sheet ${id} (night ${existing.raidNightId}) re-pointed ` +
            `${existing.softresId} -> ${softresId}; deleted ${count} orphaned reservations`,
        );
      }
    }
    await db.softresSheet.update({
      where: { id },
      data: { name, softresId, token },
    });
  },

  // Remove a sheet and its reservations (FK cascade handles the children).
  async removeSheet(id: string): Promise<void> {
    await db.softresSheet.delete({ where: { id } });
  },
};
