-- WclReport: replace the fixed `instance Instance` (SSC|TK) enum column with a
-- free-text `zone` string. The guild raids any TBC instance (Kara, Gruul,
-- Mag, …) and WCL adds zones over time, so a hand-curated enum would break on
-- the first un-listed zone. The `instances` enum type is dropped entirely — it
-- had no other users (softres sheets already moved to named strings).
-- wcl_reports is empty at this point, so no data migration is needed.

ALTER TABLE "wcl_reports" DROP COLUMN "instance";
ALTER TABLE "wcl_reports" ADD COLUMN "zone" TEXT NOT NULL;

DROP TYPE "instances";
