import { z } from "zod";

// Environment schema + pure parser. The validated singleton lives in
// env.server.ts (importing THAT triggers fail-fast validation at boot); this
// module stays side-effect-free so it can be unit-tested without real env.
//
// Phase 1 needs only auth + DB. Integration secrets (Raid-Helper, WCL) are
// optional now and validated only once a later phase requires them.
const schema = z.object({
  // --- Required from Phase 1 ---
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(1),
  AUTH_DISCORD_CLIENT_ID: z.string().min(1),
  AUTH_DISCORD_CLIENT_SECRET: z.string().min(1),

  // --- Optional now; required by the phase noted ---
  // Neon unpooled endpoint, used ONLY by `migrate deploy` in the Vercel build
  // (the running app uses the pooled DATABASE_URL). Prod-only; local dev sets
  // neither this nor AUTH_TRUST_HOST. (Phase 6)
  DIRECT_DATABASE_URL: z.string().url().optional(),
  AUTH_TRUST_HOST: z.string().optional(), // Phase 6 (Auth.js behind Vercel proxy)
  OFFICER_DISCORD_IDS: z.string().optional(), // seed (1.3)
  RAID_HELPER_API_KEY: z.string().optional(), // Phase 2
  RAID_HELPER_SERVER_ID: z.string().optional(), // Phase 2
  WCL_CLIENT_ID: z.string().optional(), // Phase 4
  WCL_CLIENT_SECRET: z.string().optional(), // Phase 4
  WCL_GUILD_ID: z.coerce.number().int().optional(), // Phase 4 (guild rank + attendance)
  CRON_SECRET: z.string().optional(), // Phase 2 (cron guard)

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof schema>;

export const envSchema = schema;

// Pure parser: throws a readable, aggregated error listing every invalid var.
// Exported so it can be unit-tested without touching the real process.env.
export function parseEnv(source: Record<string, string | undefined>): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment variables:\n${issues}\n\n` +
        `See .env.example for the full list. Copy it to .env and fill in the values.`,
    );
  }
  return parsed.data;
}
