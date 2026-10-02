import express from 'express';
import { PrismaClient } from '@prisma/client';
import { generateUniqueRoomCode } from '../utils/roomCode.js';
import { processBid, initializePlayerTimer, getPlayerTimer, scheduleTimerResolution } from '../utils/bidding.js';

const router = express.Router();
const prisma = new PrismaClient();

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// POST /api/sessions
// Create a new auction session (Host becomes participant #1)
router.post('/', async (req, res) => {
  try {
    const {
      hostName,
      sessionName,
      startingPurse,
      minBidIncrement,
      playerPoolOption = 'ALL',
      orderType = 'SHUFFLE'
    } = req.body;

    if (!hostName || !hostName.trim()) {
      return res.status(400).json({ success: false, message: 'Host name is required' });
    }

    if (!sessionName || !sessionName.trim()) {
      return res.status(400).json({ success: false, message: 'Session title is required' });
    }

    // 1. Create or find host User
    const trimmedHostName = hostName.trim();
    let hostUser = await prisma.user.findFirst({
      where: { username: trimmedHostName }
    });

    if (!hostUser) {
      hostUser = await prisma.user.create({
        data: { username: trimmedHostName }
      });
    }

    // 2. Generate unique human-readable room code
    const roomCode = await generateUniqueRoomCode(prisma);

    const parsedStartingPurse = Number(startingPurse) || 1200000000;
    const parsedMinBidIncrement = Number(minBidIncrement) || 20000000;

    // 3. Create AuctionSession in LOBBY status
    const session = await prisma.auctionSession.create({
      data: {
        roomCode,
        name: sessionName.trim(),
        status: 'LOBBY',
        hostId: hostUser.id,
        startingPurse: parsedStartingPurse,
        minBidIncrement: parsedMinBidIncrement
      },
      include: {
        host: { select: { id: true, username: true } }
      }
    });

    // 4. Auto-add Host as Participant #1
    await prisma.sessionParticipant.create({
      data: {
        sessionId: session.id,
        userId: hostUser.id,
        isHost: true
      }
    });

    // 5. Populate AuctionPlayer draft pool
    let playerWhereFilter = { isActive: true };
    if (playerPoolOption === 'MARQUEE') {
      playerWhereFilter.category = 'Marquee';
    } else if (playerPoolOption === 'CAPPED') {
      playerWhereFilter.category = 'Capped';
    } else if (playerPoolOption === 'UNCAPPED') {
      playerWhereFilter.category = 'Uncapped';
    }

    let availablePlayers = await prisma.player.findMany({
      where: playerWhereFilter,
      orderBy: [
        { basePrice: 'desc' },
        { name: 'asc' }
      ]
    });

    if (orderType === 'SHUFFLE') {
      availablePlayers = shuffleArray(availablePlayers);
    }

    if (availablePlayers.length > 0) {
      const auctionPlayerCreates = availablePlayers.map((player, index) => ({
        sessionId: session.id,
        playerId: player.id,
        status: 'AVAILABLE',
        basePrice: player.basePrice,
        orderIndex: index + 1
      }));

      await prisma.auctionPlayer.createMany({
        data: auctionPlayerCreates
      });
    }

    const clientOrigin = process.env.CLIENT_URL || 'http://localhost:5173';
    const inviteUrl = `${clientOrigin}/join/${session.roomCode}`;

    res.status(201).json({
      success: true,
      message: 'Auction session created successfully',
      session: {
        id: session.id,
        roomCode: session.roomCode,
        name: session.name,
        startingPurse: session.startingPurse,
        minBidIncrement: session.minBidIncrement,
        status: session.status,
        host: session.host,
        playerCount: availablePlayers.length,
        createdAt: session.createdAt
      },
      hostParticipantId: hostUser.id,
      inviteUrl
    });
  } catch (error) {
    console.error('Error creating auction session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create auction session',
      error: error.message
    });
  }
});

