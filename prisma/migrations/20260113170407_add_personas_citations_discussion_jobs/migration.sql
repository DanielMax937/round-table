-- AlterTable
ALTER TABLE "Message" ADD COLUMN "citations" TEXT;

-- AlterTable
ALTER TABLE "RoundTable" ADD COLUMN "selectedAgentIds" TEXT;

-- CreateTable
CREATE TABLE "Persona" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DiscussionJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "agentCount" INTEGER NOT NULL,
    "maxRounds" INTEGER NOT NULL DEFAULT 5,
    "roundTableId" TEXT NOT NULL,
    "currentRound" INTEGER,
    "currentPhase" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    CONSTRAINT "DiscussionJob_roundTableId_fkey" FOREIGN KEY ("roundTableId") REFERENCES "RoundTable" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Agent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roundTableId" TEXT NOT NULL,
    "personaId" TEXT,
    "name" TEXT NOT NULL,
    "persona" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "Agent_roundTableId_fkey" FOREIGN KEY ("roundTableId") REFERENCES "RoundTable" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Agent_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Agent" ("id", "name", "order", "persona", "roundTableId") SELECT "id", "name", "order", "persona", "roundTableId" FROM "Agent";
DROP TABLE "Agent";
ALTER TABLE "new_Agent" RENAME TO "Agent";
CREATE INDEX "Agent_roundTableId_idx" ON "Agent"("roundTableId");
CREATE INDEX "Agent_personaId_idx" ON "Agent"("personaId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Persona_isDefault_idx" ON "Persona"("isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "DiscussionJob_roundTableId_key" ON "DiscussionJob"("roundTableId");

-- CreateIndex
CREATE INDEX "DiscussionJob_status_idx" ON "DiscussionJob"("status");

-- CreateIndex
CREATE INDEX "DiscussionJob_createdAt_idx" ON "DiscussionJob"("createdAt");
