# Guild Management Tool — Implementation Plan

**Date:** 2026-06-11
**Companion to:** `docs/plans/2026-06-11-guild-tool-design.md` (the design doc is the source of truth for *what*; this plan is the *how* and *in what order*)
**Audience:** an implementing agent. Every step has explicit files, actions, and acceptance criteria. Complete steps in order; do not skip acceptance checks.

---

## 0. Ground rules (read first)

1. **Stack:** Next.js (App Router) · TypeScript `strict: true` · yarn · PostgreSQL · Prisma · Tailwind CSS · Auth.js (NextAuth v5) · Vitest.
2. **Design doc decisions are binding.** In particular:
   - `Character.name` is the **primary cross-integration linking key** (`@unique`). Discord ID is a secondary anchor.
   - DB tables are **plural snake_case** via `@@map()`; Prisma models stay PascalCase singular.
   - `WclReport` is many-per-`RaidNight`. One `RaidNight` has exactly two `SoftresSheet` rows (SSC + TK).
   - Theme is **fel-themed**: dark UI, fel-green primary accents, gold for achievements.
3. **Layering is non-negotiable (SOLID):**
   - `src/lib/integrations/*` — adapters. Only place that performs external HTTP. Map external DTOs → domain types. Implement an interface.
   - `src/lib/services/*` — domain services. Pure logic. No `fetch`, no Prisma imports where avoidable (inject repositories); fully unit-testable.
   - `src/app/*` — delivery. Server components read via services; route handlers handle mutations and cron triggers. No business logic in components.
4. **Definition of done for every step:** code compiles (`yarn tsc --noEmit`), lints clean (`yarn lint`), relevant tests pass (`yarn test`), and the step's acceptance criteria are demonstrably met. Commit per step with message `feat(phase-N): <step title>`.
5. **KISS:** no caching layer, no message queue, no microservices. Postgres is the cache. Cron syncs write to Postgres; UI reads only from Postgres.
6. **Secrets** never committed. All config through environment variables (see §1.4).

### Repository layout target

```
src/
  app/
    (member)/                 # authed member pages
      raids/                  # raid night list + detail
      profile/                # own characters + trophy cabinet
      leaderboard/
    admin/                    # OFFICER-gated
      raid-nights/            # link softres sheets, paste WCL codes
      unmatched/              # resolver queue
    api/
      auth/[...nextauth]/route.ts
      cron/
        sync-raid-helper/route.ts
        sync-softres/route.ts
      admin/                  # mutation route handlers
  lib/
    integrations/
      raid-helper/  (adapter.ts, dto.ts, mapper.ts)
      softres/      (adapter.ts, dto.ts, mapper.ts)
      warcraftlogs/ (adapter.ts, dto.ts, mapper.ts, queries.ts)
      interfaces.ts           # IEventSource, IReserveSource, IPerformanceSource
    services/
      character-resolver.ts
      sync-service.ts
      reserve-overview-service.ts
      achievement-engine.ts
      achievements/           # one file per rule
    repositories/             # thin Prisma wrappers, one per aggregate
    domain/                   # domain types + enums (no Prisma types leak upward)
    auth.ts                   # Auth.js config
    db.ts                     # Prisma client singleton
  components/
    ui/                       # design-system primitives (fel theme)
    achievement-toast.tsx
prisma/
  schema.prisma
  seed.ts
tests/
  fixtures/                   # recorded API responses (JSON)
  unit/
  integration/
docs/plans/                   # both planning docs live here
```

---

## Phase 1 — Foundation

