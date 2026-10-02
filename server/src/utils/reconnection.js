import { PrismaClient } from '@prisma/client';
import { getSquadsSnapshot } from '../routes/sessions.js';
import { getPlayerTimer } from './bidding.js';

const prisma = new PrismaClient();

// Map tracking active participant ID -> socket ID for duplicate connection handling
const activeParticipantSockets = new Map();

/**
 * Registers a participant's socket and handles duplicate connections from multiple tabs.
 * Keeps the latest socket connection authoritative.
 */
export function registerParticipantSocket(participantId, socket, io) {
  if (!participantId || !socket) return;

  const existingSocketId = activeParticipantSockets.get(participantId);

  if (existingSocketId && existingSocketId !== socket.id) {
    console.log(`[Socket.IO] Duplicate connection detected for participant ${participantId}. Replacing old socket ${existingSocketId} with new socket ${socket.id}`);
    
    // Notify old socket tab that a newer connection took over
    const oldSocket = io.sockets.sockets.get(existingSocketId);
    if (oldSocket) {
      oldSocket.emit('duplicateConnection', {
        message: 'Auction session opened in another tab. This tab is no longer active.'
      });
    }
  }

  activeParticipantSockets.set(participantId, socket.id);
}

/**
 * Clears participant socket mapping on disconnect
 */
export function unregisterParticipantSocket(participantId, socketId) {
  if (activeParticipantSockets.get(participantId) === socketId) {
    activeParticipantSockets.delete(participantId);
  }
}

/**
 * Compiles a complete auctionState snapshot for rehydrating a client on reconnect
 */
export async function getAuctionStateSnapshot(sessionCode, participantId) {
  if (!sessionCode) return null;

  const formattedCode = sessionCode.trim().toUpperCase();

  const session = await prisma.auctionSession.findUnique({
    where: { roomCode: formattedCode },
    include: {
      host: { select: { id: true, username: true } },
      participants: {
        include: {
          user: { select: { id: true, username: true, avatarUrl: true } }
        },
        orderBy: { joinedAt: 'asc' }
      }
    }
  });

  if (!session) return null;

  // 1. Current Auction Player Snapshot
  let currentPlayerPayload = null;
  if (session.currentAuctionPlayerId) {
    const ap = await prisma.auctionPlayer.findUnique({
      where: { id: session.currentAuctionPlayerId },
      include: { player: true }
    });

    if (ap) {
      const latestBid = await prisma.bid.findFirst({
        where: { auctionPlayerId: ap.id },
        orderBy: { timestamp: 'desc' },
        include: {
          bidder: { select: { id: true, username: true } },
          team: true
        }
      });

      const timer = getPlayerTimer(session.id);
      const endsAt = timer ? timer.endsAt : Date.now() + 15000;

      currentPlayerPayload = {
        auctionPlayerId: ap.id,
        orderIndex: ap.orderIndex,
        status: ap.status,
        basePrice: ap.basePrice,
        currentBid: latestBid ? latestBid.amount : ap.basePrice,
        endsAt,
        highestBidder: latestBid
          ? {
              id: latestBid.bidder?.id || latestBid.bidderId,
              username: latestBid.bidder?.username || 'Bidder'
            }
          : null,
        highestBidTeam: latestBid
          ? {
              id: latestBid.team.id,
              name: latestBid.team.name,
              shortName: latestBid.team.shortName,
              logoUrl: latestBid.team.logoUrl,
              primaryColor: latestBid.team.primaryColor
            }
          : null,
        player: ap.player
      };
    }
  }

  // 2. Claimed Team for reconnecting participant
  let claimedTeam = null;
  if (participantId) {
    const sessionTeam = await prisma.sessionTeam.findFirst({
      where: {
        sessionId: session.id,
        userId: participantId
      },
      include: { team: true }
    });

    if (sessionTeam) {
      claimedTeam = {
        teamId: sessionTeam.teamId,
        remainingPurse: sessionTeam.remainingPurse,
        team: sessionTeam.team
      };
    }
  }

  // 3. Squads Snapshot
  const squads = await getSquadsSnapshot(session.id);

  return {
    sessionCode: formattedCode,
    status: session.status,
    session: {
      id: session.id,
      name: session.name,
      roomCode: session.roomCode,
      status: session.status,
      startingPurse: session.startingPurse,
      minBidIncrement: session.minBidIncrement,
      inviteUrl: session.inviteUrl,
      host: session.host,
      participants: session.participants
    },
    currentPlayer: currentPlayerPayload,
    claimedTeam,
    squads,
    participants: session.participants
  };
}