// GET /api/sessions/:roomCode
// Retrieve session details & current participant roster
router.get('/:roomCode', async (req, res) => {
  try {
    const { roomCode } = req.params;
    const session = await prisma.auctionSession.findUnique({
      where: { roomCode: roomCode.toUpperCase() },
      include: {
        host: { select: { id: true, username: true } },
        participants: {
          include: {
            user: { select: { id: true, username: true, avatarUrl: true } }
          },
          orderBy: { joinedAt: 'asc' }
        },
        _count: {
          select: { auctionPlayers: true, sessionTeams: true }
        }
      }
    });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Auction room not found' });
    }

    const clientOrigin = process.env.CLIENT_URL || 'http://localhost:5173';

    res.status(200).json({
      success: true,
      session: {
        ...session,
        inviteUrl: `${clientOrigin}/join/${session.roomCode}`
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error retrieving session', error: error.message });
  }
});

// POST /api/sessions/:roomCode/join
// Join an auction session by room code (display name only)
router.post('/:roomCode/join', async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { displayName } = req.body;

    if (!displayName || !displayName.trim()) {
      return res.status(400).json({ success: false, message: 'Display name is required to join' });
    }

    const formattedCode = roomCode.trim().toUpperCase();

    // 1. Fetch Session
    const session = await prisma.auctionSession.findUnique({
      where: { roomCode: formattedCode },
      include: { host: { select: { id: true, username: true } } }
    });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Auction room not found' });
    }

    // 2. STAGE 5 CRITICAL REQUIREMENT: Reject joining if session status is not LOBBY
    if (session.status !== 'LOBBY') {
      return res.status(400).json({
        success: false,
        message: `Cannot join auction. Room is in ${session.status} mode, not LOBBY.`
      });
    }

    // 3. Create or find User by display name
    const trimmedName = displayName.trim();
    let user = await prisma.user.findFirst({
      where: { username: trimmedName }
    });

    if (!user) {
      user = await prisma.user.create({
        data: { username: trimmedName }
      });
    }

    const isHostUser = session.hostId === user.id;

    // 4. Add or update SessionParticipant
    const participant = await prisma.sessionParticipant.upsert({
      where: {
        sessionId_userId: {
          sessionId: session.id,
          userId: user.id
        }
      },
      update: {
        isOnline: true
      },
      create: {
        sessionId: session.id,
        userId: user.id,
        isHost: isHostUser,
        isOnline: true
      },
      include: {
        user: { select: { id: true, username: true } }
      }
    });

    // 5. Fetch updated participant roster
    const updatedParticipants = await prisma.sessionParticipant.findMany({
      where: { sessionId: session.id },
      include: {
        user: { select: { id: true, username: true } }
      },
      orderBy: { joinedAt: 'asc' }
    });

    res.status(200).json({
      success: true,
      message: 'Joined auction session waiting room successfully',
      participant: {
        id: user.id,
        username: user.username,
        isHost: participant.isHost
      },
      session: {
        id: session.id,
        roomCode: session.roomCode,
        name: session.name,
        status: session.status,
        startingPurse: session.startingPurse,
        minBidIncrement: session.minBidIncrement,
        host: session.host,
        participants: updatedParticipants
      }
    });
  } catch (error) {
    console.error('Error joining session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to join auction session',
      error: error.message
    });
  }
});

// Helper function to fetch all 10 teams merged with per-session availability
async function getSessionTeamsList(sessionId) {
  const allTeams = await prisma.team.findMany({
    orderBy: { name: 'asc' }
  });

  const sessionTeams = await prisma.sessionTeam.findMany({
    where: { sessionId },
    include: {
      user: { select: { id: true, username: true } }
    }
  });

  const sessionTeamMap = new Map();
  sessionTeams.forEach((st) => {
    sessionTeamMap.set(st.teamId, st);
  });

  return allTeams.map((team) => {
    const st = sessionTeamMap.get(team.id);
    const claimedByUser = st?.user || null;

    return {
      id: team.id,
      name: team.name,
      shortName: team.shortName,
      logoUrl: team.logoUrl,
      primaryColor: team.primaryColor || '#3b82f6',
      secondaryColor: team.secondaryColor || '#1e3a8a',
      isClaimed: Boolean(st && st.userId),
      claimedBy: claimedByUser ? { id: claimedByUser.id, username: claimedByUser.username } : null,
      startingPurse: st?.startingPurse || null,
      remainingPurse: st?.remainingPurse || null
    };
  });
}

