-- DropForeignKey
ALTER TABLE "streak_milestones" DROP CONSTRAINT "streak_milestones_raidNightId_fkey";

-- AlterTable
ALTER TABLE "streak_milestones" ADD COLUMN     "crossedReportCode" TEXT NOT NULL,
ALTER COLUMN "raidNightId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "streak_milestones" ADD CONSTRAINT "streak_milestones_raidNightId_fkey" FOREIGN KEY ("raidNightId") REFERENCES "raid_nights"("id") ON DELETE SET NULL ON UPDATE CASCADE;

