import { streakKey } from "@/lib/domain/achievements";
import { STREAK_MILESTONES } from "@/lib/domain/constants";
import type { AttendanceSyncStore } from "@/lib/services/sync-attendance-service";
import { db } from "@/lib/db";

// Thin Prisma wrapper backing the attendance-streak recompute. Resolves WCL
// names to owning users (alt-aware) and persists per-user streak state.

export const attendanceRepository: AttendanceSyncStore = {
  async resolveNamesToUsers(names) {
    const out = new Map<string, string>();
    if (names.length === 0) return out;

    // Direct character-name -> owning user.
    const chars = await db.character.findMany({
      where: { name: { in: names }, userId: { not: null } },
      select: { name: true, userId: true },
    });
    for (const c of chars) if (c.userId) out.set(c.name, c.userId);

    // Confirmed aliases -> owning user (for the names not already resolved).
    const remaining = names.filter((n) => !out.has(n));
    if (remaining.length > 0) {
      const aliases = await db.characterAlias.findMany({
        where: { alias: { in: remaining }, character: { userId: { not: null } } },
        select: { alias: true, character: { select: { userId: true } } },
      });
      for (const a of aliases) {
        if (a.character.userId) out.set(a.alias, a.character.userId);
      }
    }

    return out;
  },

  async persistUserStreak(userId, currentStreak, milestones) {
    // Pre-resolve achievement ids for the streak keys + map the crossing report
    // code to a raidNight when one was ingested (optional link).
    const achievementIds = await db.achievement.findMany({
      where: { key: { in: STREAK_MILESTONES.map(streakKey) } },
      select: { id: true, key: true },
    });
    const idByKey = new Map(achievementIds.map((a) => [a.key, a.id]));

    const codes = [...new Set(milestones.map((m) => m.crossedReportCode))];
    const reports = await db.wclReport.findMany({
      where: { reportCode: { in: codes } },
      select: { reportCode: true, raidNightId: true },
    });
    const raidNightByCode = new Map(reports.map((r) => [r.reportCode, r.raidNightId]));

    await db.$transaction([
      db.user.update({ where: { id: userId }, data: { currentStreak } }),
      ...milestones.flatMap((m) => {
        const achievementId = idByKey.get(m.achievementKey);
        if (!achievementId) return [];
        const raidNightId = raidNightByCode.get(m.crossedReportCode) ?? null;
        return [
          // Idempotent by (userId, achievementId): reached once, kept forever.
          db.streakMilestone.upsert({
            where: { userId_achievementId: { userId, achievementId } },
            update: {}, // never revoke / move
            create: {
              userId,
              achievementId,
              crossedReportCode: m.crossedReportCode,
              raidNightId,
            },
          }),
        ];
      }),
    ]);
  },
};