// Exported helper function to fetch complete squads & purse management snapshot
export async function getSquadsSnapshot(sessionId) {
  const session = await prisma.auctionSession.findUnique({
    where: { id: sessionId }
  });

  if (!session) return [];

  const allTeams = await prisma.team.findMany({
    orderBy: { name: 'asc' }
  });

  const sessionTeams = await prisma.sessionTeam.findMany({
    where: { sessionId },
    include: {
      user: { select: { id: true, username: true } }
    }
  });

  const purchases = await prisma.playerPurchase.findMany({
    where: { sessionId },
    include: {
      player: true,
      team: true
    },
    orderBy: { purchasedAt: 'desc' }
  });

  const sessionTeamMap = new Map();
  sessionTeams.forEach((st) => {
    sessionTeamMap.set(st.teamId, st);
  });

  const purchasesByTeamMap = new Map();
  purchases.forEach((p) => {
    if (!purchasesByTeamMap.has(p.teamId)) {
      purchasesByTeamMap.set(p.teamId, []);
    }
    purchasesByTeamMap.get(p.teamId).push(p);
  });

  return allTeams.map((team) => {
    const st = sessionTeamMap.get(team.id);
    const claimedByUser = st?.user || null;
    const teamPurchases = purchasesByTeamMap.get(team.id) || [];

    const startingPurse = st?.startingPurse || session.startingPurse;
    const remainingPurse = st?.remainingPurse ?? startingPurse;
    const pursePercentage = startingPurse > 0 ? (remainingPurse / startingPurse) * 100 : 100;

    return {
      teamId: team.id,
      name: team.name,
      shortName: team.shortName,
      logoUrl: team.logoUrl,
      primaryColor: team.primaryColor || '#3b82f6',
      secondaryColor: team.secondaryColor || '#1e3a8a',
      isClaimed: Boolean(st && st.userId),
      claimedBy: claimedByUser ? { id: claimedByUser.id, username: claimedByUser.username } : null,
      startingPurse,
      remainingPurse,
      pursePercentage: Number(pursePercentage.toFixed(2)),
      squadSize: teamPurchases.length,
      players: teamPurchases.map((p) => ({
        id: p.id,
        auctionPlayerId: p.auctionPlayerId,
        playerId: p.playerId,
        name: p.player.name,
        role: p.player.role,
        category: p.player.category,
        imageUrl: p.player.imageUrl,
        purchasePrice: p.purchasePrice,
        purchasedAt: p.purchasedAt
      }))
    };
  });
}

// GET /api/sessions/:roomCode/squads
// Retrieve all teams' squads, purse remaining, squad size, and player lists
router.get('/:roomCode/squads', async (req, res) => {
  try {
    const { roomCode } = roomCodeParam(req);
    const session = await prisma.auctionSession.findUnique({
      where: { roomCode }
    });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Auction room not found' });
    }

    const squads = await getSquadsSnapshot(session.id);

    res.status(200).json({
      success: true,
      sessionCode: roomCode,
      squads
    });
  } catch (error) {
    console.error('Error retrieving squads:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve squad details', error: error.message });
  }
});

// GET /api/sessions/:roomCode/teams
// Retrieve team availability map for a session
router.get('/:roomCode/teams', async (req, res) => {
  try {
    const { roomCode } = roomCodeParam(req);
    const session = await prisma.auctionSession.findUnique({
      where: { roomCode: roomCode.toUpperCase() }
    });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Auction room not found' });
    }

    const teams = await getSessionTeamsList(session.id);
    res.status(200).json({ success: true, teams });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve team availability', error: error.message });
  }
});

function roomCodeParam(req) {
  return { roomCode: req.params.roomCode.trim().toUpperCase() };
}

