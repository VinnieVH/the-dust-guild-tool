import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { classColor, zoneDisplayName } from "@/lib/domain/wow";
import {
  getComposition,
  getZoneBests,
  type CompositionMember,
  type ZoneBestView,
} from "@/lib/repositories/guild-queries";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

// WoW item-quality colors for the rank tier accent.
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

// ms -> "1h 23m" / "48m" / "2m 05s". Clears are minutes-to-hours; show the
// coarse unit plus one finer for readability.
function formatClearMs(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function hasAnyRank(z: ZoneBestView): boolean {
  return (
    z.speedServerRank != null ||
    z.speedRegionRank != null ||
    z.speedWorldRank != null
  );
}

// One role column (Tanks / Healers / DPS) — names class-colored, spec + item
// level alongside, like WCL's Composition panel.
function RoleColumn({
  title,
  members,
}: {
  title: string;
  members: CompositionMember[];
}) {
  return (
    <div>
      <h3 className="mb-2 flex items-baseline gap-2 font-semibold text-fel-300">
        {title}
        <span className="text-sm font-normal text-fel-200">{members.length}</span>
      </h3>
      <ul className="flex flex-col gap-1">
        {members.map((m) => (
          <li key={m.name} className="flex items-center justify-between gap-3 text-sm">
            {/* Class color conveys the class; spec text is intentionally omitted
                (WCL's spec labels don't match in-game TBC names — see the
                composition design note). spec stays captured in the snapshot. */}
            <span className="font-medium" style={{ color: classColor(m.className) }}>
              {m.name}
            </span>
            <span className="rounded bg-legion-900 px-1.5 py-0.5 text-xs font-semibold text-fel-200">
              {m.maxItemLevel}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function GuildPage() {
  const [zones, comp] = await Promise.all([getZoneBests(), getComposition()]);

  const anyData = zones.some((z) => z.bestClearMs != null || hasAnyRank(z));

  return (
    <PageContainer>
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-fel-300">Guild standing</h1>
        <p className="text-fel-200">
          Our fastest clears and where we rank — realm, region, world.
        </p>
        <p className="mt-1 text-xs text-fel-200/70">
          Ranks are Warcraft Logs combined-zone speed for the current phase, so
          they may differ from the per-raid splits on the WCL site.
        </p>
      </header>

      <section className="mb-10">
        {!anyData ? (
          <EmptyState title="No standings synced yet">
            An officer can pull them with “Refresh guild data” on the admin page,
            once a raid’s logs are ingested.
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-3">
            {zones.map((z) => {
              const accent = rankColor(z.speedColor);
              return (
                <Card key={z.zoneName}>
                  {/* WCL-style row: zone + tier on the left, our time, then the
                      three rank stat blocks on the right. */}
                  <div
                    className="flex flex-col gap-3 border-l-4 pl-3 sm:flex-row sm:items-center sm:justify-between"
                    style={{ borderColor: accent }}
                  >
                    <div className="min-w-[10rem]">
                      <div className="font-semibold text-fel-100">{zoneDisplayName(z.zoneName)}</div>
                      {z.speedColor && (
                        <span
                          className="text-xs font-semibold capitalize"
                          style={{ color: accent }}
                        >
                          {z.speedColor}
                        </span>
                      )}
                    </div>

                    <div className="flex items-baseline gap-2">
                      <span className="text-xs uppercase tracking-wide text-fel-200">
                        Fastest
                      </span>
                      <span className="text-lg font-bold text-gold">
                        {z.bestClearMs != null ? formatClearMs(z.bestClearMs) : "—"}
                      </span>
                    </div>

                    <dl className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <dt className="text-[10px] uppercase tracking-wide text-fel-200">
                          Realm
                        </dt>
                        <dd
                          className="font-semibold"
                          style={{ color: z.speedServerRank != null ? accent : undefined }}
                        >
                          {z.speedServerRank != null ? `#${z.speedServerRank}` : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] uppercase tracking-wide text-fel-200">
                          Region
                        </dt>
                        <dd className="text-fel-100">
                          {z.speedRegionRank != null ? `#${z.speedRegionRank}` : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] uppercase tracking-wide text-fel-200">
                          World
                        </dt>
                        <dd className="text-fel-100">
                          {z.speedWorldRank != null ? `#${z.speedWorldRank}` : "—"}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-1 flex items-baseline gap-2 font-semibold text-fel-300">
          Composition
          {comp.total > 0 && (
            <span className="text-sm font-normal text-fel-200">
              · {comp.total} raiders
            </span>
          )}
        </h2>
        {comp.total === 0 ? (
          <EmptyState title="No composition synced yet">
            “Refresh guild data” reads the lineup from the latest raid’s Warcraft
            Logs report.
          </EmptyState>
        ) : (
          <>
            <p className="mb-3 text-xs text-fel-200">Based on our most recent raid.</p>
            <Card>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <RoleColumn title="Tanks" members={comp.tanks} />
                <RoleColumn title="Healers" members={comp.healers} />
                <RoleColumn title="DPS" members={comp.dps} />
              </div>
            </Card>
            {comp.fetchedAt && (
              <p className="mt-3 text-[10px] text-fel-200">
                as of {dateFmt.format(comp.fetchedAt)}
              </p>
            )}
          </>
        )}
      </section>
    </PageContainer>
  );
}
