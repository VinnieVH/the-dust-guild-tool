// GraphQL documents for the Warcraft Logs v2 API. Field selections were built
// against a real recorded report (tests/fixtures/warcraftlogs/), not guessed.
//
// Two-step fetch by design:
//   1) REPORT_META — report zone + boss-kill fights (we need the kill fight ids
//      and per-fight friendlyPlayers before we can ask for anything fight-scoped).
//   2) REPORT_DETAIL — everything scoped to those kill fight ids: parse rankings,
//      the deaths table, and the interrupt/dispel/combatant-info event streams.

export const REPORT_META = /* GraphQL */ `
  query ReportMeta($code: String!) {
    reportData {
      report(code: $code) {
        code
        zone {
          id
          name
        }
        masterData {
          actors(type: "Player") {
            id
            name
            subType
          }
        }
        fights(killType: Encounters) {
          id
          name
          encounterID
          kill
          friendlyPlayers
        }
      }
    }
  }
`;

// Event streams paginate via nextPageTimestamp; we follow it defensively.
export const REPORT_DETAIL = /* GraphQL */ `
  query ReportDetail(
    $code: String!
    $fids: [Int]!
    $startTime: Float!
  ) {
    reportData {
      report(code: $code) {
        rankings(compare: Parses, fightIDs: $fids)
        deaths: table(dataType: Deaths, fightIDs: $fids)
        interrupts: events(
          dataType: Interrupts
          fightIDs: $fids
          startTime: $startTime
          limit: 10000
        ) {
          data
          nextPageTimestamp
        }
        dispels: events(
          dataType: Dispels
          fightIDs: $fids
          startTime: $startTime
          limit: 10000
        ) {
          data
          nextPageTimestamp
        }
        combatantInfo: events(
          dataType: CombatantInfo
          fightIDs: $fids
          startTime: $startTime
          limit: 10000
        ) {
          data
          nextPageTimestamp
        }
      }
    }
  }
`;

// Follow-up page query for a single event stream when nextPageTimestamp is set.
export const EVENTS_PAGE = /* GraphQL */ `
  query EventsPage(
    $code: String!
    $fids: [Int]!
    $dataType: EventDataType!
    $startTime: Float!
  ) {
    reportData {
      report(code: $code) {
        events(
          dataType: $dataType
          fightIDs: $fids
          startTime: $startTime
          limit: 10000
        ) {
          data
          nextPageTimestamp
        }
      }
    }
  }
`;
