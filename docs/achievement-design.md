# Achievement Design — "Everyone Can Shine"

**Date:** 2026-06-12
**Status:** proposal for sign-off. No rule code is written yet — we lock the set here first.
**Companion to:** `docs/implementation-plan.md` Phase 4.4, `docs/plans/2026-06-11-guild-tool-design.md` §6.

## Guiding principle

> A fun environment where **everyone can shine at something every raid** — not
> just the top parsers. The point is engagement, not a meritocracy ladder.

**All-positive default (2026-06-13):** no award ever labels someone "worst". Every
award names only a *winner* or a threshold *reached*; the one banter award fires
only on a genuine outlier and is usually not given. We do not want a toxic
call-out culture, so the data is used to *celebrate*, never to rank-shame.

So the set is organized by **who an award lets shine**, not by how easy it is to
build. Four buckets:

1. **Per-role winners** — a healer never loses to a DPS; each role has its own
   crown. The skill awards, made fair.
2. **Effort & diligence** — reward showing up *prepared and present*: consumables,
   attendance. **The heart of "everyone can shine"** — a mediocre parser with
   perfect flask discipline still gets a trophy.
3. **Utility heroes** — reward *paying attention* (interrupts, dispels), not raw
   output. Only ever names winners.
4. **Affectionate banter** — Floor Inspector, but **outlier-gated, not
   most-deaths** (see Bucket 3). Fun *only when it's genuinely a story*, never a
   verdict on whoever happened to be highest.

Every award below has: **criterion · min threshold · tie rule · who it lets shine ·
data confidence**.

Tie rule (default, from the plan): deterministic seeded coin-flip keyed by
`raidNightId + achievementKey` so re-runs pick the same winner. Noted per-row only
where it differs.

---

## What WCL actually gives us (verified against report `NYh79GKXvVqMA6rW`)

Probed a real SSC/TK clear (11 boss kills, 25-30 players). Findings:

| Data | Where in WCL v2 | Confidence |
|---|---|---|
| Parse percentile per player per fight, **already split into tanks/healers/dps** | `report.rankings(compare:Parses, fightIDs:[...])` → `data[fight].roles.{tanks,healers,dps}.characters[].rankPercent` | ✅ solid — role is given by WCL, no inference |
| DPS / HPS amount | same `characters[].amount`, or `table(dataType:DamageDone/Healing).entries[].total` + `activeTime` | ✅ solid |
| Deaths (per player, with timestamp, killing blow, overkill) | `table(dataType:Deaths).entries[]` — one row **per death event** (count by name) | ✅ solid |
| Fights present (participation) | `fights(killType:Encounters)[].friendlyPlayers` (actor ids) + `masterData.actors` name map | ✅ solid |
| Zone name | `report.zone.name` (this report = `"SSC / TK"`, a combined zone) | ✅ solid — confirms the free-string `zone` column was the right call |
| **Consumables** (flasks, elixirs, food/"Well Fed") | `events(dataType:CombatantInfo)` → per-player `auras[]` at each boss-fight start; filter to **self-applied** (`aura.source === event.sourceID`) **AND** a curated consumable-GUID allowlist | ✅ **confirmed** — see "Consumable detection" below. Naive aura-counting would wrongly reward raid buffs; the allowlist + self-source filter fixes it. |
| **Interrupts (successful, per player)** | `events(dataType:Interrupts, fightIDs)` — each event carries `sourceID` (who kicked). Count by source. | ✅ **confirmed** — gives exact successful-interrupt counts per player (verified: Kyrem 4, etc.). The `table` shape was the wrong one; the **events** shape is right. |
| **Dispels (per player)** | `events(dataType:Dispels, fightIDs)` — each event carries `sourceID`. Count by source. | ✅ **confirmed** — verified per-player counts (Nozpally 4, etc.). |
| **Totem twisting** | per-player `casts.abilities[]` shows totem casts, but "twisting" = rapid Windfury/Grace-of-Air recast cadence — a heuristic on cast frequency/timing | ❌ hard & fragile — only some shamans twist; n=1 fixture can't validate a cadence threshold. **Deferred.** |

**Correction to the implementation plan (now resolved):** the plan listed Kick
Commander (interrupts) and Cleanse Crusader (dispels) as easy. The obvious
`table(dataType:Interrupts/Dispels)` shape counts the **interrupted/dispelled
ability**, not who did it — so it's the wrong table. The
**`events(dataType:Interrupts/Dispels)`** shape carries `sourceID` and gives clean
per-player **successful** counts. Both confirmed buildable and **pulled into the
ship-now set** per sign-off.

