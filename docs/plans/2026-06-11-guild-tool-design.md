# Guild Management Tool — Design Document

**Date:** 2026-06-11
**Status:** Validated design, ready for implementation
**Stack:** Next.js (App Router) · TypeScript · yarn · PostgreSQL · Prisma

---

## 1. Purpose

A guild management tool for a World of Warcraft Classic (TBC) raiding guild that:

1. Integrates with **Raid-Helper** to show who signed up for upcoming raid events.
2. Integrates with **softres.it** to track soft-reserve completion. One raid night = one Raid-Helper event = **two** soft-reserve sheets (Serpentshrine Cavern + Tempest Keep).
3. Shows an at-a-glance overview of who has and hasn't filled out each SR sheet.
4. Pulls performance data from **Warcraft Logs** and awards fun, automated achievements per raid night to drive engagement.

Design principles: SOLID, DRY, KISS. Playful fel-themed (destructive, chaotic magic of the Burning Legion) WoW-themed UI.

---

## 2. The core architectural challenge: identity matching

Every member exists as three different identities:

| Source | Identity |
|---|---|
| Raid-Helper | Discord user ID + display name |
| softres.it | Free-text character name (typo-prone) |
| Warcraft Logs | Character name on the report |

**The character name is the primary linking key.** A character's `name` is unique and appears identically across Warcraft Logs, softres.it, and (as a display name) Raid-Helper. The Discord ID is the *preferred* anchor when present, but it is frequently missing or unreliable on the softres/WCL side — so the name is what actually ties the three identities together in practice. This makes `Character.name` a uniqueness constraint and the backbone of the resolver.

Everything hinges on mapping these to one person. The solution is a **character registry** with a **hybrid matching flow** (decided):

- Members log in with Discord OAuth and self-claim their characters (name, class, spec, main role).
- All sync jobs resolve external names through a single `CharacterResolver` service:
  1. Exact match
  2. Case/diacritic-insensitive match
  3. Fuzzy match (Levenshtein distance ≤ 2) → creates a *suggested* match, never an automatic one
- Anything unresolved lands in an officer queue at `/admin/unmatched` with one-click actions:
  - Link to existing character
  - Create character and assign to user
  - Ignore (pugs)

**Guardrails:**
- A character can be claimed by only one user; officers can transfer ownership.
- Officer-confirmed mappings are stored as **aliases** on the character, so each mismatch ("Thunderfurry" vs "Thûnderfurry") is resolved exactly once, for all integrations. This alias table is what keeps matching DRY.

---

## 3. Architecture

Three layers, enforcing dependency inversion:

```
┌─────────────────────────────────────────────┐
│ Delivery                                    │
│  Server components (read-heavy pages)       │
│  Route handlers (mutations, cron endpoints) │
├─────────────────────────────────────────────┤
│ Domain services (/lib/services)             │
│  SyncService · ReserveOverviewService       │
│  AchievementEngine · CharacterResolver      │
│  Pure logic, no HTTP, fully unit-testable   │
├─────────────────────────────────────────────┤
│ Integration adapters (/lib/integrations)    │
│  raid-helper/  → IEventSource               │
│  softres/      → IReserveSource             │
│  warcraftlogs/ → IPerformanceSource         │
│  Map external DTOs → domain types           │
└─────────────────────────────────────────────┘
```

- The rest of the app never touches raw API responses. Swapping softres.it for e.g. Gargul exports only changes one adapter (open/closed, dependency inversion).
- Sync runs as scheduled jobs (Vercel Cron, or `node-cron` worker if self-hosted) writing into Postgres. The UI reads only from the local DB — no live API calls during page renders, no extra caching layer. **Postgres is the cache** (KISS).

---

## 4. Data model

Every model maps to a **plural snake-case table name** via `@@map()` (Prisma models stay PascalCase singular; the DB tables are plural). Enums map to plural too.

