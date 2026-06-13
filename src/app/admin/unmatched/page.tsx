import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PageContainer } from "@/components/ui/page-container";
import { listUnmatchedReservations } from "@/lib/repositories/reservation-queries";
import { listUnmatchedPerformances } from "@/lib/repositories/wcl-unmatched-queries";
import { UnmatchedRow } from "./unmatched-row";
import { WclUnmatchedRow } from "./wcl-unmatched-row";

export default async function UnmatchedPage() {
  const rows = await listUnmatchedReservations();
  const perfs = await listUnmatchedPerformances();

  return (
    <PageContainer>
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-fel-300">
          Unmatched reservations
        </h1>
        <p className="text-fel-200">
          softres names that didn&apos;t resolve to a character. Resolve once —
          linking remembers the alias, so the next sync auto-matches it.
        </p>
      </header>

      {rows.length === 0 ? (
        <Card>
          <p className="text-fel-200">
            Nothing to resolve. Every reservation is matched or ignored. 🎉
          </p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => (
            <li key={r.id}>
              <UnmatchedRow reservation={r} />
            </li>
          ))}
        </ul>
      )}

      <section className="mt-10">
        <header className="mb-4">
          <h2 className="text-lg font-semibold text-fel-300">
            Unmatched Warcraft Logs names
          </h2>
          <p className="text-sm text-fel-200">
            WCL report names that didn&apos;t resolve to a character. Linking
            remembers the alias and re-scores that night&apos;s achievements.
          </p>
        </header>
        {perfs.length === 0 ? (
          <Card>
            <p className="text-fel-200">No unmatched log names. 🎉</p>
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {perfs.map((p) => (
              <li key={p.rawName}>
                <WclUnmatchedRow perf={p} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-6 text-sm">
        <Link href="/admin/raid-nights" className="text-fel-200 hover:text-fel-100">
          ← Raid nights
        </Link>
      </div>
    </PageContainer>
  );
}
