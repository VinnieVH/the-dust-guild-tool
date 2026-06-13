import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";
import { getLeaderboard } from "@/lib/repositories/leaderboard-queries";

// The Hall of Champions: who currently holds each achievement, plus the longest
// active attendance streaks. By design there is NO overall trophy ladder —
// every achievement is its own crown, so many members are #1 at something
// (docs/achievement-design.md: all-positive / everyone-shines).

export default async function LeaderboardPage() {
  const { champions, streakLeaders } = await getLeaderboard();

  const anyEarned = champions.some((c) => c.holders.length > 0);
  const hasStreaks = streakLeaders.length > 0;

  return (
    <PageContainer>
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-gold">Hall of Champions 🏆</h1>
        <p className="text-fel-200">
          Everyone shines at something. Here&apos;s who holds each crown.
        </p>
      </header>

      {!anyEarned && !hasStreaks ? (
        <EmptyState
          title="No champions crowned yet"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
              <path d="M6 4h12v4a6 6 0 0 1-12 0V4Z" strokeLinejoin="round" />
              <path
                d="M18 5h2a2 2 0 0 1-2 4M6 5H4a2 2 0 0 0 2 4M9 20h6M12 14v6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          }
        >
          Once a raid&apos;s Warcraft Logs report is ingested, the night&apos;s
          champions take their place here.
        </EmptyState>
      ) : (
        <>
          <section className="mb-8">
            <h2 className="mb-3 font-semibold text-fel-300">Crowns</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {champions.map((c) => (
                <Card key={c.key}>
                  <div className="flex items-center gap-2">
                    <span className="text-xl" aria-hidden>
                      {c.icon}
                    </span>
                    <span className="font-semibold text-gold">{c.name}</span>
                  </div>
                  <p className="mt-1 text-xs text-fel-200">{c.description}</p>
                  <div className="mt-3">
                    {c.holders.length === 0 ? (
                      <span className="text-sm text-fel-200/70">Up for grabs</span>
                    ) : (
                      <ul className="flex flex-col gap-1">
                        {c.holders.map((h) => (
                          <li
                            key={h.name}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="font-medium text-fel-100">{h.name}</span>
                            {h.count > 1 && (
                              <span className="text-xs font-semibold text-fel-200">
                                ×{h.count}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 font-semibold text-gold">Attendance streaks 🔥</h2>
            {!hasStreaks ? (
              <EmptyState title="No active streaks yet">
                Show up to consecutive raid nights to start a streak — the longest
                ones lead the board.
              </EmptyState>
            ) : (
              <ul className="flex flex-col gap-2">
                {streakLeaders.map((s, i) => (
                  <li
                    key={s.name}
                    className="flex items-center justify-between rounded border border-gold/40 bg-legion-800 px-3 py-2"
                  >
                    <span className="flex items-center gap-2">
                      {i === 0 && <span aria-hidden>👑</span>}
                      <span className="font-medium text-fel-100">{s.name}</span>
                    </span>
                    <span className="font-semibold text-gold">🔥 {s.streak}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </PageContainer>
  );
}
