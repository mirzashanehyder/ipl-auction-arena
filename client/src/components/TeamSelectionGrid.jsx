import React, { useState, useEffect, useCallback } from 'react';
import { getSessionTeams, selectSessionTeam, releaseSessionTeam } from '../services/api';
import { subscribeToTeamsUpdated } from '../services/socket';
import { ShieldCheck, Lock, CheckCircle2, AlertCircle, Coins, Sparkles, LogOut } from 'lucide-react';

export default function TeamSelectionGrid({ roomCode, currentParticipantId, startingPurse, onTeamChange }) {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Fetch team availability
  const fetchTeams = useCallback(async () => {
    if (!roomCode) return;
    setLoading(true);
    const res = await getSessionTeams(roomCode);
    setLoading(false);
    if (res.success && res.teams) {
      setTeams(res.teams);
      if (onTeamChange) onTeamChange(res.teams);
    }
  }, [roomCode, onTeamChange]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  // Subscribe to real-time teamsUpdated socket event
  useEffect(() => {
    const unsubscribe = subscribeToTeamsUpdated((data) => {
      if (data.teams) {
        setTeams(data.teams);
        if (onTeamChange) onTeamChange(data.teams);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [onTeamChange]);

  // Handle Team Claiming
  const handleSelectTeam = async (teamId) => {
    if (!currentParticipantId || !roomCode) return;
    setErrorMessage('');
    setSuccessMessage('');
    setActionLoadingId(teamId);

    const response = await selectSessionTeam(roomCode, currentParticipantId, teamId);
    setActionLoadingId(null);

    if (response.success) {
      setSuccessMessage(response.message || 'Team claimed successfully!');
      if (response.teams) {
        setTeams(response.teams);
        if (onTeamChange) onTeamChange(response.teams);
      }
      setTimeout(() => setSuccessMessage(''), 3000);
    } else {
      setErrorMessage(response.message || 'Could not claim team.');
    }
  };

  // Handle Team Release
  const handleReleaseTeam = async () => {
    if (!currentParticipantId || !roomCode) return;
    setErrorMessage('');
    setSuccessMessage('');
    setActionLoadingId('release');

    const response = await releaseSessionTeam(roomCode, currentParticipantId);
    setActionLoadingId(null);

    if (response.success) {
      setSuccessMessage('Released team successfully.');
      if (response.teams) {
        setTeams(response.teams);
        if (onTeamChange) onTeamChange(response.teams);
      }
      setTimeout(() => setSuccessMessage(''), 3000);
    } else {
      setErrorMessage(response.message || 'Failed to release team.');
    }
  };

  // Find user's currently claimed team
  const myClaimedTeam = teams.find((t) => t.claimedBy?.id === currentParticipantId);

  return (
    <div className="space-y-6">
      {/* SECTION HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-900/60 p-6 rounded-3xl border border-gray-800">
        <div>
          <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-yellow-400" />
            Claim Your IPL Franchise Team
          </h3>
          <p className="text-gray-400 text-xs mt-1">
            Pick one of 10 IPL franchise teams. Each team can belong to only one participant per auction.
          </p>
        </div>

        {myClaimedTeam ? (
          <div className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/30 px-4 py-2.5 rounded-2xl shrink-0">
            <div className="text-left">
              <span className="text-[10px] text-yellow-400/80 font-mono uppercase tracking-wider block">Your Selected Franchise</span>
              <span className="text-sm font-bold text-yellow-300 font-mono">{myClaimedTeam.name} ({myClaimedTeam.shortName})</span>
            </div>
            <button
              onClick={handleReleaseTeam}
              disabled={actionLoadingId === 'release'}
              className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {actionLoadingId === 'release' ? (
                <div className="w-3.5 h-3.5 border-2 border-rose-300/30 border-t-rose-300 rounded-full animate-spin"></div>
              ) : (
                <LogOut className="w-3.5 h-3.5" />
              )}
              Release
            </button>
          </div>
        ) : (
          <span className="text-xs text-amber-400 font-semibold bg-amber-500/10 border border-amber-500/20 px-3.5 py-2 rounded-2xl shrink-0 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-300" /> Select a Team Below to Claim Your Purse
          </span>
        )}
      </div>

      {/* FEEDBACK BANNERS */}
      {errorMessage && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-xs font-medium flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-300 text-xs font-medium flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          {successMessage}
        </div>
      )}

      {/* TEAMS GRID */}
      {loading ? (
        <div className="py-12 text-center space-y-3">
          <div className="w-8 h-8 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-gray-400 font-mono">Loading IPL Franchise Teams...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {teams.map((team) => {
            const isMine = team.claimedBy?.id === currentParticipantId;
            const isTaken = team.isClaimed && !isMine;
            const isLoadingThis = actionLoadingId === team.id;

            return (
              <div
                key={team.id}
                style={{
                  borderColor: isMine ? team.primaryColor || '#eab308' : isTaken ? '#374151' : `${team.primaryColor}50`
                }}
                className={`glass-panel p-4 rounded-2xl border transition-all duration-200 relative flex flex-col justify-between group ${
                  isMine
                    ? 'ring-2 ring-yellow-400/80 bg-gradient-to-b from-gray-900 via-yellow-950/10 to-gray-900 shadow-xl scale-[1.02]'
                    : isTaken
                    ? 'opacity-50 grayscale bg-gray-950/80 border-gray-800'
                    : 'hover:border-blue-500/60 hover:shadow-lg hover:scale-[1.02] bg-gray-900/60'
                }`}
              >
                {/* HEADER / LOGO & BADGE */}
                <div className="space-y-3 text-center">
                  <div className="flex justify-between items-center">
                    <span
                      className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border"
                      style={{
                        backgroundColor: `${team.primaryColor}20`,
                        color: team.primaryColor || '#60a5fa',
                        borderColor: `${team.primaryColor}40`
                      }}
                    >
                      {team.shortName}
                    </span>

                    {isMine && (
                      <span className="text-[10px] bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 px-2 py-0.5 rounded-full font-bold font-mono">
                        YOUR TEAM
                      </span>
                    )}

                    {isTaken && (
                      <span className="text-[10px] bg-gray-800 text-gray-400 border border-gray-700 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                        <Lock className="w-3 h-3 text-gray-500" /> TAKEN
                      </span>
                    )}
                  </div>

                  {/* LOGO */}
                  <div className="w-16 h-16 mx-auto rounded-2xl p-2 bg-black/40 border border-gray-800 flex items-center justify-center overflow-hidden group-hover:scale-105 transition">
                    {team.logoUrl ? (
                      <img
                        src={team.logoUrl}
                        alt={team.name}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div
                      className="w-full h-full font-black text-xl flex items-center justify-center font-mono"
                      style={{
                        display: team.logoUrl ? 'none' : 'flex',
                        color: team.primaryColor || '#ffffff'
                      }}
                    >
                      {team.shortName}
                    </div>
                  </div>

                  {/* TEAM NAME */}
                  <div>
                    <h4 className="font-extrabold text-white text-sm leading-tight tracking-tight">
                      {team.name}
                    </h4>
                    <span className="text-[11px] text-gray-400 font-mono font-semibold">
                      {team.shortName}
                    </span>
                  </div>
                </div>

                {/* STATUS & PURSE FOOTER */}
                <div className="mt-4 pt-3 border-t border-gray-800/80 space-y-2">
                  {isMine ? (
                    <div className="text-center space-y-1">
                      <div className="text-[10px] text-emerald-400 font-mono flex items-center justify-center gap-1 font-bold">
                        <Coins className="w-3.5 h-3.5 text-yellow-400" />
                        Purse: ₹{((team.startingPurse || startingPurse || 1200000000) / 10000000).toFixed(0)} Cr
                      </div>
                      <button
                        onClick={handleReleaseTeam}
                        disabled={actionLoadingId === 'release'}
                        className="w-full py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                      >
                        Release Team
                      </button>
                    </div>
                  ) : isTaken ? (
                    <div className="text-center space-y-1 py-1">
                      <div className="text-[11px] text-gray-400 font-medium truncate" title={`Claimed by ${team.claimedBy?.username}`}>
                        Claimed by <strong className="text-gray-200">{team.claimedBy?.username || 'User'}</strong>
                      </div>
                      <button
                        disabled
                        className="w-full py-2 bg-gray-900 text-gray-600 border border-gray-800 rounded-xl text-xs font-medium cursor-not-allowed"
                      >
                        Unavailable
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleSelectTeam(team.id)}
                      disabled={isLoadingThis || Boolean(actionLoadingId)}
                      className="w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-md text-xs transition duration-200 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isLoadingThis ? (
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        <ShieldCheck className="w-3.5 h-3.5 text-yellow-300" />
                      )}
                      Claim Team
                    </button>
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
