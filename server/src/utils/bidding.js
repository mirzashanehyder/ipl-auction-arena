import { PrismaClient } from '@prisma/client';
import { getSquadsSnapshot } from '../routes/sessions.js';

const prisma = new PrismaClient();
const sessionLocks = new Map();
const sessionTimers = new Map();
const resolutionTimeouts = new Map();

const DEFAULT_TIMER_DURATION_MS = 15000; // 15 seconds per bid
const MAX_PLAYER_CEILING_MS = 120000;    // 2 minutes maximum per player auction

/**
 * Initializes timer for a player on auction start
 */
export function initializePlayerTimer(sessionId, durationMs = DEFAULT_TIMER_DURATION_MS, maxCeilingMs = MAX_PLAYER_CEILING_MS) {
  const now = Date.now();
  const timerData = {
    endsAt: now + durationMs,
    auctionStartedAt: now,
    durationMs
  };
  sessionTimers.set(sessionId, timerData);
  return timerData;
}

/**
 * Resets timer on bid accepted, capped so player auction time cannot exceed 2 minutes
 */
export function resetPlayerTimerOnBid(sessionId, extensionMs = DEFAULT_TIMER_DURATION_MS, maxCeilingMs = MAX_PLAYER_CEILING_MS) {
  const existingTimer = sessionTimers.get(sessionId);
  const now = Date.now();
  const auctionStartedAt = existingTimer?.auctionStartedAt || now;
  const hardCeiling = auctionStartedAt + maxCeilingMs;
  const newEndsAt = Math.min(now + extensionMs, hardCeiling);

  const timerData = {
    endsAt: newEndsAt,
    auctionStartedAt,
    durationMs: extensionMs
  };

  sessionTimers.set(sessionId, timerData);
  return timerData;
}

/**
 * Retrieves current active timer for a session
 */
export function getPlayerTimer(sessionId) {
  let timer = sessionTimers.get(sessionId);
  if (!timer) {
    // Graceful fallback if server restarted during active session
    timer = initializePlayerTimer(sessionId);
  }
  return timer;
}

/**
 * Clears scheduled timer resolution timeout for a session
 */
export function clearTimerResolution(sessionId) {
  if (resolutionTimeouts.has(sessionId)) {
    clearTimeout(resolutionTimeouts.get(sessionId));
    resolutionTimeouts.delete(sessionId);
  }
}

/**
 * Pauses timer for a session and records remaining milliseconds
 */
export function pauseSessionTimer(sessionId) {
  clearTimerResolution(sessionId);
  const existing = sessionTimers.get(sessionId);
  if (existing) {
    const remainingMs = Math.max(0, existing.endsAt - Date.now());
    const pausedTimer = {
      ...existing,
      isPaused: true,
      remainingMsOnPause: remainingMs
    };
    sessionTimers.set(sessionId, pausedTimer);
    return remainingMs;
  }
  return 0;
}

/**
 * Resumes timer for a session with remaining milliseconds
 */
export function resumeSessionTimer(sessionId) {
  const existing = sessionTimers.get(sessionId);
  const duration = existing?.remainingMsOnPause && existing.remainingMsOnPause > 0 ? existing.remainingMsOnPause : DEFAULT_TIMER_DURATION_MS;
  const now = Date.now();
  const timerData = {
    endsAt: now + duration,
    auctionStartedAt: existing?.auctionStartedAt || now,
    durationMs: duration,
    isPaused: false
  };
  sessionTimers.set(sessionId, timerData);
  return timerData;
}

/**
 * Schedules automated timer resolution when endsAt passes
 */
export function scheduleTimerResolution(sessionId, roomCode, io) {
  if (resolutionTimeouts.has(sessionId)) {
    clearTimeout(resolutionTimeouts.get(sessionId));
    resolutionTimeouts.delete(sessionId);
  }

  const timer = getPlayerTimer(sessionId);
  if (!timer) return;

  const now = Date.now();
  const delay = Math.max(0, timer.endsAt - now);

  const timeoutId = setTimeout(async () => {
    resolutionTimeouts.delete(sessionId);
    await resolveCurrentPlayer(sessionId, roomCode, io);
  }, delay + 50);

  resolutionTimeouts.set(sessionId, timeoutId);
}