// POST /api/sessions/:roomCode/teams/select
// Participant selects/claims a team (Enforced in DB Transaction to prevent race conditions)
router.post('/:roomCode/teams/select', async (req, res) => {
  try {
    const { roomCode } = roomCodeParam(req);
    const { participantId, teamId } = req.body;

    if (!participantId || !teamId) {
      return res.status(400).json({ success: false, message: 'Participant ID and Team ID are required' });
    }

    // STAGE 7 MANDATORY REQUIREMENT: DB Transaction (not check-then-write)
    const result = await prisma.$transaction(async (tx) => {
      // 1. Verify session exists and is in LOBBY status
      const session = await tx.auctionSession.findUnique({
        where: { roomCode }
      });

      if (!session) {
        throw new Error('AUCTION_SESSION_NOT_FOUND');
      }

      if (session.status !== 'LOBBY') {
        throw new Error(`CANNOT_SELECT_TEAM_STATUS_${session.status}`);
      }

      // 2. Check if team is already claimed by ANOTHER user in this session
      const existingTeamAllocation = await tx.sessionTeam.findFirst({
        where: {
          sessionId: session.id,
          teamId,
          userId: { not: null, not: participantId }
        },
        include: {
          user: { select: { username: true } },
          team: { select: { name: true, shortName: true } }
        }
      });

      if (existingTeamAllocation) {
        const takerName = existingTeamAllocation.user?.username || 'Another participant';
        const teamName = existingTeamAllocation.team?.shortName || existingTeamAllocation.team?.name || 'Team';
        const err = new Error(`Team ${teamName} has already been claimed by ${takerName}.`);
        err.code = 'TEAM_ALREADY_CLAIMED';
        throw err;
      }

      // 3. Release any previous team claimed by this participant in this session
      await tx.sessionTeam.deleteMany({
        where: {
          sessionId: session.id,
          userId: participantId
        }
      });

      // 4. Upsert/Claim the target team for this participant with starting purse
      const sessionTeam = await tx.sessionTeam.upsert({
        where: {
          sessionId_teamId: {
            sessionId: session.id,
            teamId
          }
        },
        update: {
          userId: participantId,
          startingPurse: session.startingPurse,
          remainingPurse: session.startingPurse
        },
        create: {
          sessionId: session.id,
          teamId,
          userId: participantId,
          startingPurse: session.startingPurse,
          remainingPurse: session.startingPurse
        },
        include: {
          team: true,
          user: { select: { id: true, username: true } }
        }
      });

      return { session, sessionTeam };
    });

    // Fetch updated teams map after successful transaction
    const updatedTeams = await getSessionTeamsList(result.session.id);

    // Broadcast live socket update to everyone in the room
    const io = req.app.get('io');
    if (io) {
      io.to(`session:${roomCode}`).emit('teamsUpdated', {
        sessionCode: roomCode,
        teams: updatedTeams,
        claimedTeam: result.sessionTeam
      });
    }

    res.status(200).json({
      success: true,
      message: `Successfully claimed ${result.sessionTeam.team.name}`,
      claimedTeam: result.sessionTeam,
      teams: updatedTeams
    });
  } catch (error) {
    if (error.code === 'TEAM_ALREADY_CLAIMED') {
      return res.status(409).json({ success: false, message: error.message });
    }
    if (error.message === 'AUCTION_SESSION_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Auction room not found' });
    }
    if (error.message && error.message.startsWith('CANNOT_SELECT_TEAM_STATUS')) {
      return res.status(400).json({ success: false, message: 'Team selection is closed because auction is no longer in LOBBY mode.' });
    }
    console.error('Error selecting team:', error);
    res.status(500).json({ success: false, message: 'Failed to claim team', error: error.message });
  }
});

// POST /api/sessions/:roomCode/teams/release
// Participant releases their claimed team
router.post('/:roomCode/teams/release', async (req, res) => {
  try {
    const { roomCode } = roomCodeParam(req);
    const { participantId } = req.body;

    if (!participantId) {
      return res.status(400).json({ success: false, message: 'Participant ID is required' });
    }

    const session = await prisma.auctionSession.findUnique({
      where: { roomCode }
    });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Auction room not found' });
    }

    // Release team assigned to participant
    await prisma.sessionTeam.deleteMany({
      where: {
        sessionId: session.id,
        userId: participantId
      }
    });

    const updatedTeams = await getSessionTeamsList(session.id);

    const io = req.app.get('io');
    if (io) {
      io.to(`session:${roomCode}`).emit('teamsUpdated', {
        sessionCode: roomCode,
        teams: updatedTeams
      });
    }

    res.status(200).json({
      success: true,
      message: 'Released team successfully',
      teams: updatedTeams
    });
  } catch (error) {
    console.error('Error releasing team:', error);
    res.status(500).json({ success: false, message: 'Failed to release team', error: error.message });
  }
});

