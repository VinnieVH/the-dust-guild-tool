-- CreateTable
CREATE TABLE "ignored_wcl_names" (
    "id" TEXT NOT NULL,
    "rawName" TEXT NOT NULL,
    "ignoredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ignored_wcl_names_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ignored_wcl_names_rawName_key" ON "ignored_wcl_names"("rawName");
