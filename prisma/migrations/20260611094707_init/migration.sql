-- CreateEnum
CREATE TYPE "roles" AS ENUM ('MEMBER', 'OFFICER');

-- CreateEnum
CREATE TYPE "main_roles" AS ENUM ('TANK', 'HEALER', 'DPS');

-- CreateEnum
CREATE TYPE "instances" AS ENUM ('SSC', 'TK');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "discordName" TEXT NOT NULL,
    "role" "roles" NOT NULL DEFAULT 'MEMBER',
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "characters" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "class" TEXT NOT NULL,
    "spec" TEXT NOT NULL,
    "mainRole" "main_roles" NOT NULL,

    CONSTRAINT "characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_aliases" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,

    CONSTRAINT "character_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raid_nights" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "raidHelperEventId" TEXT NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "raid_nights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "softres_sheets" (
    "id" TEXT NOT NULL,
    "raidNightId" TEXT NOT NULL,
    "instance" "instances" NOT NULL,
    "softresId" TEXT NOT NULL,
    "token" TEXT,

    CONSTRAINT "softres_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signups" (
    "id" TEXT NOT NULL,
    "raidNightId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "specSignedAs" TEXT NOT NULL,

    CONSTRAINT "signups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" TEXT NOT NULL,
    "softresSheetId" TEXT NOT NULL,
    "characterId" TEXT,
    "rawName" TEXT NOT NULL,
    "itemId" INTEGER NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wcl_reports" (
    "id" TEXT NOT NULL,
    "raidNightId" TEXT NOT NULL,
    "reportCode" TEXT NOT NULL,
    "instance" "instances" NOT NULL,

    CONSTRAINT "wcl_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_performances" (
    "id" TEXT NOT NULL,
    "wclReportId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "role" "main_roles" NOT NULL,
    "parseAvg" DOUBLE PRECISION NOT NULL,
    "dpsOrHps" DOUBLE PRECISION NOT NULL,
    "deaths" INTEGER NOT NULL,
    "interrupts" INTEGER NOT NULL,
    "dispels" INTEGER NOT NULL,
    "fightsPresent" INTEGER NOT NULL,

    CONSTRAINT "player_performances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievements" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "category" TEXT NOT NULL,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievement_awards" (
    "id" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "raidNightId" TEXT NOT NULL,

    CONSTRAINT "achievement_awards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "users_discordId_key" ON "users"("discordId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "characters_name_key" ON "characters"("name");

-- CreateIndex
CREATE UNIQUE INDEX "character_aliases_alias_key" ON "character_aliases"("alias");

-- CreateIndex
CREATE UNIQUE INDEX "raid_nights_raidHelperEventId_key" ON "raid_nights"("raidHelperEventId");

-- CreateIndex
CREATE UNIQUE INDEX "softres_sheets_raidNightId_instance_key" ON "softres_sheets"("raidNightId", "instance");

-- CreateIndex
CREATE UNIQUE INDEX "signups_raidNightId_userId_key" ON "signups"("raidNightId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "wcl_reports_reportCode_key" ON "wcl_reports"("reportCode");

-- CreateIndex
CREATE UNIQUE INDEX "achievements_key_key" ON "achievements"("key");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_aliases" ADD CONSTRAINT "character_aliases_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "softres_sheets" ADD CONSTRAINT "softres_sheets_raidNightId_fkey" FOREIGN KEY ("raidNightId") REFERENCES "raid_nights"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signups" ADD CONSTRAINT "signups_raidNightId_fkey" FOREIGN KEY ("raidNightId") REFERENCES "raid_nights"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signups" ADD CONSTRAINT "signups_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_softresSheetId_fkey" FOREIGN KEY ("softresSheetId") REFERENCES "softres_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "characters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wcl_reports" ADD CONSTRAINT "wcl_reports_raidNightId_fkey" FOREIGN KEY ("raidNightId") REFERENCES "raid_nights"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_performances" ADD CONSTRAINT "player_performances_wclReportId_fkey" FOREIGN KEY ("wclReportId") REFERENCES "wcl_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_performances" ADD CONSTRAINT "player_performances_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "characters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement_awards" ADD CONSTRAINT "achievement_awards_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "achievements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement_awards" ADD CONSTRAINT "achievement_awards_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement_awards" ADD CONSTRAINT "achievement_awards_raidNightId_fkey" FOREIGN KEY ("raidNightId") REFERENCES "raid_nights"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
