import React, { useState, useEffect } from 'react';
import { getSessionTeams } from '../services/api';
import {
  emitPauseAuction,
  emitResumeAuction,
  emitSkipPlayer,
  emitForceSell,
  emitEndAuction
} from '../services/socket';
import {
  Crown,
  Pause,
  Play,
  SkipForward,
  Gavel,
  Square,
  AlertTriangle,
  X,
  CheckCircle,
  Coins,
  ShieldAlert
} from 'lucide-react';

export default function HostControlBar({
  sessionCode,
  hostParticipantId,
  sessionStatus,
  currentPlayer
}) {
  const [teams, setTeams] = useState([]);
  const [isPauseLoading, setIsPauseLoading] = useState(false);

  // Modals
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [showForceSellModal, setShowForceSellModal] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);

  // Force Sell Form state
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [forceSellPrice, setForceSellPrice] = useState('');
  const [forceSellError, setForceSellError] = useState('');

  // Fetch claimed session teams for Force Sell modal dropdown
  useEffect(() => {
    async function fetchTeams() {
      if (!sessionCode) return;
      const res = await getSessionTeams(sessionCode);
      if (res.success && res.teams) {
        // Filter teams that have been claimed
        const claimed = res.teams.filter((t) => t.isClaimed);
        setTeams(claimed);
        if (claimed.length > 0) {
          setSelectedTeamId(claimed[0].id);
        }
      }
    }
    if (showForceSellModal) {
      fetchTeams();
    }
  }, [sessionCode, showForceSellModal]);

  // Set default force sell price to current bid or base price
  useEffect(() => {
    if (currentPlayer) {
      const priceInCr = ((currentPlayer.currentBid || currentPlayer.basePrice || 20000000) / 10000000).toFixed(2);
      setForceSellPrice(priceInCr);
    }
  }, [currentPlayer]);

  // Handle Pause / Resume Toggle
  const handleTogglePause = () => {
    if (!sessionCode || !hostParticipantId) return;
    setIsPauseLoading(true);
    setTimeout(() => setIsPauseLoading(false), 800);

    if (sessionStatus === 'PAUSED') {
      emitResumeAuction({ sessionCode, participantId: hostParticipantId });
    } else {
      emitPauseAuction({ sessionCode, participantId: hostParticipantId });
    }
  };

  // Handle Skip Player
  const handleConfirmSkip = () => {
    if (!sessionCode || !hostParticipantId) return;
    setShowSkipModal(false);
    emitSkipPlayer({ sessionCode, participantId: hostParticipantId });
  };

  // Handle Force Sell Submit
  const handleForceSellSubmit = (e) => {
    e.preventDefault();
    setForceSellError('');

    if (!selectedTeamId) {
      setForceSellError('Please select a target franchise.');
      return;
    }

    const priceInBytes = Math.round(parseFloat(forceSellPrice) * 10000000);
    if (isNaN(priceInBytes) || priceInBytes <= 0) {
      setForceSellError('Please enter a valid sale price in Crores.');
      return;
    }

    const targetTeam = teams.find((t) => t.id === selectedTeamId);
    if (targetTeam && targetTeam.remainingPurse < priceInBytes) {
      setForceSellError(
        `Insufficient purse! ${targetTeam.shortName} has ₹${(targetTeam.remainingPurse / 10000000).toFixed(2)} Cr remaining.`
      );
      return;
    }

    emitForceSell({
      sessionCode,
      participantId: hostParticipantId,
      targetTeamId: selectedTeamId,
      amount: priceInBytes
    });

    setShowForceSellModal(false);
  };

  // Handle End Auction Early
  const handleConfirmEndAuction = () => {
    if (!sessionCode || !hostParticipantId) return;
    setShowEndModal(false);
    emitEndAuction({ sessionCode, participantId: hostParticipantId });
  };

  const isPaused = sessionStatus === 'PAUSED';
  const isCompleted = sessionStatus === 'COMPLETED';

  if (isCompleted) return null;

  return (
    <div className="bg-gradient-to-r from-purple-950/90 via-slate-900 to-indigo-950 border-2 border-purple-500/40 rounded-3xl p-5 shadow-2xl relative overflow-hidden space-y-4">
      {/* GLOW DECORATION */}
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* HEADER STRIP */}
      <div className="flex items-center justify-between gap-4 border-b border-purple-500/20 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300 shadow">
            <Crown className="w-4 h-4 fill-current text-yellow-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-widest text-purple-300 font-mono">
                Host Admin Control Strip
              </span>
              <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 rounded text-[10px] font-mono font-bold">
                Server-Authoritative
              </span>
            </div>
            <p className="text-[11px] text-gray-400 font-mono">
              Exclusive host overrides — all actions verified server-side
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isPaused ? (
            <span className="px-3 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 animate-pulse">
              <Pause className="w-3.5 h-3.5" /> AUCTION PAUSED
            </span>
          ) : (
            <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-full text-xs font-mono font-bold flex items-center gap-1.5">
              <Play className="w-3.5 h-3.5 fill-current" /> AUCTION LIVE
            </span>
          )}
        </div>
      </div>

      {/* CONTROLS BUTTON ROW */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* 1. PAUSE / RESUME */}
        <button
          onClick={handleTogglePause}
          disabled={isPauseLoading}
          className={`py-3 px-4 rounded-2xl font-extrabold text-xs flex items-center justify-center gap-2 transition duration-200 shadow-md cursor-pointer border ${
            isPaused
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-emerald-400/40'
              : 'bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-gray-950 border-amber-400/40'
          }`}
        >
          {isPaused ? (
            <>
              <Play className="w-4 h-4 fill-current" /> Resume Auction
            </>
          ) : (
            <>
              <Pause className="w-4 h-4 fill-current" /> Pause Auction
            </>
          )}
        </button>

        {/* 2. SKIP PLAYER (FORCE UNSOLD) */}
        <button
          onClick={() => setShowSkipModal(true)}
          disabled={!currentPlayer}
          className="py-3 px-4 bg-gray-800/80 hover:bg-gray-800 border border-gray-700 hover:border-yellow-500/40 text-gray-200 font-extrabold text-xs rounded-2xl transition duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <SkipForward className="w-4 h-4 text-yellow-400" /> Skip Player
        </button>

        {/* 3. FORCE SELL */}
        <button
          onClick={() => setShowForceSellModal(true)}
          disabled={!currentPlayer}
          className="py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 border border-blue-400/40 text-white font-extrabold text-xs rounded-2xl transition duration-200 shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Gavel className="w-4 h-4 text-yellow-300" /> Force Sell...
        </button>

        {/* 4. END AUCTION EARLY */}
        <button
          onClick={() => setShowEndModal(true)}
          className="py-3 px-4 bg-gradient-to-r from-rose-950/80 to-red-900 hover:from-rose-900 hover:to-red-800 border border-rose-500/40 text-rose-200 font-extrabold text-xs rounded-2xl transition duration-200 flex items-center justify-center gap-2 cursor-pointer"
        >
          <Square className="w-3.5 h-3.5 text-rose-400 fill-current" /> End Auction
        </button>
      </div>

      {/* MODAL 1: SKIP PLAYER CONFIRMATION */}
      {showSkipModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-3xl border border-gray-800 max-w-md w-full space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-yellow-400 font-extrabold text-base">
                <AlertTriangle className="w-5 h-5" /> Skip Current Player?
              </div>
              <button
                onClick={() => setShowSkipModal(false)}
                className="p-1 text-gray-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-gray-300 text-xs font-mono">
              Are you sure you want to mark <strong className="text-white font-sans">{currentPlayer?.player?.name}</strong> as <span className="text-rose-400 font-bold">UNSOLD</span> and advance to the next player?
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowSkipModal(false)}
                className="px-4 py-2.5 bg-gray-800 text-gray-300 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSkip}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-600/30"
              >
                Confirm Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: FORCE SELL PLAYER FORM */}
      {showForceSellModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-3xl border border-gray-800 max-w-md w-full space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-400 font-extrabold text-base">
                <Gavel className="w-5 h-5 text-yellow-400" /> Force Sell Player
              </div>
              <button
                onClick={() => setShowForceSellModal(false)}
                className="p-1 text-gray-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-gray-950/80 p-3 rounded-2xl border border-gray-800 text-xs space-y-1">
              <div className="text-gray-400">Current Player:</div>
              <div className="font-extrabold text-white text-sm">{currentPlayer?.player?.name}</div>
              <div className="text-yellow-400 font-mono text-[11px]">
                Base Price: ₹{((currentPlayer?.basePrice || 0) / 10000000).toFixed(2)} Cr
              </div>
            </div>

            {forceSellError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-xs flex items-center gap-2 font-mono">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                {forceSellError}
              </div>
            )}

            <form onSubmit={handleForceSellSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider font-mono">
                  Select Target Franchise *
                </label>
                <select
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-xs font-mono focus:outline-none focus:border-blue-500"
                  required
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.shortName}) — Purse: ₹{(t.remainingPurse / 10000000).toFixed(2)} Cr
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider font-mono">
                  Final Sale Price (in ₹ Crores) *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-yellow-400 font-mono font-bold text-sm">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={forceSellPrice}
                    onChange={(e) => setForceSellPrice(e.target.value)}
                    placeholder="e.g. 12.5"
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-9 pr-12 py-3 text-white font-mono text-sm focus:outline-none focus:border-blue-500"
                    required
                  />
                  <span className="absolute right-4 top-3 text-gray-400 font-mono text-xs font-bold">
                    Cr
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowForceSellModal(false)}
                  className="px-4 py-2.5 bg-gray-800 text-gray-300 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-500/25 flex items-center gap-1.5"
                >
                  <Gavel className="w-4 h-4 text-yellow-300" />
                  Assign & Sell Player
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: END AUCTION CONFIRMATION */}
      {showEndModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-3xl border border-gray-800 max-w-md w-full space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-400 font-extrabold text-base">
                <AlertTriangle className="w-5 h-5" /> End Auction Early?
              </div>
              <button
                onClick={() => setShowEndModal(false)}
                className="p-1 text-gray-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-gray-300 text-xs font-mono">
              Are you sure you want to end the auction session early? This will complete the auction and stop all bidding for all participants.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowEndModal(false)}
                className="px-4 py-2.5 bg-gray-800 text-gray-300 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmEndAuction}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-600/30"
              >
                End Auction Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
