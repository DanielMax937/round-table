-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RoundTable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topic" TEXT NOT NULL,
    "agentCount" INTEGER NOT NULL,
    "maxRounds" INTEGER NOT NULL DEFAULT 5,
    "status" TEXT NOT NULL DEFAULT 'active',
    "language" TEXT NOT NULL DEFAULT 'zh',
    "selectedAgentIds" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_RoundTable" ("agentCount", "createdAt", "id", "maxRounds", "selectedAgentIds", "status", "topic", "updatedAt") SELECT "agentCount", "createdAt", "id", "maxRounds", "selectedAgentIds", "status", "topic", "updatedAt" FROM "RoundTable";
DROP TABLE "RoundTable";
ALTER TABLE "new_RoundTable" RENAME TO "RoundTable";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
