# Operations runbook

Day-to-day operation of The Dust: syncing, recovery, the guards that protect
mutating surfaces, and a full fresh-environment dry-run. If something looks
wrong in the app, this is the page that tells you which lever to pull.

## Syncing

Sync jobs pull from external APIs into Postgres; the UI only ever reads from
Postgres (no live API calls during render). Each `/api/cron/*` endpoint is
guarded by `Authorization: Bearer ${CRON_SECRET}`. There are three:

| Endpoint | Pulls | Suggested cadence |
|---|---|---|
| `/api/cron/sync-raid-helper` | signups → raid nights | every 30 min |
| `/api/cron/sync-softres` | soft-reserves for nights within 7 days | every 30 min |
| `/api/cron/sync-guild` | WCL attendance/streaks, rankings, composition, + auto-ingest of new 25-man reports → achievements | hourly |

Syncs are idempotent — running one twice yields identical DB state, so a missed
or duplicated tick is harmless.

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

## Seeding officers

Officers are not promoted through the UI. Put their Discord user IDs in
`OFFICER_DISCORD_IDS` (comma-separated) and run `yarn db:seed`; it also seeds the
achievement catalog. The role is baked into the JWT at sign-in, so a freshly
promoted officer must **sign out and back in** before officer pages unlock.

## Recovering from a bad sync

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

## Guard coverage

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

## Full dry-run (fresh environment)

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

## One-off maintenance scripts

Run with `tsx` (already a dev dependency). These exist for backfills and
rule-change reprocessing — none are part of the normal sync loop.

| Script | What it does |
|---|---|
| `scripts/refetch-wcl-reports.mts` | Re-fetch WCL report data (e.g. after adding a new metric to the schema). |
| `scripts/rerun-night-engine.mts` | Re-run the achievement engine for specific nights after changing a rule. |
| `scripts/assign-character.mts` | Officer utility to assign a character to a user manually. |
