// Integration tests run against a DEDICATED test database, never the dev/prod
// DB the running app writes to. This is the structural guarantee that test
// fixtures can NEVER spill into real guild data: even if a test crashes before
// its own cleanup, the worst case is leftover rows in `guildtool_test`, which
// the live app and `next dev` never read.
//
// We load `.env` for the non-DB secrets (WCL creds etc.), then OVERRIDE
// DATABASE_URL to the test database. This MUST happen before any app module
// (notably `@/lib/db`, which reads env.DATABASE_URL at import time) is loaded —
// hence it lives in setupFiles, which Vitest runs before the test modules.
import "dotenv/config";

// Derive the test DB url from the real one by swapping the database name, so it
// always lives in the same Postgres instance/credentials as DATABASE_URL.
// Override with TEST_DATABASE_URL if you want it elsewhere.
function testDatabaseUrl(): string {
  const explicit = process.env.TEST_DATABASE_URL;
  if (explicit) return explicit;

  const base = process.env.DATABASE_URL;
  if (!base) {
    throw new Error(
      "Integration tests need DATABASE_URL (from .env) to derive the test DB url.",
    );
  }
  const url = new URL(base);
  // /guildtool -> /guildtool_test (keep query params like ?schema=public).
  url.pathname = `${url.pathname.replace(/\/$/, "")}_test`;
  return url.toString();
}

const TEST_DB_URL = testDatabaseUrl();

// Guard: refuse to run if we'd point at a non-test database. Without this, a
// misconfigured env could let the suite truncate the real `guildtool` DB.
if (!new URL(TEST_DB_URL).pathname.endsWith("_test")) {
  throw new Error(
    `Refusing to run integration tests: test DB url does not target a *_test database (got ${TEST_DB_URL}).`,
  );
}

process.env.DATABASE_URL = TEST_DB_URL;
