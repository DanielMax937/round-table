-- CreateTable
CREATE TABLE "SceneExecutionJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "movieId" TEXT NOT NULL,
    "sceneOutlineId" TEXT,
    "sceneId" TEXT,
    "outlineIndex" INTEGER NOT NULL,
    "currentRound" INTEGER,
    "currentAgentName" TEXT,
    "currentPhase" TEXT,
    "result" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SceneExecutionJob_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SceneExecutionJob_sceneOutlineId_fkey" FOREIGN KEY ("sceneOutlineId") REFERENCES "SceneOutline" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SceneExecutionJob_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SceneExecutionJob_movieId_idx" ON "SceneExecutionJob"("movieId");

-- CreateIndex
CREATE INDEX "SceneExecutionJob_sceneOutlineId_idx" ON "SceneExecutionJob"("sceneOutlineId");

-- CreateIndex
CREATE INDEX "SceneExecutionJob_sceneId_idx" ON "SceneExecutionJob"("sceneId");

-- CreateIndex
CREATE INDEX "SceneExecutionJob_status_idx" ON "SceneExecutionJob"("status");

-- CreateIndex
CREATE INDEX "SceneExecutionJob_createdAt_idx" ON "SceneExecutionJob"("createdAt");