### Consumable detection (Fully Buffed) — the non-obvious part

`CombatantInfo.auras[]` lists **every** buff a player had at pull start — most of
which are **raid buffs cast by others** (Arcane Brilliance, Greater Blessings,
Battle Shout). Counting auras would make "Fully Buffed" = "got buffed by the raid,"
which everyone has equally — the *opposite* of a diligence signal. Two filters,
both required:

1. **Self-applied:** keep only `aura.source === event.sourceID`. (Drops others'
   blessings/shouts/intellect — but **not** class self-buffs like Mage Armor or
   stances, which is why filter 2 is also needed.)
2. **Curated consumable-GUID allowlist** in `domain/wow.ts` — built from real GUIDs
   observed in the fixture. Categories:
   - **Flask:** 28518 (Fortification), 28519 (Mighty Restoration), 28520
     (Relentless Assault), 28521 (Blinding Light), 28540 (Pure Death), 17626
     (Distilled Wisdom-era), …
   - **Battle/Guardian elixir:** 17538 (Mongoose), 28491 (Healing Power), 28497
     (Mighty Agility), 28503 (Major Shadow Power), 33721 (Spellpower), 33726
     (Mastery), 39625 (Major Fortitude), 39627 (Draenic Wisdom), 11371 (Gift of
     Arthas), 17627 (Distilled Wisdom), …
   - **Food:** all "Well Fed" GUIDs (33256/33257/33261/33263/33268/35272/43764/…)
   - **Misc:** 28714 (Flame Cap)

   (The allowlist is curated domain knowledge, like the class colors — it lives in
   `wow.ts`, and the adapter mapper does the classification. The DTO carries only
   the **result**, never raw auras.)

