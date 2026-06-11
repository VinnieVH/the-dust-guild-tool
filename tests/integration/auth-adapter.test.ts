import { PrismaAdapter } from "@auth/prisma-adapter";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";

// Closes the headless gap for OAuth sign-in: Auth.js calls the adapter's
// createUser with the object our Discord profile() callback returns. This
// proves that shape satisfies the NOT NULL columns (discordId/discordName)
// WITHOUT needing live Discord credentials.
const adapter = PrismaAdapter(db);

describe("Prisma adapter createUser (first sign-in path)", () => {
  const ids: string[] = [];

  afterEach(async () => {
    await db.user.deleteMany({ where: { discordId: { in: ids } } });
    ids.length = 0;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("persists discordId/discordName from the profile-shaped object", async () => {
    const discordId = "test-discord-123456";
    ids.push(discordId);

    // Mirrors what authConfig's Discord profile() returns (minus `id`, which
    // Auth.js strips before calling the adapter).
    const created = await adapter.createUser!({
      id: "ignored-by-adapter",
      discordId,
      discordName: "Thunderfurry",
      name: "Thunderfurry",
      email: "tf@example.com",
      emailVerified: null,
      image: null,
      role: "MEMBER",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    expect(created.discordId).toBe(discordId);
    expect(created.discordName).toBe("Thunderfurry");

    const row = await db.user.findUnique({ where: { discordId } });
    expect(row?.role).toBe("MEMBER");
  });
});