### Step 1.1 — Scaffold the project
- Run: `yarn create next-app guild-tool --typescript --tailwind --eslint --app --src-dir --use-yarn` (no Turbopack flags needed; accept App Router defaults).
- Add deps: `yarn add prisma @prisma/client next-auth@beta @auth/prisma-adapter zod` and dev deps: `yarn add -D vitest @vitest/coverage-v8 @testing-library/react jsdom prettier`.
- Enable `"strict": true` in `tsconfig.json`; add `paths` alias `@/* → src/*`.
- Add `vitest.config.ts` (environment `jsdom` for component tests, `node` default), scripts: `"test": "vitest run"`, `"test:watch": "vitest"`, `"typecheck": "tsc --noEmit"`.
- **Accept:** `yarn dev` serves the default page; `yarn typecheck`, `yarn lint`, `yarn test` (with one placeholder test) all pass.

### Step 1.2 — Prisma schema and first migration
- `yarn prisma init`. Set `DATABASE_URL` in `.env` (local Postgres via Docker: provide `docker-compose.yml` with `postgres:16`, db `guildtool`).
- Copy the **complete schema from design doc §4 verbatim** into `prisma/schema.prisma` — including all `@@map()` plural snake_case table names, `@unique` on `Character.name` and `CharacterAlias.alias`, nullable `Character.userId`, nullable `Reservation.characterId`.
- Add Auth.js adapter models (`Account`, `Session`, `VerificationToken`) mapped to `accounts`, `sessions`, `verification_tokens` — keep the existing `User` model and extend it with the fields Auth.js requires (`email`, `emailVerified`, `image` as optional).
- Run `yarn prisma migrate dev --name init`.
- Create `src/lib/db.ts` Prisma singleton (global cache in dev).
- Create `src/lib/domain/` types mirroring the enums (`MainRole`, `Instance`, `Role`) so services never import Prisma enums directly.
- **Accept:** migration applies cleanly to a fresh DB; `yarn prisma studio` shows plural snake_case tables (`users`, `characters`, `character_aliases`, `raid_nights`, `softres_sheets`, `signups`, `reservations`, `wcl_reports`, `player_performances`, `achievements`, `achievement_awards`).

### Step 1.3 — Discord OAuth + role gate
- Configure Auth.js in `src/lib/auth.ts`: Discord provider, Prisma adapter, JWT session strategy. On sign-in, upsert `discordId` and `discordName` onto `User`.
- Role logic: default `MEMBER`. Officers are promoted via DB/seed for v1 (`prisma/seed.ts` promotes a configurable list of Discord IDs from `OFFICER_DISCORD_IDS` env var).
- Middleware (`src/middleware.ts`): all routes under `(member)` require a session; all routes under `/admin` and `/api/admin` require `role === OFFICER`.
- Add a minimal layout with sign-in/sign-out and the user's Discord name.
- **Accept:** signing in with Discord creates a `users` row; a MEMBER hitting `/admin/*` gets 403/redirect; an OFFICER (after seed) gets through.

### Step 1.4 — Environment variables (document + validate)
- Create `src/lib/env.ts` validating all env vars with zod at boot. Document in `.env.example`:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `AUTH_SECRET` | Auth.js secret |
| `AUTH_DISCORD_ID` / `AUTH_DISCORD_SECRET` | Discord OAuth app |
| `OFFICER_DISCORD_IDS` | Comma-separated Discord IDs to seed as OFFICER |
| `RAID_HELPER_API_KEY` | Raid-Helper server API key |
| `RAID_HELPER_SERVER_ID` | Discord server (guild) ID |
| `WCL_CLIENT_ID` / `WCL_CLIENT_SECRET` | Warcraft Logs v2 OAuth client |
| `CRON_SECRET` | Bearer token guarding `/api/cron/*` |
| `DISCORD_WEBHOOK_URL` | (Phase 5) award announcements |

- **Accept:** app fails fast with a readable error when a required var is missing.

