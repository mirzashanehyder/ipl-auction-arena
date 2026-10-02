import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socket = null;

export const getSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  return socket;
};

export const connectSocket = () => {
  const socketInstance = getSocket();
  if (!socketInstance.connected) {
    socketInstance.connect();
  }
  return socketInstance;
};

export const disconnectSocket = () => {
  if (socket && socket.connected) {
    socket.disconnect();
  }
};

export const joinLobbyRoom = (sessionCode, participantId) => {
  const socketInstance = connectSocket();
  if (socketInstance.connected) {
    socketInstance.emit('lobby:join', { sessionCode, participantId });
  } else {
    socketInstance.once('connect', () => {
      socketInstance.emit('lobby:join', { sessionCode, participantId });
    });
  }
  return socketInstance;
};

export const subscribeToParticipantJoined = (callback) => {
  const socketInstance = getSocket();
  socketInstance.on('participantJoined', callback);
  return () => socketInstance.off('participantJoined', callback);
};

export const subscribeToParticipantLeft = (callback) => {
  const socketInstance = getSocket();
  socketInstance.on('participantLeft', callback);
  return () => socketInstance.off('participantLeft', callback);
};

export const subscribeToTeamsUpdated = (callback) => {
  const socketInstance = getSocket();
  socketInstance.on('teamsUpdated', callback);
  return () => socketInstance.off('teamsUpdated', callback);
};

export const subscribeToQueueUpdated = (callback) => {
  const socketInstance = getSocket();
  socketInstance.on('queueUpdated', callback);
  return () => socketInstance.off('queueUpdated', callback);
};

export const subscribeToAuctionStarted = (callback) => {
  const socketInstance = getSocket();
  socketInstance.on('auctionStarted', callback);
  return () => socketInstance.off('auctionStarted', callback);
};

export const subscribeToCurrentPlayer = (callback) => {
  const socketInstance = getSocket();
  socketInstance.on('currentPlayer', callback);
  return () => socketInstance.off('currentPlayer', callback);
};

export const emitPlaceBid = ({ sessionCode, participantId, amount }) => {
  const socketInstance = connectSocket();
  if (socketInstance.connected) {
    socketInstance.emit('bid:place', { sessionCode, participantId, amount });
  } else {
    socketInstance.once('connect', () => {
      socketInstance.emit('bid:place', { sessionCode, participantId, amount });
    });
  }
};

export const subscribeToBidAccepted = (callback) => {
  const socketInstance = getSocket();
  socketInstance.on('bidAccepted', callback);
  return () => socketInstance.off('bidAccepted', callback);
};

export const subscribeToBidRejected = (callback) => {
  const socketInstance = getSocket();
  socketInstance.on('bidRejected', callback);
  return () => socketInstance.off('bidRejected', callback);
};

export const subscribeToTimerUpdated = (callback) => {
  const socketInstance = getSocket();
  socketInstance.on('timerUpdated', callback);
  return () => socketInstance.off('timerUpdated', callback);
};

export const subscribeToPlayerSold = (callback) => {
  const socketInstance = getSocket();
  socketInstance.on('playerSold', callback);
  return () => socketInstance.off('playerSold', callback);
};

export const subscribeToPlayerUnsold = (callback) => {
  const socketInstance = getSocket();
  socketInstance.on('playerUnsold', callback);
  return () => socketInstance.off('playerUnsold', callback);
};

export const subscribeToNextPlayer = (callback) => {
  const socketInstance = getSocket();
  socketInstance.on('nextPlayer', callback);
  return () => socketInstance.off('nextPlayer', callback);
};

export const subscribeToAuctionEnded = (callback) => {
  const socketInstance = getSocket();
  socketInstance.on('auctionEnded', callback);
  return () => socketInstance.off('auctionEnded', callback);
};

export const subscribeToSquadsUpdated = (callback) => {
  const socketInstance = getSocket();
  socketInstance.on('squadsUpdated', callback);
  return () => socketInstance.off('squadsUpdated', callback);
};

// Stage 14: Host Control Emitters
export const emitPauseAuction = ({ sessionCode, participantId }) => {
  const socketInstance = connectSocket();
  socketInstance.emit('host:pauseAuction', { sessionCode, participantId });
};

export const emitResumeAuction = ({ sessionCode, participantId }) => {
  const socketInstance = connectSocket();
  socketInstance.emit('host:resumeAuction', { sessionCode, participantId });
};

export const emitSkipPlayer = ({ sessionCode, participantId }) => {
  const socketInstance = connectSocket();
  socketInstance.emit('host:skipPlayer', { sessionCode, participantId });
};

export const emitForceSell = ({ sessionCode, participantId, targetTeamId, amount }) => {
  const socketInstance = connectSocket();
  socketInstance.emit('host:forceSell', { sessionCode, participantId, targetTeamId, amount });
};

export const emitEndAuction = ({ sessionCode, participantId }) => {
  const socketInstance = connectSocket();
  socketInstance.emit('host:endAuction', { sessionCode, participantId });
};

// Stage 14: Host Control Subscribers
export const subscribeToAuctionPaused = (callback) => {
  const socketInstance = getSocket();
  socketInstance.on('auctionPaused', callback);
  return () => socketInstance.off('auctionPaused', callback);
};

export const subscribeToAuctionResumed = (callback) => {
  const socketInstance = getSocket();
  socketInstance.on('auctionResumed', callback);
  return () => socketInstance.off('auctionResumed', callback);
};

export const subscribeToHostActionRejected = (callback) => {
  const socketInstance = getSocket();
  socketInstance.on('hostActionRejected', callback);
  return () => socketInstance.off('hostActionRejected', callback);
};

// Stage 15: Reconnection & State Synchronization Emitter & Subscribers
export const emitReconnectLobby = (sessionCode, participantId) => {
  const socketInstance = connectSocket();
  if (socketInstance.connected) {
    socketInstance.emit('lobby:reconnect', { sessionCode, participantId });
  } else {
    socketInstance.once('connect', () => {
      socketInstance.emit('lobby:reconnect', { sessionCode, participantId });
    });
  }
  return socketInstance;
};

export const subscribeToAuctionState = (callback) => {
  const socketInstance = getSocket();
  socketInstance.on('auctionState', callback);
  return () => socketInstance.off('auctionState', callback);
};

export const subscribeToParticipantReconnected = (callback) => {
  const socketInstance = getSocket();
  socketInstance.on('participantReconnected', callback);
  return () => socketInstance.off('participantReconnected', callback);
};

export const subscribeToDuplicateConnection = (callback) => {
  const socketInstance = getSocket();
  socketInstance.on('duplicateConnection', callback);
  return () => socketInstance.off('duplicateConnection', callback);
};
