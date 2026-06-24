// One-off officer correction: assign a character to a user by exact names.
// There's no officer transfer UI yet, so this is the manual path — it uses the
// production repository (assignOwner / transfer), with guards so it refuses to
// act on ambiguous or surprising data.
//
//   yarn tsx scripts/assign-character.mts "<characterName>" "<discordName>"
//
// Default (no args): assigns "Kyrem" to the "Kyre" user — the officer-queue
// mistake where Kyre's Raid-Helper signup was renamed to his real in-game name
// "Kyrem", creating an unowned character he never got linked to.
import "dotenv/config";
import { characterRepository } from "@/lib/repositories/character-repository";
import { db } from "@/lib/db";

const characterName = process.argv[2] ?? "Kyrem";
const discordName = process.argv[3] ?? "Kyre";

async function main() {
  const character = await db.character.findUnique({
    where: { name: characterName },
    select: { id: true, name: true, userId: true },
  });
  if (!character) throw new Error(`No character named "${characterName}".`);

  const users = await db.user.findMany({
    where: { discordName },
    select: { id: true, discordId: true, discordName: true },
  });
  if (users.length === 0) throw new Error(`No user with discordName "${discordName}".`);
  if (users.length > 1) {
    throw new Error(
      `Ambiguous: ${users.length} users named "${discordName}" — assign by id instead.`,
    );
  }
  const user = users[0];

  if (character.userId === user.id) {
    console.log(`"${character.name}" is already owned by ${user.discordName}. No-op.`);
    return;
  }

  // Unowned -> assignOwner; owned by someone else -> transfer (explicit move).
  if (character.userId === null) {
    await characterRepository.assignOwner(character.id, user.id);
    console.log(`Assigned unowned "${character.name}" -> ${user.discordName} (${user.discordId}).`);
  } else {
    await characterRepository.transfer(character.id, user.id);
    console.log(
      `Transferred "${character.name}" from user ${character.userId} -> ${user.discordName} (${user.discordId}).`,
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
