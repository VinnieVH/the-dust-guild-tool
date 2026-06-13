import type { GuildCompositionStore } from "@/lib/services/sync-guild-composition-service";
import type { GuildRankStore } from "@/lib/services/sync-guild-rank-service";
import { db } from "@/lib/db";

// Thin Prisma wrapper for the live guild zone rankings (display-only).
export const guildRankRepository: GuildRankStore = {
  async listLoggedZoneNames() {
    const rows = await db.wclReport.findMany({
      select: { zone: true },
      distinct: ["zone"],
    });
    return rows.map((r) => r.zone);
  },

  async upsertZoneRanking(r, fetchedAt) {
    await db.guildZoneRanking.upsert({
      where: { zoneId: r.zoneId },
      update: {
        zoneName: r.zoneName,
        speedWorldRank: r.speedWorldRank,
        speedRegionRank: r.speedRegionRank,
        speedServerRank: r.speedServerRank,
        speedColor: r.speedColor,
        progWorldRank: r.progWorldRank,
        progRegionRank: r.progRegionRank,
        progServerRank: r.progServerRank,
        fetchedAt,
      },
      create: {
        zoneId: r.zoneId,
        zoneName: r.zoneName,
        speedWorldRank: r.speedWorldRank,
        speedRegionRank: r.speedRegionRank,
        speedServerRank: r.speedServerRank,
        speedColor: r.speedColor,
        progWorldRank: r.progWorldRank,
        progRegionRank: r.progRegionRank,
        progServerRank: r.progServerRank,
        fetchedAt,
      },
    });
  },
};

// Thin Prisma wrapper for the live guild composition (display-only). Full-
// snapshot replace from the latest report, so a changed lineup is reflected.
export const guildCompositionRepository: GuildCompositionStore = {
  async replaceComposition(members, sourceReportCode, fetchedAt) {
    await db.$transaction([
      db.guildComposition.deleteMany({}),
      db.guildComposition.createMany({
        data: members.map((m) => ({
          name: m.name,
          role: m.role,
          className: m.className,
          spec: m.spec,
          maxItemLevel: m.maxItemLevel,
          sourceReportCode,
          fetchedAt,
        })),
      }),
    ]);
  },
};
