import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiClient } from '../services/api';
import { Trophy, Share2, Copy, Check, ShieldCheck, Flame, Coins, Users, UserX, Award, ArrowLeft, RefreshCw, AlertTriangle } from 'lucide-react';

export default function ResultsDashboard() {
  const { code } = useParams();
  const roomCode = code ? code.toUpperCase() : '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resultsData, setResultsData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('squads'); // 'squads' | 'unsold'

  const fetchResults = async () => {
    if (!roomCode) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/api/sessions/${roomCode}/results`);
      if (res.data?.success) {
        setResultsData(res.data);
      } else {
        setError(res.data?.message || 'Failed to fetch auction results');
      }
    } catch (err) {
      console.error('Error fetching results:', err);
      setError(err.response?.data?.message || 'Auction room not found or server error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, [roomCode]);

  const formatPurse = (amount) => {
    if (amount === undefined || amount === null) return '₹0 Cr';
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(2)} Cr`;
    }
    return `₹${(amount / 100000).toFixed(0)} L`;
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'BATSMAN':
        return <span className="px-2.5 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full font-mono text-[10px] font-bold uppercase">Batter</span>;
      case 'BOWLER':
        return <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full font-mono text-[10px] font-bold uppercase">Bowler</span>;
      case 'ALL_ROUNDER':
        return <span className="px-2.5 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-full font-mono text-[10px] font-bold uppercase">All-Rounder</span>;
      case 'WICKET_KEEPER':
        return <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full font-mono text-[10px] font-bold uppercase">WK</span>;
      default:
        return <span className="px-2.5 py-0.5 bg-gray-500/20 text-gray-300 border border-gray-500/30 rounded-full font-mono text-[10px] font-bold uppercase">{role}</span>;
    }
  };

  const handleCopySummary = () => {
    if (!resultsData) return;
    const { session, stats, mostExpensiveBuy, teamSquads } = resultsData;

    let text = `🏆 IPL AUCTION ARENA - FINAL RESULTS 🏆\n`;
    text += `Session: ${session.name} (Room Code: ${session.roomCode})\n\n`;

    if (mostExpensiveBuy) {
      const p = mostExpensiveBuy.player;
      const t = mostExpensiveBuy.team;
      const buyerName = mostExpensiveBuy.buyer?.username ? `@${mostExpensiveBuy.buyer.username}` : 'Unassigned';
      text += `🔥 MOST EXPENSIVE BUY:\n`;
      text += `👑 ${p.name} - ${formatPurse(mostExpensiveBuy.purchasePrice)} (${t.shortName} by ${buyerName})\n\n`;
    }

    text += `📊 OVERALL STATS:\n`;
    text += `💰 Total Spend: ${formatPurse(stats.totalSpendAllTeams)}\n`;
    text += `🏏 Players Sold: ${stats.totalPlayersSold} | Unsold: ${stats.totalPlayersUnsold}\n\n`;

    text += `🏏 FRANCHISE SQUADS:\n`;
    teamSquads.forEach((ts) => {
      const owner = ts.claimedBy?.username ? `@${ts.claimedBy.username}` : 'Unclaimed';
      text += `• ${ts.name} (${ts.shortName}) - ${owner}\n`;
      text += `  Spent: ${formatPurse(ts.totalSpent)} | Left: ${formatPurse(ts.remainingPurse)} | Squad: ${ts.squadSize} Players\n`;
    });

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin"></div>
        <p className="text-gray-400 font-mono text-xs animate-pulse">Calculating final squad math & auction statistics...</p>
      </div>
    );
  }

  if (error || !resultsData) {
    return (
      <div className="glass-panel p-10 rounded-3xl border border-rose-500/30 max-w-lg mx-auto text-center space-y-4 my-12">
        <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-white">Results Unavailable</h2>
        <p className="text-gray-400 text-xs font-mono">{error || 'Could not load auction results for this room code.'}</p>
        <div className="pt-2 flex justify-center gap-3">
          <button
            onClick={fetchResults}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
          <Link
            to="/"
            className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-xs rounded-xl flex items-center gap-1.5 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back Home
          </Link>
        </div>
      </div>
    );
  }

  const { session, stats, mostExpensiveBuy, teamSquads, unsoldPlayers } = resultsData;
  const claimedSquads = teamSquads.filter((sq) => sq.isClaimed);

  // Find franchise with highest total spend
  const topSpenderTeam = [...teamSquads].sort((a, b) => b.totalSpent - a.totalSpent)[0];

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12 animate-in fade-in duration-300">
      {/* HEADER NAVIGATION & SHARE BAR */}
      <div className="glass-panel p-6 rounded-3xl border border-gray-800 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            to={`/join/${session.roomCode}`}
            className="p-2.5 bg-gray-900 hover:bg-gray-800 text-gray-300 hover:text-white border border-gray-700 rounded-2xl transition"
            title="Return to Auction Arena"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">{session.name}</h1>
              <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 rounded-full text-xs font-mono font-extrabold flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-yellow-400" /> OFFICIAL RESULTS
              </span>
            </div>
            <p className="text-gray-400 text-xs mt-1 font-mono">
              Room Code: <strong className="text-yellow-400">{session.roomCode}</strong> &bull; Host: <span className="text-white">{session.host?.username}</span>
            </p>
          </div>
        </div>

        {/* SHARE / COPY SUMMARY ACTION */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopySummary}
            className={`px-5 py-3 rounded-2xl text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-2 shadow-lg transition duration-200 cursor-pointer ${
              copied
                ? 'bg-emerald-500 text-gray-950 shadow-emerald-500/20'
                : 'bg-gradient-to-r from-yellow-500 to-amber-600 hover:opacity-95 text-gray-950 shadow-yellow-500/20'
            }`}
          >
            {copied ? <Check className="w-4 h-4 stroke-[3]" /> : <Share2 className="w-4 h-4" />}
            {copied ? 'Summary Copied!' : 'Copy Summary to Clipboard'}
          </button>
        </div>
      </div>

      {/* FEATURED HERO HIGHLIGHT: MOST EXPENSIVE BUY */}
      {mostExpensiveBuy ? (
        <div className="glass-panel p-8 md:p-10 rounded-3xl border-2 border-yellow-500/40 bg-gradient-to-r from-amber-950/40 via-gray-950 to-amber-950/40 shadow-2xl relative overflow-hidden space-y-6">
          <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="flex items-center justify-between gap-2 border-b border-gray-800/80 pb-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-yellow-500/20 border border-yellow-500/40 rounded-full text-yellow-300 text-xs font-mono font-black uppercase tracking-wider">
              <Flame className="w-4 h-4 text-yellow-400 fill-current animate-bounce" /> MOST EXPENSIVE BUY OF THE AUCTION
            </div>
            <span className="text-xs font-mono text-gray-400">
              Base: {formatPurse(mostExpensiveBuy.player.basePrice)}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            {/* Player Avatar */}
            <div className="md:col-span-4 text-center">
              <div className="w-44 h-44 md:w-52 md:h-52 mx-auto rounded-3xl p-3 bg-gradient-to-tr from-yellow-500 via-amber-600 to-yellow-400 border-2 border-yellow-400/60 shadow-2xl flex items-center justify-center overflow-hidden">
                {mostExpensiveBuy.player.imageUrl ? (
                  <img
                    src={mostExpensiveBuy.player.imageUrl}
                    alt={mostExpensiveBuy.player.name}
                    className="w-full h-full object-cover rounded-2xl"
                  />
                ) : (
                  <div className="w-full h-full rounded-2xl bg-gray-950 flex items-center justify-center font-black text-6xl text-amber-400 font-mono">
                    {mostExpensiveBuy.player.name.charAt(0)}
                  </div>
                )}
              </div>
            </div>

            {/* Player Info & Sale Breakdown */}
            <div className="md:col-span-8 space-y-4 text-center md:text-left">
              <div>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-2">
                  {getRoleBadge(mostExpensiveBuy.player.role)}
                  <span className="px-2.5 py-0.5 bg-gray-800 text-gray-300 border border-gray-700 rounded-full font-mono text-[10px] font-bold">
                    {mostExpensiveBuy.player.country}
                  </span>
                  <span className="px-2.5 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded-full font-mono text-[10px] font-bold">
                    {mostExpensiveBuy.player.category}
                  </span>
                </div>
                <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight">{mostExpensiveBuy.player.name}</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* Sale Price Card */}
                <div className="p-4 bg-gray-950/80 rounded-2xl border border-yellow-500/30 space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-yellow-400 font-semibold block">
                    Winning Sold Price
                  </span>
                  <div className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 font-scoreboard">
                    {formatPurse(mostExpensiveBuy.purchasePrice)}
                  </div>
                </div>

                {/* Acquired Franchise Card */}
                <div className="p-4 bg-gray-950/80 rounded-2xl border border-gray-800 space-y-1 flex flex-col justify-center">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-gray-400 font-semibold block">
                    Acquiring Franchise
                  </span>
                  <div className="flex items-center gap-2.5 justify-center md:justify-start">
                    {mostExpensiveBuy.team.logoUrl ? (
                      <img src={mostExpensiveBuy.team.logoUrl} alt={mostExpensiveBuy.team.name} className="w-7 h-7 object-contain" />
                    ) : (
                      <span className="w-6 h-6 rounded-full bg-yellow-500/20 text-yellow-300 font-mono text-xs font-bold flex items-center justify-center">
                        {mostExpensiveBuy.team.shortName.charAt(0)}
                      </span>
                    )}
                    <span className="text-lg font-black text-white">{mostExpensiveBuy.team.name}</span>
                  </div>
                  {mostExpensiveBuy.buyer?.username && (
                    <span className="text-xs text-yellow-300/80 font-mono">
                      Manager: @{mostExpensiveBuy.buyer.username}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-panel p-8 rounded-3xl border border-gray-800 text-center text-gray-400 font-mono text-xs">
          No players were sold during this auction session.
        </div>
      )}

      {/* OVERALL SUMMARY STATS BAR */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-gray-800 space-y-1">
          <span className="text-[11px] font-mono uppercase tracking-wider text-gray-400 font-semibold block">
            Total Auction Spend
          </span>
          <div className="text-2xl font-black text-yellow-400 font-scoreboard">
            {formatPurse(stats.totalSpendAllTeams)}
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-gray-800 space-y-1">
          <span className="text-[11px] font-mono uppercase tracking-wider text-gray-400 font-semibold block">
            Players Sold
          </span>
          <div className="text-2xl font-black text-emerald-400 font-mono">
            {stats.totalPlayersSold} <span className="text-xs text-gray-500 font-normal">/ {stats.totalPlayersAuctioned} Auctioned</span>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-gray-800 space-y-1">
          <span className="text-[11px] font-mono uppercase tracking-wider text-gray-400 font-semibold block">
            Players Unsold
          </span>
          <div className="text-2xl font-black text-rose-400 font-mono">
            {stats.totalPlayersUnsold}
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-gray-800 space-y-1">
          <span className="text-[11px] font-mono uppercase tracking-wider text-gray-400 font-semibold block">
            Top Spender Franchise
          </span>
          <div className="text-lg font-black text-white truncate">
            {topSpenderTeam ? `${topSpenderTeam.shortName} (${formatPurse(topSpenderTeam.totalSpent)})` : 'None'}
          </div>
        </div>
      </div>

      {/* TABS: FRANCHISE SQUADS VS UNSOLD PLAYERS */}
      <div className="space-y-6">
        <div className="flex items-center gap-3 border-b border-gray-800/80 pb-3">
          <button
            onClick={() => setActiveTab('squads')}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'squads'
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Users className="w-4 h-4" /> Franchise Squads ({teamSquads.length})
          </button>

          <button
            onClick={() => setActiveTab('unsold')}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'unsold'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <UserX className="w-4 h-4" /> Unsold Players Pool ({unsoldPlayers.length})
          </button>
        </div>

        {/* TAB 1: FRANCHISE SQUADS GRID */}
        {activeTab === 'squads' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {teamSquads.map((squad) => (
              <div
                key={squad.teamId}
                className={`glass-panel p-6 rounded-3xl border space-y-5 transition duration-200 ${
                  squad.isClaimed ? 'border-gray-800' : 'border-gray-800/40 opacity-70'
                }`}
              >
                {/* Franchise Header */}
                <div className="flex items-center justify-between gap-3 border-b border-gray-800/80 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-900 border border-gray-700 p-1 flex items-center justify-center shrink-0">
                      {squad.logoUrl ? (
                        <img src={squad.logoUrl} alt={squad.name} className="w-full h-full object-contain" />
                      ) : (
                        <span className="text-yellow-400 font-mono font-black text-xs">{squad.shortName}</span>
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white leading-tight">{squad.name}</h3>
                      <p className="text-xs text-gray-400 font-mono">
                        Manager: {squad.claimedBy ? <strong className="text-yellow-300">@{squad.claimedBy.username}</strong> : <span className="text-gray-500">Unclaimed</span>}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-gray-400 font-mono block">Squad Count</span>
                    <span className="text-lg font-black text-white font-mono">{squad.squadSize} Players</span>
                  </div>
                </div>

                {/* Purse Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-gray-400">Total Spent: <strong className="text-yellow-400">{formatPurse(squad.totalSpent)}</strong></span>
                    <span className="text-gray-400">Purse Left: <strong className="text-emerald-400">{formatPurse(squad.remainingPurse)}</strong></span>
                  </div>
                  <div className="w-full bg-gray-900 rounded-full h-2 overflow-hidden border border-gray-800">
                    <div
                      className="bg-gradient-to-r from-yellow-500 to-amber-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(0, (squad.totalSpent / squad.startingPurse) * 100))}%` }}
                    ></div>
                  </div>
                </div>

                {/* Player Roster List */}
                <div className="space-y-2 pt-1">
                  <span className="text-[11px] font-mono text-gray-400 font-bold uppercase tracking-wider block">Acquired Roster:</span>
                  {squad.players.length === 0 ? (
                    <p className="text-xs text-gray-500 font-mono italic py-2">No players purchased.</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {squad.players.map((p) => (
                        <div key={p.id} className="p-2.5 bg-gray-950/70 border border-gray-800/80 rounded-xl flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            {getRoleBadge(p.role)}
                            <span className="font-bold text-white truncate">{p.name}</span>
                          </div>
                          <span className="font-mono font-black text-yellow-400 shrink-0 font-scoreboard">
                            {formatPurse(p.purchasePrice)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 2: UNSOLD PLAYERS GRID */}
        {activeTab === 'unsold' && (
          <div className="space-y-4">
            {unsoldPlayers.length === 0 ? (
              <div className="glass-panel p-8 rounded-3xl border border-gray-800 text-center text-gray-400 font-mono text-xs">
                🎉 All players in the auction draft pool were successfully sold!
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {unsoldPlayers.map((up) => (
                  <div key={up.auctionPlayerId} className="glass-panel p-4 rounded-2xl border border-gray-800/80 flex items-center justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {getRoleBadge(up.role)}
                        <span className="text-[10px] font-mono text-gray-400">{up.country}</span>
                      </div>
                      <h4 className="font-bold text-sm text-white truncate">{up.name}</h4>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-gray-500 font-mono block">Base Price</span>
                      <span className="text-xs font-mono font-bold text-gray-300">{formatPurse(up.basePrice)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
