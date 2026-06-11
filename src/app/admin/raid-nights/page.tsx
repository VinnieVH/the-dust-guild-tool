import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PageContainer } from "@/components/ui/page-container";
import { listRaidNightsForAdmin } from "@/lib/repositories/admin-queries";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

export default async function AdminRaidNightsPage() {
  const nights = await listRaidNightsForAdmin();

  return (
    <PageContainer>
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-fel-300">
          Admin · Raid Nights
        </h1>
        <p className="text-fel-200">
          Link softres sheets to a raid night. Officer-only.
        </p>
      </header>

      {nights.length === 0 ? (
        <p className="text-fel-200">No raid nights yet — run a Raid-Helper sync first.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {nights.map((n) => (
            <li key={n.id}>
              <Link href={`/admin/raid-nights/${n.id}`}>
                <Card>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-fel-100">{n.title}</span>
                    <span className="text-sm text-fel-200">
                      {dateFmt.format(n.date)} · {n.sheetCount}/2 sheets
                    </span>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
