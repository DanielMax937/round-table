-- CreateTable
CREATE TABLE "VisualAssetJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "movieId" TEXT NOT NULL,
    "sceneId" TEXT,
    "characterId" TEXT,
    "assetType" TEXT NOT NULL,
    "stylesJson" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "codexPrompt" TEXT NOT NULL,
    "codexCommand" TEXT NOT NULL,
    "executionCommand" TEXT,
    "result" TEXT,
    "error" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VisualAssetJob_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VisualAssetJob_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "VisualAssetJob_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "VisualAssetJob_movieId_idx" ON "VisualAssetJob"("movieId");

-- CreateIndex
CREATE INDEX "VisualAssetJob_sceneId_idx" ON "VisualAssetJob"("sceneId");

-- CreateIndex
CREATE INDEX "VisualAssetJob_characterId_idx" ON "VisualAssetJob"("characterId");

-- CreateIndex
CREATE INDEX "VisualAssetJob_status_idx" ON "VisualAssetJob"("status");

-- CreateIndex
CREATE INDEX "VisualAssetJob_createdAt_idx" ON "VisualAssetJob"("createdAt");
