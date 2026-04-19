import { useState } from "react";

interface HeaderProps {
  balance: number | null;
  currency: string;
  loginId: string;
  connected: boolean;
  connecting: boolean;
  onConnect: (token: string) => void;
  onDisconnect: () => void;
  connError: string;
}

export default function Header({
  balance,
  currency,
  loginId,
  connected,
  connecting,
  onConnect,
  onDisconnect,
  connError,
}: HeaderProps) {
  const [token, setToken] = useState("");

  const submitToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;
    onConnect(token.trim());
  };

  return (
    <header className="bg-gray-900 border-b border-gray-700 px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center">
          <span className="text-white font-bold text-sm">D</span>
        </div>
        <div>
          <h1 className="text-white font-bold text-lg leading-none">
            Deriv Bot
          </h1>
          <p className="text-gray-400 text-xs">Automated Trading</p>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${connected ? "bg-green-400" : "bg-red-400"}`}
          />
          <span
            className={`text-sm font-medium ${connected ? "text-green-400" : "text-red-400"}`}
          >
            {connected ? "Connected" : "Disconnected"}
          </span>
        </div>

        {!connected ? (
          <form
            onSubmit={submitToken}
            className="hidden lg:flex items-center gap-2"
          >
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Deriv API token"
              disabled={connecting}
              className="w-56 bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-white text-xs placeholder-gray-500 focus:outline-none focus:border-red-500"
            />
            <button
              type="submit"
              disabled={!token.trim() || connecting}
              className="bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              {connecting ? "Connecting..." : "Connect"}
            </button>
          </form>
        ) : (
          <button
            onClick={onDisconnect}
            className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
          >
            Disconnect
          </button>
        )}

        {loginId && (
          <div className="text-right">
            <p className="text-gray-400 text-xs">Account</p>
            <p className="text-white text-sm font-medium">{loginId}</p>
          </div>
        )}

        {balance !== null && (
          <div className="bg-gray-800 px-4 py-2 rounded-lg text-right">
            <p className="text-gray-400 text-xs">Balance</p>
            <p className="text-white font-bold text-base">
              {balance.toFixed(2)}{" "}
              <span className="text-green-400 text-sm">{currency}</span>
            </p>
          </div>
        )}
      </div>

      {!connected && (
        <div className="lg:hidden fixed bottom-3 left-3 right-3 z-20 bg-gray-900/95 border border-gray-700 rounded-xl p-3 shadow-lg">
          <form onSubmit={submitToken} className="flex items-center gap-2">
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Enter Deriv API token"
              disabled={connecting}
              className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-red-500"
            />
            <button
              type="submit"
              disabled={!token.trim() || connecting}
              className="bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-semibold px-3 py-2 rounded-lg transition-colors"
            >
              {connecting ? "..." : "Go"}
            </button>
          </form>
          {connError && (
            <p className="mt-2 text-red-400 text-xs bg-red-900/30 border border-red-800 rounded px-2 py-1">
              {connError}
            </p>
          )}
        </div>
      )}

      {connected && connError && (
        <p className="text-red-400 text-xs">{connError}</p>
      )}
    </header>
  );
}
