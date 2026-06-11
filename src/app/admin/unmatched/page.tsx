import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PageContainer } from "@/components/ui/page-container";
import { listUnmatchedReservations } from "@/lib/repositories/reservation-queries";
import { UnmatchedRow } from "./unmatched-row";

export default async function UnmatchedPage() {
  const rows = await listUnmatchedReservations();

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

      <div className="mt-6 text-sm">
        <Link href="/admin/raid-nights" className="text-fel-200 hover:text-fel-100">
          ← Raid nights
        </Link>
      </div>
    </PageContainer>
  );
}
