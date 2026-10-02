import React, { useState, useEffect } from 'react';
import { Play, Sparkles, Trophy, ShieldCheck, Zap, Coins, Users, UserX, Globe, Tag, Award, AlertTriangle, CheckCircle2, Clock, Volume2, VolumeX } from 'lucide-react';

function RadialTimer({ timeLeftMs, totalDurationMs = 15000, isPaused, isTimerExpired, isTimerUrgent }) {
  const percentage = Math.max(0, Math.min(100, (timeLeftMs / totalDurationMs) * 100));
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  let strokeColor = '#3b82f6';
  if (isPaused) strokeColor = '#f59e0b';
  else if (isTimerExpired) strokeColor = '#f43f5e';
  else if (isTimerUrgent) strokeColor = '#ef4444';
  else if (percentage < 45) strokeColor = '#eab308';

  return (
    <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 64 64">
        <circle
          cx="32"
          cy="32"
          r={radius}
          className="stroke-gray-800"
          strokeWidth="5"
          fill="transparent"
        />
        <circle
          cx="32"
          cy="32"
          r={radius}
          stroke={strokeColor}
          strokeWidth="5"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-100 ease-linear"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center font-mono font-black">
        <span className={`text-xs font-extrabold ${isTimerUrgent ? 'text-rose-400 animate-pulse' : 'text-white'}`}>
          {isPaused ? 'PAUSE' : isTimerExpired ? '0.0s' : `${(timeLeftMs / 1000).toFixed(1)}s`}
        </span>
      </div>
    </div>
  );
}

