-- SoftresSheet: replace the fixed Instance enum with a free-text `name`, so a
-- night can have 0..N officer-named sheets. Identity-preserving: existing
-- SSC/TK sheets keep their label as the new name (reservations link by
-- softresSheetId, so they ride through untouched).

DROP INDEX "softres_sheets_raidNightId_instance_key";

ALTER TABLE "softres_sheets" ADD COLUMN "name" TEXT;
UPDATE "softres_sheets" SET "name" = "instance"::text;
ALTER TABLE "softres_sheets" ALTER COLUMN "name" SET NOT NULL;
ALTER TABLE "softres_sheets" DROP COLUMN "instance";

CREATE UNIQUE INDEX "softres_sheets_raidNightId_name_key" ON "softres_sheets"("raidNightId", "name");