/**
 * Executes Stage 12 Sold / Unsold Player Logic on timer expiry:
 * 1. Checks if highest bid exists -> SOLD, creates PlayerPurchase, deducts purse, emits playerSold
 * 2. If no bids -> UNSOLD, emits playerUnsold
 * 3. After 3.5s pause, automatically advances to next AVAILABLE player or emits auctionEnded
 */
export async function resolveCurrentPlayer(sessionId, roomCode, io) {
  return await runWithSessionLock(sessionId, async () => {
    try {
      const formattedCode = roomCode.trim().toUpperCase();

      // Step 1: Query Session & Current Auction Player
      const session = await prisma.auctionSession.findUnique({
        where: { id: sessionId }
      });

      if (!session || session.status !== 'LIVE' || !session.currentAuctionPlayerId) {
        return;
      }

      const timer = getPlayerTimer(sessionId);
      if (timer && Date.now() < timer.endsAt) {
        // Timer was extended by a new bid; reschedule resolution
        scheduleTimerResolution(sessionId, formattedCode, io);
        return;
      }

      const auctionPlayer = await prisma.auctionPlayer.findUnique({
        where: { id: session.currentAuctionPlayerId },
        include: { player: true }
      });

      if (!auctionPlayer || auctionPlayer.status !== 'CURRENT') {
        return;
      }

      // Step 2: Query latest highest bid
      const latestBid = await prisma.bid.findFirst({
        where: { auctionPlayerId: auctionPlayer.id },
        orderBy: { timestamp: 'desc' },
        include: {
          bidder: { select: { id: true, username: true } },
          team: true
        }
      });

      if (latestBid) {
        // ===================================
        // SCENARIO A: PLAYER SOLD
        // ===================================
        const result = await prisma.$transaction(async (tx) => {
          // 1. Update AuctionPlayer status to SOLD
          const updatedAP = await tx.auctionPlayer.update({
            where: { id: auctionPlayer.id },
            data: {
              status: 'SOLD',
              soldToTeamId: latestBid.teamId,
              soldPrice: latestBid.amount
            },
            include: { player: true, soldToTeam: true }
          });

          // 2. Create PlayerPurchase record
          const purchase = await tx.playerPurchase.create({
            data: {
              sessionId: session.id,
              auctionPlayerId: auctionPlayer.id,
              playerId: auctionPlayer.playerId,
              teamId: latestBid.teamId,
              purchasePrice: latestBid.amount
            }
          });

          // 3. Deduct sold price from team's session purse
          const sessionTeam = await tx.sessionTeam.findFirst({
            where: {
              sessionId: session.id,
              teamId: latestBid.teamId
            }
          });

          let updatedPurse = sessionTeam?.remainingPurse ?? session.startingPurse;
          if (sessionTeam) {
            const newPurse = Math.max(0, sessionTeam.remainingPurse - latestBid.amount);
            await tx.sessionTeam.update({
              where: { id: sessionTeam.id },
              data: { remainingPurse: newPurse }
            });
            updatedPurse = newPurse;
          }

          return { updatedAP, purchase, updatedPurse };
        });

        // Broadcast playerSold event with full details
        if (io) {
          io.to(`session:${formattedCode}`).emit('playerSold', {
            sessionCode: formattedCode,
            auctionPlayerId: auctionPlayer.id,
            soldPrice: latestBid.amount,
            winningTeam: {
              id: latestBid.team.id,
              name: latestBid.team.name,
              shortName: latestBid.team.shortName,
              logoUrl: latestBid.team.logoUrl,
              primaryColor: latestBid.team.primaryColor
            },
            winningBidder: {
              id: latestBid.bidder?.id || latestBid.bidderId,
              username: latestBid.bidder?.username || 'Bidder'
            },
            player: auctionPlayer.player,
            updatedPurse: result.updatedPurse
          });

          // Broadcast updated squads snapshot to all participants
          const squadsSnapshot = await getSquadsSnapshot(session.id);
          io.to(`session:${formattedCode}`).emit('squadsUpdated', {
            sessionCode: formattedCode,
            squads: squadsSnapshot
          });
        }
      } else {
        // ===================================
        // SCENARIO B: PLAYER UNSOLD
        // ===================================
        await prisma.auctionPlayer.update({
          where: { id: auctionPlayer.id },
          data: { status: 'UNSOLD' }
        });

        if (io) {
          io.to(`session:${formattedCode}`).emit('playerUnsold', {
            sessionCode: formattedCode,
            auctionPlayerId: auctionPlayer.id,
            player: auctionPlayer.player
          });
        }
      }

      // Step 3: Automatic Queue Advancement after 3.5s pause
      setTimeout(async () => {
        try {
          await runWithSessionLock(sessionId, async () => {
            const nextAvailablePlayer = await prisma.auctionPlayer.findFirst({
              where: {
                sessionId: session.id,
                status: 'AVAILABLE'
              },
              include: { player: true },
              orderBy: { orderIndex: 'asc' }
            });

            if (nextAvailablePlayer) {
              // Advance to next AVAILABLE player
              await prisma.$transaction([
                prisma.auctionSession.update({
                  where: { id: session.id },
                  data: {
                    status: 'LIVE',
                    currentAuctionPlayerId: nextAvailablePlayer.id
                  }
                }),
                prisma.auctionPlayer.update({
                  where: { id: nextAvailablePlayer.id },
                  data: { status: 'CURRENT' }
                })
              ]);

              const timer = initializePlayerTimer(session.id);
              const nextPlayerPayload = {
                auctionPlayerId: nextAvailablePlayer.id,
                orderIndex: nextAvailablePlayer.orderIndex,
                status: 'CURRENT',
                basePrice: nextAvailablePlayer.basePrice,
                currentBid: nextAvailablePlayer.basePrice,
                endsAt: timer.endsAt,
                highestBidder: null,
                highestBidTeam: null,
                player: nextAvailablePlayer.player
              };

              // Schedule resolution timer for next player
              scheduleTimerResolution(session.id, formattedCode, io);

              if (io) {
                io.to(`session:${formattedCode}`).emit('nextPlayer', {
                  sessionCode: formattedCode,
                  status: 'LIVE',
                  currentPlayer: nextPlayerPayload
                });
                io.to(`session:${formattedCode}`).emit('currentPlayer', {
                  sessionCode: formattedCode,
                  status: 'LIVE',
                  currentPlayer: nextPlayerPayload
                });
              }
            } else {
              // Queue exhausted -> Auction Completed
              await prisma.auctionSession.update({
                where: { id: session.id },
                data: {
                  status: 'COMPLETED',
                  currentAuctionPlayerId: null
                }
              });

              if (io) {
                io.to(`session:${formattedCode}`).emit('auctionEnded', {
                  sessionCode: formattedCode,
                  status: 'COMPLETED',
                  message: 'All players in the draft pool have been auctioned! The auction has concluded.'
                });
              }
            }
          });
        } catch (err) {
          console.error('Error during auto-advance next player:', err);
        }
      }, 3500);

    } catch (err) {
      console.error('Error resolving current player timer:', err);
    }
  });
}

