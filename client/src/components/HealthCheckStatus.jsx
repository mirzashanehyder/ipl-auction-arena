import React, { useState, useEffect } from 'react';
import { checkServerHealth } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';
import { Activity, Wifi, WifiOff, RefreshCw, CheckCircle2, XCircle, Clock } from 'lucide-react';

export default function HealthCheckStatus() {
  const [restStatus, setRestStatus] = useState({ loading: true, data: null, error: null });
  const [socketStatus, setSocketStatus] = useState({ connected: false, socketId: null, latency: null });
  const [pingSending, setPingSending] = useState(false);

  const fetchRestHealth = async () => {
    setRestStatus(prev => ({ ...prev, loading: true }));
    const result = await checkServerHealth();
    if (result.success) {
      setRestStatus({ loading: false, data: result.data, error: null });
    } else {
      setRestStatus({ loading: false, data: null, error: result.error });
    }
  };

  useEffect(() => {
    fetchRestHealth();

    const socket = connectSocket();

    function onConnect() {
      setSocketStatus(prev => ({
        ...prev,
        connected: true,
        socketId: socket.id
      }));
    }

    function onDisconnect() {
      setSocketStatus({ connected: false, socketId: null, latency: null });
    }

    function onServerConnected(data) {
      console.log('[Socket] Server welcome:', data);
    }

    function onPong(data) {
      const now = Date.now();
      if (data.clientTimestamp) {
        setSocketStatus(prev => ({ ...prev, latency: now - data.clientTimestamp }));
      }
      setPingSending(false);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('server:connected', onServerConnected);
    socket.on('pong', onPong);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('server:connected', onServerConnected);
      socket.off('pong', onPong);
      disconnectSocket();
    };
  }, []);

  const sendSocketPing = () => {
    const socket = connectSocket();
    if (socket && socket.connected) {
      setPingSending(true);
      socket.emit('ping', { clientTimestamp: Date.now() });
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="w-7 h-7 text-blue-400" />
            System Health & Connectivity
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Stage 1 Monorepo Verification Dashboard
          </p>
        </div>
        <button
          onClick={fetchRestHealth}
          disabled={restStatus.loading}
          className="flex items-center gap-2 bg-blue-600/80 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 shadow-lg shadow-blue-500/20 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${restStatus.loading ? 'animate-spin' : ''}`} />
          Refresh Health
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* REST API Health Card */}
        <div className="glass-panel p-6 rounded-2xl border border-gray-800 relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg text-gray-200">REST API Endpoint</h3>
            {restStatus.loading ? (
              <span className="px-3 py-1 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-full text-xs font-semibold animate-pulse">
                Checking...
              </span>
            ) : restStatus.data ? (
              <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Healthy
              </span>
            ) : (
              <span className="px-3 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full text-xs font-semibold flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" /> Unreachable
              </span>
            )}
          </div>

          <p className="text-xs text-gray-400 mb-3 font-mono bg-black/40 px-3 py-1.5 rounded border border-gray-800">
            GET http://localhost:5000/api/health
          </p>

          {restStatus.data ? (
            <div className="space-y-2 text-sm text-gray-300 bg-gray-900/50 p-4 rounded-xl border border-gray-800 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Status:</span>
                <span className="text-emerald-400 font-bold">{restStatus.data.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Service:</span>
                <span>{restStatus.data.service}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Message:</span>
                <span>{restStatus.data.message}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Timestamp:</span>
                <span>{new Date(restStatus.data.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>
          ) : restStatus.error ? (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs font-mono">
              Error: {restStatus.error}
            </div>
          ) : null}
        </div>

        {/* Socket.IO Connection Card */}
        <div className="glass-panel p-6 rounded-2xl border border-gray-800 relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg text-gray-200 flex items-center gap-2">
              Socket.IO Server
            </h3>
            {socketStatus.connected ? (
              <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-semibold flex items-center gap-1">
                <Wifi className="w-3.5 h-3.5" /> Connected
              </span>
            ) : (
              <span className="px-3 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full text-xs font-semibold flex items-center gap-1">
                <WifiOff className="w-3.5 h-3.5" /> Disconnected
              </span>
            )}
          </div>

          <p className="text-xs text-gray-400 mb-3 font-mono bg-black/40 px-3 py-1.5 rounded border border-gray-800">
            WS ws://localhost:5000
          </p>

          <div className="space-y-3">
            <div className="space-y-2 text-sm text-gray-300 bg-gray-900/50 p-4 rounded-xl border border-gray-800 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Socket ID:</span>
                <span className="text-blue-400 font-semibold">{socketStatus.socketId || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Latency:</span>
                <span className="text-yellow-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {socketStatus.latency !== null ? `${socketStatus.latency} ms` : 'Not tested'}
                </span>
              </div>
            </div>

            <button
              onClick={sendSocketPing}
              disabled={!socketStatus.connected || pingSending}
              className="w-full py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-200 text-xs font-medium rounded-lg border border-gray-700 transition flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${pingSending ? 'animate-spin' : ''}`} />
              Send Socket Ping
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
