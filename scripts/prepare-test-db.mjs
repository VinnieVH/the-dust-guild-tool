// Prepares the dedicated integration-test database (default: <db>_test in the
// same Postgres instance as DATABASE_URL). Idempotent — safe to run before
// every integration run:
//   1. CREATE DATABASE <db>_test if it doesn't exist
//   2. prisma migrate deploy        (apply all migrations)
//   3. seed the achievement catalog (speed-record/crown tests need these rows)
//
// Keeping the test DB in the same container as the dev DB means no extra
// infra; the separation is by database NAME, which is enough to guarantee the
// app (which only ever opens `guildtool`) can't see test fixtures.
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

function loadEnv() {
  // Minimal .env reader (no dep): KEY="value" / KEY=value lines.
  const out = {};
  try {
    for (const line of readFileSync(".env", "utf8").split("\n")) {
      const i = line.indexOf("=");
      if (i === -1 || line.trimStart().startsWith("#")) continue;
      out[line.slice(0, i).trim()] = line
        .slice(i + 1)
        .trim()
        .replace(/^"|"$/g, "");
    }
  } catch {
    /* no .env — rely on process.env */
  }
  return out;
}

const fileEnv = loadEnv();
const baseUrl = process.env.DATABASE_URL ?? fileEnv.DATABASE_URL;
if (!baseUrl) {
  console.error("prepare-test-db: DATABASE_URL not set (env or .env).");
  process.exit(1);
}

const testUrl = process.env.TEST_DATABASE_URL ?? deriveTestUrl(baseUrl);
function deriveTestUrl(base) {
  const u = new URL(base);
  u.pathname = `${u.pathname.replace(/\/$/, "")}_test`;
  return u.toString();
}

// Safety: never operate on a non-*_test database.
const testDbName = new URL(testUrl).pathname.replace(/^\//, "");
if (!testDbName.endsWith("_test")) {
  console.error(`prepare-test-db: refusing — "${testDbName}" is not a *_test database.`);
  process.exit(1);
}

// 1) CREATE DATABASE if missing — connect to the server's default `postgres`
//    db (you can't create a db while connected to the target). Use the same
//    credentials/host as DATABASE_URL.
const adminUrl = new URL(testUrl);
adminUrl.pathname = "/postgres";
adminUrl.search = "";
const { Client } = await import("pg");
const admin = new Client({ connectionString: adminUrl.toString() });
await admin.connect();
const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [testDbName]);
if (exists.rowCount === 0) {
  // identifier is validated above (ends with _test, derived from our own url).
  await admin.query(`CREATE DATABASE "${testDbName}"`);
  console.log(`prepare-test-db: created database ${testDbName}`);
} else {
  console.log(`prepare-test-db: database ${testDbName} already exists`);
}
await admin.end();

// 2) + 3) migrate + seed, with DATABASE_URL pointed at the test DB.
const childEnv = { ...process.env, DATABASE_URL: testUrl };
execSync("npx prisma migrate deploy", { stdio: "inherit", env: childEnv });
execSync("npx tsx prisma/seed.ts", { stdio: "inherit", env: childEnv });
console.log("prepare-test-db: ready");