```prisma
model User {
  id          String      @id @default(cuid())
  discordId   String      @unique
  discordName String
  role        Role        @default(MEMBER)
  characters  Character[]
  signups     Signup[]

  @@map("users")
}

model Character {
  id           String              @id @default(cuid())
  userId       String?
  name         String              @unique   // primary cross-integration linking key
  class        String
  spec         String
  mainRole     MainRole
  user         User?               @relation(fields: [userId], references: [id])
  aliases      CharacterAlias[]
  reservations Reservation[]
  performances PlayerPerformance[]
  awards       AchievementAward[]

  @@map("characters")
}

model CharacterAlias {
  id          String    @id @default(cuid())
  characterId String
  alias       String    @unique   // officer-confirmed name variants
  character   Character @relation(fields: [characterId], references: [id])

  @@map("character_aliases")
}

model RaidNight {
  id               String             @id @default(cuid())
  date             DateTime
  raidHelperEventId String            @unique
  title            String
  sheets           SoftresSheet[]
  signups          Signup[]
  reports          WclReport[]
  awards           AchievementAward[]

  @@map("raid_nights")
}

model SoftresSheet {
  id           String        @id @default(cuid())
  raidNightId  String
  instance     Instance
  softresId    String
  token        String?
  raidNight    RaidNight     @relation(fields: [raidNightId], references: [id])
  reservations Reservation[]

  @@map("softres_sheets")
}

model Signup {
  id           String     @id @default(cuid())
  raidNightId  String
  userId       String
  status       String
  specSignedAs String
  raidNight    RaidNight  @relation(fields: [raidNightId], references: [id])
  user         User       @relation(fields: [userId], references: [id])

  @@map("signups")
}

model Reservation {
  id             String        @id @default(cuid())
  softresSheetId String
  characterId    String?       // nullable → unmatched entries form the officer queue
  rawName        String        // always kept, even when matched
  itemId         Int
  softresSheet   SoftresSheet  @relation(fields: [softresSheetId], references: [id])
  character      Character?    @relation(fields: [characterId], references: [id])

  @@map("reservations")
}

model WclReport {
  id           String              @id @default(cuid())
  raidNightId  String              // MANY reports per raid night
  reportCode   String              @unique
  instance     Instance
  raidNight    RaidNight           @relation(fields: [raidNightId], references: [id])
  performances PlayerPerformance[]

  @@map("wcl_reports")
}

model PlayerPerformance {
  id            String    @id @default(cuid())
  wclReportId   String
  characterId   String
  role          MainRole
  parseAvg      Float
  dpsOrHps      Float
  deaths        Int
  interrupts    Int
  dispels       Int
  fightsPresent Int
  wclReport     WclReport @relation(fields: [wclReportId], references: [id])
  character     Character @relation(fields: [characterId], references: [id])

  @@map("player_performances")
}

model Achievement {
  id          String             @id @default(cuid())
  key         String             @unique
  name        String
  description String
  icon        String
  category    String
  awards      AchievementAward[]

  @@map("achievements")
}

model AchievementAward {
  id            String      @id @default(cuid())
  achievementId String
  characterId   String
  raidNightId   String
  achievement   Achievement @relation(fields: [achievementId], references: [id])
  character     Character   @relation(fields: [characterId], references: [id])
  raidNight     RaidNight   @relation(fields: [raidNightId], references: [id])

  @@map("achievement_awards")
}

enum Role {
  MEMBER
  OFFICER

  @@map("roles")
}

enum MainRole {
  TANK
  HEALER
  DPS

  @@map("main_roles")
}

enum Instance {
  SSC
  TK

  @@map("instances")
}
```

Notes:
- **`Character.name` is `@unique`** and is the primary key for cross-integration matching — softres and WCL names resolve to it directly, Discord ID is a secondary anchor. `CharacterAlias.alias` is also `@unique` so a confirmed variant ("Thûnderfurry") can never point at two characters.
- `Character.userId` is **nullable**: officers can create characters (e.g. for pugs or before a member self-claims) that aren't yet owned by a `User`.
- `Reservation.characterId` is **nullable**, with `rawName` always kept → unmatched entries form the officer resolution queue.
- `WclReport` is modeled as **many per raid night** from day one. Loggers disconnect and nights get split into multiple reports; this is one foreign key now versus a painful migration later.
- One `RaidNight` has exactly two `SoftresSheet` children (SSC + TK), directly modeling the "one event, two raids" setup.

---

## 5. Integrations

### 5.1 Raid-Helper
- REST API; requires the **server API key** from the Raid-Helper bot settings.
- Sync job pulls upcoming events for the Discord server and the signups per event (Discord user ID, name, class/spec, signup status).
- Upserts `RaidNight` + `Signup`.

### 5.2 softres.it
- Each sheet has a raid ID; the API returns the reservation list (character name + reserved items).
- Officer flow: when creating/linking a raid night, paste the two softres links → app extracts IDs/tokens → sync job pulls reservations.
- **SR overview page** = join of signups × sheets:
  - Matrix per member: *Signed up / SSC SR done / TK SR done*, red/green status per cell.
  - "Poke list" of members signed up but missing one or both sheets.
  - **"Copy Discord reminder"** button generating a ready-to-paste message tagging the slackers.

