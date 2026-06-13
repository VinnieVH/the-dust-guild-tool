// One-off maintenance: re-run the per-night achievement engine over every raid
// night that has WCL reports. Idempotent (the engine does a scoped delete +
// re-award per night), so it's safe to run repeatedly. Use it to backfill
// awards after an achievement RULE changes — e.g. the 2026-06-14 Floor Inspector
// switch to most-deaths, which means nights that previously produced no Floor
// Inspector now should.
//
// Runs the REAL production path (runNightEngineForNight + nightEngineRepository),
// not ad-hoc SQL, so the result matches what an officer re-ingest would produce.
//
//   yarn tsx scripts/rerun-night-engine.mts
//
import "dotenv/config";
import { db } from "@/lib/db";
import { nightEngineRepository } from "@/lib/repositories/wcl-repository";
import { runNightEngineForNight } from "@/lib/services/run-night-engine-service";

async function main() {
  // Every night that has at least one WCL report (no report ⇒ nothing to score).
  const nights = await db.raidNight.findMany({
    where: { reports: { some: {} } },
    select: { id: true, title: true },
    orderBy: { date: "asc" },
  });

  console.log(`Re-running the per-night engine over ${nights.length} night(s)…`);

  let totalAwards = 0;
  for (const night of nights) {
    const { awards, scored } = await runNightEngineForNight(
      nightEngineRepository,
      night.id,
    );
    totalAwards += awards;
    console.log(`  ${night.title}: scored ${scored}, awarded ${awards}`);
  }

  console.log(`Done. ${totalAwards} award(s) across ${nights.length} night(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
