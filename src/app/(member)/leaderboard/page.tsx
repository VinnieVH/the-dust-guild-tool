import { Card } from "@/components/ui/card";
import { PageContainer } from "@/components/ui/page-container";

export default function LeaderboardPage() {
  return (
    <PageContainer>
      <h1 className="mb-4 text-xl font-semibold text-fel-300">Leaderboard</h1>
      <Card>
        <p className="text-fel-200">
          Season standings arrive with achievements (Phase 5).
        </p>
      </Card>
    </PageContainer>
  );
}
