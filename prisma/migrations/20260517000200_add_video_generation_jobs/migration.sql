-- CreateTable
CREATE TABLE "VideoGenerationJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "movieId" TEXT NOT NULL,
    "sceneId" TEXT,
    "visualAssetJobId" TEXT,
    "title" TEXT NOT NULL,
    "ratio" TEXT NOT NULL DEFAULT '16:9',
    "durationSeconds" INTEGER,
    "sourceImagePathsJson" TEXT NOT NULL DEFAULT '[]',
    "prompt" TEXT NOT NULL,
    "doubaoInputJson" TEXT NOT NULL,
    "inputJsonPath" TEXT,
    "doubaoCommand" TEXT NOT NULL,
    "executionCommand" TEXT,
    "outputDir" TEXT,
    "result" TEXT,
    "error" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VideoGenerationJob_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VideoGenerationJob_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "VideoGenerationJob_visualAssetJobId_fkey" FOREIGN KEY ("visualAssetJobId") REFERENCES "VisualAssetJob" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "VideoGenerationJob_movieId_idx" ON "VideoGenerationJob"("movieId");

-- CreateIndex
CREATE INDEX "VideoGenerationJob_sceneId_idx" ON "VideoGenerationJob"("sceneId");

-- CreateIndex
CREATE INDEX "VideoGenerationJob_visualAssetJobId_idx" ON "VideoGenerationJob"("visualAssetJobId");

-- CreateIndex
CREATE INDEX "VideoGenerationJob_status_idx" ON "VideoGenerationJob"("status");

-- CreateIndex
CREATE INDEX "VideoGenerationJob_createdAt_idx" ON "VideoGenerationJob"("createdAt");
