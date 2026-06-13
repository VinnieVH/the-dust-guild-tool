// Global teardown for the integration project: after the whole suite finishes,
// wipe every table in the test DB so a crashed test can never leave rows that
// poison the NEXT run. This is the "always cleaned up" guarantee on top of the
// dedicated-test-DB isolation (a crash mid-test can skip a per-test afterEach,
// but never this).
//
// Runs in Vitest's globalSetup context (separate process), so it re-derives the
// test DB url the same way setup.integration.ts does, and hard-refuses anything
// that isn't a *_test database.
import "dotenv/config";

export async function teardown() {
  const base = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!base) return; // nothing configured — nothing to clean.

  const url = new URL(base);
  if (!process.env.TEST_DATABASE_URL) {
    url.pathname = `${url.pathname.replace(/\/$/, "")}_test`;
  }
  const dbName = url.pathname.replace(/^\//, "");
  // Safety: only ever truncate a *_test database.
  if (!dbName.endsWith("_test")) {
    throw new Error(`Refusing to truncate non-test database "${dbName}".`);
  }

  const { Client } = await import("pg");
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  try {
    // TRUNCATE every public table (except prisma's migration ledger) in one go,
    // CASCADE to satisfy FKs, RESTART IDENTITY to reset sequences.
    const { rows } = await client.query(
      `SELECT tablename FROM pg_tables
       WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
    );
    if (rows.length > 0) {
      const list = rows.map((r) => `"${r.tablename}"`).join(", ");
      await client.query(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
    }
  } finally {
    await client.end();
  }
}
