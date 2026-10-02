import React, { useState } from 'react';
import { Trophy, Coins, Users, ChevronDown, ChevronUp, UserCheck, Shield, Sparkles, Award } from 'lucide-react';

export default function SquadPursePanel({ squads = [], currentParticipantId }) {
  const [isOpen, setIsOpen] = useState(true);
  const [expandedTeamId, setExpandedTeamId] = useState(null);

  const formatPurse = (amount) => {
    if (amount === undefined || amount === null) return '₹0 Cr';
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(2)} Cr`;
    }
    return `₹${(amount / 100000).toFixed(0)} Lakhs`;
  };

  const getProgressBarColor = (percentage) => {
    if (percentage > 50) return 'from-emerald-500 to-teal-400';
    if (percentage >= 20) return 'from-yellow-500 to-amber-400';
    return 'from-rose-600 to-red-500 animate-pulse';
  };

  const toggleExpand = (teamId) => {
    setExpandedTeamId((prev) => (prev === teamId ? null : teamId));
  };

  const totalPlayersSold = squads.reduce((acc, team) => acc + (team.squadSize || 0), 0);

  return (
    <div className="glass-panel p-6 rounded-3xl border border-gray-800 shadow-2xl space-y-6">
      {/* HEADER BAR WITH COLLAPSE TOGGLE */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-gray-950 font-black shadow-lg">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-extrabold text-white">Franchise Squads & Purse Tracker</h3>
              <span className="px-2.5 py-0.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full text-xs font-mono font-bold">
                {totalPlayersSold} {totalPlayersSold === 1 ? 'Player Sold' : 'Players Sold'}
              </span>
            </div>
            <p className="text-gray-400 text-xs font-mono mt-0.5">
              Live remaining purse limits & acquired rosters across all 10 IPL franchises
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className="p-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-mono font-bold"
        >
          {isOpen ? (
            <>
              Hide Leaderboard <ChevronUp className="w-4 h-4" />
            </>
          ) : (
            <>
              Show Leaderboard <ChevronDown className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      {/* SQUAD & PURSE LEADERBOARD GRID */}
      {isOpen && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-200">
          {squads.map((team) => {
            const isMyTeam = team.claimedBy?.id === currentParticipantId;
            const isExpanded = expandedTeamId === team.teamId;
            const pursePercentage = team.pursePercentage ?? 100;

            return (
              <div
                key={team.teamId}
                className={`glass-card p-5 rounded-2xl border transition-all duration-200 relative overflow-hidden ${
                  isMyTeam
                    ? 'border-2 border-yellow-500/80 bg-gradient-to-b from-yellow-500/10 via-gray-900 to-black shadow-xl shadow-yellow-500/10'
                    : 'border-gray-800 hover:border-gray-700 bg-gray-900/60'
                }`}
              >
                {/* MY FRANCHISE GLOW BADGE */}
                {isMyTeam && (
                  <div className="absolute top-0 right-0 bg-yellow-500 text-gray-950 text-[10px] font-black font-mono px-3 py-1 rounded-bl-xl shadow-md uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3 h-3 fill-current" /> Your Franchise
                  </div>
                )}

                {/* TEAM HEADER */}
                <div className="flex items-center gap-3.5 mb-3">
                  <div
                    className="w-12 h-12 rounded-2xl p-1 shadow-md flex items-center justify-center shrink-0 border"
                    style={{
                      borderColor: team.primaryColor || '#3b82f6',
                      backgroundColor: `${team.primaryColor || '#3b82f6'}20`
                    }}
                  >
                    {team.logoUrl ? (
                      <img src={team.logoUrl} alt={team.name} className="w-full h-full object-contain" />
                    ) : (
                      <span className="font-black text-sm text-white font-mono">{team.shortName}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-white text-base truncate">{team.name}</h4>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-gray-800 text-gray-300 rounded-md border border-gray-700">
                        {team.shortName}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-0.5 text-xs">
                      {team.isClaimed ? (
                        <span className="text-emerald-400 font-mono flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5" /> {team.claimedBy?.username}
                        </span>
                      ) : (
                        <span className="text-gray-500 font-mono italic">Unclaimed</span>
                      )}
                      <span className="text-gray-600">&bull;</span>
                      <span className="text-gray-300 font-mono font-bold">
                        {team.squadSize} {team.squadSize === 1 ? 'Player' : 'Players'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* PURSE PROGRESS BAR */}
                <div className="space-y-1.5 bg-gray-950/80 p-3 rounded-xl border border-gray-800/80">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-gray-400 uppercase tracking-wider text-[10px] font-semibold">
                      Purse Remaining
                    </span>
                    <span className="font-black text-white font-mono">
                      {formatPurse(team.remainingPurse)} <span className="text-gray-500 font-normal">/ {formatPurse(team.startingPurse)}</span>
                    </span>
                  </div>

                  <div className="w-full bg-gray-800 rounded-full h-2.5 overflow-hidden p-0.5 border border-gray-700/50">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${getProgressBarColor(pursePercentage)} transition-all duration-500`}
                      style={{ width: `${Math.min(100, Math.max(0, pursePercentage))}%` }}
                    />
                  </div>
                </div>

                {/* EXPANDABLE SQUAD LIST BUTTON */}
                <div className="mt-3">
                  <button
                    onClick={() => toggleExpand(team.teamId)}
                    className="w-full py-2 px-3 bg-gray-800/60 hover:bg-gray-800 text-gray-300 rounded-xl text-xs font-mono font-semibold transition flex items-center justify-between cursor-pointer border border-gray-800"
                  >
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-blue-400" />
                      View Acquired Roster ({team.squadSize})
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {/* EXPANDED SQUAD LIST */}
                  {isExpanded && (
                    <div className="mt-3 space-y-2 pt-2 border-t border-gray-800 animate-in fade-in duration-200">
                      {team.players && team.players.length > 0 ? (
                        team.players.map((p) => (
                          <div
                            key={p.id}
                            className="p-2.5 bg-gray-950 rounded-xl border border-gray-800 flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-gray-800 flex items-center justify-center font-bold text-amber-400 text-xs font-mono shrink-0">
                                {p.name.charAt(0)}
                              </div>
                              <div className="truncate">
                                <div className="font-bold text-white truncate">{p.name}</div>
                                <div className="text-[10px] text-gray-400 font-mono">{p.role} &bull; {p.category}</div>
                              </div>
                            </div>
                            <div className="font-black text-yellow-400 font-mono shrink-0">
                              {formatPurse(p.purchasePrice)}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-3 text-center text-xs text-gray-500 font-mono italic bg-gray-950/40 rounded-xl border border-gray-800/40">
                          No players acquired yet in this auction.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
