import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { PageContainer } from "@/components/ui/page-container";
import { Instance } from "@/lib/domain/enums";
import { getRaidNightForAdmin } from "@/lib/repositories/admin-queries";
import { LinkSheetsForm } from "./link-sheets-form";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const softresUrl = (id: string) => `https://softres.it/raid/${id}`;

export default async function AdminRaidNightDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const night = await getRaidNightForAdmin(id);
  if (!night) notFound();

  const sheetById = new Map(night.sheets.map((s) => [s.instance, s.softresId]));
  const ssc = sheetById.get(Instance.SSC) ?? "";
  const tk = sheetById.get(Instance.TK) ?? "";

  return (
    <PageContainer>
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-fel-300">{night.title}</h1>
        <p className="text-fel-200">{dateFmt.format(night.date)}</p>
      </header>

      <Card>
        <h2 className="mb-3 font-semibold text-fel-300">Soft-res sheets</h2>
        <p className="mb-4 text-sm text-fel-200">
          Paste the softres links for this night. Pasting a new link for an
          instance replaces the old sheet (and its reservations). Linking syncs
          immediately.
        </p>
        <LinkSheetsForm
          raidNightId={night.id}
          sscDefault={ssc ? softresUrl(ssc) : ""}
          tkDefault={tk ? softresUrl(tk) : ""}
        />
      </Card>

      <div className="mt-6 flex gap-4 text-sm">
        <Link href="/admin/raid-nights" className="text-fel-200 hover:text-fel-100">
          ← All raid nights
        </Link>
        <Link href="/admin/unmatched" className="text-fel-200 hover:text-fel-100">
          Unmatched reservations →
        </Link>
      </div>
    </PageContainer>
  );
}
