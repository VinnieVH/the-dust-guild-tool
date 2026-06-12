import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { listUpcomingRaidNights } from "@/lib/repositories/raid-queries";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function RaidsPage() {
  const nights = await listUpcomingRaidNights();

  return (
    <PageContainer>
      <h1 className="mb-4 text-xl font-semibold text-fel-300">Upcoming raids</h1>

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
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {nights.map((n) => (
            <Link key={n.id} href={`/raids/${n.id}`}>
              <Card className="h-full transition-shadow hover:shadow-[0_0_18px_-2px_var(--color-fel-glow)]">
                <h2 className="font-semibold text-fel-300">{n.title}</h2>
                <p className="text-sm text-fel-200">{dateFmt.format(n.date)}</p>
                <div className="mt-2">
                  <Badge variant="fel">{n.signupCount} signed up</Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
