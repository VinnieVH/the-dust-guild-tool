// READ-ONLY diagnostic for the "no character claimed" SR-matrix bug.
//
// Symptom: a pug filled in the softres sheet (e.g. "Brotmann", "Kranà") and an
// officer resolved the reservation, yet the SR matrix still shows the member as
// "no character claimed". The matrix reads ownership from the raid-helper
// signup's User -> that User's characters; softres sync links a reservation to a
// character but NEVER assigns Character.userId. So an unowned (or wrong-owner)
// character never shows up in the matrix and never self-heals on re-sync.
//
// This script ONLY runs SELECTs. It prints, per name pattern:
//   - the Character row(s) and their owner (userId + that user's discord)
//   - the Reservation row(s): what they linked to + the softres dId
//   - the raid-helper Signup User(s) the matrix actually reads from
// and a one-line diagnosis: unowned / wrong-user / never-created / linked-ok.
//
// Run against PROD (point DATABASE_URL at the prod connection string):
//   DATABASE_URL="postgresql://..." yarn tsx scripts/diagnose-sr-link.mts
//   DATABASE_URL="postgresql://..." yarn tsx scripts/diagnose-sr-link.mts brotmann kran
//
// Standalone Prisma client (own pg adapter) so it needs ONLY DATABASE_URL — no
// AUTH_* vars, unlike importing @/lib/db.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error(
    'Set DATABASE_URL to the PROD connection string, e.g.\n  DATABASE_URL="postgresql://..." yarn tsx scripts/diagnose-sr-link.mts',
  );
  process.exit(1);
}

// Name patterns to investigate (case-insensitive prefix). Override via argv.
const patterns = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["brotmann", "kran"];

const adapter = new PrismaPg({ connectionString });
const db = new PrismaClient({ adapter });

async function investigate(pattern: string) {
  const like = `${pattern}%`;

  // 1) Characters matching the in-game name, with their owner.
  const characters = await db.character.findMany({
    where: { name: { startsWith: pattern, mode: "insensitive" } },
    select: {
      id: true,
      name: true,
      userId: true,
      user: { select: { discordId: true, discordName: true } },
      aliases: { select: { alias: true } },
    },
  });

  // 2) Reservations whose rawName matches — what they linked to + softres dId.
  const reservations = await db.reservation.findMany({
    where: { rawName: { startsWith: pattern, mode: "insensitive" } },
    select: {
      rawName: true,
      characterId: true,
      suggestedCharacterId: true,
      discordId: true,
      ignored: true,
    },
  });

  // 3) The raid-helper signup Users the SR matrix actually reads ownership from.
  const signups = await db.signup.findMany({
    where: { characterName: { startsWith: pattern, mode: "insensitive" } },
    select: {
      characterName: true,
      user: {
        select: {
          id: true,
          discordId: true,
          discordName: true,
          characters: { select: { id: true, name: true } },
        },
      },
    },
  });

  console.log(`\n${"=".repeat(64)}\nPATTERN: ${like}\n${"=".repeat(64)}`);

  console.log(`\n[1] Character rows (${characters.length}):`);
  for (const c of characters) {
    const owner = c.userId
      ? `OWNED by ${c.user?.discordName} (discordId=${c.user?.discordId}, userId=${c.userId})`
      : "UNOWNED (userId=null)";
    const aliases = c.aliases.map((a) => a.alias).join(", ") || "—";
    console.log(`  - "${c.name}" [${c.id}] ${owner}; aliases: ${aliases}`);
  }

  console.log(`\n[2] Reservation rows (${reservations.length}):`);
  for (const r of reservations) {
    console.log(
      `  - rawName="${r.rawName}" characterId=${r.characterId ?? "null"} ` +
        `suggested=${r.suggestedCharacterId ?? "null"} dId=${r.discordId ?? "null"} ignored=${r.ignored}`,
    );
  }

  console.log(`\n[3] Raid-helper signup Users the matrix reads (${signups.length}):`);
  for (const s of signups) {
    const u = s.user;
    const owned =
      u.characters.map((c) => `"${c.name}"`).join(", ") || "NONE";
    console.log(
      `  - signup characterName="${s.characterName}" -> User ${u.discordName} ` +
        `(discordId=${u.discordId}, userId=${u.id}); owns: ${owned}`,
    );
  }

  // Diagnosis: compare the linked character's owner against the signup user(s).
  console.log(`\n[diagnosis]`);
  if (characters.length === 0) {
    console.log(
      "  NEVER-CREATED: no Character row matches. The queue was only showing the" +
        " unmatched rawName; nothing was created. -> officer must Create & link.",
    );
  }
  const signupUserIds = new Set(signups.map((s) => s.user.id));
  for (const c of characters) {
    if (!c.userId) {
      console.log(
        `  UNOWNED: "${c.name}" has no owner. softres dId was "0"/absent, or the` +
          ` signup User didn't exist yet at create time. -> assign to the signup User.`,
      );
    } else if (signupUserIds.size && !signupUserIds.has(c.userId)) {
      console.log(
        `  WRONG-USER: "${c.name}" is owned by userId=${c.userId}, which is NOT any` +
          ` raid-helper signup User above. dId resolved to a different/duplicate User.` +
          ` -> transfer to the signup User.`,
      );
    } else if (signupUserIds.has(c.userId)) {
      console.log(
        `  LINKED-OK: "${c.name}" is owned by a signup User. If the matrix still` +
          ` shows "no character claimed", check the reservation's characterId link.`,
      );
    } else {
      console.log(
        `  OWNED (no matching signup found for this pattern): "${c.name}" owned by` +
          ` userId=${c.userId}. Verify the signup characterName pattern.`,
      );
    }
  }
}

async function main() {
  for (const p of patterns) {
    await investigate(p);
  }
  console.log("\nDone (read-only — nothing was modified).\n");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
