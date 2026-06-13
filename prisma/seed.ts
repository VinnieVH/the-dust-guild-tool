import { PrismaPg } from "@prisma/adapter-pg";
import { ALL_ACHIEVEMENTS } from "../src/lib/domain/achievements.ts";
import { PrismaClient } from "../src/generated/prisma/client.ts";

// Seed: promote configured Discord IDs to OFFICER. A user may not have signed
// in yet, so we upsert by discordId — creating a stub officer row that the
// OAuth flow will later fill in (discordName is overwritten on first sign-in).
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

async function main() {
  // Achievement catalog — idempotent upsert by key (single source of truth in
  // src/lib/domain/achievements.ts). Updating a name/icon there + re-seeding
  // refreshes the row without touching awards.
  for (const a of ALL_ACHIEVEMENTS) {
    await db.achievement.upsert({
      where: { key: a.key },
      update: { name: a.name, description: a.description, icon: a.icon, category: a.category },
      create: a,
    });
  }
  console.log(`Seeded ${ALL_ACHIEVEMENTS.length} achievements`);

  const ids = (process.env.OFFICER_DISCORD_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    console.log("No OFFICER_DISCORD_IDS set — nothing to seed.");
    return;
  }

  for (const discordId of ids) {
    await db.user.upsert({
      where: { discordId },
      update: { role: "OFFICER" },
      create: { discordId, discordName: `officer:${discordId}`, role: "OFFICER" },
    });
    console.log(`Promoted ${discordId} to OFFICER`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
