import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";

const valid = {
  DATABASE_URL: "postgresql://u:p@localhost:5433/db?schema=public",
  AUTH_SECRET: "secret",
  AUTH_DISCORD_ID: "id",
  AUTH_DISCORD_SECRET: "shh",
} satisfies Record<string, string | undefined>;

describe("parseEnv", () => {
  it("accepts a valid environment and defaults NODE_ENV", () => {
    const env = parseEnv({ ...valid });
    expect(env.DATABASE_URL).toBe(valid.DATABASE_URL);
    expect(env.NODE_ENV).toBe("development");
  });

  it("fails fast with a readable error naming the missing var", () => {
    const missing: Record<string, string | undefined> = { ...valid };
    delete missing.AUTH_SECRET;
    expect(() => parseEnv(missing)).toThrowError(/AUTH_SECRET/);
    expect(() => parseEnv(missing)).toThrowError(/Invalid environment variables/);
  });

  it("aggregates multiple missing vars into one error", () => {
    try {
      parseEnv({ DATABASE_URL: valid.DATABASE_URL });
      expect.unreachable("should have thrown");
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain("AUTH_SECRET");
      expect(msg).toContain("AUTH_DISCORD_ID");
      expect(msg).toContain("AUTH_DISCORD_SECRET");
    }
  });

  it("rejects a malformed DATABASE_URL", () => {
    expect(() => parseEnv({ ...valid, DATABASE_URL: "not-a-url" })).toThrowError(
      /DATABASE_URL/,
    );
  });

  it("treats integration secrets as optional", () => {
    const env = parseEnv({ ...valid });
    expect(env.RAID_HELPER_API_KEY).toBeUndefined();
    expect(env.CRON_SECRET).toBeUndefined();
  });
});