export default function LiveAuctionArena({
  session,
  currentPlayer,
  currentParticipant,
  claimedTeam,
  onStartAuction,
  startLoading,
  onPlaceBid,
  isBidding,
  bidError,
  onClearError,
  lastSoldResult,
  lastUnsoldResult
}) {
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Play synthesized auction hammer sound cue on player sold
  useEffect(() => {
    if (lastSoldResult && soundEnabled) {
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(160, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.7, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.18);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.18);
      } catch (e) {
        console.log('Audio Context playback notice:', e);
      }
    }
  }, [lastSoldResult, soundEnabled]);
  const isHost = currentParticipant?.isHost;
  const isPaused = session?.status === 'PAUSED';
  const isLive = session?.status === 'LIVE' || isPaused;
  const isCompleted = session?.status === 'COMPLETED';

  // Format currency helpers
  const formatPurse = (amount) => {
    if (amount === undefined || amount === null) return '₹0 Cr';
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(2)} Cr`;
    }
    return `₹${(amount / 100000).toFixed(0)} Lakhs`;
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'BATSMAN':
        return <span className="px-3 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full font-mono text-xs font-bold uppercase">Batter</span>;
      case 'BOWLER':
        return <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full font-mono text-xs font-bold uppercase">Bowler</span>;
      case 'ALL_ROUNDER':
        return <span className="px-3 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-full font-mono text-xs font-bold uppercase">All-Rounder</span>;
      case 'WICKET_KEEPER':
        return <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full font-mono text-xs font-bold uppercase">Wicket-Keeper</span>;
      default:
        return <span className="px-3 py-1 bg-gray-500/20 text-gray-300 border border-gray-500/30 rounded-full font-mono text-xs font-bold uppercase">{role}</span>;
    }
  };

  const playerDetails = currentPlayer?.player;
  const currentBidAmount = currentPlayer?.currentBid || currentPlayer?.basePrice || 20000000;
  const minIncrement = session?.minBidIncrement || 20000000;

  // Next bid increment calculation options
  const nextBid1 = currentBidAmount + minIncrement;
  const nextBid2 = currentBidAmount + (minIncrement * 2);
  const nextBid5 = currentBidAmount + (minIncrement * 5);

  const hasClaimedTeam = Boolean(claimedTeam);
  const isCurrentHighestBidder = claimedTeam && currentPlayer?.highestBidTeam?.id === claimedTeam.teamId;
  const remainingPurse = claimedTeam?.remainingPurse ?? (session?.startingPurse || 1000000000);

  // Stage 11 Server-Owned Timer Countdown Hook
  const [timeLeftMs, setTimeLeftMs] = useState(0);

  useEffect(() => {
    if (!currentPlayer?.endsAt || !isLive) {
      setTimeLeftMs(0);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, currentPlayer.endsAt - now);
      setTimeLeftMs(diff);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 50);
    return () => clearInterval(interval);
  }, [currentPlayer?.endsAt, isLive]);

  const isTimerExpired = isLive && Boolean(currentPlayer?.endsAt) && timeLeftMs <= 0;
  const isTimerUrgent = isLive && timeLeftMs > 0 && timeLeftMs <= 5000;

  return (
    <div className="space-y-6">
      {/* ARENA TOP CONTROL & STATUS HEADER */}
      <div className="glass-panel p-6 rounded-3xl border border-gray-800 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-yellow-500 to-amber-600 flex items-center justify-center text-gray-950 font-black shadow-lg shrink-0">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-2xl font-black text-white tracking-tight">{session?.name}</h2>
              {isLive ? (
                <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-extrabold flex items-center gap-1.5 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]"></span>
                  AUCTION LIVE
                </span>
              ) : (
                <span className="px-3 py-1 bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 rounded-full text-xs font-extrabold">
                  PRE-AUCTION LOBBY
                </span>
              )}
            </div>
            <p className="text-gray-400 text-xs mt-0.5 font-mono">
              Room Code: <strong className="text-yellow-400 font-bold">{session?.roomCode}</strong> &bull; Host: <span className="text-white">{session?.host?.username}</span> &bull; Min Increment: <span className="text-yellow-300">₹{((session?.minBidIncrement || 20000000) / 100000).toFixed(0)} L</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`px-3 py-2 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 transition cursor-pointer ${
              soundEnabled
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
            }`}
            title={soundEnabled ? 'Hammer sound enabled' : 'Hammer sound muted'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4 text-gray-400" />}
            {soundEnabled ? 'Sound ON' : 'Muted'}
          </button>

          {/* HOST ACTION BAR */}
          {!isLive && isHost && (
            <button
              onClick={onStartAuction}
              disabled={startLoading}
              className="px-6 py-3.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:opacity-95 text-gray-950 font-black rounded-2xl shadow-xl shadow-emerald-500/20 transition duration-200 flex items-center justify-center gap-2 text-sm uppercase tracking-wider shrink-0 cursor-pointer disabled:opacity-50"
            >
              {startLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-gray-950/30 border-t-gray-950 rounded-full animate-spin"></div>
                  Initializing Live Engine...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  Start Live Auction
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* SOLD & UNSOLD REAL-TIME NOTIFICATION OVERLAYS */}
      {lastSoldResult && (
        <div className="p-6 bg-gradient-to-r from-emerald-950 via-teal-900 to-gray-950 border-2 border-emerald-500 rounded-3xl text-center space-y-3 animate-in zoom-in-95 shadow-2xl relative overflow-hidden">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full text-xs font-mono font-black uppercase tracking-widest animate-pulse">
            🔨 PLAYER SOLD!
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl md:text-3xl font-black text-white">{lastSoldResult.player?.name}</h3>
            <p className="text-emerald-400 font-mono text-base font-bold">
              Acquired by <span className="text-yellow-300">{lastSoldResult.winningTeam?.name}</span> ({lastSoldResult.winningBidder?.username}) for {formatPurse(lastSoldResult.soldPrice)}!
            </p>
          </div>
          <p className="text-gray-400 text-xs font-mono pt-1 animate-pulse">
            Advancing to next player in draft pool...
          </p>
        </div>
      )}

      {lastUnsoldResult && (
        <div className="p-6 bg-gradient-to-r from-gray-950 via-rose-950 to-gray-950 border-2 border-rose-500/50 rounded-3xl text-center space-y-3 animate-in zoom-in-95 shadow-2xl relative overflow-hidden">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-full text-xs font-mono font-black uppercase tracking-widest">
            ❌ PLAYER UNSOLD
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-white">{lastUnsoldResult.player?.name}</h3>
            <p className="text-gray-400 text-xs font-mono">No bids were placed during the bidding window.</p>
          </div>
          <p className="text-gray-400 text-xs font-mono pt-1 animate-pulse">
            Advancing to next player in draft pool...
          </p>
        </div>
      )}

      {/* STAGE VIEW */}
      {isCompleted ? (
        <div className="glass-panel p-12 rounded-3xl border border-yellow-500/40 text-center space-y-6 bg-gradient-to-b from-gray-900 to-black shadow-2xl">
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-yellow-500 to-amber-600 text-gray-950 flex items-center justify-center mx-auto shadow-xl">
            <Trophy className="w-10 h-10" />
          </div>
          <div className="space-y-2 max-w-lg mx-auto">
            <h2 className="text-3xl font-black text-white">AUCTION CONCLUDED!</h2>
            <p className="text-gray-300 text-sm">
              All players in the draft pool have been processed. Franchise squads, total spend, and unsold stats have been recorded.
            </p>
            <div className="pt-4">
              <a
                href={`/results/${session?.roomCode}`}
                className="inline-flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-gray-950 font-black text-xs rounded-2xl shadow-xl shadow-yellow-500/20 uppercase tracking-wider transition"
              >
                <Trophy className="w-4 h-4 fill-current" /> View Official Results Dashboard
              </a>
            </div>
          </div>
        </div>
      ) : !isLive ? (
        <div className="glass-panel p-12 rounded-3xl border border-gray-800 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 flex items-center justify-center mx-auto">
            <Zap className="w-8 h-8 animate-bounce" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-xl font-extrabold text-white">Auction Engine Ready</h3>
            <p className="text-gray-400 text-xs">
              {isHost
                ? 'Claim your team franchise above, review the draft player queue, and click "Start Live Auction" when all franchise managers are ready.'
                : 'Waiting for the host to launch the live auction engine. Pick your team franchise above while waiting!'}
            </p>
          </div>
        </div>
      ) : (
        /* LIVE AUCTION ACTIVE PLAYER CARD (STAGE 11 TIMER SYNCHRONIZATION) */
        <div className="glass-panel p-8 md:p-10 rounded-3xl border border-yellow-500/30 shadow-2xl space-y-8 relative overflow-hidden bg-gradient-to-b from-gray-900 via-gray-900/90 to-black">
          {/* Subtle Ambient Glow Background */}
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

          {/* TOP TAGS & LOT ORDER */}
          <div className="flex flex-wrap items-center justify-between gap-3 relative z-10">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 rounded-xl text-xs font-mono font-extrabold">
                LOT #{currentPlayer?.orderIndex || 1}
              </span>
              {playerDetails?.category && (
                <span className="px-3 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded-xl text-xs font-mono font-bold flex items-center gap-1">
                  <Award className="w-3.5 h-3.5 text-purple-400" />
                  {playerDetails.category}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {getRoleBadge(playerDetails?.role)}
              <span className="px-3 py-1 bg-gray-800 text-gray-300 border border-gray-700 rounded-xl text-xs font-mono font-semibold flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-gray-400" />
                {playerDetails?.country || 'India'}
              </span>
            </div>
          </div>

          {/* PLAYER MAIN SHOWCASE */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center relative z-10">
            {/* PLAYER AVATAR SHOWCASE */}
            <div className="md:col-span-5 text-center">
              <div className="w-48 h-48 md:w-56 md:h-56 mx-auto rounded-3xl p-3 bg-gradient-to-tr from-gray-800 via-gray-900 to-black border-2 border-yellow-500/40 shadow-2xl flex items-center justify-center overflow-hidden relative group">
                {playerDetails?.imageUrl ? (
                  <img
                    src={playerDetails.imageUrl}
                    alt={playerDetails.name}
                    className="w-full h-full object-cover rounded-2xl group-hover:scale-105 transition duration-300"
                  />
                ) : (
                  <div className="w-full h-full rounded-2xl bg-gray-900 flex items-center justify-center font-black text-6xl text-amber-400 font-mono">
                    {playerDetails?.name?.charAt(0) || '?'}
                  </div>
                )}
              </div>
            </div>

            {/* PLAYER DETAILS & PRICE CENTER */}
            <div className="md:col-span-7 space-y-6 text-center md:text-left">
              <div className="space-y-2">
                <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">
                  {playerDetails?.name || 'Player'}
                </h1>
                
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-xs text-gray-400 font-mono">
                  {playerDetails?.battingStyle && (
                    <span className="bg-gray-800/80 px-3 py-1 rounded-lg border border-gray-700">
                      Batting: <strong className="text-gray-200">{playerDetails.battingStyle}</strong>
                    </span>
                  )}
                  {playerDetails?.bowlingStyle && (
                    <span className="bg-gray-800/80 px-3 py-1 rounded-lg border border-gray-700">
                      Bowling: <strong className="text-gray-200">{playerDetails.bowlingStyle}</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* SCOREBOARD - THE MONEY CENTER & COUNTDOWN READOUT */}
              <div className="bg-gradient-to-br from-gray-950 via-gray-900 to-black p-6 rounded-2xl border border-gray-800 shadow-inner grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                {/* BASE PRICE */}
                <div className="p-4 bg-gray-900/60 rounded-xl border border-gray-800/80 space-y-1">
                  <span className="text-[11px] uppercase tracking-widest text-gray-400 font-mono font-semibold block">
                    Base Price
                  </span>
                  <div className="text-2xl font-black text-gray-200 font-mono">
                    {formatPurse(currentPlayer?.basePrice)}
                  </div>
                </div>

                {/* CURRENT BID / ASKING PRICE */}
                <div className="p-4 bg-yellow-500/10 rounded-xl border border-yellow-500/30 space-y-1">
                  <span className="text-[11px] uppercase tracking-widest text-yellow-400 font-mono font-semibold block">
                    Current Bid
                  </span>
                  <div className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 font-scoreboard tracking-wider">
                    {formatPurse(currentBidAmount)}
                  </div>
                </div>

                {/* STAGE 11 & 16 RADIAL SVG COUNTDOWN TIMER */}
                <div className={`p-3 rounded-xl border transition-all flex flex-col items-center justify-center gap-1 ${
                  isPaused
                    ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 animate-pulse'
                    : isTimerExpired
                    ? 'bg-rose-500/10 border-rose-500/40 text-rose-300'
                    : isTimerUrgent
                    ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)] animate-pulse'
                    : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                }`}>
                  <span className="text-[10px] uppercase tracking-widest font-mono font-bold flex items-center gap-1 text-gray-300">
                    <Clock className={`w-3 h-3 ${isTimerUrgent ? 'animate-spin text-amber-400' : ''}`} /> Timer
                  </span>
                  <RadialTimer
                    timeLeftMs={timeLeftMs}
                    totalDurationMs={15000}
                    isPaused={isPaused}
                    isTimerExpired={isTimerExpired}
                    isTimerUrgent={isTimerUrgent}
                  />
                </div>
              </div>

              {/* HIGHEST BIDDER STATUS */}
              <div className="p-4 bg-gray-900/80 rounded-2xl border border-gray-800 flex items-center justify-between gap-4">
                <span className="text-xs font-mono text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-yellow-400" /> Highest Bidder:
                </span>
                {currentPlayer?.highestBidTeam ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white font-mono px-3 py-1 bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 rounded-lg flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.9)] animate-pulse"></span>
                      {currentPlayer.highestBidTeam.name} ({currentPlayer.highestBidder?.username})
                    </span>
                  </div>
                ) : (
                  <span className="text-xs font-bold text-gray-400 font-mono px-3 py-1 bg-gray-800 rounded-lg border border-gray-700">
                    No Bids Placed Yet
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* STAGE 10 & 11 REAL-TIME BIDDING CONTROL PANEL */}
          <div className="bg-gray-950/90 p-6 rounded-2xl border border-yellow-500/30 space-y-4 relative z-10">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-mono font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-yellow-400" /> Real-Time Bidding Controls
              </span>
              {claimedTeam && (
                <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full font-bold">
                  Team Purse: {formatPurse(claimedTeam.remainingPurse)}
                </span>
              )}
            </div>

            {bidError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-mono flex items-center justify-between gap-2 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span><strong>Bid Rejected:</strong> {bidError}</span>
                </div>
                <button onClick={onClearError} className="text-gray-400 hover:text-white text-xs font-bold cursor-pointer px-1">✕</button>
              </div>
            )}

            {isPaused ? (
              <div className="p-4 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-300 text-xs text-center font-mono font-bold flex items-center justify-center gap-2 animate-pulse">
                <Clock className="w-4 h-4 text-amber-400" />
                AUCTION PAUSED BY HOST — Live bidding is temporarily suspended until the host resumes.
              </div>
            ) : !hasClaimedTeam ? (
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-300 text-xs text-center font-mono">
                ⚠️ <strong>No Team Franchise Claimed</strong>: Select an available team franchise above to unlock live bidding buttons.
              </div>
            ) : isTimerExpired ? (
              <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs text-center font-mono font-bold flex items-center justify-center gap-2">
                <Clock className="w-4 h-4 text-rose-400" />
                Auction Bidding Window Closed (Timer Expired). Any late bid will be rejected by the server clock.
              </div>
            ) : isCurrentHighestBidder ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs text-center font-mono font-bold flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Your Franchise holds the HIGHEST BID at {formatPurse(currentBidAmount)}! Waiting for another franchise to outbid.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Option 1: Minimum Increment (+1x) */}
                <button
                  onClick={() => onPlaceBid(nextBid1)}
                  disabled={isBidding || isTimerExpired || remainingPurse < nextBid1}
                  className="py-3.5 px-4 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-gray-950 font-black rounded-xl shadow-lg transition duration-200 flex flex-col items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="text-[10px] uppercase tracking-wider font-mono">Bid +{formatPurse(minIncrement)}</span>
                  <span className="text-base font-black font-mono">{formatPurse(nextBid1)}</span>
                </button>

                {/* Option 2: 2x Increment */}
                <button
                  onClick={() => onPlaceBid(nextBid2)}
                  disabled={isBidding || isTimerExpired || remainingPurse < nextBid2}
                  className="py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black rounded-xl shadow-lg transition duration-200 flex flex-col items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="text-[10px] uppercase tracking-wider font-mono text-blue-200">Bid +{formatPurse(minIncrement * 2)}</span>
                  <span className="text-base font-black font-mono">{formatPurse(nextBid2)}</span>
                </button>

                {/* Option 3: 5x Increment */}
                <button
                  onClick={() => onPlaceBid(nextBid5)}
                  disabled={isBidding || isTimerExpired || remainingPurse < nextBid5}
                  className="py-3.5 px-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-black rounded-xl shadow-lg transition duration-200 flex flex-col items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="text-[10px] uppercase tracking-wider font-mono text-purple-200">Bid +{formatPurse(minIncrement * 5)}</span>
                  <span className="text-base font-black font-mono">{formatPurse(nextBid5)}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

