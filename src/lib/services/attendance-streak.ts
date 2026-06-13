import { STREAK_MILESTONES } from "@/lib/domain/constants";
import { streakKey } from "@/lib/domain/achievements";

// Attendance streaks — a history-recompute pass (like speed records), NOT the
// per-night engine. Counts CONSECUTIVE logged raid nights a USER attended.
//
// This module is the PURE core: it takes per-User per-night presence booleans
// (already resolved + alt-deduped by the feeding layer) and computes the
// current streak (a stat) and which milestones were crossed (awards). The
// impure feeding layer (name→Character→User resolution, alt dedup) lives in the
// repository/service that calls this — see docs/achievement-design.md.

/** One night in the chronology, already ordered by the caller (date, then
 *  reportCode). Keyed by the WCL attendance report code — the streak runs on
 *  the WCL attendance spine, not raid_nights. */
export interface StreakNight {
  reportCode: string;
  /** True if the User attended this night on ANY owned character (alt-deduped
   *  upstream). */
  present: boolean;
}

export interface StreakResult {
  /** Trailing run of attended nights up to the most recent night (the live
   *  stat shown on a profile). */
  currentStreak: number;
  /** Milestones the User has earned, each with the WCL report code of the night
   *  it was first reached. Never revoked (assumes append-only attendance — a
   *  deliberate choice). */
  milestones: Array<{ achievementKey: string; crossedReportCode: string }>;
}

/**
 * Compute a single User's streak result over their full night chronology.
 * `nights` MUST be ordered oldest → newest by the caller.
 */
export function computeStreak(nights: StreakNight[]): StreakResult {
  // Forward walk: running count, award each milestone the first night the count
  // reaches it. Bounding a run by an absence is never a penalty — a late joiner
  // simply has absences before they existed, which start their run cleanly.
  const milestones: Array<{ achievementKey: string; crossedReportCode: string }> = [];
  const awarded = new Set<number>();
  let run = 0;
  for (const night of nights) {
    if (night.present) {
      run += 1;
      for (const m of STREAK_MILESTONES) {
        if (run >= m && !awarded.has(m)) {
          awarded.add(m);
          milestones.push({ achievementKey: streakKey(m), crossedReportCode: night.reportCode });
        }
      }
    } else {
      run = 0;
    }
  }

  // Current streak = trailing run (walk from the end until the first absence).
  let currentStreak = 0;
  for (let i = nights.length - 1; i >= 0; i--) {
    if (nights[i].present) currentStreak += 1;
    else break;
  }

  return { currentStreak, milestones };
}
