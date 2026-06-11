import type { ExternalSignup } from "@/lib/domain/external";
import type { MainRole } from "@/lib/domain/enums";
import { db } from "@/lib/db";

// Port the sync service depends on (keeps the service Prisma-free / testable).
export interface RaidSyncStore {
  /** Upsert a raid night by its Raid-Helper event id; return its internal id. */
  upsertRaidNight(input: {
    raidHelperEventId: string;
    title: string;
    date: Date;
  }): Promise<{ id: string; created: boolean }>;

  /** Ensure a user row exists for a Discord id (stub if unknown); return its id. */
  ensureUserByDiscordId(discordId: string, discordName: string): Promise<string>;

  /** Upsert a signup by (raidNightId, userId); report whether it changed. */
  upsertSignup(input: {
    raidNightId: string;
    userId: string;
    status: string;
    specSignedAs: string;
    role: MainRole | null;
    characterName: string | null;
    class: string | null;
  }): Promise<{ created: boolean; updated: boolean }>;
}

export const raidNightRepository: RaidSyncStore = {
  async upsertRaidNight({ raidHelperEventId, title, date }) {
    const existing = await db.raidNight.findUnique({
      where: { raidHelperEventId },
      select: { id: true },
    });
    if (existing) {
      await db.raidNight.update({
        where: { id: existing.id },
        data: { title, date },
      });
      return { id: existing.id, created: false };
    }
    const created = await db.raidNight.create({
      data: { raidHelperEventId, title, date },
      select: { id: true },
    });
    return { id: created.id, created: true };
  },

  async ensureUserByDiscordId(discordId, discordName) {
    const user = await db.user.upsert({
      where: { discordId },
      // Don't clobber a real signed-in user's name with the RH display name on
      // every sync; only set it when creating the stub.
      update: {},
      create: { discordId, discordName },
      select: { id: true },
    });
    return user.id;
  },

  async upsertSignup({
    raidNightId,
    userId,
    status,
    specSignedAs,
    role,
    characterName,
    class: className,
  }) {
    const existing = await db.signup.findUnique({
      where: { raidNightId_userId: { raidNightId, userId } },
      select: {
        status: true,
        specSignedAs: true,
        role: true,
        characterName: true,
        class: true,
      },
    });
    if (!existing) {
      await db.signup.create({
        data: {
          raidNightId,
          userId,
          status,
          specSignedAs,
          role,
          characterName,
          class: className,
        },
      });
      return { created: true, updated: false };
    }
    const changed =
      existing.status !== status ||
      existing.specSignedAs !== specSignedAs ||
      existing.role !== role ||
      existing.characterName !== characterName ||
      existing.class !== className;
    if (changed) {
      await db.signup.update({
        where: { raidNightId_userId: { raidNightId, userId } },
        data: { status, specSignedAs, role, characterName, class: className },
      });
    }
    return { created: false, updated: changed };
  },
};

// Convenience: the spec string we persist for a signup (display-only).
export function signupSpec(s: ExternalSignup): string {
  return s.spec ?? "";
}
