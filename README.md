<div align="center">

# The Dust

**A raid-night command center for a World of Warcraft: The Burning Crusade guild.**

Signups, soft-reserves, and Warcraft Logs performance — pulled together, matched
by character, and turned into automated achievements that hand out the night's
loot of glory (and a little ribbing).

<br />

[![Next.js](https://img.shields.io/badge/Next.js-16.2-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7.8-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Auth.js](https://img.shields.io/badge/Auth.js-v5-000000?logo=auth0&logoColor=white)](https://authjs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Tests](https://img.shields.io/badge/tests-229%20passing-3CB371)](#testing)

</div>

---

## What is this

Three tools every TBC raiding guild already juggles, glued together so nobody has
to cross-reference them by hand at 7:59pm on a raid night:

- **[Raid-Helper](https://raid-helper.dev/)** knows who signed up.
- **[softres.it](https://softres.it/)** knows who reserved what.
- **[Warcraft Logs](https://www.warcraftlogs.com/)** knows what actually happened.

The Dust ingests all three, links them by character name, and surfaces the answers
officers actually ask: *Is the roster full? Who still hasn't filled their SR sheet?
Who topped the meters — and who spent the most time inspecting the floor?*

Then, after every night, an **achievement engine** runs and quietly hands out
titles. Some are earned (top parse, zero deaths, a flawless attendance streak).
Some are earned the hard way (**Floor Inspector**, for the most deaths of the
night). All of them show up as a WoW-style gold toast and live forever in your
trophy cabinet.

> Built for **The Dust** (WCL guild `809103`), a 25-man TBC progression guild.
> Names, zones, and class colors are all canon-accurate to TBC.

---

## Highlights

### Signups, roster-ready

Raid-Helper signups sync into clean per-role rosters — class-colored names, spec
icons, and confirmed/tentative/bench/absent status at a glance. No more squinting
at a Discord embed.

### Soft-reserves that nag for you

Officers link any number of named softres.it sheets to a night (SSC, TK, Kara —
whatever you're running). The SR matrix shows a green check or red cross for every
signup × sheet, an XP-bar-style completion meter, and a **"Copy Discord reminder"**
button that spits out `<@mentions>` for exactly the people who still owe a reserve.

### Performance, ingested by paste

Drop a WCL report code (or full URL) and The Dust pulls parses, DPS/HPS, deaths,
interrupts, dispels, and consumable usage. Loggers disconnect mid-raid? Add
multiple reports to one night and they merge.

### Twelve automated achievements

After ingestion, the rules fire automatically with deterministic, seeded
tie-breaking — no two re-runs disagree:

| Title | Earned by |
|---|---|
| **Deadliest** | Top DPS parse of the night |
| **Lifebinder** | Top healer parse |
| **Immovable Object** | Top tank parse |
| **Kick Commander** | Most successful interrupts |
| **Cleanse Crusader** | Most dispels |
| **Fully Buffed** | Flask + elixir + food, every pull |
| **Iron Man** | Zero deaths (and showed up for ≥75% of it) |
| **Well-Oiled Machine** | Guild award — raid-average parse ≥ 80 |
| **SR Speedrunner** | First to fill every sheet for the night |
| **Perfect Attendance** | A live consecutive-raid streak |
| **Streak Milestones** | One-time keepsakes at 5 / 10 / 20 / 30 / 50 raids |
| **Floor Inspector** | Most deaths of the night (worn with pride) |

Achievements surface as animated gold toasts (respecting `prefers-reduced-motion`),
on the **Hall of Champions** leaderboard, and in each member's **trophy cabinet**.

### Resolve-once name matching

External tools spell names a dozen ways. When a name can't be matched, it lands in
an officer **unmatched queue** with one-click link / create / ignore. Confirming a
link writes a character **alias**, so the *next* sync matches that spelling silently
forever after.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 16** (App Router) — server components for reads, route handlers + server actions for writes |
| Language | **TypeScript 5** (strict) |
| Database | **PostgreSQL 16** via **Prisma 7** (`@prisma/adapter-pg` TCP driver) |
| Auth | **Auth.js v5** (NextAuth) with Discord OAuth, role baked into the JWT |
| UI | **Tailwind CSS 4** + **Framer Motion** for achievement toasts |
| Validation | **Zod 4** (env validation, form schemas) |
| Testing | **Vitest 4** + Testing Library + jsdom |

---

## Architecture

A clean three-layer split with dependency inversion — domain logic never imports
HTTP, and the UI never touches a live API.

```
┌──────────────────────────────────────────────────────┐
│ Delivery — Next.js                                     │
│   server components (read-heavy pages)                 │
│   route handlers + server actions (mutations, cron)    │
├──────────────────────────────────────────────────────┤
│ Domain services — src/lib/services                     │
│   SyncService · ReserveOverviewService                 │
│   AchievementEngine · CharacterResolver                │
│   pure logic, no HTTP, fully unit-testable             │
├──────────────────────────────────────────────────────┤
│ Integration adapters — src/lib/integrations            │
│   raid-helper/   → IEventSource                        │
│   softres/       → IReserveSource                      │
│   warcraftlogs/  → IPerformanceSource                  │
│   map external DTOs → domain types                     │
└──────────────────────────────────────────────────────┘
```

**The database is a cache.** Syncs pull from external APIs and write to Postgres;
every page reads only from Postgres. That keeps renders fast and makes syncs
**idempotent** — running one twice yields identical state, so a missed or
duplicated cron tick is harmless. `Character.name` is unique and is the single
linking key that stitches Raid-Helper, softres, and WCL together.

---

## Getting started

**Prerequisites:** Node 18+, Yarn, and Docker (for local Postgres).

```bash
yarn install
cp .env.example .env        # then fill in the values
docker compose up -d        # Postgres on host port 5433
yarn db:migrate             # apply migrations
yarn db:seed                # promote OFFICER_DISCORD_IDS to officers + seed achievements
yarn dev                    # http://localhost:3000
```

### Environment

Every variable is documented in `.env.example` and validated at boot by
`src/lib/env.ts` — the app fails fast with a readable error on a missing one.

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

`sync` vars are optional until the matching sync runs — a cron route returns
`503 not configured` (not a crash) when its vars are missing, so you can stand up
the app and add integrations one at a time.

---

## Scripts

| Command | Does |
|---|---|
| `yarn dev` | Start the dev server |
| `yarn build` | Production build |
| `yarn start` | Serve the production build |
| `yarn lint` | ESLint |
| `yarn typecheck` | `tsc --noEmit` |
| `yarn db:up` | `docker compose up -d` |
| `yarn db:migrate` | `prisma migrate dev` |
| `yarn db:seed` | Seed officers + achievement catalog |
| `yarn test` | Unit tests (no DB needed) |
| `yarn test:integration` | Integration tests (needs Postgres up) |
| `yarn test:all` | Both |
| `yarn format` | Prettier |

---

## Testing

```bash
yarn test               # unit (no DB needed)
yarn test:integration   # integration (needs docker-compose Postgres up)
yarn test:all           # both
```

Integration tests run against a **dedicated `guildtool_test` database** (same
Postgres container, separate database) — never the `guildtool` DB the running app
writes to, so test fixtures can never spill into real guild data. It's
auto-created, migrated, and seeded by `yarn test:db:prepare` (run automatically
before the integration suites) and TRUNCATEd afterward, so a crashed test can't
poison the next run. A guard refuses to touch any DB whose name doesn't end in
`_test`. Override with `TEST_DATABASE_URL`.

Before pushing:

```bash
yarn lint && yarn typecheck && yarn test:all
```

---

## Deployment

Ships to **Vercel** with **Neon Postgres**. `vercel.json` schedules all three cron
endpoints; Vercel Cron sends `CRON_SECRET` as the bearer automatically. Migrations
run against Neon's direct (unpooled) endpoint at build time via the
`vercel-build` script, while the app uses the pooled endpoint at runtime.

> Vercel's **Pro** plan is required — Hobby rejects the per-30-minute cron
> schedules. Self-hosting works too: point any scheduler at the same cron
> endpoints (see the [operations runbook](docs/OPERATIONS.md)).

---

## Documentation

- **[Operations runbook](docs/OPERATIONS.md)** — syncing, recovery, guard coverage,
  one-off maintenance scripts, and a full fresh-environment dry-run.
- **[Design doc](docs/plans/2026-06-11-guild-tool-design.md)** — the *what* and *why*.
- **[Implementation plan](docs/implementation-plan.md)** — the *how*.
- **[Achievement design](docs/achievement-design.md)** — the rule pipeline in detail.
