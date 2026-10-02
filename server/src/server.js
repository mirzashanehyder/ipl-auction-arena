import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import healthRouter from './routes/health.js';
import sessionRouter from './routes/sessions.js';

import { processBid } from './utils/bidding.js';
import {
  handlePauseAuction,
  handleResumeAuction,
  handleSkipPlayer,
  handleForceSellPlayer,
  handleEndAuctionEarly
} from './utils/hostControls.js';
import {
  registerParticipantSocket,
  unregisterParticipantSocket,
  getAuctionStateSnapshot
} from './utils/reconnection.js';

dotenv.config();

const prisma = new PrismaClient();

const app = express();
const PORT = process.env.PORT || 5000;
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((url) => url.trim());

const corsOriginCheck = (origin, callback) => {
  if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*') || origin.endsWith('.vercel.app')) {
    callback(null, true);
  } else {
    callback(null, true); // Permissive fallback for socket cross-network handshakes
  }
};

// Middleware
app.use(cors({
  origin: corsOriginCheck,
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/health', healthRouter);
app.use('/api/sessions', sessionRouter);

// HTTP & Socket.IO server creation
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: corsOriginCheck,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.set('io', io);

// Socket.IO Connection Handler
io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);

  socket.emit('server:connected', {
    message: 'Successfully connected to IPL Auction Socket Server',
    socketId: socket.id,
    timestamp: new Date().toISOString()
  });

  socket.on('ping', () => {
    socket.emit('pong', { timestamp: new Date().toISOString() });
  });

  // Stage 6: Join Session Socket Room
  socket.on('lobby:join', async ({ sessionCode, participantId }) => {
    try {
      if (!sessionCode || !participantId) return;

      const formattedCode = sessionCode.trim().toUpperCase();
      const roomName = `session:${formattedCode}`;

      socket.sessionCode = formattedCode;
      socket.participantId = participantId;

      registerParticipantSocket(participantId, socket, io);

      socket.join(roomName);
      console.log(`[Socket.IO] Socket ${socket.id} (Participant: ${participantId}) joined room: ${roomName}`);

      const session = await prisma.auctionSession.findUnique({
        where: { roomCode: formattedCode }
      });

      if (session) {
        await prisma.sessionParticipant.updateMany({
          where: {
            sessionId: session.id,
            userId: participantId
          },
          data: { isOnline: true }
        });

        const updatedParticipants = await prisma.sessionParticipant.findMany({
          where: { sessionId: session.id },
          include: {
            user: { select: { id: true, username: true, avatarUrl: true } }
          },
          orderBy: { joinedAt: 'asc' }
        });

        io.to(roomName).emit('participantJoined', {
          sessionCode: formattedCode,
          joinedParticipantId: participantId,
          participants: updatedParticipants
        });
      }
    } catch (err) {
      console.error('[Socket.IO] Error in lobby:join:', err);
    }
  });

  // Stage 15: Reconnection & State Synchronization Socket Event
  socket.on('lobby:reconnect', async ({ sessionCode, participantId }) => {
    try {
      if (!sessionCode || !participantId) return;

      const formattedCode = sessionCode.trim().toUpperCase();
      const roomName = `session:${formattedCode}`;

      socket.sessionCode = formattedCode;
      socket.participantId = participantId;

      // Handle duplicate sockets (keeping latest authoritative)
      registerParticipantSocket(participantId, socket, io);

      socket.join(roomName);
      console.log(`[Socket.IO] Socket ${socket.id} reconnected (Participant: ${participantId}) to room: ${roomName}`);

      const session = await prisma.auctionSession.findUnique({
        where: { roomCode: formattedCode }
      });

      if (session) {
        await prisma.sessionParticipant.updateMany({
          where: {
            sessionId: session.id,
            userId: participantId
          },
          data: { isOnline: true }
        });

        const updatedParticipants = await prisma.sessionParticipant.findMany({
          where: { sessionId: session.id },
          include: {
            user: { select: { id: true, username: true, avatarUrl: true } }
          },
          orderBy: { joinedAt: 'asc' }
        });

        const reconnectedUser = updatedParticipants.find((p) => p.userId === participantId || p.id === participantId);

        // Broadcast participantReconnected to session room
        io.to(roomName).emit('participantReconnected', {
          sessionCode: formattedCode,
          reconnectedParticipantId: participantId,
          username: reconnectedUser?.user?.username || 'Participant',
          participants: updatedParticipants
        });

        // Emit complete auctionState snapshot directly back to reconnected client
        const auctionState = await getAuctionStateSnapshot(formattedCode, participantId);
        if (auctionState) {
          socket.emit('auctionState', auctionState);
        }
      }
    } catch (err) {
      console.error('[Socket.IO] Error in lobby:reconnect:', err);
    }
  });

  // Stage 10 & 11: Real-Time Bidding Socket Event
  socket.on('bid:place', async ({ sessionCode, participantId, amount }) => {
    try {
      const result = await processBid({ sessionCode, participantId, amount, io });

      if (result.success) {
        const roomName = `session:${result.data.sessionCode}`;
        // Broadcast bidAccepted with new state to the whole session
        io.to(roomName).emit('bidAccepted', result.data);

        // Broadcast timerUpdated event with authoritative endsAt
        io.to(roomName).emit('timerUpdated', {
          sessionCode: result.data.sessionCode,
          endsAt: result.data.currentPlayer.endsAt,
          durationMs: 15000
        });
      } else {
        // Emit bidRejected specifically to caller socket (never silent failure)
        socket.emit('bidRejected', {
          sessionCode,
          code: result.code,
          reason: result.reason,
          attemptedBid: amount
        });
      }
    } catch (err) {
      console.error('[Socket.IO] Error processing bid:', err);
      socket.emit('bidRejected', {
        sessionCode,
        code: 'INTERNAL_SERVER_ERROR',
        reason: 'Failed to process bid due to a server error.',
        attemptedBid: amount
      });
    }
  });

  // ==========================================
  // STAGE 14: HOST CONTROLS SOCKET HANDLERS
  // ==========================================

  // Host Action: Pause Auction
  socket.on('host:pauseAuction', async ({ sessionCode, participantId }) => {
    try {
      const res = await handlePauseAuction({ sessionCode, participantId, io });
      if (!res.success) {
        socket.emit('hostActionRejected', { sessionCode, reason: res.reason });
      }
    } catch (err) {
      console.error('[Socket.IO] Error in host:pauseAuction:', err);
      socket.emit('hostActionRejected', { sessionCode, reason: 'Failed to pause auction due to a server error.' });
    }
  });

  // Host Action: Resume Auction
  socket.on('host:resumeAuction', async ({ sessionCode, participantId }) => {
    try {
      const res = await handleResumeAuction({ sessionCode, participantId, io });
      if (!res.success) {
        socket.emit('hostActionRejected', { sessionCode, reason: res.reason });
      }
    } catch (err) {
      console.error('[Socket.IO] Error in host:resumeAuction:', err);
      socket.emit('hostActionRejected', { sessionCode, reason: 'Failed to resume auction due to a server error.' });
    }
  });

  // Host Action: Skip Player (Force UNSOLD)
  socket.on('host:skipPlayer', async ({ sessionCode, participantId }) => {
    try {
      const res = await handleSkipPlayer({ sessionCode, participantId, io });
      if (!res.success) {
        socket.emit('hostActionRejected', { sessionCode, reason: res.reason });
      }
    } catch (err) {
      console.error('[Socket.IO] Error in host:skipPlayer:', err);
      socket.emit('hostActionRejected', { sessionCode, reason: 'Failed to skip player due to a server error.' });
    }
  });

  // Host Action: Force Sell Player
  socket.on('host:forceSell', async ({ sessionCode, participantId, targetTeamId, amount }) => {
    try {
      const res = await handleForceSellPlayer({ sessionCode, participantId, targetTeamId, amount, io });
      if (!res.success) {
        socket.emit('hostActionRejected', { sessionCode, reason: res.reason });
      }
    } catch (err) {
      console.error('[Socket.IO] Error in host:forceSell:', err);
      socket.emit('hostActionRejected', { sessionCode, reason: 'Failed to force sell player due to a server error.' });
    }
  });

  // Host Action: End Auction Early
  socket.on('host:endAuction', async ({ sessionCode, participantId }) => {
    try {
      const res = await handleEndAuctionEarly({ sessionCode, participantId, io });
      if (!res.success) {
        socket.emit('hostActionRejected', { sessionCode, reason: res.reason });
      }
    } catch (err) {
      console.error('[Socket.IO] Error in host:endAuction:', err);
      socket.emit('hostActionRejected', { sessionCode, reason: 'Failed to end auction due to a server error.' });
    }
  });

  socket.on('disconnect', async (reason) => {
    console.log(`[Socket.IO] Client disconnected (${socket.id}): ${reason}`);

    if (socket.participantId && socket.sessionCode) {
      try {
        unregisterParticipantSocket(socket.participantId, socket.id);

        const formattedCode = socket.sessionCode;
        const roomName = `session:${formattedCode}`;
        const session = await prisma.auctionSession.findUnique({
          where: { roomCode: formattedCode }
        });

        if (session) {
          await prisma.sessionParticipant.updateMany({
            where: {
              sessionId: session.id,
              userId: socket.participantId
            },
            data: { isOnline: false }
          });

          const updatedParticipants = await prisma.sessionParticipant.findMany({
            where: { sessionId: session.id },
            include: {
              user: { select: { id: true, username: true, avatarUrl: true } }
            },
            orderBy: { joinedAt: 'asc' }
          });

          io.to(roomName).emit('participantLeft', {
            sessionCode: formattedCode,
            leftParticipantId: socket.participantId,
            participants: updatedParticipants
          });
        }
      } catch (err) {
        console.error('[Socket.IO] Error in disconnect handler:', err);
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`🚀 IPL Auction Server Running`);
  console.log(`📡 REST API Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🔌 Socket.IO Server Ready`);
  console.log(`=================================`);
});
