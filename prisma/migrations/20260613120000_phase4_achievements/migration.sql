-- DropForeignKey
ALTER TABLE "player_performances" DROP CONSTRAINT "player_performances_characterId_fkey";

-- AlterTable
ALTER TABLE "player_performances" ADD COLUMN     "hadElixir" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hadFlask" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hadFood" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rawName" TEXT NOT NULL,
ALTER COLUMN "characterId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "currentStreak" INTEGER;

-- CreateTable
CREATE TABLE "streak_milestones" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "raidNightId" TEXT NOT NULL,

    CONSTRAINT "streak_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guild_zone_rankings" (
    "id" TEXT NOT NULL,
    "zoneId" INTEGER NOT NULL,
    "zoneName" TEXT NOT NULL,
    "speedWorldRank" INTEGER,
    "speedRegionRank" INTEGER,
    "speedServerRank" INTEGER,
    "speedColor" TEXT,
    "progWorldRank" INTEGER,
    "progRegionRank" INTEGER,
    "progServerRank" INTEGER,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guild_zone_rankings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "streak_milestones_userId_achievementId_key" ON "streak_milestones"("userId", "achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "guild_zone_rankings_zoneId_key" ON "guild_zone_rankings"("zoneId");

-- CreateIndex
CREATE UNIQUE INDEX "achievement_awards_achievementId_characterId_raidNightId_key" ON "achievement_awards"("achievementId", "characterId", "raidNightId");

-- CreateIndex
CREATE UNIQUE INDEX "player_performances_wclReportId_rawName_key" ON "player_performances"("wclReportId", "rawName");

-- AddForeignKey
ALTER TABLE "player_performances" ADD CONSTRAINT "player_performances_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "characters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "streak_milestones" ADD CONSTRAINT "streak_milestones_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "streak_milestones" ADD CONSTRAINT "streak_milestones_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "achievements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "streak_milestones" ADD CONSTRAINT "streak_milestones_raidNightId_fkey" FOREIGN KEY ("raidNightId") REFERENCES "raid_nights"("id") ON DELETE CASCADE ON UPDATE CASCADE;

