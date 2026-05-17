-- CreateTable
CREATE TABLE "ProductionPipelineRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "movieId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "sceneIdsJson" TEXT NOT NULL DEFAULT '[]',
    "optionsJson" TEXT NOT NULL DEFAULT '{}',
    "resultJson" TEXT,
    "error" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductionPipelineRun_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ProductionPipelineRun_movieId_idx" ON "ProductionPipelineRun"("movieId");

-- CreateIndex
CREATE INDEX "ProductionPipelineRun_level_idx" ON "ProductionPipelineRun"("level");

-- CreateIndex
CREATE INDEX "ProductionPipelineRun_status_idx" ON "ProductionPipelineRun"("status");

-- CreateIndex
CREATE INDEX "ProductionPipelineRun_createdAt_idx" ON "ProductionPipelineRun"("createdAt");
