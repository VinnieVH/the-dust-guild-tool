// Raw Warcraft Logs v2 GraphQL response shapes. These mirror exactly what the
// API returns (recorded in tests/fixtures/warcraftlogs/); the mapper turns them
// into domain ExternalReport. Several fields come back as opaque JSON scalars
// (rankings, table, events.data) — typed as the structures actually observed.

export interface WclActor {
  id: number;
  name: string;
  /** e.g. "Warrior", "Druid" — WCL's class for the actor. */
  subType: string;
}

export interface WclFight {
  id: number;
  name: string;
  encounterID: number;
  kill: boolean;
  /** Actor ids of friendly players present for this fight. */
  friendlyPlayers: number[];
}

export interface WclReportMeta {
  reportData: {
    report: {
      code: string;
      zone: { id: number; name: string } | null;
      masterData: { actors: WclActor[] };
      fights: WclFight[];
    } | null;
  };
}

// --- rankings(compare: Parses) is a JSON scalar: array, one per fight ---
export interface WclRankedCharacter {
  id: number;
  name: string;
  class: string;
  spec: string;
  /** DPS/HPS amount for the fight. */
  amount: number;
  /** The parse percentile (0-100). */
  rankPercent: number;
}

export interface WclFightRanking {
  fightID: number;
  encounter: { id: number; name: string };
  roles: {
    tanks?: { characters: WclRankedCharacter[] };
    healers?: { characters: WclRankedCharacter[] };
    dps?: { characters: WclRankedCharacter[] };
  };
}

// --- table(dataType: Deaths) is a JSON scalar ---
export interface WclDeathEntry {
  name: string;
  id: number;
  /** Actor id this death belongs to. */
  fight: number;
}

export interface WclDeathsTable {
  data: { entries: WclDeathEntry[] };
}

// --- events(...).data is a JSON scalar: array of event rows ---
export interface WclInterruptEvent {
  type: string;
  sourceID: number;
  fight: number;
}

export interface WclDispelEvent {
  type: string;
  sourceID: number;
  fight: number;
  isBuff?: boolean;
}

export interface WclAura {
  /** Actor id that applied the aura (self === consumable, other === raid buff). */
  source: number;
  /** Ability GUID — matched against the consumable allowlist. */
  ability: number;
  name: string;
}

export interface WclCombatantInfoEvent {
  sourceID: number;
  fight: number;
  auras?: WclAura[];
}

export interface WclEventStream<T> {
  data: T[];
  nextPageTimestamp: number | null;
}

// --- Guild attendance + zone ranking (IGuildSource) ---

export interface WclAttendancePlayer {
  name: string;
  /** WCL presence flag: 1 = present (2 = present-but-partial in some data). */
  presence: number;
}

export interface WclAttendanceNight {
  code: string;
  /** Epoch ms. */
  startTime: number;
  zone: { name: string } | null;
  players: WclAttendancePlayer[];
}

export interface WclGuildAttendance {
  guildData: {
    guild: {
      attendance: {
        total: number;
        current_page: number;
        last_page: number;
        has_more_pages: boolean;
        data: WclAttendanceNight[];
      };
    } | null;
  };
}

interface WclRankNumber {
  number: number | null;
  color?: string | null;
}

export interface WclGuildZoneRanking {
  guildData: {
    guild: {
      zoneRanking: {
        progress: {
          worldRank: WclRankNumber;
          regionRank: WclRankNumber;
          serverRank: WclRankNumber;
        } | null;
        speed: {
          worldRank: WclRankNumber;
          regionRank: WclRankNumber;
          serverRank: WclRankNumber;
        } | null;
      } | null;
    } | null;
  };
}

export interface WclReportDetail {
  reportData: {
    report: {
      rankings: { data: WclFightRanking[] };
      deaths: WclDeathsTable;
      interrupts: WclEventStream<WclInterruptEvent>;
      dispels: WclEventStream<WclDispelEvent>;
      combatantInfo: WclEventStream<WclCombatantInfoEvent>;
    } | null;
  };
}
