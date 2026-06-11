-- AlterTable
ALTER TABLE "reservations" DROP COLUMN "itemId",
ADD COLUMN     "discordId" TEXT,
ADD COLUMN     "ignored" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "items" INTEGER[],
ADD COLUMN     "rawClass" TEXT,
ADD COLUMN     "reservedAt" TIMESTAMP(3),
ADD COLUMN     "suggestedCharacterId" TEXT;
-- CreateIndex
CREATE UNIQUE INDEX "reservations_softresSheetId_rawName_key" ON "reservations"("softresSheetId", "rawName");
