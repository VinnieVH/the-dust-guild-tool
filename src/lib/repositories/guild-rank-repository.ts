import type { GuildRankStore } from "@/lib/services/sync-guild-rank-service";
import type { GuildRosterStore } from "@/lib/services/sync-guild-roster-service";
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

// Thin Prisma wrapper for the live guild roster (display-only). Full-snapshot
// replace so departed members drop out.
export const guildRosterRepository: GuildRosterStore = {
  async replaceRoster(members, fetchedAt) {
    await db.$transaction([
      db.guildMember.deleteMany({}),
      db.guildMember.createMany({
        data: members.map((m) => ({
          name: m.name,
          className: m.className,
          level: m.level,
          fetchedAt,
        })),
      }),
    ]);
  },
};
