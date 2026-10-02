import axios from 'axios';

const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const API_BASE_URL = rawApiUrl.replace(/\/api\/?$/i, '').replace(/\/+$/, '');

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 10000
});

// Health check call
export const checkServerHealth = async () => {
  try {
    const response = await apiClient.get('/api/health');
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Unable to connect to server'
    };
  }
};

// Create a new auction session
export const createAuctionSession = async (payload) => {
  try {
    const response = await apiClient.post('/api/sessions', payload);
    return response.data;
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to create auction session'
    };
  }
};

// Get session details by room code
export const getSessionByRoomCode = async (roomCode) => {
  try {
    const response = await apiClient.get(`/api/sessions/${roomCode}`);
    return response.data;
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Auction room not found'
    };
  }
};

// Join auction session by room code and display name
export const joinAuctionSession = async (roomCode, displayName) => {
  try {
    const response = await apiClient.post(`/api/sessions/${roomCode}/join`, { displayName });
    return response.data;
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to join room'
    };
  }
};

// Get team availability for an auction session
export const getSessionTeams = async (roomCode) => {
  try {
    const response = await apiClient.get(`/api/sessions/${roomCode}/teams`);
    return response.data;
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to fetch team list'
    };
  }
};

// Participant selects/claims a team
export const selectSessionTeam = async (roomCode, participantId, teamId) => {
  try {
    const response = await apiClient.post(`/api/sessions/${roomCode}/teams/select`, {
      participantId,
      teamId
    });
    return response.data;
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to claim team'
    };
  }
};

// Participant releases their claimed team
export const releaseSessionTeam = async (roomCode, participantId) => {
  try {
    const response = await apiClient.post(`/api/sessions/${roomCode}/teams/release`, {
      participantId
    });
    return response.data;
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to release team'
    };
  }
};

// Host-only: Get draft player queue preview
export const getPlayerQueue = async (roomCode, hostParticipantId) => {
  try {
    const response = await apiClient.get(`/api/sessions/${roomCode}/player-queue`, {
      params: { participantId: hostParticipantId }
    });
    return response.data;
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to retrieve player queue'
    };
  }
};

// Host-only: Reshuffle draft player queue order
export const shufflePlayerQueue = async (roomCode, hostParticipantId) => {
  try {
    const response = await apiClient.post(`/api/sessions/${roomCode}/shuffle-queue`, {
      hostParticipantId
    });
    return response.data;
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to reshuffle queue'
    };
  }
};

// Host-only: Start live auction session
export const startAuctionSession = async (roomCode, hostParticipantId) => {
  try {
    const response = await apiClient.post(`/api/sessions/${roomCode}/start`, {
      hostParticipantId
    });
    return response.data;
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to start auction'
    };
  }
};

// Retrieve current session status & active player payload
export const getCurrentAuctionPlayer = async (roomCode) => {
  try {
    const response = await apiClient.get(`/api/sessions/${roomCode}/current-player`);
    return response.data;
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to fetch current player'
    };
  }
};

// Place a bid via REST API
export const placeBidApi = async (roomCode, participantId, amount) => {
  try {
    const response = await apiClient.post(`/api/sessions/${roomCode}/bids`, {
      participantId,
      amount
    });
    return response.data;
  } catch (error) {
    return {
      success: false,
      code: error.response?.data?.code || 'BID_FAILED',
      message: error.response?.data?.message || error.response?.data?.reason || error.message || 'Failed to place bid'
    };
  }
};

// Retrieve full squads & purse management snapshot
export const getSessionSquads = async (roomCode) => {
  try {
    const response = await apiClient.get(`/api/sessions/${roomCode}/squads`);
    return response.data;
  } catch (error) {
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to fetch squad details'
    };
  }
};
