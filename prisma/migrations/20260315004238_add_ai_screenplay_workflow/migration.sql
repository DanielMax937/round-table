-- AlterTable
ALTER TABLE "Character" ADD COLUMN "currentStateJson" TEXT;
ALTER TABLE "Character" ADD COLUMN "deepMotivation" TEXT;
ALTER TABLE "Character" ADD COLUMN "fatalFlaw" TEXT;
ALTER TABLE "Character" ADD COLUMN "signatureLanguageStyle" TEXT;
ALTER TABLE "Character" ADD COLUMN "surfaceGoal" TEXT;

-- CreateTable
CREATE TABLE "SceneOutline" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "movieId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "contentSummary" TEXT NOT NULL,
    "emotionalGoal" TEXT NOT NULL,
    "characterIdsJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SceneOutline_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Movie" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "theme" TEXT,
    "storyProposalJson" TEXT,
    "storyProposalsJson" TEXT,
    "plotSummary" TEXT,
    "workflowPhase" TEXT NOT NULL DEFAULT 'theme',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Movie" ("createdAt", "description", "id", "status", "title", "updatedAt") SELECT "createdAt", "description", "id", "status", "title", "updatedAt" FROM "Movie";
DROP TABLE "Movie";
ALTER TABLE "new_Movie" RENAME TO "Movie";
CREATE TABLE "new_Scene" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "movieId" TEXT NOT NULL,
    "sceneNumber" INTEGER NOT NULL,
    "heading" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "finalizedScript" TEXT,
    "maxRounds" INTEGER NOT NULL DEFAULT 10,
    "roundTableId" TEXT NOT NULL,
    "contentSummary" TEXT,
    "emotionalGoal" TEXT,
    "contextJson" TEXT,
    "settlementSummary" TEXT,
    "sceneOutlineId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Scene_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Scene_roundTableId_fkey" FOREIGN KEY ("roundTableId") REFERENCES "RoundTable" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Scene_sceneOutlineId_fkey" FOREIGN KEY ("sceneOutlineId") REFERENCES "SceneOutline" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Scene" ("createdAt", "description", "finalizedScript", "heading", "id", "maxRounds", "movieId", "roundTableId", "sceneNumber", "status", "updatedAt") SELECT "createdAt", "description", "finalizedScript", "heading", "id", "maxRounds", "movieId", "roundTableId", "sceneNumber", "status", "updatedAt" FROM "Scene";
DROP TABLE "Scene";
ALTER TABLE "new_Scene" RENAME TO "Scene";
CREATE UNIQUE INDEX "Scene_roundTableId_key" ON "Scene"("roundTableId");
CREATE UNIQUE INDEX "Scene_sceneOutlineId_key" ON "Scene"("sceneOutlineId");
CREATE INDEX "Scene_movieId_idx" ON "Scene"("movieId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "SceneOutline_movieId_idx" ON "SceneOutline"("movieId");
