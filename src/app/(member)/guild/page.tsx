import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import {
  getSpeedRecordNights,
  getZoneRankings,
} from "@/lib/repositories/guild-queries";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

// WoW item-quality colors for the rank tier badge.
const QUALITY_COLOR: Record<string, string> = {
  common: "#ffffff",
  uncommon: "#1eff00",
  rare: "#0070dd",
  epic: "#a335ee",
  legendary: "#ff8000",
  artifact: "#e6cc80",
};

function rankColor(tier: string | null): string {
  return (tier && QUALITY_COLOR[tier]) || "#ffce1f";
}

export default async function GuildPage() {
  const [rankings, records] = await Promise.all([
    getZoneRankings(),
    getSpeedRecordNights(),
  ]);

  return (
    <PageContainer>
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-fel-300">Guild standing</h1>
        <p className="text-fel-200">
          Where we rank on the realm, and the clears we&apos;re proudest of.
        </p>
      </header>

      <section className="mb-8">
        <h2 className="mb-3 font-semibold text-fel-300">Speed rankings</h2>
        {rankings.length === 0 ? (
          <EmptyState title="No rankings synced yet">
            An officer can pull them with “Refresh guild data” on the admin page.
          </EmptyState>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rankings.map((r) => (
              <Card key={r.zoneName}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-fel-100">{r.zoneName}</span>
                  {r.speedColor && (
                    <span
                      className="rounded px-2 py-0.5 text-xs font-semibold capitalize"
                      style={{ color: rankColor(r.speedColor), borderColor: rankColor(r.speedColor) }}
                    >
                      {r.speedColor}
                    </span>
                  )}
                </div>
                <dl className="mt-2 grid grid-cols-3 gap-1 text-center text-sm">
                  <div>
                    <dt className="text-xs text-fel-200">Server</dt>
                    <dd className="font-semibold text-fel-100">#{r.speedServerRank ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-fel-200">Region</dt>
                    <dd className="text-fel-100">#{r.speedRegionRank ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-fel-200">World</dt>
                    <dd className="text-fel-100">#{r.speedWorldRank ?? "—"}</dd>
                  </div>
                </dl>
                <p className="mt-2 text-[10px] text-fel-200">
                  as of {dateFmt.format(r.fetchedAt)}
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-semibold text-gold">Speed records 🏆</h2>
        {records.length === 0 ? (
          <EmptyState title="No speed records yet">
            Ingest a raid’s Warcraft Logs report — the fastest clear of each zone
            earns the record.
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {records.map((rec) => (
              <li
                key={rec.raidNightId}
                className="flex items-center justify-between rounded border border-gold/40 bg-legion-800 px-3 py-2"
              >
                <span className="font-medium text-gold">{rec.zone ?? rec.title}</span>
                <span className="text-sm text-fel-200">{dateFmt.format(rec.date)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageContainer>
  );
}