### 5.3 Warcraft Logs
- API v2 (GraphQL, OAuth2 client-credentials flow).
- After the raid, an officer pastes the report code(s); optionally auto-discover by guild + date later.
- Pull per-player data: parse percentiles, DPS/HPS, deaths, interrupts, dispels → stored as `PlayerPerformance`.

---

## 6. Achievement engine

A **rules pipeline**, not hardcoded ifs (open/closed principle):

```ts
interface AchievementRule {
  key: string;
  evaluate(performances: PlayerPerformance[]): Award[];
}
```

The engine runs all registered rules after each WCL sync. Adding an achievement = adding one rule object.

### Scoring (decided: parse percentile)
- Per raid night, compute each character's **average parse percentile** across boss fights they were present for, per instance.
- Combine SSC + TK into one night score, **weighted by fight count** (a one-boss TK clear shouldn't skew the night).
- **Minimum participation threshold:** present for ≥ 60% of boss kills to be eligible for the top titles.
- Tanks use WCL tank parse, healers HPS parse, DPS damage parse — all on the same 0–100 scale, which is what makes it fair across roles and specs.
- Ties: coin flip for v1 (KISS); ilvl-bracket parse as a later refinement.

### Core weekly titles (per raid night)
| Title | Criterion |
|---|---|
| 🗡️ Deadliest | Top DPS parse |
| ✨ Lifebinder | Top healer parse |
| 🛡️ Immovable Object | Top tank parse |

### Culture-building extras
| Title | Criterion |
|---|---|
| Kick Commander | Most interrupts |
| Cleanse Crusader | Most dispels |
| Floor Inspector | Most deaths (wear it with shame) |
| Iron Man | Zero deaths all night |
| Perfect Attendance | Signup + attendance streaks |
| SR Speedrunner | First to fill both SR sheets |

Awards persist forever → member profiles accumulate a **trophy cabinet**, plus a season leaderboard.

---

## 7. Fun & playful design

- **Class-colored names** everywhere (canonical hex codes).
- Dark UI with **epic-purple and gold** accents; item-quality borders on achievement cards.
- **WoW achievement toast** replica when awards are granted: gold banner, shield icon, fanfare animation (Framer Motion).
- Spec icons on the signup matrix.
- SR completion shown as an **XP-bar style progress bar** ("SR completion: 18/25").
- Hover tooltips styled like in-game item tooltips.
- Tailwind CSS for styling.

---

## 8. Phased implementation plan

### Phase 1 — Foundation (week 1)
- Scaffold Next.js + TypeScript + yarn; Prisma schema + initial migration.
- Discord OAuth via Auth.js; `MEMBER`/`OFFICER` role gate.
- Character registry with self-claim flow.

### Phase 2 — Raid-Helper sync (week 2)
- Raid-Helper adapter + cron sync.
- Raid night list page; signup roster view.

### Phase 3 — Soft-res tracking (weeks 2–3) ← first real value delivery, ship to the guild here
- softres adapter; link-two-sheets flow.
- `CharacterResolver` (exact → insensitive → fuzzy-suggest) + officer resolution queue + alias table.
- SR overview matrix, poke list, "Copy Discord reminder" button.

### Phase 4 — WCL + achievements (weeks 3–4)
- WCL adapter (GraphQL, OAuth2); performance ingestion (multi-report per night).
- Rule engine with the three core titles, then the fun rules.
- Participation threshold + weighted night scoring.

### Phase 5 — Polish
- Achievement toasts; member profiles / trophy cabinets; season leaderboard.
- Discord webhook posting the night's award winners to the guild channel (engagement loop).

---

## 9. Testing strategy

- **Unit tests** for domain services and every achievement rule, using fixture `PlayerPerformance` data (adapters mocked behind their interfaces).
- **One integration test per adapter** against recorded API responses (fixtures checked into the repo).
- Resolver gets dedicated tests for the exact/insensitive/fuzzy tiers and alias handling.

---

## 10. Open items (decide later, low risk)

- Auto-discovery of WCL reports by guild + date (Phase 4 nice-to-have; manual paste is fine for v1).
- Tie-breaking via ilvl-bracket parses.
- Hosting choice (Vercel + managed Postgres vs self-hosted) — architecture supports both; only the cron mechanism differs.