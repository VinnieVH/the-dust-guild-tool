import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { ClassName } from "@/components/ui/class-name";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { getProfile } from "@/lib/repositories/profile-queries";
import { auth } from "@/lib/auth";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) notFound();

  const profile = await getProfile(session.user.id);
  if (!profile) notFound();

  return (
    <PageContainer>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-fel-300">{profile.discordName}</h1>
          <p className="text-fel-200">
            {profile.characters.length} character
            {profile.characters.length === 1 ? "" : "s"} ·{" "}
            {profile.trophies.reduce((n, t) => n + t.count, 0)} trophies
          </p>
        </div>
        {profile.currentStreak != null && profile.currentStreak > 0 && (
          <div className="rounded-lg border border-gold/50 bg-legion-800 px-4 py-2 text-center shadow-[0_0_12px_-3px_var(--color-gold)]">
            <div className="text-2xl font-bold text-gold">🔥 {profile.currentStreak}</div>
            <div className="text-xs text-fel-200">raid streak</div>
          </div>
        )}
      </header>

      {profile.characters.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 font-semibold text-fel-300">Characters</h2>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {profile.characters.map((c) => (
              <li key={c.name}>
                <ClassName name={c.name} wowClass={c.class} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-semibold text-gold">Trophy cabinet</h2>
        {profile.trophies.length === 0 ? (
          <EmptyState title="No trophies yet">
            Show up, parse hard, bring your flasks — achievements appear here after
            a raid&apos;s logs are ingested.
          </EmptyState>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {profile.trophies.map((t) => (
              <Card key={t.key}>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="text-xl" aria-hidden>
                      {t.icon}
                    </span>
                    <span className="font-semibold text-gold">{t.name}</span>
                  </span>
                  {t.count > 1 && (
                    <span className="text-sm font-semibold text-fel-200">×{t.count}</span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </PageContainer>
  );
}
