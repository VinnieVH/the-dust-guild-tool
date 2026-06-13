# The Dust — Guild Management Tool

Raid signups, soft-reserve tracking, and automated achievements for a WoW TBC
raiding guild. Next.js (App Router) · TypeScript · Prisma · PostgreSQL · Auth.js.

See `docs/plans/2026-06-11-guild-tool-design.md` (what) and
`docs/implementation-plan.md` (how).

## Getting started

```bash
yarn install
cp .env.example .env        # then fill in the values
docker compose up -d        # Postgres on host port 5433
yarn db:migrate             # apply migrations
yarn db:seed                # promote OFFICER_DISCORD_IDS to officers
yarn dev                    # http://localhost:3000
```

### Environment

All variables are documented in `.env.example` and validated at boot by
`src/lib/env.ts` (the app fails fast with a readable error on a missing one).

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string |
| `AUTH_SECRET` | yes | Auth.js session secret (`npx auth secret`) |
| `AUTH_DISCORD_CLIENT_ID` / `AUTH_DISCORD_CLIENT_SECRET` | yes | Discord OAuth app |
| `OFFICER_DISCORD_IDS` | seed | Comma-separated Discord IDs promoted to OFFICER by `yarn db:seed` |
| `RAID_HELPER_API_KEY` / `RAID_HELPER_SERVER_ID` | sync | Raid-Helper signups sync |
| `WCL_CLIENT_ID` / `WCL_CLIENT_SECRET` | sync | Warcraft Logs v2 OAuth client |
| `WCL_GUILD_ID` | sync | Numeric WCL guild id (rank + attendance). The Dust = `809103` |
| `CRON_SECRET` | sync | Bearer token guarding every `/api/cron/*` endpoint |

"sync" vars are optional until the matching sync runs: a cron route returns
`503 not configured` (not a crash) when its vars are missing.

### Tests

```bash
yarn test               # unit (no DB needed)
yarn test:integration   # integration (needs docker-compose Postgres up)
yarn test:all           # both
```

Integration tests run against a **dedicated `guildtool_test` database** (same
Postgres container, separate database), never the `guildtool` DB the running app
writes to — so test fixtures can never spill into real guild data. The test DB is
auto-created, migrated, and seeded by `yarn test:db:prepare` (run automatically
before `test:integration`/`test:all`), and TRUNCATEd after the suite so a crashed
test can't poison the next run. A guard refuses to touch any DB whose name doesn't
end in `_test`. Override the location with `TEST_DATABASE_URL` if needed.

## Syncing

Sync jobs pull from external APIs into Postgres; the UI only ever reads from
Postgres (no live API calls during render). Each `/api/cron/*` endpoint is
guarded by `Authorization: Bearer ${CRON_SECRET}`. There are three:

| Endpoint | Pulls | Suggested cadence |
|---|---|---|
| `/api/cron/sync-raid-helper` | signups → raid nights | every 30 min |
| `/api/cron/sync-softres` | soft-reserves for nights within 7 days | every 30 min |
| `/api/cron/sync-guild` | WCL attendance/streaks, rankings, composition, + auto-ingest of new 25-man reports → achievements | hourly |

### Option A — Vercel Cron (default)

`vercel.json` schedules all three. Set `CRON_SECRET` in the Vercel project;
Vercel Cron sends it as the bearer automatically.

```json
{ "crons": [{ "path": "/api/cron/sync-raid-helper", "schedule": "*/30 * * * *" }] }
```

### Option B — self-hosted worker

If not on Vercel, trigger the same endpoint from any scheduler (cron, systemd
timer, a small `node-cron` worker):

```bash
*/30 * * * * curl -fsS -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://your-host/api/cron/sync-raid-helper
```

Syncs are idempotent — running one twice yields identical DB state, so a missed
or duplicated tick is harmless.

## Operations

### Seeding officers

Officers are not promoted through the UI. Put their Discord user IDs in
`OFFICER_DISCORD_IDS` (comma-separated) and run `yarn db:seed`; it also seeds the
achievement catalog. The role is baked into the JWT at sign-in, so a freshly
promoted officer must **sign out and back in** before officer pages unlock.

### Recovering from a bad sync

Every sync and ingest is idempotent — recovery is almost always "just run it
again". Nothing here is destructive to characters, claims, or aliases.

- **A sync pulled wrong/stale data** → re-run the same endpoint (or the officer
  "Sync now" / "Refresh now" buttons). Re-runs overwrite, never accumulate.
- **A WCL report was ingested against the wrong night** → remove it on
  `/admin/raid-nights/[id]` (cascades its performances) and re-add it to the
  right night. The per-night engine and speed records recompute on both actions.
- **Names landed in the unmatched queue** → resolve them on `/admin/unmatched`.
  Linking inserts a character alias, so the *next* sync auto-links the same name
  with no queue entry (resolve-once).
- **Soft-res matches look wrong after re-linking a sheet** → remove + re-add the
  sheet; saved aliases reconstruct the matches on the next sync.
- **Achievements look off for one night** → re-ingesting any of its reports
  re-runs the per-night engine (scoped delete + re-award, deterministic ties),
  so awards converge without touching other nights.

### Guard coverage

Two guards protect mutating/triggering surfaces, each with tests:

- **`/api/cron/*`** — bearer-token check (`isAuthorizedCron`), unit-tested for
  the token logic and integration-tested per route (`tests/integration/cron-guards.test.ts`)
  to prove each handler actually wires the guard (401 without a valid bearer).
- **`(member)` / `/admin` pages** — role gate in `src/proxy.ts` (Next 16's
  renamed middleware), delegating to the pure `decideGate`, exhaustively
  unit-tested (`tests/unit/auth-gate.test.ts`). Admin mutations are server
  actions that re-check `role === OFFICER` inline (defense in depth).

> There are no dedicated `/api/admin/*` route handlers — admin write paths are
> server actions, so the "one test per admin API route" from the original plan
> is satisfied by the inline action checks plus the proxy gate, not by HTTP
> route tests.

### Full dry-run (fresh environment)

```bash
docker compose up -d
yarn db:migrate                 # apply all migrations to a fresh DB
yarn db:seed                    # officers + achievement catalog
# trigger syncs (cron endpoints or the officer buttons):
curl -fsS -H "Authorization: Bearer $CRON_SECRET" .../api/cron/sync-raid-helper
curl -fsS -H "Authorization: Bearer $CRON_SECRET" .../api/cron/sync-softres
curl -fsS -H "Authorization: Bearer $CRON_SECRET" .../api/cron/sync-guild
# then: link sheets on /admin/raid-nights/[id], paste a WCL report,
# and confirm /raids, /raids/[id], /leaderboard, /guild, /profile all render.
```
