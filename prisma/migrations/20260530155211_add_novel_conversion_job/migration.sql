-- CreateTable
CREATE TABLE "NovelConversionJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "movieId" TEXT NOT NULL,
    "currentChapter" INTEGER,
    "totalChapters" INTEGER,
    "chaptersJson" TEXT,
    "result" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NovelConversionJob_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "NovelConversionJob_movieId_idx" ON "NovelConversionJob"("movieId");

-- CreateIndex
CREATE INDEX "NovelConversionJob_status_idx" ON "NovelConversionJob"("status");

-- CreateIndex
CREATE INDEX "NovelConversionJob_createdAt_idx" ON "NovelConversionJob"("createdAt");
