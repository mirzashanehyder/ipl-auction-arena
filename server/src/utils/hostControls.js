import { PrismaClient } from '@prisma/client';
import { getSquadsSnapshot } from '../routes/sessions.js';
import {
  pauseSessionTimer,
  resumeSessionTimer,
  clearTimerResolution,
  scheduleTimerResolution,
  initializePlayerTimer,
  runWithSessionLock
} from './bidding.js';

const prisma = new PrismaClient();

/**
 * Server-side host permission check.
 * Verifies that the requesting participantId is the actual host of the auction session.
 */
export async function verifyHostPermission(sessionCode, requestingParticipantId) {
  if (!sessionCode || !requestingParticipantId) return null;

  const formattedCode = sessionCode.trim().toUpperCase();
  const session = await prisma.auctionSession.findUnique({
    where: { roomCode: formattedCode },
    include: {
      participants: {
        include: { user: true }
      }
    }
  });

  if (!session) return null;

  const requestingParticipant = session.participants.find(
    (p) => p.userId === requestingParticipantId || p.id === requestingParticipantId
  );

  if (!requestingParticipant) return null;

  const isHost =
    session.hostId === requestingParticipantId ||
    session.hostId === requestingParticipant.userId ||
    requestingParticipant.isHost === true;

  if (!isHost) return null;

  return { session, participant: requestingParticipant };
}

/**
 * Host Action 1: Pause Auction
 */
export async function handlePauseAuction({ sessionCode, participantId, io }) {
  const auth = await verifyHostPermission(sessionCode, participantId);
  if (!auth) {
    return {
      success: false,
      reason: 'Unauthorized: Only the session host can pause the auction.'
    };
  }

  const { session } = auth;
  if (session.status !== 'LIVE') {
    return {
      success: false,
      reason: `Cannot pause auction. Session status is currently ${session.status}.`
    };
  }

  return await runWithSessionLock(session.id, async () => {
    // 1. Update session status to PAUSED
    await prisma.auctionSession.update({
      where: { id: session.id },
      data: { status: 'PAUSED' }
    });

    // 2. Pause server timer
    const remainingMs = pauseSessionTimer(session.id);

    const roomName = `session:${session.roomCode}`;
    if (io) {
      io.to(roomName).emit('auctionPaused', {
        sessionCode: session.roomCode,
        status: 'PAUSED',
        remainingMs,
        message: 'The live auction has been PAUSED by the host.'
      });
    }

    return {
      success: true,
      status: 'PAUSED',
      remainingMs
    };
  });
}

/**
 * Host Action 2: Resume Auction
 */
export async function handleResumeAuction({ sessionCode, participantId, io }) {
  const auth = await verifyHostPermission(sessionCode, participantId);
  if (!auth) {
    return {
      success: false,
      reason: 'Unauthorized: Only the session host can resume the auction.'
    };
  }

  const { session } = auth;
  if (session.status !== 'PAUSED') {
    return {
      success: false,
      reason: `Cannot resume auction. Session status is currently ${session.status}.`
    };
  }

  return await runWithSessionLock(session.id, async () => {
    // 1. Update session status to LIVE
    await prisma.auctionSession.update({
      where: { id: session.id },
      data: { status: 'LIVE' }
    });

    // 2. Resume server timer
    const timer = resumeSessionTimer(session.id);

    // 3. Schedule resolution timeout
    scheduleTimerResolution(session.id, session.roomCode, io);

    const roomName = `session:${session.roomCode}`;
    if (io) {
      io.to(roomName).emit('auctionResumed', {
        sessionCode: session.roomCode,
        status: 'LIVE',
        endsAt: timer.endsAt,
        message: 'The live auction has been RESUMED by the host.'
      });

      io.to(roomName).emit('timerUpdated', {
        sessionCode: session.roomCode,
        endsAt: timer.endsAt,
        durationMs: timer.durationMs
      });
    }

    return {
      success: true,
      status: 'LIVE',
      endsAt: timer.endsAt
    };
  });
}

/**
 * Host Action 3: Skip Current Player (Force UNSOLD)
 */
