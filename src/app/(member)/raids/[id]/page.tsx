import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ClassName } from "@/components/ui/class-name";
import { PageContainer } from "@/components/ui/page-container";
import { ProgressBar } from "@/components/ui/progress-bar";
import { MainRole, Role } from "@/lib/domain/enums";
import { SignupStatus } from "@/lib/domain/external";
import {
  type RosterEntry,
  getRaidNightDetail,
} from "@/lib/repositories/raid-queries";
import { getOverviewData } from "@/lib/repositories/reserve-overview-queries";
import {
  buildOverview,
  buildPokeList,
  buildReminderText,
} from "@/lib/services/reserve-overview-service";
import { auth } from "@/lib/auth";
import { CopyReminderButton } from "./copy-reminder-button";
import { SrMatrix } from "./sr-matrix";
import { SyncNowButton } from "./sync-now-button";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

const ROLE_COLUMNS: { role: MainRole; label: string }[] = [
  { role: MainRole.TANK, label: "Tanks" },
  { role: MainRole.HEALER, label: "Healers" },
  { role: MainRole.DPS, label: "DPS" },
];

function statusBadge(status: string) {
  switch (status) {
    case SignupStatus.CONFIRMED:
      return <Badge variant="fel">Confirmed</Badge>;
    case SignupStatus.TENTATIVE:
      return <Badge variant="sargeras">Tentative</Badge>;
    case SignupStatus.BENCH:
      return <Badge variant="neutral">Bench</Badge>;
    case SignupStatus.ABSENT:
      return <Badge variant="felfire">Absent</Badge>;
    default:
      return <Badge variant="neutral">{status}</Badge>;
  }
}

function RosterMember({ member }: { member: RosterEntry }) {
  return (
    <li className="flex items-center justify-between gap-2 text-sm">
      <span>
        {member.class ? (
          <ClassName name={member.name} wowClass={member.class} />
        ) : (
          <span className="font-medium text-fel-100">{member.name}</span>
        )}
        {member.spec && <span className="text-fel-200"> · {member.spec}</span>}
      </span>
      {statusBadge(member.status)}
    </li>
  );
}

export default async function RaidNightPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const night = await getRaidNightDetail(id);
  if (!night) notFound();

  // Roster columns show attendees (CONFIRMED). Non-attending signups are listed
  // separately so officers can see declines/benches.
  const attending = night.roster.filter(
    (m) => m.status === SignupStatus.CONFIRMED,
  );
  const notAttending = night.roster.filter(
    (m) => m.status !== SignupStatus.CONFIRMED,
  );

  // Soft-res overview: only render when at least one sheet is linked.
  const overview = buildOverview(await getOverviewData(id));
  const poke = buildPokeList(overview);
  const reminder = buildReminderText(poke);

  // Officers get a manual "Sync now" button (reservations are pull-based).
  const session = await auth();
  const isOfficer = session?.user?.role === Role.OFFICER;

  return (
    <PageContainer>
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-fel-300">{night.title}</h1>
        <p className="text-fel-200">{dateFmt.format(night.date)}</p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {ROLE_COLUMNS.map(({ role, label }) => {
          const members = attending.filter((m) => m.role === role);
          return (
            <Card key={role}>
              <h2 className="mb-2 font-semibold text-fel-300">
                {label}{" "}
                <span className="text-fel-200">({members.length})</span>
              </h2>
              {members.length === 0 ? (
                <p className="text-sm text-fel-200">None</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {members.map((m, i) => (
                    <RosterMember key={`${m.name}-${i}`} member={m} />
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>

      {notAttending.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 font-semibold text-fel-300">Not attending</h2>
          <ul className="flex flex-col gap-1">
            {notAttending.map((m, i) => (
              <RosterMember key={`${m.name}-${i}`} member={m} />
            ))}
          </ul>
        </section>
      )}

      {overview.linkedInstances.length > 0 && (
        <Card className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold text-fel-300">Soft-res completion</h2>
            <div className="flex flex-wrap items-center gap-2">
              {isOfficer && <SyncNowButton raidNightId={night.id} />}
              <CopyReminderButton text={reminder} />
            </div>
          </div>
          <div className="mb-4">
            <ProgressBar
              value={overview.completed}
              max={overview.total}
              label="SR completion"
            />
          </div>
          <SrMatrix overview={overview} />
          {poke.length > 0 && (
            <p className="mt-3 text-xs text-fel-200">
              {poke.length} member{poke.length === 1 ? "" : "s"} still missing a
              reservation.
            </p>
          )}
        </Card>
      )}
    </PageContainer>
  );
}
