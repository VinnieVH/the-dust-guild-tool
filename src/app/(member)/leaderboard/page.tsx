import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-container";

export default function LeaderboardPage() {
  return (
    <PageContainer>
      <h1 className="mb-4 text-xl font-semibold text-fel-300">Leaderboard</h1>
      <EmptyState
        title="Season standings are coming"
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
        Once Warcraft Logs ingestion lands, this is where the guild&apos;s
        achievement standings and season podium will live.
      </EmptyState>
    </PageContainer>
  );
}