export async function handleSkipPlayer({ sessionCode, participantId, io }) {
  const auth = await verifyHostPermission(sessionCode, participantId);
  if (!auth) {
    return {
      success: false,
      reason: 'Unauthorized: Only the session host can skip a player.'
    };
  }

  const { session } = auth;
  if (!session.currentAuctionPlayerId) {
    return {
      success: false,
      reason: 'No player is currently on the auction block.'
    };
  }

  return await runWithSessionLock(session.id, async () => {
    clearTimerResolution(session.id);

    const currentAP = await prisma.auctionPlayer.findUnique({
      where: { id: session.currentAuctionPlayerId },
      include: { player: true }
    });

    if (!currentAP || currentAP.status !== 'CURRENT') {
      return {
        success: false,
        reason: 'Current auction player is not active.'
      };
    }

    // Mark UNSOLD
    await prisma.auctionPlayer.update({
      where: { id: currentAP.id },
      data: { status: 'UNSOLD' }
    });

    const roomName = `session:${session.roomCode}`;
    if (io) {
      io.to(roomName).emit('playerUnsold', {
        sessionCode: session.roomCode,
        auctionPlayerId: currentAP.id,
        player: currentAP.player,
        reason: 'Player skipped by Host'
      });
    }

    // Auto advance after 2.5s
    setTimeout(async () => {
      await advanceNextPlayer(session.id, session.roomCode, io);
    }, 2500);

    return { success: true };
  });
}

/**
 * Host Action 4: Force Sell Player to Chosen Team & Price
 */
export async function handleForceSellPlayer({ sessionCode, participantId, targetTeamId, amount, io }) {
  const auth = await verifyHostPermission(sessionCode, participantId);
  if (!auth) {
    return {
      success: false,
      reason: 'Unauthorized: Only the session host can force sell a player.'
    };
  }

  const { session } = auth;
  if (!session.currentAuctionPlayerId) {
    return {
      success: false,
      reason: 'No player is currently on the auction block.'
    };
  }

  const numericAmount = Number(amount);
  if (isNaN(numericAmount) || numericAmount <= 0) {
    return {
      success: false,
      reason: 'Force sell price must be a valid positive number.'
    };
  }

  return await runWithSessionLock(session.id, async () => {
    clearTimerResolution(session.id);

    const currentAP = await prisma.auctionPlayer.findUnique({
      where: { id: session.currentAuctionPlayerId },
      include: { player: true }
    });

    if (!currentAP || currentAP.status !== 'CURRENT') {
      return {
        success: false,
        reason: 'Current auction player is not active.'
      };
    }

    // Verify Target Team
    const targetSessionTeam = await prisma.sessionTeam.findFirst({
      where: {
        sessionId: session.id,
        teamId: targetTeamId
      },
      include: {
        team: true,
        user: { select: { id: true, username: true } }
      }
    });

    if (!targetSessionTeam) {
      return {
        success: false,
        reason: 'Selected target franchise is invalid or not in this auction room.'
      };
    }

    if (targetSessionTeam.remainingPurse < numericAmount) {
      return {
        success: false,
        reason: `Target team ${targetSessionTeam.team.shortName} has insufficient purse (₹${(targetSessionTeam.remainingPurse / 10000000).toFixed(2)} Cr) for ₹${(numericAmount / 10000000).toFixed(2)} Cr.`
      };
    }

    // DB Transaction for Force Sell
    const result = await prisma.$transaction(async (tx) => {
      const updatedAP = await tx.auctionPlayer.update({
        where: { id: currentAP.id },
        data: {
          status: 'SOLD',
          soldToTeamId: targetTeamId,
          soldPrice: numericAmount
        },
        include: { player: true }
      });

      await tx.playerPurchase.create({
        data: {
          sessionId: session.id,
          auctionPlayerId: currentAP.id,
          playerId: currentAP.playerId,
          teamId: targetTeamId,
          purchasePrice: numericAmount
        }
      });

      const newPurse = Math.max(0, targetSessionTeam.remainingPurse - numericAmount);
      await tx.sessionTeam.update({
        where: { id: targetSessionTeam.id },
        data: { remainingPurse: newPurse }
      });

      return { updatedAP, newPurse };
    });

    const roomName = `session:${session.roomCode}`;
    if (io) {
      io.to(roomName).emit('playerSold', {
        sessionCode: session.roomCode,
        auctionPlayerId: currentAP.id,
        soldPrice: numericAmount,
        winningTeam: {
          id: targetSessionTeam.team.id,
          name: targetSessionTeam.team.name,
          shortName: targetSessionTeam.team.shortName,
          logoUrl: targetSessionTeam.team.logoUrl,
          primaryColor: targetSessionTeam.team.primaryColor
        },
        winningBidder: {
          id: targetSessionTeam.userId,
          username: targetSessionTeam.user?.username || 'Franchise Manager'
        },
        player: currentAP.player,
        updatedPurse: result.newPurse,
        isForceSell: true
      });

      const squadsSnapshot = await getSquadsSnapshot(session.id);
      io.to(roomName).emit('squadsUpdated', {
        sessionCode: session.roomCode,
        squads: squadsSnapshot
      });
    }

    // Auto advance after 2.5s
    setTimeout(async () => {
      await advanceNextPlayer(session.id, session.roomCode, io);
    }, 2500);

    return { success: true };
  });
}