/**
 * Ensures sequential execution per session to prevent race conditions on simultaneous bids
 */
export function runWithSessionLock(sessionId, fn) {
  let lock = sessionLocks.get(sessionId);
  if (!lock) {
    lock = Promise.resolve();
  }
  let resolveNext;
  const nextLock = new Promise((resolve) => {
    resolveNext = resolve;
  });
  sessionLocks.set(sessionId, lock.then(() => nextLock));

  return lock
    .then(async () => {
      try {
        return await fn();
      } finally {
        resolveNext();
        if (sessionLocks.get(sessionId) === nextLock) {
          sessionLocks.delete(sessionId);
        }
      }
    })
    .catch((err) => {
      resolveNext();
      if (sessionLocks.get(sessionId) === nextLock) {
        sessionLocks.delete(sessionId);
      }
      throw err;
    });
}

/**
 * Process a bid according to Stage 10 & 11 strict validation order:
 * 1. AuctionSession status is LIVE and AuctionPlayer status is CURRENT
 * 2. Participant is connected and has claimed a team in this session
 * 3. Bid amount is strictly greater than current bid AND valid multiple of minBidIncrement
 * 4. Participant's team purse remaining covers the bid
 * 5. Auction timer has not expired (server-owned clock shows Date.now() < endsAt)
 */
