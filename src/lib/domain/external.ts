import type { MainRole } from "@/lib/domain/enums";

// Domain-level DTOs returned by integration adapters. Raw API shapes stay
// inside each adapter's dto.ts/mapper.ts; everything above the adapter layer
// speaks only these types.

// Normalized signup status. Unknown source statuses map to TENTATIVE.
export const SignupStatus = {
  CONFIRMED: "CONFIRMED",
  TENTATIVE: "TENTATIVE",
  ABSENT: "ABSENT",
  BENCH: "BENCH",
} as const;
export type SignupStatus = (typeof SignupStatus)[keyof typeof SignupStatus];

export interface ExternalRaidEvent {
  /** Source event id (Raid-Helper event id). */
  eventId: string;
  title: string;
  /** Event start time. */
  startTime: Date;
}

export interface ExternalSignup {
  /** Discord user id of the person who signed up. */
  discordId: string;
  /** Display name shown in Raid-Helper. */
  name: string;
  /** WoW class, if the source provides one. */
  class: string | null;
  /** Spec the player signed as, if provided. */
  spec: string | null;
  /** Role the player signed up to fill (from Raid-Helper roleName). Null for
   *  absent/bench signups that omit a role. */
  role: MainRole | null;
  status: SignupStatus;
}

export interface ExternalReservation {
  /** Raw character name as typed on softres.it (typo-prone). */
  rawName: string;
  /** Class the reserver picked on softres, if any. */
  rawClass: string | null;
  /** Discord id of the reserver (softres `dId`). The strong link — softres
   *  requires Discord login. Null defensively if a sheet omits it. */
  discordId: string | null;
  /** Item ids this name reserved on the sheet (softres `items`). */
  items: number[];
  /** When the reservation was made (softres `updated`/`created`). */
  reservedAt: Date | null;
}

export interface ExternalPerformance {
  /** Character name on the WCL report. */
  name: string;
  role: MainRole;
  /** Mean parse percentile across fights present (0-100). This is what every
   *  role crown ranks on — fair across roles/specs. */
  parseAvg: number;
  /** Display-only flavor number from the parse ranking's `amount`. NOTE: WCL's
   *  `compare:Parses` amount is damage-biased, so this is ~0 for healers (their
   *  real metric is HPS, not captured here). No achievement scores on it.
   *  Capturing true HPS is deferred to the 4.5 UI (would need a Healing table
   *  query). Don't treat 0 as "did nothing". */
  dpsOrHps: number;
  /** Deaths on boss KILL pulls only. Drives Iron Man + participation scope. */
  deaths: number;
  /** Every death in the whole report (kills + wipes + trash). Floor Inspector
   *  only. Differs a lot from `deaths` on a wipe-heavy night. */
  totalDeaths: number;
  /** Successful interrupts (counted from interrupt events by source). */
  interrupts: number;
  /** Dispels performed (counted from dispel events by source). */
  dispels: number;
  /** Consumable presence (Fully Buffed). True if the player self-applied a
   *  consumable in that category in any boss fight that night — see
   *  docs/achievement-design.md "Consumable detection". */
  hadFlask: boolean;
  hadFood: boolean;
  hadElixir: boolean;
  fightsPresent: number;
}

// One logged raid night from the WCL guild attendance history.
export interface ExternalGuildAttendance {
  /** WCL report code for the night. */
  reportCode: string;
  startTime: Date;
  zone: string;
  /** Character names present (with WCL presence flag). Resolution to User +
   *  alt-dedup happens above the adapter. */
  players: Array<{ name: string; present: boolean }>;
}

// One raider in the guild's composition, derived from a report's WCL
// playerDetails (the role/spec/ilvl panel — who actually raided).
export interface ExternalCompositionMember {
  name: string;
  /** Role WCL classified them as in the report. */
  role: MainRole;
  /** Class name (WCL `type`, e.g. "Druid"). */
  className: string;
  /** Dominant played spec that night (e.g. "Feral"). */
  spec: string;
  /** Best item level seen in the report (WCL maxItemLevel). */
  maxItemLevel: number;
}

// A reference to one of the guild's WCL reports (for auto-discovery): enough to
// decide whether to ingest it, without fetching its full detail.
export interface ExternalGuildReportRef {
  reportCode: string;
  startTime: Date;
  zone: string;
}

// Live guild standing for one zone (display-only).
export interface ExternalZoneRanking {
  zoneId: number;
  zoneName: string;
  speedWorldRank: number | null;
  speedRegionRank: number | null;
  speedServerRank: number | null;
  /** WoW item-quality tier of the speed rank ("rare", "epic"…) for theming. */
  speedColor: string | null;
  progWorldRank: number | null;
  progRegionRank: number | null;
  progServerRank: number | null;
}

export interface ExternalReport {
  reportCode: string;
  /** WCL zone name as reported by the API (e.g. "Serpentshrine Cavern",
   *  "Karazhan"). A free string — the guild raids any TBC instance. */
  zone: string;
  totalBossFights: number;
  /** Clear duration in ms (report end - start) — the New Speed Record metric. */
  clearMs: number;
  performances: ExternalPerformance[];
}
