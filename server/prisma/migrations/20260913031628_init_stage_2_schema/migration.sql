-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "avatarUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "players" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'India',
    "basePrice" REAL NOT NULL,
    "imageUrl" TEXT,
    "stats" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "logoUrl" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "auction_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'LOBBY',
    "hostId" TEXT NOT NULL,
    "startingPurse" REAL NOT NULL DEFAULT 1000000000,
    "minBidIncrement" REAL NOT NULL DEFAULT 20000000,
    "currentAuctionPlayerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "auction_sessions_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "session_teams" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT,
    "startingPurse" REAL NOT NULL,
    "remainingPurse" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "session_teams_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "auction_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "session_teams_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "session_teams_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "auction_players" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "basePrice" REAL NOT NULL,
    "soldToTeamId" TEXT,
    "soldPrice" REAL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "auction_players_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "auction_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "auction_players_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "auction_players_soldToTeamId_fkey" FOREIGN KEY ("soldToTeamId") REFERENCES "teams" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "bids" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "auctionPlayerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "bidderId" TEXT,
    "amount" REAL NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bids_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "auction_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bids_auctionPlayerId_fkey" FOREIGN KEY ("auctionPlayerId") REFERENCES "auction_players" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "bids_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "bids_bidderId_fkey" FOREIGN KEY ("bidderId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "player_purchases" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "auctionPlayerId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "purchasePrice" REAL NOT NULL,
    "purchasedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "player_purchases_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "auction_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "player_purchases_auctionPlayerId_fkey" FOREIGN KEY ("auctionPlayerId") REFERENCES "auction_players" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "player_purchases_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "player_purchases_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "teams_shortName_key" ON "teams"("shortName");

-- CreateIndex
CREATE UNIQUE INDEX "auction_sessions_roomCode_key" ON "auction_sessions"("roomCode");

-- CreateIndex
CREATE INDEX "auction_sessions_roomCode_idx" ON "auction_sessions"("roomCode");

-- CreateIndex
CREATE INDEX "session_teams_sessionId_idx" ON "session_teams"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "session_teams_sessionId_teamId_key" ON "session_teams"("sessionId", "teamId");

-- CreateIndex
CREATE INDEX "auction_players_sessionId_idx" ON "auction_players"("sessionId");

-- CreateIndex
CREATE INDEX "auction_players_sessionId_status_idx" ON "auction_players"("sessionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "auction_players_sessionId_playerId_key" ON "auction_players"("sessionId", "playerId");

-- CreateIndex
CREATE INDEX "bids_sessionId_idx" ON "bids"("sessionId");

-- CreateIndex
CREATE INDEX "bids_auctionPlayerId_idx" ON "bids"("auctionPlayerId");

-- CreateIndex
CREATE UNIQUE INDEX "player_purchases_auctionPlayerId_key" ON "player_purchases"("auctionPlayerId");

-- CreateIndex
CREATE INDEX "player_purchases_sessionId_idx" ON "player_purchases"("sessionId");

-- CreateIndex
CREATE INDEX "player_purchases_teamId_idx" ON "player_purchases"("teamId");