// GET /api/sessions/:roomCode/player-queue
// Host-only preview endpoint to view the draft player queue in order
router.get('/:roomCode/player-queue', async (req, res) => {
  try {
    const { roomCode } = roomCodeParam(req);
    const hostParticipantId = req.query.participantId || req.query.hostParticipantId || req.headers['x-participant-id'];

    if (!hostParticipantId) {
      return res.status(400).json({ success: false, message: 'Participant ID is required to access queue preview' });
    }

    const session = await prisma.auctionSession.findUnique({
      where: { roomCode },
      include: {
        host: { select: { id: true, username: true } }
      }
    });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Auction room not found' });
    }

    // Host permission verification
    const isHost = session.hostId === hostParticipantId;

    if (!isHost) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the auction room host can preview the draft player queue.'
      });
    }

    const playerQueue = await prisma.auctionPlayer.findMany({
      where: { sessionId: session.id },
      include: {
        player: true
      },
      orderBy: { orderIndex: 'asc' }
    });

    res.status(200).json({
      success: true,
      count: playerQueue.length,
      playerQueue
    });
  } catch (error) {
    console.error('Error fetching player queue:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve player queue', error: error.message });
  }
});

// POST /api/sessions/:roomCode/shuffle-queue
// Host-only action to reshuffle the draft order of AVAILABLE players
router.post('/:roomCode/shuffle-queue', async (req, res) => {
  try {
    const { roomCode } = roomCodeParam(req);
    const { hostParticipantId } = req.body;

    if (!hostParticipantId) {
      return res.status(400).json({ success: false, message: 'Host Participant ID is required' });
    }

    const session = await prisma.auctionSession.findUnique({
      where: { roomCode }
    });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Auction room not found' });
    }

    if (session.hostId !== hostParticipantId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the auction room host can re-shuffle the draft queue.'
      });
    }

    // Fetch available auction players
    const availableAuctionPlayers = await prisma.auctionPlayer.findMany({
      where: {
        sessionId: session.id,
        status: 'AVAILABLE'
      }
    });

    if (availableAuctionPlayers.length === 0) {
      return res.status(400).json({ success: false, message: 'No available players to shuffle' });
    }

    const shuffled = shuffleArray(availableAuctionPlayers);

    // Update orderIndex in Prisma transaction
    await prisma.$transaction(
      shuffled.map((ap, idx) =>
        prisma.auctionPlayer.update({
          where: { id: ap.id },
          data: { orderIndex: idx + 1 }
        })
      )
    );

    const updatedQueue = await prisma.auctionPlayer.findMany({
      where: { sessionId: session.id },
      include: { player: true },
      orderBy: { orderIndex: 'asc' }
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`session:${roomCode}`).emit('queueUpdated', {
        sessionCode: roomCode,
        count: updatedQueue.length
      });
    }

    res.status(200).json({
      success: true,
      message: 'Draft player queue reshuffled successfully',
      playerQueue: updatedQueue
    });
  } catch (error) {
    console.error('Error shuffling queue:', error);
    res.status(500).json({ success: false, message: 'Failed to reshuffle queue', error: error.message });
  }
});

// POST /api/sessions/:roomCode/start
// Host-only action to start live auction (status LOBBY -> LIVE, pull first player)
router.post('/:roomCode/start', async (req, res) => {
  try {
    const { roomCode } = roomCodeParam(req);
    const { hostParticipantId } = req.body;

    if (!hostParticipantId) {
      return res.status(400).json({ success: false, message: 'Host Participant ID is required' });
    }

    const session = await prisma.auctionSession.findUnique({
      where: { roomCode },
      include: {
        host: { select: { id: true, username: true } }
      }
    });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Auction room not found' });
    }

    if (session.hostId !== hostParticipantId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the auction room host can start the live auction.'
      });
    }

    // Find the first AVAILABLE player by orderIndex
    const firstAvailablePlayer = await prisma.auctionPlayer.findFirst({
      where: {
        sessionId: session.id,
        status: 'AVAILABLE'
      },
      include: {
        player: true
      },
      orderBy: { orderIndex: 'asc' }
    });

    if (!firstAvailablePlayer) {
      return res.status(400).json({
        success: false,
        message: 'Cannot start auction. No available players found in the draft pool.'
      });
    }

    // Update session status to LIVE and auction player to CURRENT in transaction
    const result = await prisma.$transaction(async (tx) => {
      const updatedSession = await tx.auctionSession.update({
        where: { id: session.id },
        data: {
          status: 'LIVE',
          currentAuctionPlayerId: firstAvailablePlayer.id
        }
      });

      const updatedAuctionPlayer = await tx.auctionPlayer.update({
        where: { id: firstAvailablePlayer.id },
        data: { status: 'CURRENT' },
        include: { player: true }
      });

      return { session: updatedSession, auctionPlayer: updatedAuctionPlayer };
    });

    // Initialize server-owned timer for first player
    const timer = initializePlayerTimer(session.id);

    const currentPlayerPayload = {
      auctionPlayerId: result.auctionPlayer.id,
      orderIndex: result.auctionPlayer.orderIndex,
      status: 'CURRENT',
      basePrice: result.auctionPlayer.basePrice,
      currentBid: result.auctionPlayer.basePrice,
      endsAt: timer.endsAt,
      highestBidder: null,
      highestBidTeam: null,
      player: result.auctionPlayer.player
    };

    const io = req.app.get('io');
    if (io) {
      scheduleTimerResolution(session.id, roomCode, io);
      io.to(`session:${roomCode}`).emit('auctionStarted', {
        sessionCode: roomCode,
        status: 'LIVE',
        currentPlayer: currentPlayerPayload
      });
    }

    res.status(200).json({
      success: true,
      message: 'Auction started successfully! Live auction engine activated.',
      status: 'LIVE',
      currentPlayer: currentPlayerPayload
    });
  } catch (error) {
    console.error('Error starting auction:', error);
    res.status(500).json({ success: false, message: 'Failed to start auction', error: error.message });
  }
});

