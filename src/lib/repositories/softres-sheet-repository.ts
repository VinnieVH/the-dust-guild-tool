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

  // Set (or clear) the softres edit token for a sheet. This is the admin/edit
  // key from the softres sheet — losing it means a raid leader can no longer
  // edit reservations. Stored plain text; an empty value clears it (null).
  async updateToken(id: string, token: string | null): Promise<void> {
    await db.softresSheet.update({
      where: { id },
      data: { token: token && token.length > 0 ? token : null },
    });
  },

  // Remove a sheet and its reservations (FK cascade handles the children).
  // Re-linking is remove + add: the saved character_aliases reconstruct the
  // matches on the next sync, so no separate edit path is needed.
  async removeSheet(id: string): Promise<void> {
    await db.softresSheet.delete({ where: { id } });
  },
};
