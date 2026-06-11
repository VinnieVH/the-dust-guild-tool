import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ClassName } from "@/components/ui/class-name";
import { MainRole } from "@/lib/domain/enums";
import { SignupStatus } from "@/lib/domain/external";
import {
  type RosterEntry,
  getRaidNightDetail,
} from "@/lib/repositories/raid-queries";

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

  return (
    <div className="flex flex-col gap-6 p-6">
      <header>
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
        <section>
          <h2 className="mb-2 font-semibold text-fel-300">Not attending</h2>
          <ul className="flex flex-col gap-1">
            {notAttending.map((m, i) => (
              <RosterMember key={`${m.name}-${i}`} member={m} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
