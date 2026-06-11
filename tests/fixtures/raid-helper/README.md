# Raid-Helper fixtures

Recorded from the live Raid-Helper API v4 (`https://raid-helper.xyz/api/v4`)
against the guild's test event. Used by `tests/integration/raid-helper-mapper.test.ts`.

| File | Endpoint | Notes |
|---|---|---|
| `events.json` | `GET /servers/{serverId}/events` | Paginated list; events under `postedEvents`. |
| `event.json` | `GET /events/{eventId}` | Baseline: 17 signups, all attending (`status: "primary"`). |
| `event-absence.json` | `GET /events/{eventId}` | Same event after "Skreamo" set to Absence. |

## Key shape findings

- **Attendance lives in `className`, not `status`.** `status` stays `"primary"`
  even for an Absence. The template's `classes` array lists `Late`, `Bench`,
  `Tentative`, `Absence` as pseudo-classes alongside real WoW classes.
- A non-attending signup omits `specName`/`roleName`.
- `className: "Tank"` is a *role* signup, not a class.
- Specs may carry a trailing digit (`Holy1`, `Protection1`) to disambiguate
  same-named specs across classes — display-only, stripped by the mapper.