export async function processBid({ sessionCode, participantId, amount, io }) {
  if (!sessionCode) {
    return {
      success: false,
      code: 'ROOM_CODE_REQUIRED',
      reason: 'Session room code is required to place a bid.'
    };
  }

  const formattedCode = sessionCode.trim().toUpperCase();
  const numericAmount = Number(amount);

  if (!participantId) {
    return {
      success: false,
      code: 'PARTICIPANT_REQUIRED',
      reason: 'Participant ID is required to place a bid.'
    };
  }

  if (isNaN(numericAmount) || numericAmount <= 0) {
    return {
      success: false,
      code: 'INVALID_BID_AMOUNT',
      reason: 'Bid amount must be a positive number.'
    };
  }

  // Find Session
  const session = await prisma.auctionSession.findUnique({
    where: { roomCode: formattedCode }
  });

  if (!session) {
    return {
      success: false,
      code: 'SESSION_NOT_FOUND',
      reason: `Auction room ${formattedCode} not found.`
    };
  }

  // Execute within per-session lock to serialize incoming bids
  return await runWithSessionLock(session.id, async () => {
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Step 1: AuctionSession status is LIVE and target AuctionPlayer is CURRENT
        const currentSession = await tx.auctionSession.findUnique({
          where: { id: session.id }
        });

        if (!currentSession || currentSession.status !== 'LIVE') {
          const err = new Error(`Cannot place bid. Auction session status is ${currentSession?.status || 'UNKNOWN'}, not LIVE.`);
          err.code = 'AUCTION_NOT_LIVE';
          throw err;
        }

        if (!currentSession.currentAuctionPlayerId) {
          const err = new Error('No player is currently on the auction block.');
          err.code = 'NO_CURRENT_PLAYER';
          throw err;
        }

        const auctionPlayer = await tx.auctionPlayer.findUnique({
          where: { id: currentSession.currentAuctionPlayerId },
          include: { player: true }
        });

        if (!auctionPlayer || auctionPlayer.status !== 'CURRENT') {
          const err = new Error(`Cannot place bid. Current player status is ${auctionPlayer?.status || 'UNKNOWN'}, not CURRENT.`);
          err.code = 'PLAYER_NOT_CURRENT';
          throw err;
        }

        // Step 2: Participant is connected and has claimed a team in this session
        const participantTeam = await tx.sessionTeam.findFirst({
          where: {
            sessionId: session.id,
            userId: participantId
          },
          include: {
            team: true,
            user: { select: { id: true, username: true } }
          }
        });

        if (!participantTeam) {
          const err = new Error('You must claim a team franchise in this session before placing bids.');
          err.code = 'TEAM_NOT_CLAIMED';
          throw err;
        }

        // Fetch latest highest bid for this auction player
        const latestBid = await tx.bid.findFirst({
          where: { auctionPlayerId: auctionPlayer.id },
          orderBy: { timestamp: 'desc' }
        });

        const effectiveCurrentBid = latestBid ? latestBid.amount : auctionPlayer.basePrice;
        const minIncrement = currentSession.minBidIncrement || 20000000;

        // Step 3: Bid amount strictly greater than current bid AND valid multiple of minBidIncrement
        if (numericAmount <= effectiveCurrentBid) {
          const err = new Error(`Bid of ₹${(numericAmount / 10000000).toFixed(2)} Cr must be strictly greater than current bid of ₹${(effectiveCurrentBid / 10000000).toFixed(2)} Cr.`);
          err.code = 'BID_TOO_LOW';
          throw err;
        }

        const bidDiff = Math.round(numericAmount - effectiveCurrentBid);
        const roundedIncrement = Math.round(minIncrement);
        const remainder = bidDiff % roundedIncrement;

        if (remainder !== 0) {
          const err = new Error(`Bid amount must be a valid multiple of minimum increment (₹${(minIncrement / 100000).toFixed(0)} Lakhs) above current bid.`);
          err.code = 'INVALID_BID_INCREMENT';
          throw err;
        }

        // Step 4: Participant's team purse remaining covers the bid
        if (participantTeam.remainingPurse < numericAmount) {
          const err = new Error(`Insufficient purse remaining. Your team ${participantTeam.team.shortName} has ₹${(participantTeam.remainingPurse / 10000000).toFixed(2)} Cr available, but bid requires ₹${(numericAmount / 10000000).toFixed(2)} Cr.`);
          err.code = 'INSUFFICIENT_PURSE';
          throw err;
        }

        // Step 5: Auction timer has not expired (server-owned clock shows Date.now() < endsAt)
        const timer = getPlayerTimer(session.id);
        const now = Date.now();

        if (timer && now >= timer.endsAt) {
          const err = new Error(`Auction timer has expired for ${auctionPlayer.player.name}. Server clock shows endsAt has already passed.`);
          err.code = 'TIMER_EXPIRED';
          throw err;
        }

        // All 5 steps passed! Create Bid record and update AuctionPlayer
        const newBid = await tx.bid.create({
          data: {
            sessionId: session.id,
            auctionPlayerId: auctionPlayer.id,
            teamId: participantTeam.teamId,
            bidderId: participantId,
            amount: numericAmount
          },
          include: {
            team: true,
            bidder: { select: { id: true, username: true } }
          }
        });

        // Update current bid tracking on AuctionPlayer
        await tx.auctionPlayer.update({
          where: { id: auctionPlayer.id },
          data: {
            soldPrice: numericAmount
          }
        });

        // Reset server-authoritative timer for next bid
        const updatedTimer = resetPlayerTimerOnBid(session.id);

        // Schedule automated resolution when timer expires
        if (io) {
          scheduleTimerResolution(session.id, formattedCode, io);
        }

        return {
          sessionCode: formattedCode,
          bid: {
            id: newBid.id,
            auctionPlayerId: auctionPlayer.id,
            amount: newBid.amount,
            timestamp: newBid.timestamp,
            team: {
              id: newBid.team.id,
              name: newBid.team.name,
              shortName: newBid.team.shortName,
              logoUrl: newBid.team.logoUrl,
              primaryColor: newBid.team.primaryColor
            },
            bidder: {
              id: newBid.bidder?.id || participantId,
              username: newBid.bidder?.username || participantTeam.user?.username || 'Bidder'
            }
          },
          currentPlayer: {
            auctionPlayerId: auctionPlayer.id,
            orderIndex: auctionPlayer.orderIndex,
            status: auctionPlayer.status,
            basePrice: auctionPlayer.basePrice,
            currentBid: newBid.amount,
            endsAt: updatedTimer.endsAt,
            highestBidder: {
              id: newBid.bidder?.id || participantId,
              username: newBid.bidder?.username || participantTeam.user?.username || 'Bidder'
            },
            highestBidTeam: {
              id: newBid.team.id,
              name: newBid.team.name,
              shortName: newBid.team.shortName,
              logoUrl: newBid.team.logoUrl,
              primaryColor: newBid.team.primaryColor
            },
            player: auctionPlayer.player
          }
        };
      });

      return {
        success: true,
        data: result
      };
    } catch (err) {
      return {
        success: false,
        code: err.code || 'BID_REJECTED',
        reason: err.message || 'Bid rejected by server.'
      };
    }
  });
}