/**
 * Host Action 5: End Auction Early
 */
export async function handleEndAuctionEarly({ sessionCode, participantId, io }) {
  const auth = await verifyHostPermission(sessionCode, participantId);
  if (!auth) {
    return {
      success: false,
      reason: 'Unauthorized: Only the session host can end the auction.'
    };
  }

  const { session } = auth;

  return await runWithSessionLock(session.id, async () => {
    clearTimerResolution(session.id);

    await prisma.auctionSession.update({
      where: { id: session.id },
      data: {
        status: 'COMPLETED',
        currentAuctionPlayerId: null
      }
    });

    const roomName = `session:${session.roomCode}`;
    if (io) {
      io.to(roomName).emit('auctionEnded', {
        sessionCode: session.roomCode,
        status: 'COMPLETED',
        message: 'The live auction has been ENDED early by the session host.'
      });
    }

    return { success: true, status: 'COMPLETED' };
  });
}

/**
 * Helper to advance to next available player
 */
async function advanceNextPlayer(sessionId, sessionCode, io) {
  return await runWithSessionLock(sessionId, async () => {
    const nextAvailable = await prisma.auctionPlayer.findFirst({
      where: {
        sessionId,
        status: 'AVAILABLE'
      },
      include: { player: true },
      orderBy: { orderIndex: 'asc' }
    });

    const roomName = `session:${sessionCode}`;

    if (nextAvailable) {
      await prisma.$transaction([
        prisma.auctionSession.update({
          where: { id: sessionId },
          data: {
            status: 'LIVE',
            currentAuctionPlayerId: nextAvailable.id
          }
        }),
        prisma.auctionPlayer.update({
          where: { id: nextAvailable.id },
          data: { status: 'CURRENT' }
        })
      ]);

      const timer = initializePlayerTimer(sessionId);
      const nextPlayerPayload = {
        auctionPlayerId: nextAvailable.id,
        orderIndex: nextAvailable.orderIndex,
        status: 'CURRENT',
        basePrice: nextAvailable.basePrice,
        currentBid: nextAvailable.basePrice,
        endsAt: timer.endsAt,
        highestBidder: null,
        highestBidTeam: null,
        player: nextAvailable.player
      };

      scheduleTimerResolution(sessionId, sessionCode, io);

      if (io) {
        io.to(roomName).emit('nextPlayer', {
          sessionCode,
          status: 'LIVE',
          currentPlayer: nextPlayerPayload
        });
        io.to(roomName).emit('currentPlayer', {
          sessionCode,
          status: 'LIVE',
          currentPlayer: nextPlayerPayload
        });
      }
    } else {
      await prisma.auctionSession.update({
        where: { id: sessionId },
        data: {
          status: 'COMPLETED',
          currentAuctionPlayerId: null
        }
      });

      if (io) {
        io.to(roomName).emit('auctionEnded', {
          sessionCode,
          status: 'COMPLETED',
          message: 'All players in the draft pool have been auctioned! The auction has concluded.'
        });
      }
    }
  });
}