### Step 1.5 — Character registry + self-claim flow
- Repository: `src/lib/repositories/character-repository.ts` (create, findByNameOrAlias, claim, transfer, addAlias).
- Page `/(member)/profile`: list own characters; "Claim a character" form (name, class, spec, main role). Server action validates with zod.
- Claim rules (from design doc §2): `Character.name` unique — if the name exists **unowned** (`userId` null), claiming assigns ownership; if owned by someone else, reject with a message to contact an officer. Officers can transfer ownership from `/admin`.
- Class/spec data: static const in `src/lib/domain/wow.ts` (TBC classes, specs, canonical class colors hex map — also used by the UI later).
- Unit tests: claim of free name, claim of unowned existing character, rejection of owned character, alias uniqueness.
- **Accept:** a signed-in member can claim a character; double-claim is rejected; tests pass.

### Step 1.6 — Fel design system base
- Tailwind theme extension in `tailwind.config.ts`:
  - `fel.green: #7FFF00` family (e.g. `fel-100 … fel-900`, glow color `#39FF14`-adjacent), `legion.dark: #0B0F0C` backgrounds, `epic: #A335EE`, `gold: #FFB100` reserved for achievements, class color tokens from `wow.ts`.
- Build `src/components/ui/` primitives: `Card` (dark panel, subtle fel-green border glow), `Badge`, `ClassName` (renders a character name in its class color), `ProgressBar` (XP-bar style with fel-green fill), `Tooltip` (item-tooltip style: dark, gold title, thin border).
- **Accept:** a Storybook-less demo page `/(member)/styleguide` renders all primitives; visual check: dark + fel green, not purple-first.

---

## Phase 2 — Raid-Helper sync

### Step 2.1 — Adapter interfaces
- `src/lib/integrations/interfaces.ts`:

```ts
export interface IEventSource {
  fetchUpcomingEvents(): Promise<ExternalRaidEvent[]>;
  fetchSignups(eventId: string): Promise<ExternalSignup[]>;
}
export interface IReserveSource {
  fetchReservations(softresId: string, token?: string): Promise<ExternalReservation[]>;
}
export interface IPerformanceSource {
  fetchReportPerformances(reportCode: string): Promise<ExternalPerformance[]>;
}
```

- Domain DTO types live in `src/lib/domain/external.ts`. Adapters return these; raw API shapes stay inside each adapter's `dto.ts`/`mapper.ts`.
- **Accept:** interfaces compile; no adapter yet.

### Step 2.2 — Raid-Helper adapter
- `raid-helper/adapter.ts` implements `IEventSource` using the Raid-Helper REST API with `RAID_HELPER_API_KEY` + `RAID_HELPER_SERVER_ID`. **First action: fetch one real event from the API and save the JSON response into `tests/fixtures/raid-helper/`** — build the mapper against the real shape, not assumptions. Map: event id, title, start time; per signup: Discord user ID, display name, class, spec, signup status.
- Mapper normalizes signup status to a small domain enum (e.g. `CONFIRMED | TENTATIVE | ABSENT | BENCH`); unknown statuses map to `TENTATIVE` and log a warning.
- Integration test runs the mapper against the recorded fixture.
- **Accept:** `fetchUpcomingEvents` + `fetchSignups` work against fixtures; mapper test green.

### Step 2.3 — Sync service + cron endpoint
- `sync-service.ts#syncRaidHelper(eventSource, repos)`: upsert `RaidNight` by `raidHelperEventId`; upsert `Signup` rows by `(raidNightId, userId)`. Users unknown to the app (signed up on Discord but never logged in) get a stub `users` row keyed by `discordId` so signups are never dropped.
- Route handler `/api/cron/sync-raid-helper`: requires `Authorization: Bearer ${CRON_SECRET}`; calls the service; returns counts `{ events, signups, created, updated }`.
- Add `vercel.json` cron entry (e.g. every 30 min) **and** document the self-hosted alternative (`node-cron` worker) in the README.
- Unit tests with a fake `IEventSource`: new event creates night + signups; re-sync is idempotent; status change updates the row.
- **Accept:** calling the endpoint twice produces identical DB state (idempotent); tests pass.