// GET /api/sessions/:roomCode/current-player
// Retrieve current session status & active player payload
router.get('/:roomCode/current-player', async (req, res) => {
  try {
    const { roomCode } = roomCodeParam(req);
    const session = await prisma.auctionSession.findUnique({
      where: { roomCode }
    });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Auction room not found' });
    }

    if (!session.currentAuctionPlayerId) {
      return res.status(200).json({
        success: true,
        status: session.status,
        currentPlayer: null
      });
    }

    const currentAuctionPlayer = await prisma.auctionPlayer.findUnique({
      where: { id: session.currentAuctionPlayerId },
      include: { player: true }
    });

    if (!currentAuctionPlayer) {
      return res.status(200).json({
        success: true,
        status: session.status,
        currentPlayer: null
      });
    }

    const latestBid = await prisma.bid.findFirst({
      where: { auctionPlayerId: currentAuctionPlayer.id },
      orderBy: { timestamp: 'desc' },
      include: {
        bidder: { select: { id: true, username: true } },
        team: true
      }
    });

    const timer = getPlayerTimer(session.id);

    const currentPlayerPayload = {
      auctionPlayerId: currentAuctionPlayer.id,
      orderIndex: currentAuctionPlayer.orderIndex,
      status: currentAuctionPlayer.status,
      basePrice: currentAuctionPlayer.basePrice,
      currentBid: latestBid ? latestBid.amount : (currentAuctionPlayer.soldPrice || currentAuctionPlayer.basePrice),
      endsAt: timer ? timer.endsAt : null,
      highestBidder: latestBid?.bidder ? { id: latestBid.bidder.id, username: latestBid.bidder.username } : null,
      highestBidTeam: latestBid?.team ? {
        id: latestBid.team.id,
        name: latestBid.team.name,
        shortName: latestBid.team.shortName,
        logoUrl: latestBid.team.logoUrl,
        primaryColor: latestBid.team.primaryColor
      } : null,
      player: currentAuctionPlayer.player
    };

    res.status(200).json({
      success: true,
      status: session.status,
      currentPlayer: currentPlayerPayload
    });
  } catch (error) {
    console.error('Error retrieving current player:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve current player', error: error.message });
  }
});

// POST /api/sessions/:roomCode/bids
// REST API endpoint to place a bid (backed by Stage 10 5-step validation & mutex lock)
router.post('/:roomCode/bids', async (req, res) => {
  try {
    const roomCode = req.params.roomCode ? req.params.roomCode.toUpperCase() : '';
    const { participantId, amount } = req.body;
    const io = req.app.get('io');

    const result = await processBid({ sessionCode: roomCode, participantId, amount, io });

    if (result.success) {
      if (io) {
        io.to(`session:${result.data.sessionCode}`).emit('bidAccepted', result.data);
      }
      return res.status(200).json({
        success: true,
        message: 'Bid accepted',
        ...result.data
      });
    } else {
      return res.status(400).json({
        success: false,
        code: result.code,
        message: result.reason,
        reason: result.reason
      });
    }
  } catch (error) {
    console.error('Error placing bid REST API:', error);
    res.status(500).json({ success: false, message: 'Failed to process bid', error: error.message });
  }
});

