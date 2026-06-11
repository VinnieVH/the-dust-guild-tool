import { afterAll, afterEach, describe, expect, it } from "vitest";
import type { AdapterUser } from "next-auth/adapters";
import { createReconcilingAdapter } from "@/lib/auth-adapter";
import { db } from "@/lib/db";

// Closes the headless gap for OAuth sign-in: Auth.js calls the adapter's
// createUser with the object our Discord profile() callback returns. Proves the
// shape satisfies the NOT NULL columns AND that createUser reconciles with the
// stub users the Raid-Helper sync creates — all WITHOUT live Discord creds.
const adapter = createReconcilingAdapter(db);

// Build the profile()-shaped object Auth.js hands to createUser.
function profileUser(over: Partial<AdapterUser> & { discordId: string; discordName: string }) {
  return {
    id: "ignored-by-adapter",
    name: over.discordName,
    email: null,
    emailVerified: null,
    image: null,
    role: "MEMBER",
    ...over,
    // discordId/discordName/role are custom fields not on AdapterUser.
  } as AdapterUser;
}

describe("reconciling adapter createUser", () => {
  const ids: string[] = [];
  const track = (id: string) => {
    ids.push(id);
    return id;
  };

  afterEach(async () => {
    await db.user.deleteMany({ where: { discordId: { in: ids } } });
    ids.length = 0;
  });
  afterAll(async () => {
    await db.$disconnect();
  });

  it("persists discordId/discordName on a fresh sign-in", async () => {
    const discordId = track("itest-fresh-1");
    const created = await adapter.createUser!(
      profileUser({ discordId, discordName: "Thunderfurry", email: "tf@example.com" }),
    );
    expect(created.discordId).toBe(discordId);
    expect(created.discordName).toBe("Thunderfurry");

    const row = await db.user.findUnique({ where: { discordId } });
    expect(row?.role).toBe("MEMBER");
  });

  // The bug this fixes: the sync makes a stub user (no account); first sign-in
  // must reuse it, not insert a duplicate (unique constraint on discordId).
  it("reconciles with an existing stub user instead of throwing", async () => {
    const discordId = track("itest-stub-1");
    const stub = await db.user.create({
      data: { discordId, discordName: "SyncStub", role: "MEMBER" },
    });

    const result = await adapter.createUser!(
      profileUser({
        discordId,
        discordName: "RealName",
        image: "https://cdn.discordapp.com/avatars/x/y.png",
      }),
    );
    expect(result.id).toBe(stub.id); // same row, not a new one

    const count = await db.user.count({ where: { discordId } });
    expect(count).toBe(1);

    // Backfills avatar/name the sync couldn't know.
    const row = await db.user.findUnique({ where: { discordId } });
    expect(row?.image).toBe("https://cdn.discordapp.com/avatars/x/y.png");
    expect(row?.discordName).toBe("RealName");
  });

  // The clobber trap: a seeded OFFICER signing in for the first time must keep
  // their role — the reconcile must not overwrite it with the profile's MEMBER.
  it("preserves a seeded OFFICER role on first sign-in", async () => {
    const discordId = track("itest-officer-1");
    await db.user.create({
      data: { discordId, discordName: `officer:${discordId}`, role: "OFFICER" },
    });

    await adapter.createUser!(profileUser({ discordId, discordName: "RealOfficer" }));

    const row = await db.user.findUnique({ where: { discordId } });
    expect(row?.role).toBe("OFFICER"); // NOT downgraded to MEMBER
  });
});