### Step 2.4 — Raid pages
- `/(member)/raids`: upcoming raid nights (date, title, signup count), fel-styled cards.
- `/(member)/raids/[id]`: roster grouped by role (TANK/HEALER/DPS columns), names class-colored, spec icons (static assets in `public/specs/`), signup status badges.
- **Accept:** after a sync, the pages render real data with zero live API calls (verify: pages work with network blocked).

---

## Phase 3 — Soft-res tracking  ← first ship-to-guild milestone

> **Deviation from original plan (2026-06-11, recorded during implementation).**
> The original Step 3.1 specified a 5-tier fuzzy `CharacterResolver` (exact →
> alias → diacritic → Levenshtein → unmatched) on the assumption that a softres
> reservation only carries a `rawName` string. Inspecting the **live softres.it
> API** (`GET https://softres.it/api/raid/{id}`, fixture in
> `tests/fixtures/softres/raid.json`) showed each reservation also carries
> **`dId`** — the reserver's Discord id (softres requires Discord login) — plus
> `class` and an `items` **array** (not a singular `itemId`), and a **numeric**
> `spec` id (e.g. `92`), not a spec name. `dId` is the same strong key auto-claim
> already uses. The resolver design changed accordingly (Steps 3.1/3.4 below).

### Step 3.1 — Reservation resolution (dId-first, link-only) — DONE
- **No standalone fuzzy `CharacterResolver`.** Resolution lives in
  `services/sync-softres-service.ts#syncSoftres` and is **link-only** — it never
  creates a `Character`. Reason: a reservation has no honest `spec`/`mainRole`
  (numeric spec id; no role at all), and `ClaimInput`/`Character` require both
  non-null. Fabricating `mainRole` (Warrior → Tank-or-DPS is undecidable) would
  poison WCL role-matching, the roster, and achievements. Character creation
  stays an **officer queue action** (Step 3.4), where a real spec/role is given.
- Resolution tiers (pure, over injected `SoftresSyncStore` ports — no Prisma):
  1. Exact match on `characters.name`, or confirmed `character_aliases.alias`
     (the `@unique` name **is** the strong link) → `matched`, set `characterId`.
  2. Else, via `dId`: if the reserver owns **exactly one** character whose name
     differs, store it as `suggestedCharacterId` → `suggested` (the typo bridge,
     e.g. "Skreemo" → their "Skreamo"). This **replaces** the deferred
     Levenshtein/diacritic tiers — dId is a stronger signal than edit distance.
  3. Else → `unmatched` (officer queue). Ambiguous (reserver owns several
     characters) is left unmatched so the queue can show their chars as
     candidates rather than guess.