// GET /api/sessions/:roomCode/results
// Stage 17: Retrieve final auction results (team squads with total spend, unsold players, top buy highlight & stats)
router.get('/:roomCode/results', async (req, res) => {
  try {
    const roomCode = req.params.roomCode ? req.params.roomCode.toUpperCase() : '';
    const session = await prisma.auctionSession.findUnique({
      where: { roomCode },
      include: {
        host: { select: { id: true, username: true } }
      }
    });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Auction room not found' });
    }

    // Fetch team squads
    const squads = await getSquadsSnapshot(session.id);

    // Compute total spend per team squad
    const teamSquads = squads.map((sq) => ({
      ...sq,
      totalSpent: sq.startingPurse - sq.remainingPurse
    }));

    // Fetch unsold auction players
    const unsoldAuctionPlayers = await prisma.auctionPlayer.findMany({
      where: {
        sessionId: session.id,
        status: 'UNSOLD'
      },
      include: {
        player: true
      },
      orderBy: { orderIndex: 'asc' }
    });

    const unsoldPlayers = unsoldAuctionPlayers.map((ap) => ({
      auctionPlayerId: ap.id,
      playerId: ap.playerId,
      name: ap.player.name,
      role: ap.player.role,
      country: ap.player.country,
      category: ap.player.category,
      imageUrl: ap.player.imageUrl,
      basePrice: ap.basePrice,
      orderIndex: ap.orderIndex
    }));

    // Fetch top expensive buy
    const topPurchase = await prisma.playerPurchase.findFirst({
      where: { sessionId: session.id },
      orderBy: { purchasePrice: 'desc' },
      include: {
        player: true,
        team: true
      }
    });

    let mostExpensiveBuy = null;
    if (topPurchase) {
      const st = await prisma.sessionTeam.findUnique({
        where: {
          sessionId_teamId: {
            sessionId: session.id,
            teamId: topPurchase.teamId
          }
        },
        include: {
          user: { select: { id: true, username: true } }
        }
      });

      mostExpensiveBuy = {
        id: topPurchase.id,
        purchasePrice: topPurchase.purchasePrice,
        purchasedAt: topPurchase.purchasedAt,
        player: {
          id: topPurchase.player.id,
          name: topPurchase.player.name,
          role: topPurchase.player.role,
          country: topPurchase.player.country,
          category: topPurchase.player.category,
          imageUrl: topPurchase.player.imageUrl,
          basePrice: topPurchase.player.basePrice
        },
        team: {
          id: topPurchase.team.id,
          name: topPurchase.team.name,
          shortName: topPurchase.team.shortName,
          logoUrl: topPurchase.team.logoUrl,
          primaryColor: topPurchase.team.primaryColor
        },
        buyer: st?.user ? { id: st.user.id, username: st.user.username } : null
      };
    }

    // Calculate aggregated overall stats
    const totalPlayersAuctioned = await prisma.auctionPlayer.count({
      where: {
        sessionId: session.id,
        status: { in: ['SOLD', 'UNSOLD'] }
      }
    });

    const totalPlayersSold = await prisma.auctionPlayer.count({
      where: { sessionId: session.id, status: 'SOLD' }
    });

    const totalPlayersUnsold = unsoldPlayers.length;
    const totalSpendAllTeams = teamSquads.reduce((acc, team) => acc + team.totalSpent, 0);

    res.status(200).json({
      success: true,
      session: {
        id: session.id,
        roomCode: session.roomCode,
        name: session.name,
        startingPurse: session.startingPurse,
        minBidIncrement: session.minBidIncrement,
        status: session.status,
        createdAt: session.createdAt,
        host: session.host
      },
      stats: {
        totalPlayersAuctioned,
        totalPlayersSold,
        totalPlayersUnsold,
        totalSpendAllTeams
      },
      mostExpensiveBuy,
      teamSquads,
      unsoldPlayers
    });
  } catch (error) {
    console.error('Error fetching auction results:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch auction results', error: error.message });
  }
});

export default router;
