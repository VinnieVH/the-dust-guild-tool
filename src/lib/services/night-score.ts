import { PARTICIPATION_THRESHOLD } from "@/lib/domain/constants";
import { MainRole } from "@/lib/domain/enums";
import type { NightScore, ReportPerformance } from "@/lib/domain/night-score";

// Step 4.3 — night scoring. Pure: merges a character's performances across all
// of a night's WCL reports into one NightScore. No IO, no Prisma.
//
// Weighting: a character's parse for the night is the mean of their per-report
// parses weighted by fightsPresent — a 1-boss report shouldn't count as much as
// a 6-boss one. Participation = total fights present / total boss fights of the
// night, and gates eligibility for the per-role crowns at 75%.

/** Total boss fights of the night = sum across the night's reports. Reports are
 *  non-overlapping segments of a night, so summing their boss-fight counts is
 *  the right denominator. Caller passes the per-report boss-fight totals. */
export function nightBossFights(reportBossFights: number[]): number {
  return reportBossFights.reduce((a, b) => a + b, 0);
}

function dominantRole(perfs: ReportPerformance[]): MainRole {
  // Weight role by fights so a one-fight off-spec stint doesn't flip the night.
  const weight = new Map<MainRole, number>();
  for (const p of perfs) {
    weight.set(p.role, (weight.get(p.role) ?? 0) + p.fightsPresent);
  }
  const order: MainRole[] = [MainRole.TANK, MainRole.HEALER, MainRole.DPS];
  let best: MainRole = MainRole.DPS;
  let bestW = -1;
  for (const role of order) {
    const w = weight.get(role) ?? 0;
    if (w > bestW) {
      best = role;
      bestW = w;
    }
  }
  return best;
}

/**
 * Score one night for every character that appears in its reports.
 *
 * @param performances every report-performance for the night, across all reports
 * @param totalBossFights the night's total boss fights (see nightBossFights)
 */
export function scoreNight(
  performances: ReportPerformance[],
  totalBossFights: number,
): NightScore[] {
  // Group by character.
  const byCharacter = new Map<string, ReportPerformance[]>();
  for (const p of performances) {
    const list = byCharacter.get(p.characterId);
    if (list) list.push(p);
    else byCharacter.set(p.characterId, [p]);
  }

  const scores: NightScore[] = [];
  for (const perfs of byCharacter.values()) {
    const fightsPresent = perfs.reduce((a, p) => a + p.fightsPresent, 0);

    // Fight-weighted parse mean. If somehow no fights, fall back to a plain mean
    // so we never divide by zero.
    const weightTotal = fightsPresent;
    const parseAvg =
      weightTotal > 0
        ? perfs.reduce((a, p) => a + p.parseAvg * p.fightsPresent, 0) / weightTotal
        : perfs.reduce((a, p) => a + p.parseAvg, 0) / perfs.length;

    const hadFlask = perfs.some((p) => p.hadFlask);
    const hadFood = perfs.some((p) => p.hadFood);
    const hadElixir = perfs.some((p) => p.hadElixir);

    const participation =
      totalBossFights > 0 ? fightsPresent / totalBossFights : 0;

    scores.push({
      characterId: perfs[0].characterId,
      characterName: perfs[0].characterName,
      role: dominantRole(perfs),
      parseAvg,
      deaths: perfs.reduce((a, p) => a + p.deaths, 0),
      totalDeaths: perfs.reduce((a, p) => a + p.totalDeaths, 0),
      interrupts: perfs.reduce((a, p) => a + p.interrupts, 0),
      dispels: perfs.reduce((a, p) => a + p.dispels, 0),
      hadFlask,
      hadFood,
      hadElixir,
      consumableCount: [hadFlask, hadFood, hadElixir].filter(Boolean).length,
      fightsPresent,
      participation,
      // Cap at 1: overlapping reports could push fightsPresent slightly over the
      // denominator; eligibility should never be denied by an artifact > 100%.
      eligible: Math.min(participation, 1) >= PARTICIPATION_THRESHOLD,
    });
  }

  return scores;
}
