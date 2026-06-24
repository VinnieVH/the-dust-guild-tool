// READ-ONLY sweep for the "born-unowned" SR-matrix bug (see
// diagnose-sr-link.mts). Lists every UNOWNED character that is linked to at
// least one reservation, and says whether the reserver's dId already has a User
// (so the sync self-heal would adopt it now) or not (heals once they sign up).
//
//   DATABASE_URL="postgresql://..." yarn tsx scripts/scan-unowned-reserved.mts
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Set DATABASE_URL, e.g. DATABASE_URL="postgresql://..." yarn tsx scripts/scan-unowned-reserved.mts');
  process.exit(1);
}
const adapter = new PrismaPg({ connectionString });
const db = new PrismaClient({ adapter });

async function main() {
  const unowned = await db.character.findMany({
    where: { userId: null, reservations: { some: {} } },
    select: {
      id: true,
      name: true,
      reservations: { select: { discordId: true }, take: 1 },
    },
    orderBy: { name: "asc" },
  });

  let healable = 0;
  let waiting = 0;
  for (const c of unowned) {
    const dId = c.reservations[0]?.discordId ?? null;
    if (!dId) {
      console.log(`no-dId:       "${c.name}" — reservation has no Discord id; manual link only`);
      continue;
    }
    const user = await db.user.findUnique({
      where: { discordId: dId },
      select: { discordName: true },
    });
    if (user) {
      healable++;
      console.log(`HEALABLE:     "${c.name}" -> ${user.discordName} (dId=${dId})`);
    } else {
      waiting++;
      console.log(`no-user-yet:  "${c.name}" (dId=${dId}) — heals when they sign up`);
    }
  }

  console.log(
    `\n${unowned.length} unowned-but-reserved characters; ` +
      `${healable} adoptable by the self-heal now, ${waiting} waiting on a User.`,
  );
  console.log("(read-only — nothing was modified)");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
