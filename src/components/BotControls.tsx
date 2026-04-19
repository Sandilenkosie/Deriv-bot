interface BotControlsProps {
  running: boolean;
  connected: boolean;
  onStart: () => void;
  onStop: () => void;
  statusMessage: string;
}

export default function BotControls({
  running,
  connected,
  onStart,
  onStop,
  statusMessage,
}: BotControlsProps) {
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
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
        Bot Controls
      </h2>

      <div className="space-y-3">
        {running ? (
          <button
            onClick={onStop}
            className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            Stop Bot
          </button>
        ) : (
          <button
            onClick={onStart}
            disabled={!connected}
            className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            {connected ? "Start Bot" : "Connect to Start"}
          </button>
        )}

        {statusMessage && (
          <div
            className={`text-xs px-3 py-2 rounded-lg border ${
              running
                ? "bg-green-900/30 border-green-800 text-green-300"
                : "bg-gray-900/50 border-gray-700 text-gray-400"
            }`}
          >
            <div className="flex items-center gap-2">
              {running && (
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              )}
              {statusMessage}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
