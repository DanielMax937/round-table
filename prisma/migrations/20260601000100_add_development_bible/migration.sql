-- AlterTable
ALTER TABLE "Movie" ADD COLUMN "developmentReportJson" TEXT;
ALTER TABLE "Movie" ADD COLUMN "storyBibleJson" TEXT;

-- AlterTable
ALTER TABLE "SceneOutline" ADD COLUMN "act" TEXT;
ALTER TABLE "SceneOutline" ADD COLUMN "arcName" TEXT;
ALTER TABLE "SceneOutline" ADD COLUMN "arcGoal" TEXT;
ALTER TABLE "SceneOutline" ADD COLUMN "setupPayoff" TEXT;
ALTER TABLE "SceneOutline" ADD COLUMN "requiredMotif" TEXT;
