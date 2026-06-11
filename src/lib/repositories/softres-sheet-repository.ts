import type { Instance } from "@/lib/domain/enums";
import { db } from "@/lib/db";

export interface SoftresSheetRecord {
  id: string;
  raidNightId: string;
  instance: Instance;
  softresId: string;
  token: string | null;
}

// Thin Prisma wrapper for SoftresSheet. One sheet per (raidNight, instance);
// re-linking an instance with a different softres id replaces the sheet and
// explicitly deletes the now-orphaned reservations (implementation-plan §3.3).
export const softresSheetRepository = {
  async listForRaidNight(raidNightId: string): Promise<SoftresSheetRecord[]> {
    const rows = await db.softresSheet.findMany({
      where: { raidNightId },
      orderBy: { instance: "asc" },
      select: {
        id: true,
        raidNightId: true,
        instance: true,
        softresId: true,
        token: true,
      },
    });
    return rows.map((r) => ({ ...r, instance: r.instance as Instance }));
  },

  // Upsert by (raidNightId, instance). When the softres id changes, the old
  // sheet's reservations are orphaned — delete them explicitly (logged) so the
  // unmatched queue and SR matrix never show stale reservations.
  async linkSheet(input: {
    raidNightId: string;
    instance: Instance;
    softresId: string;
    token?: string | null;
  }): Promise<{ id: string; replaced: boolean }> {
    const { raidNightId, instance, softresId, token = null } = input;
    const existing = await db.softresSheet.findUnique({
      where: { raidNightId_instance: { raidNightId, instance } },
      select: { id: true, softresId: true },
    });

    if (!existing) {
      const created = await db.softresSheet.create({
        data: { raidNightId, instance, softresId, token },
        select: { id: true },
      });
      return { id: created.id, replaced: false };
    }

    const idChanged = existing.softresId !== softresId;
    if (idChanged) {
      const { count } = await db.reservation.deleteMany({
        where: { softresSheetId: existing.id },
      });
      if (count > 0) {
        console.warn(
          `[softres] re-linked ${instance} for night ${raidNightId}: ` +
            `softres id ${existing.softresId} -> ${softresId}, deleted ${count} orphaned reservations`,
        );
      }
    }
    await db.softresSheet.update({
      where: { id: existing.id },
      data: { softresId, token },
    });
    return { id: existing.id, replaced: idChanged };
  },
};
