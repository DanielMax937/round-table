-- CreateTable
CREATE TABLE "MoeVoteJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "includeDiscussionAgentsInVoting" BOOLEAN NOT NULL DEFAULT false,
    "agentCount" INTEGER NOT NULL DEFAULT 3,
    "roundTableId" TEXT NOT NULL,
    "currentRound" INTEGER,
    "currentPhase" TEXT,
    "result" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    CONSTRAINT "MoeVoteJob_roundTableId_fkey" FOREIGN KEY ("roundTableId") REFERENCES "RoundTable" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "MoeVoteJob_roundTableId_key" ON "MoeVoteJob"("roundTableId");

-- CreateIndex
CREATE INDEX "MoeVoteJob_status_idx" ON "MoeVoteJob"("status");

-- CreateIndex
CREATE INDEX "MoeVoteJob_createdAt_idx" ON "MoeVoteJob"("createdAt");
