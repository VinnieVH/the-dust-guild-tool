import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PageContainer } from "@/components/ui/page-container";
import { listRaidNightsForAdmin } from "@/lib/repositories/admin-queries";
import { countUnmatchedReservations } from "@/lib/repositories/reservation-queries";
import { countUnmatchedPerformances } from "@/lib/repositories/wcl-unmatched-queries";
import { RefreshGuildButton } from "./refresh-guild-button";
import { SyncEventsButton } from "./sync-events-button";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

// Month heading for the grouped Past list, e.g. "June 2026".
const monthFmt = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });

type AdminNight = { id: string; title: string; date: Date; sheetCount: number };

// Split a date-DESC list of nights into month buckets, preserving order
// (newest month first, newest night first within each). Keyed by year-month so
// e.g. June 2025 and June 2026 never collide.
function groupByMonth(nights: AdminNight[]): { key: string; label: string; nights: AdminNight[] }[] {
  const groups: { key: string; label: string; nights: AdminNight[] }[] = [];
  for (const n of nights) {
    const key = `${n.date.getFullYear()}-${n.date.getMonth()}`;
    let group = groups.at(-1);
    if (!group || group.key !== key) {
      group = { key, label: monthFmt.format(n.date), nights: [] };
      groups.push(group);
    }
    group.nights.push(n);
  }
  return groups;
}

export default async function AdminRaidNightsPage() {
  const [{ upcoming, past }, unmatchedRes, unmatchedPerf] = await Promise.all([
    listRaidNightsForAdmin(),
    countUnmatchedReservations(),
    countUnmatchedPerformances(),
  ]);
  const unmatched = unmatchedRes + unmatchedPerf;
  const hasNights = upcoming.length + past.length > 0;

  return (
    <PageContainer>
      <header className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-fel-300">
            Admin · Raid Nights
          </h1>
          <p className="mt-1 text-sm text-fel-200">
            Link soft-res sheets to a raid night, then resolve any names that
            didn&apos;t auto-match. Officer-only.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/unmatched"
            className="flex items-center gap-2 rounded border border-fel-700 px-3 py-1 text-sm text-fel-100 hover:bg-fel-900"
          >
            Unmatched queue
            {unmatched > 0 && (
              <span className="rounded-full bg-fel-600 px-2 py-0.5 text-xs font-semibold text-legion-950">
                {unmatched}
              </span>
            )}
          </Link>
          <SyncEventsButton />
          <RefreshGuildButton />
        </div>
      </header>

      {!hasNights ? (
        <Card>
          <p className="text-fel-200">
            No raid nights yet — hit “Sync Raid-Helper” to pull events.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-8">
          <NightSection title="Upcoming" nights={upcoming} emptyHint="No upcoming nights." />
          {past.length > 0 && <PastSection nights={past} />}
        </div>
      )}
    </PageContainer>
  );
}

function NightSection({
  title,
  nights,
  emptyHint,
}: {
  title: string;
  nights: AdminNight[];
  emptyHint?: string;
}) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-fel-200">
        {title}
      </h2>
      {nights.length === 0 ? (
        emptyHint && <p className="text-sm text-fel-200">{emptyHint}</p>
      ) : (
        <NightList nights={nights} />
      )}
    </section>
  );
}

// Past nights grouped into month subsections (newest month first) so a long
// backlog stays scannable.
function PastSection({ nights }: { nights: AdminNight[] }) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-fel-200">
        Past
      </h2>
      <div className="flex flex-col gap-6">
        {groupByMonth(nights).map((group) => (
          <div key={group.key}>
            <h3 className="mb-2 text-xs font-medium text-fel-300/80">
              {group.label}
              <span className="ml-2 text-fel-200/60">
                {group.nights.length} night{group.nights.length === 1 ? "" : "s"}
              </span>
            </h3>
            <NightList nights={group.nights} />
          </div>
        ))}
      </div>
    </section>
  );
}

function NightList({ nights }: { nights: AdminNight[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {nights.map((n) => (
        <li key={n.id}>
          <Link href={`/admin/raid-nights/${n.id}`} className="group block">
            <Card className="transition-colors group-hover:border-fel-500">
              <div className="flex items-center justify-between gap-4">
                <span className="font-medium text-fel-100">{n.title}</span>
                <span className="flex items-center gap-3 text-sm text-fel-200">
                  <span>{dateFmt.format(n.date)}</span>
                  <span className="text-fel-300">
                    {n.sheetCount} sheet{n.sheetCount === 1 ? "" : "s"}
                  </span>
                  <span aria-hidden className="text-fel-400 transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </span>
              </div>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