**Scoring (presence, per sign-off):** booleans `hadFlask`, `hadFood`, `hadElixir`
— true if the player had a consumable in that category in **any boss fight that
night**. The Fully Buffed score is the count of true categories (0–3). Booleans (not
a bare count) so the toast can name what someone brought *or forgot* ("showed up
with no flask"). Tie → seeded coin-flip.

**Pagination note:** `events` returns `nextPageTimestamp`; it was `null` for a full
11-boss night (250 CombatantInfo events on one page). The adapter still follows
`nextPageTimestamp` defensively so a very long pull can't silently undercount.

---

## Proposed set

### Bucket 1 — Per-role winners (skill, made fair)

| Award | Criterion | Min threshold | Who shines | Confidence |
|---|---|---|---|---|
| 🗡️ **Deadliest** | Highest mean DPS parse % across the night | participation ≥ **75%** of boss kills | best DPS | ✅ |
| ✨ **Lifebinder** | Highest mean HPS parse % | participation ≥ **75%** | best healer | ✅ |
| 🛡️ **Immovable Object** | Highest mean tank parse % | participation ≥ **75%** | best tank | ✅ |

These are the only "top performer" awards. Each is **role-locked**, so the three
roles never compete with each other. Parse %, not raw numbers, so gear/spec
differences are normalized (WCL's whole point).

### Bucket 2 — Effort & diligence (the heart of it)

| Award | Criterion | Min threshold | Who shines | Confidence |
|---|---|---|---|---|
| 🧪 **Fully Buffed** | Highest consumable score = count of categories present (flask / battle elixir / food) | must have ≥ 1 category (the unprepared can't *win*, but still raid) | the diligent prepper, *any* role/skill | ✅ **confirmed** |
| 🔥 **Attendance Streak** | Consecutive logged raid nights attended, **counted per person (User)** | milestone thresholds (5/10/20…) award; the live count is a stat | the reliable regular | ✅ **confirmed** (see Attendance below) |
| 🥇 **Iron Man** | Zero deaths all night | participation ≥ **75%**; **can award multiple** (everyone who qualifies) | the careful, *any* role | ✅ |

`Fully Buffed` is the single best "everyone can shine" award: a 40th-percentile
parser who brought flask + food + elixir beats a top parser who forgot consumes.
Scored by **presence** (per sign-off) — see "Consumable detection" above for the
self-source + allowlist filtering that makes it honest.

#### Attendance Streak (replaces the old "Perfect Attendance") — signed off 2026-06-13

The metric is a **streak**: how many raids in a row a person joined without
missing. Two surfaces, split exactly like guild rank-vs-record:

- **Current streak ("🔥 7 in a row")** — a live profile **stat**, recomputed each
  sync. Display-only (it moves over time, so it cannot be a frozen award).
- **Streak milestones (5 / 10 / 20 / … in a row)** — the **awardable** part:
  granted on the raid night the threshold was crossed, kept forever. Maps to that
  `RaidNight`. Matches the all-positive culture.

**Source = WCL guild attendance API**, `guildData.guild.attendance` (probed live:
49 nights of history for The Dust, paginated 25/page, newest first; each night has
`code`, `startTime`, `zone`, `players[].name`, `players[].presence`). This is
broader than per-report presence — it covers **every logged night automatically**,
no officer pasting reports.

**25-man only (binding — signed off 2026-06-13).** We are a 25-man guild; 10-man
side-content (Karazhan, Zul'Aman) runs in separate groups and MUST NOT count. The
streak chronology is filtered to 25-man zones (`is25ManZone` in `wow.ts`,
allowlist: SSC/TK, Gruul/Mag, BT/Hyjal) BEFORE computing — otherwise a 25-man
regular's streak breaks on every Kara night they skip, and a Kara-only attendee
earns a streak they shouldn't. Live impact: the feed's 49 nights drop to 22
counted (Kara was 27 of them). The milestone recompute is **authoritative** — it
wipes `streak_milestones` and re-derives each run, so milestones inflated by the
old Kara-inclusive count are corrected, not grandfathered.

**Where the filter lives (filter generators, never readers — binding).** There are
exactly THREE award generators, and all three filter to 25-man at their data source:
1. **Per-night engine** — `getNightPerformances` drops non-25-man reports per-REPORT
   (a mixed SSC+Kara night still scores its SSC half). Covers every per-night
   achievement: crowns, iron-man, fully-buffed, clean-sweep, well-oiled.
2. **Speed records** — `computeSpeedRecords` filters `is25ManZone` at compute time.
3. **Attendance streaks** — chronology filtered before `computeStreak` (above).

Plus the ingest guard in `syncWclReport` rejects non-25-man reports at the door.
Award **readers** (`getLeaderboard`, `getProfile`, `getNightResults`,
`getSpeedRecordNights`) deliberately do NOT filter — they're multiple views of the
same rows, so filtering one but not its siblings would create inconsistency.
Because every generator's source is 25-man, every reader is clean by construction.
(Bonus: the engine's scoped delete is self-healing — re-running it on a hypothetical
pre-existing Kara night deletes its stale per-night awards.)

**Counted per User, NOT per character (binding — the alt rule).** WCL attendance
is keyed by character *name*, so an alt is a separate row. The streak engine
**resolves each `players[].name` → `Character` → `User`** and counts presence per
User, so a main + alt are one person's streak (see the cross-cutting Alts section).
Unclaimed/unresolvable names are orphaned (can't credit a person we don't know) —
same limitation as elsewhere.

**Definitions (stated, not asked — sound defaults):**
- A "raid" in the streak = a **logged** guild raid night (an attendance entry).
  The streak is "consecutive *logged* nights attended", not "every raid that ever
  happened" — an unlogged night is invisible, which is acceptable and documented.
- A "miss" = a counted night where the User was absent. Current streak = the run of
  most-recent consecutive attended nights. Only **25-man** raid nights count (see the
  25-man-only rule above); 10-man side-content is filtered out before counting.

**Determinism (shares the New Speed Record rule):** current-streak and
milestone-crossing are a **pure function of presence ordered by raid DATE**, not
ingestion order. Recompute from full history every time; never incrementally
mutate. Backfill / out-of-order ingest must yield identical streaks.

### Bucket 3 — Affectionate banter (outlier-gated, NOT a "worst" ranking)

> **Culture decision (2026-06-13, binding).** The guild explicitly wants an
> **all-positive default** — no one should ever be algorithmically labelled
> "worst". So the only banter award, Floor Inspector, is **NOT** "most deaths".
> It is an **outlier-only** award: it fires *only* when one player's deaths are a
> genuine comedic outlier, and otherwise **is not given at all**. A clean or
> normal night produces no Floor Inspector. This is what keeps it fun (it only
> ever lands when it's actually a story) instead of toxic (it never just points
> at whoever happened to be highest on a good night). Do **not** "simplify" this
> later into a plain most-deaths award — that change reintroduces the call-out
> the guild asked to avoid.

| Award | Criterion | Gate | Who shines | Confidence |
|---|---|---|---|---|
| 💀 **Floor Inspector** | One player's death count is a clear outlier | deaths ≥ 3 **and** ≥ 2× the runner-up's deaths; else **no award** | affectionate ribbing; only ever a genuine "the floor missed you" night | ✅ |

The outlier gate (≥3 absolute **and** ≥2× runner-up) means: a 2-vs-1 night never
triggers it; it takes a real outlier. Death data is rich (killing blow, the boss
that did it) so the *single* toast can be a specific, funny story rather than a
leaderboard. At most one Floor Inspector per night, often zero.

### Bucket 3b — Utility heroes (pulled into ship-now per sign-off)

| Award | Criterion | Min threshold | Who shines | Confidence |
|---|---|---|---|---|
| 👢 **Kick Commander** | Most successful interrupts in the night | min 1 interrupt | the attentive interrupter (often a rogue/warrior/shaman, *not* a top parser) | ✅ confirmed |
| 🧼 **Cleanse Crusader** | Most dispels in the night | min 1 dispel | the support player watching debuffs | ✅ confirmed |

Both reward *paying attention* over raw output — squarely "everyone can shine."

### Bucket 4 — Deferred (not in this phase)

| Award | Criterion | Why deferred |
|---|---|---|
| 🌀 **Totem Twister** | Best Windfury/Grace twisting cadence | heuristic; fragile; only some shamans do it; can't validate on n=1 |
| ⚡ **SR Speedrunner** | First to reserve on all of a night's sheets | needs reservation `createdAt`; softres-side, not WCL — a separate small migration |

---

## Locked set (signed off 2026-06-12)

**9 awards build this phase:**

| Bucket | Awards |
|---|---|
| Per-role winners (≥75% participation) | 🗡️ Deadliest · ✨ Lifebinder · 🛡️ Immovable Object |
| Effort & diligence | 🧪 Fully Buffed (presence) · 🔥 Attendance Streak (milestones) · 🥇 Iron Man (≥75%, multi) |
| Utility heroes | 👢 Kick Commander · 🧼 Cleanse Crusader |
| Affectionate banter (outlier-gated) | 💀 Floor Inspector |

**Settled decisions:**
- **All-positive default (2026-06-13).** 8 of the 9 awards only ever name a
  *winner* — no award produces a "worst" label. The lone banter award (Floor
  Inspector) is **outlier-gated**, not most-deaths, and is frequently *not*
  awarded. See Bucket 3 culture note — binding.
- **Participation threshold = 75%** for the per-role crowns and Iron Man.
- **Fully Buffed = presence** — booleans `hadFlask`/`hadFood`/`hadElixir`, score =
  count of true categories, min 1 to win. Self-source + curated GUID allowlist.
- **Attendance = streak, counted per User** (not character). Current streak is a
  live stat; milestones (5/10/20…) are the awards. Source = WCL guild attendance
  API. See the Attendance Streak section — binding.
- **Floor Inspector gate:** deaths ≥ 3 **and** ≥ 2× the runner-up; else no award.
- All ties → seeded coin-flip (`raidNightId + achievementKey`).
- **Deferred:** Totem Twister, SR Speedrunner.

**DTO impact:** `ExternalPerformance` already has `interrupts`/`dispels`. Add
`hadFlask`, `hadFood`, `hadElixir` (booleans). `PlayerPerformance` (schema) gains
the same three columns. Everything else (`parseAvg`, `dpsOrHps`, `deaths`,
`fightsPresent`, `role`) already exists.

---

## Guild achievements + live rank (signed off 2026-06-13)

> The guild wanted two things: **collective achievements** ("a raid where we
> parsed very high", "we broke our last speed record") that **everyone present
> earns**, and **our rank on speed clears** to be **visible**. These are TWO
> different mechanisms — conflating them is a trap (see below).

### The split: awardable per-night facts vs. a live cumulative stat

| | Per-night guild achievements | Live guild standing |
|---|---|---|
| Example | "New SSC Speed Record", "Clean Sweep" | "Server #45 on SSC speed" |
| Nature | An immutable fact about **one night** | A **moving, cumulative** number across all our reports, that changes when *other* guilds log |
| Surfaced as | **Awarded** to every present member (trophy) + a guild banner | **Displayed** on a guild/dashboard page, refreshed each sync |
| Earned? | Yes — "everyone who was there gets it" | **No** — nobody earns a rank; it's a stat |

**Why rank is NOT an award:** `zoneRanking.speed.serverRank` (e.g. 45) reflects our
all-time best vs. every other guild and drifts over time. Stamping it on a night's
attendee profiles would (a) freeze a number that's wrong next week and (b)
misattribute a cumulative-history stat to one night's roster. So rank is a
**dashboard stat**, displayed only.

### Data probe (verified live against guild "The Dust", id 809103)

`guildData.guild(id).zoneRanking(zoneId)` returns, per zone, **`speed`** and
**`progress`**, each with `worldRank`/`regionRank`/`serverRank` `{ number, color }`.
For us, SSC/TK speed = world #363, region #204, **server #45** (`color: "rare"` —
usable as an item-quality theme tier). One cheap query per zone; **no scraping
other guilds**. TBC Classic zone ids resolve directly: Karazhan **1007**,
Gruul/Mag **1008**, SSC/TK **1010**/**1056**, BT/Hyjal **1011**, ZA **1012**. The
report's own `zone.id` tells us which to query.

### Per-night guild achievements (awardable, reuse existing `AchievementAward`)

Awarded to **every member present ≥ 75%** of the night's boss kills (reusing the
`friendlyPlayers` presence already built). One `AchievementAward` row per attendee
with `Achievement.category = "guild"`. **No new award schema** — same
(achievementId, characterId, raidNightId) shape.

| Award | Criterion | Notes |
|---|---|---|
| 🏆 **New Speed Record** | This night's clear time beats our prior best for that zone | **Internal PB** — see determinism rule. "Was a PB when it happened" (immutable). |
| 🧹 **Clean Sweep** | All of the zone's bosses killed this night (full clear) | from kill fights vs. zone encounter count |
| ⚙️ **Well-Oiled Machine** | Raid-average `parseAvg` over a threshold (e.g. ≥ 80) | celebrates a high-execution night, collectively |

**Clear-time metric (defined):** WCL `speed` is per *zone* (SSC/TK is one combined
clear, not per-instance). Duration = report-level `endTime − startTime` (whole-run
wall clock). Requires adding `startTime`/`endTime` to the `REPORT_META` query (a
small adapter change; currently unselected).

**PB determinism rule (binding for the 4.4 engine):** "New Speed Record" must be a
**pure function of this night's clear time vs. every raid night chronologically
before it by RAID DATE** (not ingestion order). This keeps the
delete-and-re-award engine deterministic and correct even if reports are ingested
out of order or backfilled. Semantics = **"was a record when it happened"**: the
badge is kept forever even after a later night beats it (matches the all-positive
culture; also order-independent — a later faster night doesn't strip an earlier
badge).

### Live standing (display-only)

New small table (e.g. `guild_zone_rankings`): one row per `zoneId`, storing latest
`speedWorldRank/RegionRank/ServerRank` (+ `color`) and `progress*` ranks, plus
`fetchedAt`. Refreshed by the sync. Shown on a guild/dashboard page. **Optional
flavor:** a non-awarded "new best server rank!" callout on the dashboard when a
refresh improves a rank — celebratory without stamping profiles.

**Deferred consciously:** per-encounter rank detail; rank history/sparklines.

---

## New WCL adapter surface needed (build notes)

The current `IPerformanceSource.fetchReport` is per-report. Guild rank +
attendance are **guild-level**, not report-level, so the adapter grows two new
methods (likely a new port, e.g. `IGuildSource`, to keep `IPerformanceSource`
focused — decide at build time):

- `fetchZoneRanking(guildId, zoneId)` → `{ speed, progress }` world/region/server
  ranks (+ `color`). Feeds the `guild_zone_rankings` display table.
- `fetchAttendance(guildId)` → paged list of `{ code, startTime, zone, players:
  [{ name, presence }] }` (25/page; follow `total`). Feeds the per-User streak.

Both need the **guild id** (`809103` for The Dust). Source it from a report's
`report.guild.id` on first WCL ingest, or an env/config value — decide at build
time (env config is simplest and avoids a chicken-and-egg on first sync).

Also: add report-level `startTime`/`endTime` to `REPORT_META` for clear duration
(the New Speed Record metric).
