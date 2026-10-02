import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSessionByRoomCode, joinAuctionSession, startAuctionSession, getCurrentAuctionPlayer, getSessionTeams, getSessionSquads } from '../services/api';
import {
  joinLobbyRoom,
  subscribeToParticipantJoined,
  subscribeToParticipantLeft,
  subscribeToAuctionStarted,
  subscribeToCurrentPlayer,
  subscribeToTeamsUpdated,
  emitPlaceBid,
  subscribeToBidAccepted,
  subscribeToBidRejected,
  subscribeToTimerUpdated,
  subscribeToPlayerSold,
  subscribeToPlayerUnsold,
  subscribeToNextPlayer,
  subscribeToAuctionEnded,
  subscribeToSquadsUpdated,
  subscribeToAuctionPaused,
  subscribeToAuctionResumed,
  subscribeToHostActionRejected,
  emitReconnectLobby,
  subscribeToAuctionState,
  subscribeToParticipantReconnected,
  subscribeToDuplicateConnection
} from '../services/socket';
import TeamSelectionGrid from '../components/TeamSelectionGrid';
import PlayerQueuePreview from '../components/PlayerQueuePreview';
import LiveAuctionArena from '../components/LiveAuctionArena';
import SquadPursePanel from '../components/SquadPursePanel';
import HostControlBar from '../components/HostControlBar';
import { Trophy, Users, Shield, RefreshCw, Copy, Check, UserCheck, Clock, AlertTriangle, ArrowRight, Wifi, WifiOff } from 'lucide-react';

