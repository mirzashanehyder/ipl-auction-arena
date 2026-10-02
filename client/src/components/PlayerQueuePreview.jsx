import React, { useState, useEffect, useCallback } from 'react';
import { getPlayerQueue, shufflePlayerQueue } from '../services/api';
import { subscribeToQueueUpdated } from '../services/socket';
import { ListOrdered, Shuffle, ChevronDown, ChevronUp, UserCheck, ShieldAlert, Sparkles, Trophy, Globe } from 'lucide-react';

export default function PlayerQueuePreview({ roomCode, hostParticipantId }) {
  const [playerQueue, setPlayerQueue] = useState([]);
  const [loading, setLoading] = useState(false);
  const [shuffleLoading, setShuffleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);

  // Fetch Player Queue Preview
  const fetchQueue = useCallback(async () => {
    if (!roomCode || !hostParticipantId) return;
    setLoading(true);
    setErrorMessage('');
    const res = await getPlayerQueue(roomCode, hostParticipantId);
    setLoading(false);

    if (res.success && res.playerQueue) {
      setPlayerQueue(res.playerQueue);
    } else {
      setErrorMessage(res.message || 'Failed to load player queue.');
    }
  }, [roomCode, hostParticipantId]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Socket listener for real-time queue updates
  useEffect(() => {
    const unsubscribe = subscribeToQueueUpdated(() => {
      fetchQueue();
    });
    return () => unsubscribe();
  }, [fetchQueue]);

  // Handle Reshuffle Queue
  const handleShuffle = async () => {
    if (!roomCode || !hostParticipantId) return;
    setShuffleLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    const res = await shufflePlayerQueue(roomCode, hostParticipantId);
    setShuffleLoading(false);

    if (res.success && res.playerQueue) {
      setPlayerQueue(res.playerQueue);
      setSuccessMessage('Draft queue reshuffled successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } else {
      setErrorMessage(res.message || 'Failed to reshuffle draft queue.');
    }
  };

  // Helper for formatting prices in INR Crores/Lakhs
  const formatPrice = (price) => {
    if (!price) return '₹0';
    if (price >= 10000000) {
      return `₹${(price / 10000000).toFixed(2)} Cr`;
    }
    return `₹${(price / 100000).toFixed(0)} Lakhs`;
  };

  // Helper for Role Tag Styling
  const getRoleBadge = (role) => {
    switch (role) {
      case 'BATSMAN':
        return <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded font-mono text-[10px] uppercase">Batter</span>;
      case 'BOWLER':
        return <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded font-mono text-[10px] uppercase">Bowler</span>;
      case 'ALL_ROUNDER':
        return <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded font-mono text-[10px] uppercase">All-Rounder</span>;
      case 'WICKET_KEEPER':
        return <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded font-mono text-[10px] uppercase">Keeper</span>;
      default:
        return <span className="px-2 py-0.5 bg-gray-500/20 text-gray-300 border border-gray-500/30 rounded font-mono text-[10px] uppercase">{role}</span>;
    }
  };

  if (!hostParticipantId) return null;

  return (
    <div className="glass-panel p-6 rounded-3xl border border-blue-500/20 shadow-2xl space-y-4">
      {/* HEADER & TOGGLE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <ListOrdered className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-extrabold text-white">Draft Player Queue Preview</h3>
              <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 text-xs font-mono font-bold rounded-full border border-blue-500/30">
                {playerQueue.length} Players
              </span>
              <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-300 text-[10px] font-semibold rounded-full border border-yellow-500/30">
                HOST CONTROL
              </span>
            </div>
            <p className="text-gray-400 text-xs mt-0.5">
              Host preview of upcoming auction queue order before going live.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShuffle}
            disabled={shuffleLoading || loading || playerQueue.length === 0}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-purple-500/20 cursor-pointer disabled:opacity-50"
          >
            {shuffleLoading ? (
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <Shuffle className="w-4 h-4 text-yellow-300" />
            )}
            Reshuffle Order
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition"
            title={isExpanded ? 'Collapse Queue' : 'Expand Queue'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* MESSAGES */}
      {errorMessage && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
          {successMessage}
        </div>
      )}

      {/* EXPANDABLE QUEUE LIST */}
      {isExpanded && (
        <div className="space-y-3 pt-2">
          {loading ? (
            <div className="py-8 text-center space-y-2">
              <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto"></div>
              <p className="text-xs text-gray-400 font-mono">Loading draft queue order...</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
              {playerQueue.map((ap, idx) => {
                const p = ap.player;
                return (
                  <div
                    key={ap.id}
                    className="glass-card p-3 rounded-2xl border border-gray-800/80 hover:border-gray-700 flex items-center justify-between gap-3 transition"
                  >
                    <div className="flex items-center gap-3">
                      {/* ORDER BADGE */}
                      <div className="w-8 h-8 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center font-mono font-bold text-xs text-yellow-400 shrink-0">
                        #{ap.orderIndex || idx + 1}
                      </div>

                      {/* PLAYER AVATAR & DETAILS */}
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-900 border border-gray-800 overflow-hidden flex items-center justify-center shrink-0">
                          {p?.imageUrl ? (
                            <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-bold text-white text-xs">{p?.name?.charAt(0) || '?'}</span>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-white">{p?.name}</span>
                            <span className="text-[11px] text-gray-400 flex items-center gap-1 font-mono">
                              <Globe className="w-3 h-3 text-gray-500" /> {p?.country}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mt-1">
                            {getRoleBadge(p?.role)}
                            <span className="text-[10px] px-2 py-0.5 bg-gray-800 text-gray-300 rounded font-mono">
                              {p?.category || 'Capped'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* BASE PRICE & STATUS */}
                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold text-emerald-400 font-mono">
                        Base: {formatPrice(p?.basePrice || ap.basePrice)}
                      </div>
                      <span className="text-[10px] text-gray-500 font-mono uppercase">
                        {ap.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
