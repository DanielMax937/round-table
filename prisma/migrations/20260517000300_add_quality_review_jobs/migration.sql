-- CreateTable
CREATE TABLE "QualityReviewJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "movieId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "sceneId" TEXT,
    "visualAssetJobId" TEXT,
    "videoGenerationJobId" TEXT,
    "title" TEXT NOT NULL,
    "score" INTEGER,
    "aiFeel" TEXT,
    "industryLevel" TEXT,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "summary" TEXT,
    "issuesJson" TEXT NOT NULL DEFAULT '[]',
    "repairInstructions" TEXT,
    "resultJson" TEXT,
    "error" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QualityReviewJob_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QualityReviewJob_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "QualityReviewJob_visualAssetJobId_fkey" FOREIGN KEY ("visualAssetJobId") REFERENCES "VisualAssetJob" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "QualityReviewJob_videoGenerationJobId_fkey" FOREIGN KEY ("videoGenerationJobId") REFERENCES "VideoGenerationJob" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "QualityReviewJob_movieId_idx" ON "QualityReviewJob"("movieId");

-- CreateIndex
CREATE INDEX "QualityReviewJob_targetType_idx" ON "QualityReviewJob"("targetType");

-- CreateIndex
CREATE INDEX "QualityReviewJob_targetId_idx" ON "QualityReviewJob"("targetId");

-- CreateIndex
CREATE INDEX "QualityReviewJob_sceneId_idx" ON "QualityReviewJob"("sceneId");

-- CreateIndex
CREATE INDEX "QualityReviewJob_visualAssetJobId_idx" ON "QualityReviewJob"("visualAssetJobId");

-- CreateIndex
CREATE INDEX "QualityReviewJob_videoGenerationJobId_idx" ON "QualityReviewJob"("videoGenerationJobId");

-- CreateIndex
CREATE INDEX "QualityReviewJob_status_idx" ON "QualityReviewJob"("status");

-- CreateIndex
CREATE INDEX "QualityReviewJob_passed_idx" ON "QualityReviewJob"("passed");

-- CreateIndex
CREATE INDEX "QualityReviewJob_createdAt_idx" ON "QualityReviewJob"("createdAt");
