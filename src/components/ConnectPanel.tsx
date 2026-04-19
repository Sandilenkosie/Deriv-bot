import { useState } from "react";

interface ConnectPanelProps {
  onConnect: (token: string) => void;
  onDisconnect: () => void;
  connected: boolean;
  connecting: boolean;
  error: string;
}

export default function ConnectPanel({
  onConnect,
  onDisconnect,
  connected,
  connecting,
  error,
}: ConnectPanelProps) {
  const [token, setToken] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (token.trim()) onConnect(token.trim());
  };

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <h2 className="text-white font-semibold text-base mb-4 flex items-center gap-2">
        <svg
          className="w-4 h-4 text-red-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
        Connection
      </h2>

      {!connected ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-gray-400 text-xs mb-1">
              API Token
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Enter your Deriv API token"
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-red-500 transition-colors"
              disabled={connecting}
            />
          </div>
          {error && (
            <p className="text-red-400 text-xs bg-red-900/30 border border-red-800 rounded px-3 py-2">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={!token.trim() || connecting}
            className="w-full bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-2 rounded-lg transition-colors text-sm"
          >
            {connecting ? "Connecting…" : "Connect"}
          </button>
          <p className="text-gray-500 text-xs text-center">
            Get your token from{" "}
            <a
              href="https://app.deriv.com/account/api-token"
              target="_blank"
              rel="noopener noreferrer"
              className="text-red-400 hover:underline"
            >
              Deriv API Tokens
            </a>
          </p>
        </form>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 bg-green-900/30 border border-green-800 rounded-lg px-3 py-2">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-green-400 text-sm">Authenticated</span>
          </div>
          <button
            onClick={onDisconnect}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 rounded-lg transition-colors text-sm"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
