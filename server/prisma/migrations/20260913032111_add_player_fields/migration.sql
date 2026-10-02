-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_players" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'India',
    "basePrice" REAL NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Capped',
    "battingStyle" TEXT,
    "bowlingStyle" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "imageUrl" TEXT,
    "stats" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_players" ("basePrice", "country", "createdAt", "id", "imageUrl", "name", "role", "stats", "updatedAt") SELECT "basePrice", "country", "createdAt", "id", "imageUrl", "name", "role", "stats", "updatedAt" FROM "players";
DROP TABLE "players";
ALTER TABLE "new_players" RENAME TO "players";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
