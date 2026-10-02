import React, { useState } from 'react';
import { createAuctionSession } from '../services/api';
import { Trophy, Copy, Share2, Check, Sparkles, ArrowRight, Shield, Coins, Users, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function CreateAuction() {
  const navigate = useNavigate();

  // Form State
  const [formData, setFormData] = useState({
    hostName: '',
    sessionName: 'IPL 2026 Mega Auction',
    startingPurseCrores: 120,
    minBidIncrementLakhs: 20,
    playerPoolOption: 'ALL'
  });

  // Response State
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [createdSession, setCreatedSession] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!formData.hostName.trim()) {
      setErrorMessage('Please enter your Host Name.');
      return;
    }

    if (!formData.sessionName.trim()) {
      setErrorMessage('Please enter an Auction Title.');
      return;
    }

    setLoading(true);

    const payload = {
      hostName: formData.hostName,
      sessionName: formData.sessionName,
      startingPurse: Number(formData.startingPurseCrores) * 10000000, // convert Cr to INR
      minBidIncrement: Number(formData.minBidIncrementLakhs) * 100000, // convert Lakhs to INR
      playerPoolOption: formData.playerPoolOption
    };

    const response = await createAuctionSession(payload);
    setLoading(false);

    if (response.success) {
      if (response.hostParticipantId) {
        localStorage.setItem('ipl_participant_id', response.hostParticipantId);
        localStorage.setItem('ipl_participant_name', formData.hostName);
        localStorage.setItem('ipl_room_code', response.session.roomCode);
      }

      setCreatedSession({
        ...response.session,
        inviteUrl: response.inviteUrl
      });
    } else {
      setErrorMessage(response.message || 'Failed to create auction session.');
    }
  };

  const handleCopyLink = () => {
    if (!createdSession?.inviteUrl) return;
    navigator.clipboard.writeText(createdSession.inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleNativeShare = async () => {
    if (!createdSession) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: createdSession.name,
          text: `Join my IPL Auction Arena session! Room Code: ${createdSession.roomCode}`,
          url: createdSession.inviteUrl
        });
      } catch (err) {
        console.log('Share canceled or failed:', err);
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-8">
      {/* Header Banner */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-yellow-400" /> Host Control Room
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
          Create IPL Auction Room
        </h1>
        <p className="text-gray-400 text-sm max-w-lg mx-auto">
          Configure your virtual purse, bid rules, and player draft pool. Receive a shareable room code to invite team franchise owners.
        </p>
      </div>

      {!createdSession ? (
        /* CREATE AUCTION FORM */
        <div className="glass-panel p-8 rounded-3xl border border-gray-800 shadow-2xl relative">
          {errorMessage && (
            <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs font-medium">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Host Name */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-yellow-400" /> Host Name *
                </label>
                <input
                  type="text"
                  name="hostName"
                  value={formData.hostName}
                  onChange={handleChange}
                  placeholder="e.g. Dhoni / Host Admin"
                  className="w-full bg-gray-900/80 border border-gray-700/80 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition text-sm"
                  required
                />
              </div>

              {/* Auction Title */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-blue-400" /> Auction Title *
                </label>
                <input
                  type="text"
                  name="sessionName"
                  value={formData.sessionName}
                  onChange={handleChange}
                  placeholder="e.g. IPL 2026 Mega Auction"
                  className="w-full bg-gray-900/80 border border-gray-700/80 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition text-sm"
                  required
                />
              </div>

              {/* Starting Purse */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-emerald-400" /> Starting Purse (₹ Crores)
                </label>
                <input
                  type="number"
                  name="startingPurseCrores"
                  value={formData.startingPurseCrores}
                  onChange={handleChange}
                  min="1"
                  max="500"
                  className="w-full bg-gray-900/80 border border-gray-700/80 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition text-sm"
                />
              </div>

              {/* Minimum Bid Increment */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-orange-400" /> Min Bid Increment (₹ Lakhs)
                </label>
                <input
                  type="number"
                  name="minBidIncrementLakhs"
                  value={formData.minBidIncrementLakhs}
                  onChange={handleChange}
                  min="1"
                  max="1000"
                  className="w-full bg-gray-900/80 border border-gray-700/80 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition text-sm"
                />
              </div>
            </div>

            {/* Player Pool Selection */}
            <div className="space-y-2 pt-2">
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-purple-400" /> Draft Player Pool Selection
              </label>
              <select
                name="playerPoolOption"
                value={formData.playerPoolOption}
                onChange={handleChange}
                className="w-full bg-gray-900/80 border border-gray-700/80 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition text-sm"
              >
                <option value="ALL">Full Draft Pool (40 Players - Marquee, Capped & Uncapped)</option>
                <option value="MARQUEE">Marquee Players Only (10 Premium Stars)</option>
                <option value="CAPPED">Capped International & Indian Stars (30 Players)</option>
                <option value="UNCAPPED">Uncapped Emerging Talent Only</option>
              </select>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-yellow-500 hover:opacity-95 text-white font-bold rounded-xl shadow-lg shadow-blue-500/25 transition duration-200 flex items-center justify-center gap-2 text-base disabled:opacity-50 mt-4 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Generating Session Room...
                </>
              ) : (
                <>
                  <Trophy className="w-5 h-5 text-yellow-300" />
                  Create Auction Room
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </form>
        </div>
      ) : (
        /* CREATED SESSION SUCCESS VIEW */
        <div className="glass-panel p-8 rounded-3xl border border-emerald-500/30 shadow-2xl text-center space-y-8 animate-in fade-in zoom-in-95 duration-300">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mx-auto">
            <Check className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">Auction Room Created Successfully!</h2>
            <p className="text-gray-400 text-xs">Share your room code or invite link with franchise managers.</p>
          </div>

          {/* ROOM CODE DISPLAY */}
          <div className="bg-gradient-to-b from-gray-900 to-black/80 p-6 rounded-2xl border border-gray-800 max-w-md mx-auto space-y-2">
            <span className="text-xs uppercase tracking-widest text-gray-500 font-mono font-semibold">
              Shareable Room Code
            </span>
            <div className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 tracking-wider font-mono select-all py-1">
              {createdSession.roomCode}
            </div>
            <div className="text-[11px] text-gray-400 pt-1">
              Host: <span className="text-white font-medium">{createdSession.host.username}</span> &bull; Purse: <span className="text-emerald-400">₹{(createdSession.startingPurse / 10000000).toFixed(0)} Cr</span> &bull; Pool: <span className="text-blue-400">{createdSession.playerCount} Players</span>
            </div>
          </div>

          {/* INVITE LINK & COPY / SHARE BUTTONS */}
          <div className="max-w-md mx-auto space-y-3">
            <div className="flex items-center bg-gray-900 border border-gray-800 rounded-xl p-1.5 pl-3">
              <input
                type="text"
                readOnly
                value={createdSession.inviteUrl}
                className="bg-transparent text-xs font-mono text-gray-300 w-full focus:outline-none"
              />
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition shrink-0 ml-2"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <button
              onClick={() => navigate(`/join/${createdSession.roomCode}`)}
              className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-95 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/25 transition duration-200 flex items-center justify-center gap-2 text-base cursor-pointer"
            >
              <Users className="w-5 h-5 text-yellow-300" />
              Enter Waiting Room as Host
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>

            <div className="flex gap-3">
              <button
                onClick={handleNativeShare}
                className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold rounded-xl border border-gray-700 transition flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4 text-blue-400" />
                Share Invite Link
              </button>

              <button
                onClick={() => navigate('/')}
                className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold rounded-xl border border-gray-700 transition flex items-center justify-center gap-2"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
