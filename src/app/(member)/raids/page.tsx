import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold text-fel-300">Upcoming raids</h1>

      {nights.length === 0 ? (
        <p className="text-fel-200">
          No upcoming raid nights. Run a Raid-Helper sync to populate them.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {nights.map((n) => (
            <Link key={n.id} href={`/raids/${n.id}`}>
              <Card className="transition-shadow hover:shadow-[0_0_18px_-2px_var(--color-fel-glow)]">
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
    </div>
  );
}