- **Deferred (not built):** Levenshtein/diacritic string matching, and
  auto-creating never-claimed alts from a reservation (needs a softres
  spec-id → {spec, role} map; role isn't always derivable; fixture is n=1 so the
  map can't be validated yet). Revisit only if a real need appears.
- Tests: `tests/unit/sync-softres-service.test.ts` — exact, alias, dId-suggest,
  ambiguous→unmatched, no-match→unmatched, plus the idempotency cases in 3.4.
- **Accept:** ✅ resolver tests green; logic has no Prisma import (ports injected).

### Step 3.2 — softres.it adapter — DONE
- `softres/adapter.ts` implements `IReserveSource`. Real response recorded into
  `tests/fixtures/softres/raid.json` first. Mapper maps per reservation →
  `rawName`, `rawClass`, `discordId` (from `dId`; `"0"`/absent → null), `items[]`
  (the array, not a single id), `reservedAt` (from `updated`/`created`).
- The read endpoint is **public** (returns 200 unauthenticated), so `IReserveSource`'s
  `token?` is unused for reads.
- `parseSoftresUrl(url): { softresId } | null` — handles full URLs, `/edit` URLs,
  scheme-less hosts, and bare ids.
- Tests: `tests/integration/softres-mapper.test.ts` (fixture + hand-built
  dId-absent / placeholder-"0" / bad-timestamp cases) and
  `tests/unit/softres-url.test.ts`.
- **Caveat:** the fixture is **n=1** (one reserve, Discord login on). It cannot
  validate the dId-absent or multi-reserver paths against real data — those are
  covered by constructed inputs, not recorded ones.
- **Accept:** ✅ mapper + URL parser tests green.

### Step 3.3 — Link sheets to a raid night (officer UI) — DONE
> **Deviation (2026-06-12):** the original "exactly two SSC+TK sheets" assumption
> (design doc §4) was dropped. Not every night has two raids (e.g. a Kara night
> has one), and sheets are now **officer-named, 0..N per night**. Migration
> `softres_sheet_named` replaced `SoftresSheet.instance Instance` with
> `name String`, unique per night (identity-preserving: existing SSC/TK rows kept
> their label as the name). The `Instance` enum stays for `WclReport` (Phase 4),
> which detects the zone independently — softres sheets never joined to it.
- `/admin/raid-nights/[id]`: a **SheetManager** lists the night's sheets
  (name + softres link + Remove) and an "Add sheet" row (name + URL). Adding
  syncs that sheet immediately; removing deletes it and its reservations
  (cascade). Re-linking is remove + add — the saved character aliases
  reconstruct the matches on the next sync, so there's no separate edit path.
  All actions are officer-gated server-side.
- `/admin/raid-nights`: roomier layout, upcoming/past split, and an
  **Unmatched queue** link with a pending-count badge.
- **Accept:** ✅ an officer can add/remove any number of named sheets; the SR
  matrix renders one column per sheet.

### Step 3.4 — Reservation sync + resolution queue
- **Schema (done):** `reservations` reshaped via migration
  `add_softres_reservation_fields` — `itemId Int` → `items Int[]`; added nullable
  `rawClass`, `discordId`, `reservedAt`, `suggestedCharacterId`, and
  `ignored Boolean @default(false)`; `@@unique([softresSheetId, rawName])` so
  re-sync upserts one row per reserved name.
- `services/sync-softres-service.ts#syncSoftres(reserveSource, store, sheets)`:
  for each sheet, fetch reservations, resolve each (Step 3.1), then **upsert** by
  `(sheetId, rawName)`:
  - `matched` → set `characterId`;
  - `suggested` → leave `characterId` null, store `suggestedCharacterId`;
  - `unmatched` → both null.
- **Idempotency contract (enforced in `reservation-repository.ts`, tested):**
  - sync **never** writes `ignored` (officer-owned) — a re-sync can't resurface a
    dismissed row;
  - sync **never** clears an officer-confirmed `characterId` — on already-linked
    rows it only refreshes softres metadata;
  - resolve-once holds via aliases: officer **Link** inserts a
    `character_alias`, so the next sync re-derives the link by alias with no
    queue entry.
- Cron endpoint `/api/cron/sync-softres` (same `CRON_SECRET` guard), syncing sheets of raid nights within the next 7 days.
- `/admin/unmatched`: table of reservations with `characterId IS NULL`, showing `rawName`, sheet/instance, and the suggestion if present. Actions per row (server actions):
  - **Link** to a character (accept suggestion or pick from search) → sets `characterId` **and** inserts a `character_aliases` row for `rawName` (this is the resolve-once guarantee).
  - **Create character** (officer creates unowned character with that name, `userId` null) → link.
  - **Ignore** (add `ignored: Boolean @default(false)` to `reservations` in the same migration).
- Officer UI (`/admin/raid-nights` + `/admin/raid-nights/[id]` for sheet linking,
  `/admin/unmatched` for the queue) — see Step 3.3. Queue filter is
  `characterId IS NULL AND ignored = false` (suggested rows DO appear, with a
  one-click accept; ignored rows drop out).
- Tests: `tests/unit/sync-softres-service.test.ts` (decision table + idempotency),
  `tests/unit/resolve-reservation-service.test.ts` (alias-inserted-on-link).
- **Accept:** ✅ after an officer resolves a name once, the next sync auto-links
  the same `rawName` with no queue entry (verified live in
  `tests/integration/sync-softres.test.ts`).

### Step 3.5 — SR overview matrix + poke list — DONE
- `services/reserve-overview-service.ts#buildOverview(data)` returns, per
  confirmed signup: SSC done?, TK done?, hasCharacter. "Done" for an instance =
  **any reservation on that sheet resolves to any character they own** (covers
  alts). Pure; fed by `reserve-overview-queries.ts#getOverviewData`.
- `/(member)/raids/[id]` gains the matrix (rows = confirmed signups, a column per
  **linked** instance, green ✓ / red ✗), an XP-style "SR completion: n/total"
  progress bar, and the **"Copy Discord reminder"** button — `buildReminderText`
  builds `<@discordId>` mentions listing who's missing which sheet (with a "no
  character claimed" hint), copied client-side.
- Cron `/api/cron/sync-softres` (same `CRON_SECRET` guard) syncs sheets of nights
  within 7 days. (vercel.json cron entry deferred to deploy/hardening.)
- Tests: `tests/unit/reserve-overview-service.test.ts` (both/one/none, alt
  reserved, no-character) + the live `tests/integration/sync-softres.test.ts`
  proving the full chain against Postgres.
- **Accept:** ✅ end-to-end verified live: sync reservations → matrix shows
  correct red/green → completion count → reminder text correct → resolve-once
  holds on re-sync. **Ready to ship to the guild** (pending Discord-login on the
  guild's real sheets so `dId` is populated).

---

## Alts — one Discord id owns many characters (cross-cutting, recorded 2026-06-12)

> A single Discord id legitimately maps to **multiple characters** (a main +
> alts), and they may be different classes/roles — e.g. Skreamo signs up to SSC/TK
> as an Arms Warrior and to a Kara night as a Destruction Warlock alt, under the
> same Discord name. This is a first-class case, not an edge case.

**The schema already supports it.** `User` 1:N `Character` (`Character.userId`
nullable), and `Character.name` (`@unique`) is the cross-integration linking key.
softres and WCL resolution match on the **real in-game name**, so an alt with its
own true name resolves to its own `Character` independently of the main. No schema
change needed; do **not** drop `@unique` on `Character.name` (it is the linking key
Phases 3 and 4 both depend on) and do **not** add any `discordId → single
character` shortcut anywhere in resolution.

**Where "1 Discord = 1 character" was actually baked in — the Raid-Helper path.**
Raid-Helper gives **one display name per signup** (the Discord nickname, e.g.
"Skreamo") plus that signup's `class`/`spec`/`role`. It does **not** carry the
alt's real in-game name. So two things were wrong and are fixed as part of Phase 4
prep / Phase 2 correction:

1. **Roster query (`raid-queries.ts#getRaidNightDetail`) ignored the per-signup
   class.** It showed `user.characters[0]` (first claimed character, alphabetical),
   so a Kara warlock signup rendered as the user's Warrior main. **Fix:** the
   roster (and the SR-matrix `getOverviewData`) reads `Signup.characterName` +
   `Signup.class` per night, falling back to the Discord name only when the signup
   carried none. Note the displayed **name** is the Raid-Helper *Discord nickname*
   (RH never carries the alt's real in-game name), so the warlock row reads
   "Skreamo" + Warlock — the **class** is per-night accurate, the name is the nick.
   That's honest and cosmetic (the reminder uses `<@discordId>` mentions, not the
   name). The SR matrix still keys "done" off *any* character the user owns being
   reserved (`characterIds` = all owned), so it already covers alts.
2. **Auto-claim (`auto-claim.ts`) deduped by name with an arbitrary winner.** Both
   signups carry `characterName: "Skreamo"`, and `byName.set(...)` was last-write
   by Map insertion order, so *which class* "Skreamo" got registered as was
   arbitrary (claim then no-ops forever via `already_yours`, so it's not overwritten
   later — just arbitrarily chosen once). **Corrected contract:** auto-claim creates
   **at most one `Character` per Discord display name** and picks the representative
   class **deterministically** (most-frequent class across the user's signups,
   alphabetical tie-break) so it no longer depends on row order. This is a
   determinism/quality fix, not a correctness one — the per-night roster now reads
   from `Signup` (item 1), so the registry only needs one stable main per name. The
   alt's *real* `Character` still enters via self-claim or softres/WCL real-name
   resolution — **never** fabricated from a Raid-Helper signup (a synthetic name
   like "Skreamo (Warlock)" would never match the warlock's real name and would
   manufacture duplicates an officer must merge).

**Net:** alts are tracked at the **signup/roster layer** (per-night, class-aware)
and at the **real-name source layer** (softres/WCL → true `Character` rows). The
Raid-Helper path deliberately tracks only the main per Discord name, because it
physically lacks the alt's name. Phase 4 (below) needs no special alt handling so
long as WCL resolution stays name-based.

---

## Phase 4 — Warcraft Logs + achievements

### Step 4.1 — WCL adapter
- OAuth2 client-credentials token helper with in-memory expiry cache (`warcraftlogs/auth.ts`).
- `warcraftlogs/queries.ts`: GraphQL documents for: report fights (boss kills only), and per-player rankings/table data (parse percentile per fight, total damage/healing, deaths, interrupts, dispels).
- `adapter.ts` implements `IPerformanceSource`: input `reportCode`; output per character: `name`, `role` (tank parse present → TANK; healer ranking → HEALER; else DPS), `parseAvg` (mean of fight parse percentiles), `dpsOrHps`, `deaths`, `interrupts`, `dispels`, `fightsPresent`, plus report-level `totalBossFights` and detected `instance` (SSC/TK from zone id).
- **Record one real report response into `tests/fixtures/warcraftlogs/` first**; build mapper against it; integration test on the fixture.
- **Accept:** adapter returns sane numbers for the fixture report (spot-check vs the WCL website values noted in the fixture's README).

### Step 4.2 — Performance ingestion (officer flow)
- `/admin/raid-nights/[id]`: "Add WCL report" input (code or full URL — write `parseWclUrl` helper + tests). Multiple reports per night supported (design doc: many-per-night).
- Server action: create `wcl_reports` row, call adapter, resolve each player name through `CharacterResolver` (same queue handles WCL unmatched names — extend `/admin/unmatched` to cover performances by adding nullable `characterId` + `rawName` to `player_performances` via migration), insert `player_performances`.
- Idempotency: re-ingesting a report code replaces its performance rows.
- **Accept:** pasting a report populates performances; unknown character names appear in the unmatched queue; resolving them backfills `characterId`.

### Step 4.3 — Night scoring service
- `services/night-score.ts`: per character per raid night, combine performances across that night's reports: weighted mean of `parseAvg` by `fightsPresent`; total deaths/interrupts/dispels; `participation = fightsPresent / totalBossFightsOfNight`.
- Eligibility for top titles: `participation ≥ 0.6` (constant in one place: `src/lib/domain/constants.ts`).
- Unit tests: weighting (1-boss TK + 6-boss SSC), threshold edge (exactly 60%), multi-report merge.
- **Accept:** tests green; pure function, no IO.

### Step 4.4 — Achievement engine + rules
- `services/achievement-engine.ts`: takes night scores + raw performances, runs all registered `AchievementRule`s, persists `achievement_awards` idempotently (re-run for a night first deletes that night's awards, then re-awards — deterministic).
- Tie-break for v1: deterministic "coin flip" = seeded by `raidNightId + achievementKey` so re-runs give the same winner.
- Seed `achievements` table in `prisma/seed.ts` with keys/names/icons.
- Rules, one file each under `services/achievements/`:
  - `deadliest.ts` (top eligible DPS parse), `lifebinder.ts` (healer), `immovable-object.ts` (tank)
  - `kick-commander.ts` (most interrupts, min 1), `cleanse-crusader.ts` (most dispels, min 1)
  - `floor-inspector.ts` (most deaths, min 1), `iron-man.ts` (0 deaths, participation ≥ 0.6, can award multiple)
  - `sr-speedrunner.ts` (earliest member to have reservations on both sheets — needs `createdAt` capture on reservations; add column in a migration; note: only meaningful from first sync onward)
  - `perfect-attendance.ts` (streak across consecutive raid nights — compute from signup+performance history)
- Unit tests per rule with fixture data, plus engine tests (idempotent re-run, deterministic ties).
- **Accept:** ingesting fixtures for a night and running the engine produces the expected award set, twice in a row, identically.

### Step 4.5 — Trigger + surfacing
- Run the engine automatically at the end of WCL ingestion (Step 4.2 server action).
- `/(member)/raids/[id]`: "Night results" section — winners per title with class-colored names and gold-bordered cards.
- **Accept:** end-to-end: paste report → awards appear on the raid page.

---

## Phase 5 — Polish & engagement

### Step 5.1 — Achievement toast
- `components/achievement-toast.tsx`: WoW-style gold banner toast (gold border, shield/icon, title + character name) with Framer Motion entrance (`yarn add framer-motion`). Fire on the raid page when results are first viewed (client component reading awards via props).
- **Accept:** visually matches the WoW achievement frame vibe; respects `prefers-reduced-motion`.

### Step 5.2 — Profiles & trophy cabinet
- `/(member)/profile`: trophy cabinet — all `achievement_awards` for the member's characters, grouped by achievement, with counts ("Deadliest ×4"), item-quality borders by category.
- **Accept:** awards from Phase 4 fixtures render; empty state is friendly.

### Step 5.3 — Season leaderboard
- `/(member)/leaderboard`: award counts per character for a date range ("season" = configurable start date constant for v1), sortable, top-3 podium styling (gold/silver/bronze).
- **Accept:** matches a hand-computed count from seeded data.

### Step 5.4 — Discord webhook announcements
- After the engine runs, POST an embed to `DISCORD_WEBHOOK_URL`: night title + winners per title with emoji. Feature-flag via env var presence; failures are logged, never block ingestion.
- **Accept:** webhook fires once per engine run (not on idempotent re-runs unless awards changed).

### Step 5.5 — Hardening pass
- Add an ops README section: required env vars, cron setup (Vercel + self-hosted), seeding officers, recovering from a bad sync (re-run is idempotent everywhere).
- Verify all `/api/cron/*` and `/api/admin/*` routes enforce their guards (write one integration test per guard).
- Run a full dry-run: fresh DB → migrate → seed → sync → link sheets → sync SR → ingest WCL fixture → engine → all pages render.
- **Accept:** dry-run checklist passes top to bottom.

---

## Cross-cutting requirements (apply to every phase)

1. **Fixtures before mappers.** For every external API, record at least one real response into `tests/fixtures/<source>/` before writing the mapper. Never code a mapper against an imagined shape.
2. **Idempotent syncs.** Every sync/ingest can run twice with identical end state. Test it.
3. **No Prisma types above the repository layer.** Services and components use `src/lib/domain` types.
4. **Migrations are additive and named** (`add_reservation_suggestion`, `add_performance_rawname`, …). Never edit an applied migration.
5. **Error handling:** adapters throw typed errors (`IntegrationError` with `source` + `cause`); cron handlers catch, log, and return 500 with a safe message; UI shows last-sync status, not stack traces.
6. **Accessibility & theme:** fel green on dark must keep ≥ 4.5:1 contrast for body text (use the lighter fel tints for text, saturated fel for accents/glows only).

## Suggested commit sequence (one per step)

`1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → 2.1 → 2.2 → 2.3 → 2.4 → 3.1 → 3.2 → 3.3 → 3.4 → 3.5 (ship) → 4.1 → 4.2 → 4.3 → 4.4 → 4.5 → 5.1 → 5.2 → 5.3 → 5.4 → 5.5`