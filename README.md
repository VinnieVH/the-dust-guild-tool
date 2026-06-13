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
guarded by `Authorization: Bearer ${CRON_SECRET}`.

### Option A — Vercel Cron (default)

`vercel.json` schedules the sync. Set `CRON_SECRET` in the Vercel project; Vercel
Cron sends it as the bearer automatically.

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
