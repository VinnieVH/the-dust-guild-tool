import { consumableCategory } from "@/lib/domain/consumables";
import { MainRole } from "@/lib/domain/enums";
import type { ExternalPerformance, ExternalReport } from "@/lib/domain/external";
import type {
  WclCombatantInfoEvent,
  WclDispelEvent,
  WclInterruptEvent,
  WclRankedCharacter,
  WclReportDetail,
  WclReportMeta,
} from "./dto";

// Maps raw WCL DTOs -> domain ExternalReport. Keyed by character NAME (the
// cross-integration linking key). Pure: no IO, fully unit-testable against the
// recorded fixture.

interface RoleSample {
  role: MainRole;
  rankPercent: number;
  amount: number;
}

// Per-character accumulator while we fold the rankings.
interface Accumulator {
  name: string;
  samples: RoleSample[];
}

const ROLE_BY_BUCKET = {
  tanks: MainRole.TANK,
  healers: MainRole.HEALER,
  dps: MainRole.DPS,
} as const;

/** Most-frequent role across a player's fights; ties broken TANK > HEALER > DPS
 *  (deterministic). A player who tanked most fights is a tank for the night. */
function dominantRole(samples: RoleSample[]): MainRole {
  const counts = new Map<MainRole, number>();
  for (const s of samples) counts.set(s.role, (counts.get(s.role) ?? 0) + 1);
  const order: MainRole[] = [MainRole.TANK, MainRole.HEALER, MainRole.DPS];
  let best: MainRole = MainRole.DPS;
  let bestN = -1;
  for (const role of order) {
    const n = counts.get(role) ?? 0;
    if (n > bestN) {
      best = role;
      bestN = n;
    }
  }
  return best;
}

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function mapReport(
  meta: WclReportMeta,
  detail: WclReportDetail,
): ExternalReport {
  const report = meta.reportData.report;
  const detailReport = detail.reportData.report;
  if (!report || !detailReport) {
    throw new Error("WCL report not found in response");
  }

  const killFights = report.fights.filter((f) => f.kill);
  const totalBossFights = killFights.length;

  // actor id -> name (for joining the deaths/event/consumable streams).
  const nameById = new Map<number, string>();
  for (const a of report.masterData.actors) nameById.set(a.id, a.name);

  // True presence = how many BOSS KILLS a player was actually in the raid for
  // (from each kill fight's friendlyPlayers), NOT how many fights they posted a
  // parse on. These differ — a healer/backup present but unranked on a fight is
  // present but not parsed. participation = fightsPresent / totalBossFights, and
  // the 75% eligibility gate (achievement-design.md) depends on this being
  // presence, so we count it from friendlyPlayers, not the rankings.
  const presenceByActor = new Map<number, number>();
  for (const f of killFights) {
    for (const actorId of f.friendlyPlayers) {
      presenceByActor.set(actorId, (presenceByActor.get(actorId) ?? 0) + 1);
    }
  }

  // --- Fold rankings into per-character accumulators (keyed by name) ---
  const accByName = new Map<string, Accumulator>();

  const ingestCharacter = (
    bucket: keyof typeof ROLE_BY_BUCKET,
    c: WclRankedCharacter,
  ) => {
    let acc = accByName.get(c.name);
    if (!acc) {
      acc = { name: c.name, samples: [] };
      accByName.set(c.name, acc);
    }
    acc.samples.push({
      role: ROLE_BY_BUCKET[bucket],
      rankPercent: c.rankPercent,
      amount: c.amount,
    });
  };

  for (const ranking of detailReport.rankings.data) {
    for (const bucket of ["tanks", "healers", "dps"] as const) {
      const chars = ranking.roles[bucket]?.characters ?? [];
      for (const c of chars) ingestCharacter(bucket, c);
    }
  }

  // --- Count deaths by character name ---
  const deathsByName = new Map<string, number>();
  for (const d of detailReport.deaths.data.entries) {
    deathsByName.set(d.name, (deathsByName.get(d.name) ?? 0) + 1);
  }

  // --- Count successful interrupts/dispels by source actor -> name ---
  const countBySource = (
    events: Array<WclInterruptEvent | WclDispelEvent>,
  ): Map<string, number> => {
    const out = new Map<string, number>();
    for (const e of events) {
      const name = nameById.get(e.sourceID);
      if (!name) continue;
      out.set(name, (out.get(name) ?? 0) + 1);
    }
    return out;
  };
  const interruptsByName = countBySource(detailReport.interrupts.data);
  const dispelsByName = countBySource(detailReport.dispels.data);

  // --- Consumable presence by character name (self-applied + allowlist) ---
  const consumablesByName = new Map<
    string,
    { flask: boolean; food: boolean; elixir: boolean }
  >();
  for (const ev of detailReport.combatantInfo.data as WclCombatantInfoEvent[]) {
    const name = nameById.get(ev.sourceID);
    if (!name) continue;
    const cur = consumablesByName.get(name) ?? {
      flask: false,
      food: false,
      elixir: false,
    };
    for (const aura of ev.auras ?? []) {
      // Self-applied only: drops raid buffs cast by others.
      if (aura.source !== ev.sourceID) continue;
      const cat = consumableCategory(aura.ability);
      if (cat) cur[cat] = true;
    }
    consumablesByName.set(name, cur);
  }

  // Presence is actor-id keyed; everything else is name-keyed. Bridge them.
  const presenceByName = new Map<string, number>();
  for (const [actorId, n] of presenceByActor) {
    const name = nameById.get(actorId);
    if (name) presenceByName.set(name, n);
  }

  // --- Assemble performances ---
  // Seed the roster from EVERYONE who has any signal: rankings (parsed), true
  // presence (in a kill fight), OR a death. Iterating only `accByName` would
  // silently drop a player who died but never registered a parse (rare, but it
  // touches Floor Inspector), so we union the keys.
  const allNames = new Set<string>([
    ...accByName.keys(),
    ...presenceByName.keys(),
    ...deathsByName.keys(),
  ]);

  const performances: ExternalPerformance[] = [];
  for (const name of allNames) {
    const acc = accByName.get(name);
    const samples = acc?.samples ?? [];
    const consumables = consumablesByName.get(name) ?? {
      flask: false,
      food: false,
      elixir: false,
    };
    performances.push({
      name,
      role: dominantRole(samples),
      parseAvg: mean(samples.map((s) => s.rankPercent)),
      dpsOrHps: mean(samples.map((s) => s.amount)),
      deaths: deathsByName.get(name) ?? 0,
      interrupts: interruptsByName.get(name) ?? 0,
      dispels: dispelsByName.get(name) ?? 0,
      hadFlask: consumables.flask,
      hadFood: consumables.food,
      hadElixir: consumables.elixir,
      // True presence (kill fights attended). Falls back to parsed-fights count
      // only if the player somehow isn't in any friendlyPlayers list.
      fightsPresent: presenceByName.get(name) ?? samples.length,
    });
  }

  return {
    reportCode: report.code,
    zone: report.zone?.name ?? "Unknown",
    totalBossFights,
    performances,
  };
}

/** Kill-fight ids for a report meta — the adapter needs these to scope the
 *  detail query. Exported so the adapter and tests share one definition. */
export function killFightIds(meta: WclReportMeta): number[] {
  return (meta.reportData.report?.fights ?? [])
    .filter((f) => f.kill)
    .map((f) => f.id);
}

/** Earliest fight start is not in meta; the detail query needs a startTime for
 *  the events streams. WCL accepts 0 to mean "from report start". */
export const EVENTS_START_TIME = 0;
