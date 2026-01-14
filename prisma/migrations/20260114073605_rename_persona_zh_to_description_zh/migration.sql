/*
  Warnings:

  - You are about to drop the column `personaZh` on the `Persona` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Persona" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "descriptionZh" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Persona" ("createdAt", "description", "id", "isDefault", "name", "systemPrompt", "updatedAt") SELECT "createdAt", "description", "id", "isDefault", "name", "systemPrompt", "updatedAt" FROM "Persona";
DROP TABLE "Persona";
ALTER TABLE "new_Persona" RENAME TO "Persona";
CREATE INDEX "Persona_isDefault_idx" ON "Persona"("isDefault");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
