import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";

// Proves the Prisma 7 client + pg adapter actually connect and the plural
// tables are queryable. Requires the docker-compose Postgres to be up.
describe("db connectivity", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("connects and queries plural tables", async () => {
    const users = await db.user.count();
    const characters = await db.character.count();
    expect(users).toBeGreaterThanOrEqual(0);
    expect(characters).toBeGreaterThanOrEqual(0);
  });
});
