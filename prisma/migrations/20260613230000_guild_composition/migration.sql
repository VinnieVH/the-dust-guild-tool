-- DropTable
DROP TABLE "guild_members";

-- CreateTable
CREATE TABLE "guild_composition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "main_roles" NOT NULL,
    "className" TEXT NOT NULL,
    "spec" TEXT NOT NULL,
    "maxItemLevel" INTEGER NOT NULL,
    "sourceReportCode" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guild_composition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guild_composition_name_key" ON "guild_composition"("name");

