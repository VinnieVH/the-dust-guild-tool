import type { CharacterRecord, ClaimInput } from "@/lib/domain/character";
import type { MainRole } from "@/lib/domain/enums";
import type {
  AutoClaimStore,
  ClaimableSignup,
} from "@/lib/services/auto-claim";
import type { CharacterClaimStore } from "@/lib/services/character-claim";
import { db } from "@/lib/db";

// Row shape we select — kept narrow so we map a stable domain record.
type CharacterRow = {
  id: string;
  userId: string | null;
  name: string;
  class: string;
  spec: string;
  mainRole: string;
};

function toRecord(row: CharacterRow): CharacterRecord {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    class: row.class,
    spec: row.spec,
    mainRole: row.mainRole as MainRole,
  };
}

// Thin Prisma wrapper for the Character aggregate. The only place character
// persistence happens; everything above uses CharacterRecord.
export const characterRepository: CharacterClaimStore &
  AutoClaimStore & {
    listByUser(userId: string): Promise<CharacterRecord[]>;
    transfer(
      characterId: string,
      toUserId: string | null,
    ): Promise<CharacterRecord>;
    addAlias(characterId: string, alias: string): Promise<void>;
  } = {
  async findByNameOrAlias(name) {
    const direct = await db.character.findUnique({ where: { name } });
    if (direct) return toRecord(direct);

    const alias = await db.characterAlias.findUnique({
      where: { alias: name },
      include: { character: true },
    });
    return alias ? toRecord(alias.character) : null;
  },

  async create(input: ClaimInput, userId: string) {
    const created = await db.character.create({
      data: {
        name: input.name,
        class: input.class,
        spec: input.spec,
        mainRole: input.mainRole,
        userId,
      },
    });
    return toRecord(created);
  },

  async assignOwner(characterId, userId) {
    const updated = await db.character.update({
      where: { id: characterId },
      data: { userId },
    });
    return toRecord(updated);
  },

  async listByUser(userId) {
    const rows = await db.character.findMany({
      where: { userId },
      orderBy: { name: "asc" },
    });
    return rows.map(toRecord);
  },

  async transfer(characterId, toUserId) {
    const updated = await db.character.update({
      where: { id: characterId },
      data: { userId: toUserId },
    });
    return toRecord(updated);
  },

  async addAlias(characterId, alias) {
    await db.characterAlias.create({ data: { characterId, alias } });
  },

  async listClaimableSignups(discordId): Promise<ClaimableSignup[]> {
    // Only signups that name a real character, class, and role can become a
    // Character (mainRole is NOT NULL). Role-only "Tank" signups (class null)
    // and absent/bench rows (role null) are excluded here.
    const rows = await db.signup.findMany({
      where: {
        user: { discordId },
        characterName: { not: null },
        class: { not: null },
        role: { not: null },
      },
      select: {
        characterName: true,
        class: true,
        specSignedAs: true,
        role: true,
      },
    });
    return rows.map((r) => ({
      characterName: r.characterName as string,
      class: r.class as string,
      specSignedAs: r.specSignedAs,
      role: r.role as MainRole,
    }));
  },
};
