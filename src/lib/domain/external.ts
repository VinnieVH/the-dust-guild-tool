import type { Instance, MainRole } from "@/lib/domain/enums";

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
  status: SignupStatus;
}

export interface ExternalReservation {
  /** Raw character name as typed on softres.it (typo-prone). */
  rawName: string;
  itemId: number;
}

export interface ExternalPerformance {
  /** Character name on the WCL report. */
  name: string;
  role: MainRole;
  /** Mean parse percentile across fights present (0-100). */
  parseAvg: number;
  dpsOrHps: number;
  deaths: number;
  interrupts: number;
  dispels: number;
  fightsPresent: number;
}

export interface ExternalReport {
  reportCode: string;
  instance: Instance;
  totalBossFights: number;
  performances: ExternalPerformance[];
}
