# Vercel Deployment Plan (Phase 6)

**Date:** 2026-06-17
**Goal:** Host the whole tool on Vercel — Next app + Postgres — before the raid starts.
**Account:** Vercel Pro (required; see D1).
**Companion to:** `docs/implementation-plan.md` Phase 6 (the binding spec for *what*; this doc is the executable *how*, with decisions resolved).

---

## Decisions resolved (2026-06-17)

- **Fresh production DB.** No `pg_dump` of local data. Crons auto-rebuild
  guild/signup/softres data within an hour; WCL report codes are re-pasted by an
  officer once. Members re-claim their characters. Local dev DB is untouched.
- **`totalDeaths` backfill (plan §6.2) is a NO-OP** and skipped — there are no
  WCL reports on a fresh DB, so Floor Inspector has nothing to backfill.
- **Migrate URL mechanism: env override in a `vercel-build` script**, NOT a
  datasource `directUrl`. Verified: the `datasource db {}` block is bare and
  resolves its URL from `prisma.config.ts` → `process.env["DATABASE_URL"]`, and
  `@prisma/config`'s datasource type exposes only `url` / `shadowDatabaseUrl`
  (no `directUrl`). So migrations get the direct URL via an env override; the
  running app keeps the pooled `DATABASE_URL`.

---

## Part A — Code changes (do first, locally, then commit + push to `main`)

The only code-touching parts. Local dev keeps booting on `DATABASE_URL` alone —
every prod-only var is optional in the env schema.

- [x] **A1. `src/lib/env.ts`** — added two optional vars to the zod schema:
  - `DIRECT_DATABASE_URL: z.string().url().optional()`
  - `AUTH_TRUST_HOST: z.string().optional()`
  Optional so local dev (sets neither) still boots.
- [x] **A2. `.env.example`** — documented both, noting `DIRECT_DATABASE_URL` is the
  Neon *unpooled* endpoint used only by `migrate deploy`, prod-only.
- [x] **A3. `package.json`** — added (Vercel prefers `vercel-build` over `build`):
  ```
  "vercel-build": "DATABASE_URL=$DIRECT_DATABASE_URL prisma migrate deploy && next build"
  ```
  `"build": "next build"` left untouched for local.
- [x] **A4. `src/app/api/cron/sync-guild/route.ts`** — added at module top:
  `export const maxDuration = 300;` (Pro max; this is the heavy cron).
- [x] **A5.** `yarn typecheck && yarn lint && yarn test` green (177 unit tests) → committed.

## Part B — Provision Neon (Vercel dashboard)

- [ ] **B1.** Vercel project → **Storage → Create Database → Neon (Postgres)**
  (Marketplace). Attach to this project.
- [ ] **B2.** Map the two app vars on the **Production environment ONLY**:
  - `DATABASE_URL` → the **pooled** host (the `-pooler` hostname).
  - `DIRECT_DATABASE_URL` → the **direct/unpooled** host.
  ⚠️ Production scope only — never Preview, or a preview build runs
  `migrate deploy` against prod.

## Part C — Production environment variables (Production scope, set before first deploy)

| Var | Notes |
|---|---|
| `DATABASE_URL` | pooled Neon (B2) |
| `DIRECT_DATABASE_URL` | direct Neon (B2) |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_DISCORD_CLIENT_ID` / `AUTH_DISCORD_CLIENT_SECRET` | from Discord app |
| `AUTH_TRUST_HOST` | `true` (Auth.js trusts Vercel's proxy for callback URLs) |
| `OFFICER_DISCORD_IDS` | your Discord ID(s), comma-separated |
| `RAID_HELPER_API_KEY` / `RAID_HELPER_SERVER_ID` | |
| `WCL_CLIENT_ID` / `WCL_CLIENT_SECRET` | |
| `WCL_GUILD_ID` | `809103` (The Dust) |
| `CRON_SECRET` | **MUST be set.** Vercel only sends `Authorization: Bearer <CRON_SECRET>` on cron calls if this exists. If unset, crons fire but `isAuthorizedCron` silently 401s them. Any random string. |

## Part D — First deploy

- [ ] **D1.** Confirm the project is on **Pro**. Hobby rejects `*/30 * * * *` and
  `0 * * * *` crons at *build time* — `vercel.json` has both. Do not deploy these
  crons on Hobby; the build fails.
- [ ] **D2.** Trigger a deploy. Build runs `vercel-build` → `migrate deploy`
  applies all migrations to the empty Neon DB via the direct URL → `next build`.
  **Watch the build log** to confirm migrations applied cleanly (this is the one
  step with a technical unknown — verify success).

## Part E — Seed officers (one-time, manual — NOT in the build)

Officer promotion isn't idempotent the way migrations are, so it's a manual
one-time step against the direct URL:
```
DATABASE_URL="<DIRECT_DATABASE_URL>" OFFICER_DISCORD_IDS="<your-id>" yarn db:seed
```
Seeds the 16 achievements + promotes your Discord ID to OFFICER. No `totalDeaths`
backfill needed (fresh DB).

## Part F — Discord OAuth redirect

- [ ] **F1.** Discord application → OAuth2 → Redirects, add:
  `https://<prod-domain>/api/auth/callback/discord`
  (sign-in 400s without it).

## Part G — Production dry-run (acceptance)

- [ ] **G1.** Visit prod URL, **sign in with Discord** → user created, you reach
  `/admin`. *JWT gotcha:* if you signed in before the seed promoted you, sign out
  and back in to refresh the role claim.
- [ ] **G2.** Hit each cron, expect JSON counts (not 401):
  ```
  curl -s -H "Authorization: Bearer <CRON_SECRET>" https://<domain>/api/cron/sync-raid-helper
  curl -s -H "Authorization: Bearer <CRON_SECRET>" https://<domain>/api/cron/sync-softres
  curl -s -H "Authorization: Bearer <CRON_SECRET>" https://<domain>/api/cron/sync-guild
  ```
- [ ] **G3.** Link a softres sheet on a raid night; paste a WCL report code.
- [ ] **G4.** Confirm `/raids`, `/raids/[id]`, `/leaderboard`, `/guild`,
  `/profile` all render against Neon.

## Part H — README deploy section (plan §6.5)

- [ ] Add "Deploying to Vercel": Neon storage, pooled/direct split and *why*,
  Pro-plan cron requirement (+ Hobby failure mode), the `vercel-build` migrate
  step, the one-time seed, the auth redirect/env checklist.

---

## Production-only watch-items (not blockers)

- **Neon pooler + Prisma prepared statements.** If `prepared statement "s0"
  already exists` ever appears at runtime (never locally), append
  `?pgbouncer=true` to the pooled `DATABASE_URL`. Transaction-mode pooling.
- **`maxDuration` on a cold backlog.** 300s covers steady-state. If the first
  `sync-guild` over a season backlog exceeds it, chunk ingestion (idempotent
  re-runs catch up). Don't pre-build it.

## Out of scope (named, not dropped)

- Neon preview branching (per-PR ephemeral DBs).
- `sync-guild` cron chunking (only if it exceeds `maxDuration` in practice).
- Neon serverless driver (only needed on the Edge runtime; we use Node).
