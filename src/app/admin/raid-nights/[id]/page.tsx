import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { PageContainer } from "@/components/ui/page-container";
import { getRaidNightForAdmin } from "@/lib/repositories/admin-queries";
import { SheetManager } from "./sheet-manager";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

export default async function AdminRaidNightDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const night = await getRaidNightForAdmin(id);
  if (!night) notFound();

  return (
    <PageContainer>
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-fel-300">{night.title}</h1>
        <p className="text-fel-200">{dateFmt.format(night.date)}</p>
      </header>

      <Card>
        <h2 className="mb-1 font-semibold text-fel-300">Soft-res sheets</h2>
        <p className="mb-4 text-sm text-fel-200">
          Add one or more named softres sheets (e.g. “SSC”, “TK”, “Kara”). Each
          becomes a column in the raid&apos;s SR matrix. Adding syncs it
          immediately; removing deletes its reservations.
        </p>
        <SheetManager raidNightId={night.id} sheets={night.sheets} />
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