export default function JoinAuction() {
  const { code } = useParams();
  const navigate = useNavigate();

  const [inputCode, setInputCode] = useState(code || '');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Session & Waiting Room state
  const [session, setSession] = useState(null);
  const [currentParticipant, setCurrentParticipant] = useState(null);
  const [hasJoined, setHasJoined] = useState(false);
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Stage 9, 10, 11 & 12 Live Auction core state
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [startAuctionLoading, setStartAuctionLoading] = useState(false);
  const [claimedTeam, setClaimedTeam] = useState(null);
  const [isBidding, setIsBidding] = useState(false);
  const [bidError, setBidError] = useState('');
  const [lastSoldResult, setLastSoldResult] = useState(null);
  const [lastUnsoldResult, setLastUnsoldResult] = useState(null);

  // Stage 13 Squad & Purse tracker state
  const [squads, setSquads] = useState([]);

  // Stage 15 Reconnection & Duplicate tab state
  const [isDuplicateTab, setIsDuplicateTab] = useState(false);

  // Fetch session details & team info on load if code exists in URL
  const fetchSessionInfo = useCallback(async (targetCode) => {
    if (!targetCode) return;
    setLoading(true);
    setErrorMessage('');
    const response = await getSessionByRoomCode(targetCode);
    setLoading(false);

    if (response.success) {
      setSession(response.session);

      if (response.session.status === 'LIVE') {
        const currentPlayerData = await getCurrentAuctionPlayer(targetCode);
        if (currentPlayerData.success && currentPlayerData.currentPlayer) {
          setCurrentPlayer(currentPlayerData.currentPlayer);
        }
      }

      // Fetch squad and purse tracker details
      const squadsRes = await getSessionSquads(targetCode);
      if (squadsRes.success && squadsRes.squads) {
        setSquads(squadsRes.squads);
      }

      // Auto-reconnect/re-enter if participant info is already saved in localStorage for this room
      const savedParticipantId = localStorage.getItem('ipl_participant_id');
      const savedParticipantName = localStorage.getItem('ipl_participant_name');
      const savedRoomCode = localStorage.getItem('ipl_room_code');

      if (
        savedParticipantId &&
        savedRoomCode &&
        savedRoomCode.toUpperCase() === targetCode.toUpperCase()
      ) {
        const existingParticipant = response.session.participants?.find(
          (p) => p.userId === savedParticipantId || p.user?.id === savedParticipantId
        );

        if (existingParticipant) {
          setCurrentParticipant({
            id: savedParticipantId,
            username: existingParticipant.user?.username || savedParticipantName,
            isHost: existingParticipant.isHost
          });
          setHasJoined(true);

          // Emit Stage 15 socket reconnect to reassociate socket & request full auctionState snapshot
          emitReconnectLobby(targetCode, savedParticipantId);

          // Fetch team claimed by participant
          const teamsRes = await getSessionTeams(targetCode);
          if (teamsRes.success && teamsRes.teams) {
            const myTeam = teamsRes.teams.find((t) => t.claimedBy?.id === savedParticipantId);
            if (myTeam) {
              setClaimedTeam({
                teamId: myTeam.id,
                remainingPurse: myTeam.remainingPurse ?? response.session.startingPurse,
                team: myTeam
              });
            }
          }
        }
      }
    } else {
      setErrorMessage(response.message || 'Auction room not found.');
    }
  }, []);

  useEffect(() => {
    if (code) {
      setInputCode(code);
      fetchSessionInfo(code);
    }
  }, [code, fetchSessionInfo]);

  // Stage 6 & Stage 9 & Stage 10: Socket Room Subscription Effect
  useEffect(() => {
    if (!hasJoined || !session?.roomCode || !currentParticipant?.id) return;

    // Join Socket.IO Room channel
    joinLobbyRoom(session.roomCode, currentParticipant.id);

    // Subscribe to live participant updates
    const unsubscribeJoined = subscribeToParticipantJoined((data) => {
      if (data.participants) {
        setSession((prev) => (prev ? { ...prev, participants: data.participants } : prev));
      }
    });

    const unsubscribeLeft = subscribeToParticipantLeft((data) => {
      if (data.participants) {
        setSession((prev) => (prev ? { ...prev, participants: data.participants } : prev));
      }
    });

    const unsubscribeAuctionStarted = subscribeToAuctionStarted((data) => {
      console.log('[Socket.IO] auctionStarted event received:', data);
      if (data.status) {
        setSession((prev) => (prev ? { ...prev, status: data.status } : prev));
      }
      if (data.currentPlayer) {
        setCurrentPlayer(data.currentPlayer);
      }
    });

    const unsubscribeCurrentPlayer = subscribeToCurrentPlayer((data) => {
      console.log('[Socket.IO] currentPlayer event received:', data);
      if (data.currentPlayer) {
        setCurrentPlayer(data.currentPlayer);
      }
    });

    const unsubscribeTeamsUpdated = subscribeToTeamsUpdated((data) => {
      if (data.teams) {
        const myTeam = data.teams.find((t) => t.claimedBy?.id === currentParticipant.id);
        if (myTeam) {
          setClaimedTeam({
            teamId: myTeam.id,
            remainingPurse: myTeam.remainingPurse ?? session.startingPurse,
            team: myTeam
          });
        } else {
          setClaimedTeam(null);
        }
      }
    });

    const unsubscribeBidAccepted = subscribeToBidAccepted((data) => {
      console.log('[Socket.IO] bidAccepted event received:', data);
      setIsBidding(false);
      setBidError('');
      if (data.currentPlayer) {
        setCurrentPlayer(data.currentPlayer);
      }
    });

    const unsubscribeBidRejected = subscribeToBidRejected((data) => {
      console.log('[Socket.IO] bidRejected event received:', data);
      setIsBidding(false);
      if (data.reason) {
        setBidError(data.reason);
      }
    });

    const unsubscribeTimerUpdated = subscribeToTimerUpdated((data) => {
      console.log('[Socket.IO] timerUpdated event received:', data);
      if (data.endsAt) {
        setCurrentPlayer((prev) => (prev ? { ...prev, endsAt: data.endsAt } : prev));
      }
    });

    const unsubscribePlayerSold = subscribeToPlayerSold((data) => {
      console.log('[Socket.IO] playerSold event received:', data);
      setLastSoldResult(data);
      setLastUnsoldResult(null);
      setTimeout(() => setLastSoldResult(null), 4500);
    });

    const unsubscribePlayerUnsold = subscribeToPlayerUnsold((data) => {
      console.log('[Socket.IO] playerUnsold event received:', data);
      setLastUnsoldResult(data);
      setLastSoldResult(null);
      setTimeout(() => setLastUnsoldResult(null), 4500);
    });

    const unsubscribeNextPlayer = subscribeToNextPlayer((data) => {
      console.log('[Socket.IO] nextPlayer event received:', data);
      setLastSoldResult(null);
      setLastUnsoldResult(null);
      if (data.currentPlayer) {
        setCurrentPlayer(data.currentPlayer);
      }
    });

    const unsubscribeAuctionEnded = subscribeToAuctionEnded((data) => {
      console.log('[Socket.IO] auctionEnded event received:', data);
      setLastSoldResult(null);
      setLastUnsoldResult(null);
      if (data.status) {
        setSession((prev) => (prev ? { ...prev, status: data.status } : prev));
      }
    });

    const unsubscribeSquadsUpdated = subscribeToSquadsUpdated((data) => {
      console.log('[Socket.IO] squadsUpdated event received:', data);
      if (data.squads) {
        setSquads(data.squads);
      }
    });

    const unsubscribeAuctionPaused = subscribeToAuctionPaused((data) => {
      console.log('[Socket.IO] auctionPaused event received:', data);
      if (data.status) {
        setSession((prev) => (prev ? { ...prev, status: data.status } : prev));
      }
    });

    const unsubscribeAuctionResumed = subscribeToAuctionResumed((data) => {
      console.log('[Socket.IO] auctionResumed event received:', data);
      if (data.status) {
        setSession((prev) => (prev ? { ...prev, status: data.status } : prev));
      }
      if (data.endsAt) {
        setCurrentPlayer((prev) => (prev ? { ...prev, endsAt: data.endsAt } : prev));
      }
    });

    const unsubscribeHostActionRejected = subscribeToHostActionRejected((data) => {
      console.log('[Socket.IO] hostActionRejected event received:', data);
      if (data.reason) {
        setBidError(`Host Action Rejected: ${data.reason}`);
      }
    });

    const unsubscribeAuctionState = subscribeToAuctionState((data) => {
      console.log('[Socket.IO] auctionState snapshot received:', data);
      if (data.session) {
        setSession(data.session);
      }
      if (data.currentPlayer) {
        setCurrentPlayer(data.currentPlayer);
      }
      if (data.squads) {
        setSquads(data.squads);
      }
      if (data.claimedTeam) {
        setClaimedTeam(data.claimedTeam);
      }
      if (data.participants) {
        setSession((prev) => (prev ? { ...prev, participants: data.participants } : prev));
      }
    });

    const unsubscribeParticipantReconnected = subscribeToParticipantReconnected((data) => {
      console.log('[Socket.IO] participantReconnected event received:', data);
      if (data.participants) {
        setSession((prev) => (prev ? { ...prev, participants: data.participants } : prev));
      }
    });

    const unsubscribeDuplicateConnection = subscribeToDuplicateConnection((data) => {
      console.log('[Socket.IO] duplicateConnection event received:', data);
      setIsDuplicateTab(true);
    });

    return () => {
      unsubscribeJoined();
      unsubscribeLeft();
      unsubscribeAuctionStarted();
      unsubscribeCurrentPlayer();
      unsubscribeTeamsUpdated();
      unsubscribeBidAccepted();
      unsubscribeBidRejected();
      unsubscribeTimerUpdated();
      unsubscribePlayerSold();
      unsubscribePlayerUnsold();
      unsubscribeNextPlayer();
      unsubscribeAuctionEnded();
      unsubscribeSquadsUpdated();
      unsubscribeAuctionPaused();
      unsubscribeAuctionResumed();
      unsubscribeHostActionRejected();
      unsubscribeAuctionState();
      unsubscribeParticipantReconnected();
      unsubscribeDuplicateConnection();
    };
  }, [hasJoined, session?.roomCode, currentParticipant?.id, session?.startingPurse]);

  // Handle placing a real-time bid
  const handlePlaceBid = (amount) => {
    if (!session?.roomCode || !currentParticipant?.id) return;
    setBidError('');
    setIsBidding(true);
    emitPlaceBid({
      sessionCode: session.roomCode,
      participantId: currentParticipant.id,
      amount
    });
  };

  // Handle Host Start Live Auction action
  const handleStartAuction = async () => {
    if (!session?.roomCode || !currentParticipant?.id) return;
    setStartAuctionLoading(true);
    setErrorMessage('');
    const res = await startAuctionSession(session.roomCode, currentParticipant.id);
    setStartAuctionLoading(false);

    if (res.success) {
      setSession((prev) => (prev ? { ...prev, status: res.status } : prev));
      if (res.currentPlayer) {
        setCurrentPlayer(res.currentPlayer);
      }
    } else {
      setErrorMessage(res.message || 'Failed to start live auction session.');
    }
  };

  // Handle Joining Room
  const handleJoinSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const targetCode = (code || inputCode).trim().toUpperCase();
    if (!targetCode) {
      setErrorMessage('Please enter a valid 6-character room code.');
      return;
    }

    if (!displayName.trim()) {
      setErrorMessage('Please enter your display name to join.');
      return;
    }

    setLoading(true);
    const response = await joinAuctionSession(targetCode, displayName.trim());
    setLoading(false);

    if (response.success) {
      setSession(response.session);
      setCurrentParticipant(response.participant);
      setHasJoined(true);

      // Persist participant details in localStorage for Stage 6 / Socket connection
      localStorage.setItem('ipl_participant_id', response.participant.id);
      localStorage.setItem('ipl_participant_name', response.participant.username);
      localStorage.setItem('ipl_room_code', response.session.roomCode);
    } else {
      setErrorMessage(response.message || 'Unable to join auction room.');
    }
  };

  // Refresh Participant Roster
  const handleRefreshRoster = async () => {
    if (!session?.roomCode) return;
    setRefreshing(true);
    const response = await getSessionByRoomCode(session.roomCode);
    setRefreshing(false);
    if (response.success) {
      setSession(response.session);
    }
  };

  const handleCopyLink = () => {
    if (!session?.inviteUrl) return;
    navigator.clipboard.writeText(session.inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-8">
      {!hasJoined ? (
        /* STEP 1: JOIN FORM (DISPLAY NAME ENTRY) */
        <div className="space-y-6">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-full text-yellow-400 text-xs font-semibold">
              <Users className="w-3.5 h-3.5" /> Join Auction Room
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
              Enter Waiting Room
            </h1>
            <p className="text-gray-400 text-sm max-w-md mx-auto">
              Provide your display name to join the pre-auction lobby.
            </p>
          </div>

          <div className="glass-panel p-8 rounded-3xl border border-gray-800 shadow-2xl relative max-w-lg mx-auto">
            {errorMessage && (
              <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                {errorMessage}
              </div>
            )}

            {session && (
              <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-xs space-y-1 font-mono">
                <div className="text-blue-300 font-bold text-sm font-sans mb-1">{session.name}</div>
                <div className="flex justify-between text-gray-400">
                  <span>Room Code:</span>
                  <span className="text-yellow-400 font-bold">{session.roomCode}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Host:</span>
                  <span className="text-white">{session.host?.username}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Status:</span>
                  <span className={`font-bold ${session.status === 'LOBBY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {session.status}
                  </span>
                </div>
              </div>
            )}

            <form onSubmit={handleJoinSubmit} className="space-y-6">
              {!code && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    Room Code *
                  </label>
                  <input
                    type="text"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                    placeholder="e.g. IPL-X7K92P"
                    className="w-full bg-gray-900/80 border border-gray-700/80 rounded-xl px-4 py-3 text-white placeholder-gray-500 font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition text-sm uppercase tracking-wider"
                    required
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-yellow-400" /> Your Display Name *
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Kohli / Manager 1"
                  className="w-full bg-gray-900/80 border border-gray-700/80 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition text-sm"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 text-white font-bold rounded-xl shadow-lg shadow-blue-500/25 transition duration-200 flex items-center justify-center gap-2 text-base disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Joining Lobby...
                  </>
                ) : (
                  <>
                    <UserCheck className="w-5 h-5 text-yellow-300" />
                    Join Waiting Room
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* STEP 2: WAITING ROOM VIEW */
        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
          {/* DUPLICATE TAB WARNING BANNER */}
          {isDuplicateTab && (
            <div className="p-4 bg-amber-500/20 border-2 border-amber-500/50 text-amber-200 rounded-3xl text-xs font-mono font-bold flex items-center gap-3 animate-pulse shadow-xl">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <strong className="text-white block font-sans text-sm">Session Opened in Another Tab</strong>
                You have opened this auction room in a newer browser tab or window. This tab has been de-activated to prevent duplicate actions.
              </div>
            </div>
          )}

          {/* Header Status Card */}
          <div className="glass-panel p-8 rounded-3xl border border-gray-800 shadow-2xl relative text-center space-y-6">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-semibold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 animate-pulse" /> Waiting Room ({session?.status})
              </span>

              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-xs font-semibold transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-blue-400" />}
                {copied ? 'Link Copied!' : 'Copy Invite'}
              </button>
            </div>

            <div className="space-y-2">
              <h2 className="text-3xl font-extrabold text-white">{session?.name}</h2>
              <p className="text-gray-400 text-xs font-mono">
                Host: <strong className="text-white">{session?.host?.username}</strong> &bull; Purse: <span className="text-emerald-400">₹{((session?.startingPurse || 0) / 10000000).toFixed(0)} Cr</span> &bull; Min Increment: <span className="text-yellow-400">₹{((session?.minBidIncrement || 0) / 100000).toFixed(0)} L</span>
              </p>
            </div>

            {/* BIG BOLD ROOM CODE */}
            <div className="bg-gradient-to-b from-gray-900 to-black p-6 rounded-2xl border border-gray-800 max-w-sm mx-auto space-y-1">
              <span className="text-[11px] uppercase tracking-widest text-gray-500 font-mono font-semibold">
                Room Code
              </span>
              <div className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-500 tracking-wider font-mono select-all">
                {session?.roomCode}
              </div>
            </div>

            <div className="text-xs text-gray-400 bg-gray-900/60 p-3 rounded-xl border border-gray-800 inline-block">
              You joined as <strong className="text-yellow-300 font-semibold">{currentParticipant?.username}</strong> {currentParticipant?.isHost && '(Host)'}
            </div>
          </div>

          {/* STAGE 14 HOST CONTROL BAR (RECESSED ADMIN STRIP) */}
          {currentParticipant?.isHost && (
            <HostControlBar
              sessionCode={session?.roomCode}
              hostParticipantId={currentParticipant?.id}
              sessionStatus={session?.status}
              currentPlayer={currentPlayer}
            />
          )}

          {/* STAGE 9, 10, 11 & 12 LIVE AUCTION ARENA */}
          <LiveAuctionArena
            session={session}
            currentPlayer={currentPlayer}
            currentParticipant={currentParticipant}
            claimedTeam={claimedTeam}
            onStartAuction={handleStartAuction}
            startLoading={startAuctionLoading}
            onPlaceBid={handlePlaceBid}
            isBidding={isBidding}
            bidError={bidError}
            onClearError={() => setBidError('')}
            lastSoldResult={lastSoldResult}
            lastUnsoldResult={lastUnsoldResult}
          />

          {/* STAGE 13 SQUAD & PURSE MANAGEMENT TRACKER */}
          <SquadPursePanel
            squads={squads}
            currentParticipantId={currentParticipant?.id}
          />

          {/* TEAM SELECTION GRID (STAGE 7) */}
          <TeamSelectionGrid
            roomCode={session?.roomCode}
            currentParticipantId={currentParticipant?.id}
            startingPurse={session?.startingPurse}
          />

          {/* DRAFT PLAYER QUEUE PREVIEW (STAGE 8 - HOST CONTROL ONLY) */}
          {currentParticipant?.isHost && (
            <PlayerQueuePreview
              roomCode={session?.roomCode}
              hostParticipantId={currentParticipant?.id}
            />
          )}

          {/* PARTICIPANTS ROSTER SECTION */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                Joined Participants ({session?.participants?.length || 0})
              </h3>

              <button
                onClick={handleRefreshRoster}
                disabled={refreshing}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-medium transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh Roster
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {session?.participants?.map((p) => {
                const isCurrent = p.userId === currentParticipant?.id || p.user?.id === currentParticipant?.id;
                const isHost = p.isHost;

                return (
                  <div
                    key={p.id || p.userId}
                    className={`glass-card p-4 rounded-2xl border flex items-center gap-3 transition ${
                      isCurrent
                        ? 'border-yellow-500/50 bg-yellow-500/5'
                        : 'border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white text-sm shadow">
                        {(p.user?.username || p.username || '?').charAt(0).toUpperCase()}
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-gray-900 ${
                          p.isOnline
                            ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                            : 'bg-gray-500'
                        }`}
                        title={p.isOnline ? 'Online' : 'Offline'}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm text-gray-200 truncate">
                          {p.user?.username || p.username}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 px-1.5 py-0.5 rounded font-mono">
                            You
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        {isHost ? (
                          <span className="text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                            <Trophy className="w-3 h-3 text-yellow-400" /> Host
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400 font-mono">
                            Participant
                          </span>
                        )}
                        <span className={`text-[10px] font-mono flex items-center gap-1 ${p.isOnline ? 'text-emerald-400' : 'text-gray-500'}`}>
                          {p.isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                          {p.isOnline ? 'Online' : 'Offline'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
