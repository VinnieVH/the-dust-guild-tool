import Link from "next/link";
import type { MainRole } from "@/lib/domain/enums";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import {
  listUpcomingRaidNights,
  type RaidNightListItem,
} from "@/lib/repositories/raid-queries";

const dayFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "short",
});
const timeFmt = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
});

// Human countdown from now to the raid date, in guild-night terms.
function countdown(date: Date): string {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfDate = new Date(date);
  startOfDate.setHours(0, 0, 0, 0);
  const days = Math.round(
    (startOfDate.getTime() - startOfToday.getTime()) / 86_400_000,
  );
  if (days <= 0) return "Tonight";
  if (days === 1) return "Tomorrow";
  if (days < 7) return `In ${days} days`;
  if (days < 14) return "Next week";
  return `In ${Math.floor(days / 7)} weeks`;
}

const ROLES: { key: MainRole; label: string; dot: string; text: string }[] = [
  { key: "TANK", label: "Tanks", dot: "bg-fel-400", text: "text-fel-200" },
  { key: "HEALER", label: "Healers", dot: "bg-sargeras", text: "text-fel-200" },
  { key: "DPS", label: "DPS", dot: "bg-felfire", text: "text-fel-200" },
];

function RolePips({ counts }: { counts: Record<MainRole, number> }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      {ROLES.map((r) => (
        <span key={r.key} className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${r.dot}`} aria-hidden />
          <span className={r.text}>
            <span className="font-semibold text-fel-100">{counts[r.key]}</span>{" "}
            {r.label}
          </span>
        </span>
      ))}
    </div>
  );
}

function DateBlock({ date }: { date: Date }) {
  return (
    <p className="text-sm text-fel-200">
      <span className="text-fel-100">{dayFmt.format(date)}</span>
      <span className="text-fel-300"> · {timeFmt.format(date)}</span>
    </p>
  );
}

// Large hero card for the soonest raid night.
function FeaturedNight({ n }: { n: RaidNightListItem }) {
  return (
    <Link href={`/raids/${n.id}`} className="group block">
      <div className="fel-atmosphere relative overflow-hidden rounded-2xl border border-fel-700 p-7 shadow-[0_0_22px_-6px_var(--color-fel-glow)] transition-all group-hover:border-fel-500 group-hover:shadow-[0_0_30px_-6px_var(--color-fel-glow)]">
        <div className="mb-3 flex items-center gap-2">
          <Badge variant="fel">Next raid</Badge>
          <Badge variant="gold">{countdown(n.date)}</Badge>
        </div>
        <h2 className="text-2xl font-bold text-fel-300">{n.title}</h2>
        <div className="mt-1">
          <DateBlock date={n.date} />
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <RolePips counts={n.roleCounts} />
          <p className="text-sm text-fel-200">
            <span className="font-semibold text-fel-100">
              {n.confirmedCount}
            </span>{" "}
            confirmed
            {n.tentativeCount > 0 && (
              <span className="text-fel-300">
                {" "}
                · {n.tentativeCount} tentative
              </span>
            )}
          </p>
        </div>
      </div>
    </Link>
  );
}

function NightCard({ n }: { n: RaidNightListItem }) {
  return (
    <Link href={`/raids/${n.id}`} className="group block h-full">
      <div className="flex h-full flex-col rounded-lg border border-fel-800 bg-legion-800 p-5 shadow-[0_0_12px_-2px_var(--color-fel-glow)] transition-all group-hover:border-fel-600 group-hover:shadow-[0_0_20px_-2px_var(--color-fel-glow)]">
        <div className="mb-2">
          <Badge variant="neutral">{countdown(n.date)}</Badge>
        </div>
        <h2 className="font-semibold text-fel-300">{n.title}</h2>
        <div className="mt-0.5">
          <DateBlock date={n.date} />
        </div>
        <div className="mt-4 border-t border-legion-700 pt-3">
          <RolePips counts={n.roleCounts} />
          <p className="mt-2 text-xs text-fel-200">
            <span className="font-semibold text-fel-100">
              {n.confirmedCount}
            </span>{" "}
            confirmed
            {n.tentativeCount > 0 && ` · ${n.tentativeCount} tentative`}
          </p>
        </div>
      </div>
    </Link>
  );
}

export default async function RaidsPage() {
  const nights = await listUpcomingRaidNights();
  const [featured, ...rest] = nights;

  return (
    <PageContainer>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-fel-300">Upcoming raids</h1>
        <p className="mt-1 text-sm text-fel-200">
          {nights.length === 0
            ? "Nothing on the calendar."
            : `${nights.length} night${nights.length === 1 ? "" : "s"} on the calendar — sign up on Discord.`}
        </p>
      </header>

      {nights.length === 0 ? (
        <EmptyState
          title="No upcoming raids"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
              <rect x="3" y="4" width="18" height="17" rx="2" />
              <path d="M3 9h18M8 2v4M16 2v4" strokeLinecap="round" />
            </svg>
          }
        >
          Nothing scheduled yet. Run a Raid-Helper sync to pull in upcoming
          nights.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          {featured && <FeaturedNight n={featured} />}
          {rest.length > 0 && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
              {rest.map((n) => (
                <NightCard key={n.id} n={n} />
              ))}
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
}
