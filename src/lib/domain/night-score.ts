import type { MainRole } from "./enums";

// Domain types for night scoring (Step 4.3). A "night" may have several WCL
// reports (a logger DCs, the night splits). Scoring merges a character's
// performances across all of that night's reports into one NightScore.

/** One character's performance within a single WCL report — the scorer's input.
 *  Mirrors PlayerPerformance but is a plain domain shape (no Prisma). The
 *  scorer is fed these from the repository layer, keyed by resolved character. */
export interface ReportPerformance {
  characterId: string;
  characterName: string;
  role: MainRole;
  parseAvg: number;
  deaths: number;
  interrupts: number;
  dispels: number;
  hadFlask: boolean;
  hadFood: boolean;
  hadElixir: boolean;
  fightsPresent: number;
  /** Boss fights in the report this performance came from — the weight for the
   *  parse mean and the denominator contribution for participation. */
  reportBossFights: number;
}

/** A character's merged score across all of one night's reports. */
export interface NightScore {
  characterId: string;
  characterName: string;
  role: MainRole;
  /** Fight-weighted mean parse across the night (0-100). */
  parseAvg: number;
  deaths: number;
  interrupts: number;
  dispels: number;
  /** Consumable presence = OR across reports (had it in any report). */
  hadFlask: boolean;
  hadFood: boolean;
  hadElixir: boolean;
  /** Distinct consumable categories present (0-3) — the Fully Buffed score. */
  consumableCount: number;
  fightsPresent: number;
  /** fightsPresent / total boss fights of the night (0-1). */
  participation: number;
  /** participation >= PARTICIPATION_THRESHOLD — eligible for role crowns. */
  eligible: boolean;
}
