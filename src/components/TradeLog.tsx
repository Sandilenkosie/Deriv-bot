export interface TradeRecord {
  id: string;
  contractId?: string;
  time: string;
  symbol: string;
  contractType: "CALL" | "PUT" | "DIGITDIFF" | "ACCU";
  barrier?: number;
  accumulatorLabelRate?: number;
  stake: number;
  payout: number | null;
  profit: number | null;
  status: "open" | "won" | "lost";
}

interface TradeLogProps {
  trades: TradeRecord[];
  accumulatorDefaultLabelRate: number;
  totalProfit: number;
  totalTrades: number;
  wins: number;
  losses: number;
  running: boolean;
  connected: boolean;
  onStart: () => void;
  onStop: () => void;
}

export default function TradeLog({
  trades,
  accumulatorDefaultLabelRate,
  totalProfit,
  totalTrades,
  wins,
  losses,
  running,
  connected,
  onStart,
  onStop,
}: TradeLogProps) {
  const displayTrades = [...trades].reverse();

  return (
    <div className="bg-gray-800/95 rounded-xl border border-gray-700 flex flex-col h-full overflow-hidden shadow-lg">
      <div className="p-5 border-b border-gray-700">
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 className="text-white font-semibold text-base flex items-center gap-2">
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
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            Trade Log
          </h2>

          {running ? (
            <button
              onClick={onStop}
              className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-2 text-xs shadow-sm"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
              Stop Bot
            </button>
          ) : (
            <button
              onClick={onStart}
              disabled={!connected}
              className="bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-2 text-xs shadow-sm"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              {connected ? "Start Bot" : "Connect to Start"}
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <div className="bg-gray-900 rounded-lg px-2.5 py-2 text-center">
            <p className="text-gray-400 text-[11px] mb-0.5">Total Trades</p>
            <p className="text-white font-bold text-base leading-tight">
              {totalTrades}
            </p>
          </div>
          <div className="bg-gray-900 rounded-lg px-2.5 py-2 text-center">
            <p className="text-gray-400 text-[11px] mb-0.5">Total Wins</p>
            <p className="text-green-400 font-bold text-base leading-tight">
              {wins}
            </p>
          </div>
          <div className="bg-gray-900 rounded-lg px-2.5 py-2 text-center">
            <p className="text-gray-400 text-[11px] mb-0.5">Total Losses</p>
            <p className="text-red-400 font-bold text-base leading-tight">
              {losses}
            </p>
          </div>
          <div className="bg-gray-900 rounded-lg px-2.5 py-2 text-center">
            <p className="text-gray-400 text-[11px] mb-0.5">Net P/L</p>
            <p
              className={`font-bold text-base leading-tight ${totalProfit >= 0 ? "text-green-400" : "text-red-400"}`}
            >
              {totalProfit >= 0 ? "+" : ""}
              {totalProfit.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {trades.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-gray-500">
            <svg
              className="w-10 h-10 mb-2 opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
            <p className="text-sm">No trades yet</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-900/90 backdrop-blur">
              <tr className="text-gray-400 text-xs">
                <th className="px-4 py-2 text-left font-medium">Time</th>
                <th className="px-4 py-2 text-left font-medium">Type</th>
                <th className="px-4 py-2 text-right font-medium">Stake</th>
                <th className="px-4 py-2 text-right font-medium">P/L</th>
                <th className="px-4 py-2 text-center font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {displayTrades.map((t) => (
                <tr
                  key={t.id}
                  className="border-t border-gray-700/50 hover:bg-gray-700/30 transition-colors"
                >
                  <td className="px-4 py-2 text-gray-400">{t.time}</td>
                  <td className="px-4 py-2">
                    {t.contractType === "DIGITDIFF" ? (
                      <span className="font-semibold text-purple-400">
                        ≠ {t.barrier ?? "?"}
                      </span>
                    ) : t.contractType === "ACCU" ? (
                      <span className="font-semibold text-cyan-400">
                        Accu{" "}
                        {(Number.isFinite(t.accumulatorLabelRate)
                          ? Number(t.accumulatorLabelRate)
                          : accumulatorDefaultLabelRate
                        ).toFixed(0)}
                        %
                      </span>
                    ) : (
                      <span
                        className={`font-semibold ${
                          t.contractType === "CALL"
                            ? "text-green-400"
                            : "text-red-400"
                        }`}
                      >
                        {t.contractType === "CALL" ? "▲ Rise" : "▼ Fall"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right text-white">
                    ${t.stake.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {t.profit !== null ? (
                      <span
                        className={
                          t.profit >= 0 ? "text-green-400" : "text-red-400"
                        }
                      >
                        {t.profit >= 0 ? "+" : ""}
                        {t.profit.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {t.status === "open" && (
                      <span className="bg-yellow-900/50 text-yellow-400 text-xs px-2 py-0.5 rounded-full">
                        Open
                      </span>
                    )}
                    {t.status === "won" && (
                      <span className="bg-green-900/50 text-green-400 text-xs px-2 py-0.5 rounded-full">
                        Won
                      </span>
                    )}
                    {t.status === "lost" && (
                      <span className="bg-red-900/50 text-red-400 text-xs px-2 py-0.5 rounded-full">
                        Lost
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
