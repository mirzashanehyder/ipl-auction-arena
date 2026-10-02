import React, { useState } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import HealthCheckStatus from './components/HealthCheckStatus';
import CreateAuction from './pages/CreateAuction';
import JoinAuction from './pages/JoinAuction';
import ResultsDashboard from './pages/ResultsDashboard';
import { Trophy, ShieldCheck, PlusCircle, Activity, LogIn, ArrowRight } from 'lucide-react';

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [manualRoomCode, setManualRoomCode] = useState('');

  const handleManualJoin = (e) => {
    e.preventDefault();
    if (!manualRoomCode.trim()) return;
    const formatted = manualRoomCode.trim().toUpperCase();
    navigate(`/join/${formatted}`);
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-gray-100 flex flex-col selection:bg-blue-500 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-gray-800/80 bg-[#0f1629]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-yellow-400 p-0.5 shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform duration-200">
              <div className="w-full h-full bg-[#0b0f19] rounded-[10px] flex items-center justify-center">
                <Trophy className="w-5 h-5 text-yellow-400" />
              </div>
            </div>
            <div>
              <h1 className="font-bold text-lg leading-none tracking-tight text-white">
                IPL AUCTION <span className="text-yellow-400">ARENA</span>
              </h1>
              <span className="text-[10px] text-blue-400 font-mono tracking-wider uppercase">
                Real-Time Auction Platform
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              to="/"
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                location.pathname === '/'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <Activity className="w-3.5 h-3.5" /> Health
            </Link>

            <Link
              to="/create"
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition duration-200 ${
                location.pathname === '/create'
                  ? 'bg-yellow-500 text-black shadow-yellow-500/20'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20'
              }`}
            >
              <PlusCircle className="w-4 h-4" /> Create Auction
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl mx-auto px-4 py-8 w-full">
        <Routes>
          <Route
            path="/"
            element={
              <div className="space-y-10">
                <section className="text-center space-y-4 max-w-2xl mx-auto pt-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-full text-yellow-400 text-xs font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5" /> Stage 17 Active &bull; Results Dashboard Ready
                  </div>
                  <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
                    Host & Participate in IPL Auctions
                  </h2>
                  <p className="text-gray-400 text-sm md:text-base leading-relaxed">
                    Create your private auction room or enter a shareable 6-character room code to join the live bidding arena.
                  </p>

                  {/* ROOM CODE JOIN WIDGET */}
                  <div className="glass-panel p-4 rounded-2xl border border-gray-800 max-w-md mx-auto mt-4">
                    <form onSubmit={handleManualJoin} className="flex gap-2">
                      <input
                        type="text"
                        value={manualRoomCode}
                        onChange={(e) => setManualRoomCode(e.target.value.toUpperCase())}
                        placeholder="ENTER ROOM CODE (e.g. IPL-X7K92P)"
                        className="bg-gray-900 border border-gray-700/80 rounded-xl px-4 py-2.5 text-white font-mono text-xs placeholder-gray-500 uppercase tracking-wider flex-1 focus:outline-none focus:border-blue-500"
                        required
                      />
                      <button
                        type="submit"
                        className="px-4 py-2.5 bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-xs rounded-xl flex items-center gap-1.5 transition shrink-0 cursor-pointer"
                      >
                        <LogIn className="w-4 h-4" /> Join Room
                      </button>
                    </form>
                  </div>

                  <div className="pt-2 flex items-center justify-center gap-4">
                    <Link
                      to="/create"
                      className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-500/25 flex items-center gap-2 transition"
                    >
                      <PlusCircle className="w-4 h-4 text-yellow-300" /> Create New Auction
                    </Link>
                  </div>
                </section>

                <section>
                  <HealthCheckStatus />
                </section>
              </div>
            }
          />
          <Route path="/create" element={<CreateAuction />} />
          <Route path="/join" element={<JoinAuction />} />
          <Route path="/join/:code" element={<JoinAuction />} />
          <Route path="/results/:code" element={<ResultsDashboard />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800/80 py-6 text-center text-xs text-gray-500">
        IPL Auction Arena &bull; Real-time Cricket Auction Infrastructure
      </footer>
    </div>
  );
}
