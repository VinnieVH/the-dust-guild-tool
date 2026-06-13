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
        startTime
        endTime
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

// --- Guild-level queries (IGuildSource) ----------------------------------

// One page of the guild's logged-raid attendance history (25/page, newest
// first). Verified live against guild 809103.
export const GUILD_ATTENDANCE = /* GraphQL */ `
  query GuildAttendance($guildId: Int!, $page: Int!) {
    guildData {
      guild(id: $guildId) {
        attendance(page: $page) {
          total
          current_page
          last_page
          has_more_pages
          data {
            code
            startTime
            zone { name }
            players { name presence }
          }
        }
      }
    }
  }
`;

// A report's raid composition (the WCL "Composition" panel data): players
// grouped by role, each with their played spec(s) and item-level range. A JSON
// scalar ({ data: { tanks, dps, healers } }). Needs a time window; we pass the
// report's full range. Verified live against report NYh79GKXvVqMA6rW.
export const REPORT_COMPOSITION = /* GraphQL */ `
  query ReportComposition($code: String!, $startTime: Float!, $endTime: Float!) {
    reportData {
      report(code: $code) {
        playerDetails(startTime: $startTime, endTime: $endTime)
      }
    }
  }
`;

// Live world/region/server speed + progress ranks for one zone.
export const GUILD_ZONE_RANKING = /* GraphQL */ `
  query GuildZoneRanking($guildId: Int!, $zoneId: Int!) {
    guildData {
      guild(id: $guildId) {
        zoneRanking(zoneId: $zoneId) {
          progress {
            worldRank { number }
            regionRank { number }
            serverRank { number }
          }
          speed {
            worldRank { number color }
            regionRank { number }
            serverRank { number }
          }
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
