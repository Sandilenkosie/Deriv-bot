interface LastDigitsChartProps {
  digits: number[]; // full history, latest last
  priceHistory: number[];
  currentPrice: string;
  strategy: "RISE_FALL" | "DIGITS_DIFFER" | "ACCUMULATOR";
  predictedDigit: number; // highlighted in red
}

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const STREAM_LEN = 30; // how many recent digits to show in the stream row
const HISTORY_LEN = 500; // how many ticks drive the frequency bars
const ACCUMULATOR_HISTORY_LEN = 80;

export default function LastDigitsChart({
  digits,
  priceHistory,
  currentPrice,
  strategy,
  predictedDigit,
}: LastDigitsChartProps) {
  if (strategy === "ACCUMULATOR") {
    const history = priceHistory.slice(-ACCUMULATOR_HISTORY_LEN);
    const minPrice = history.length > 0 ? Math.min(...history) : 0;
    const maxPrice = history.length > 0 ? Math.max(...history) : 0;
    const entryPrice = history.length > 0 ? history[0] : 0;
    const lastPrice = history.length > 0 ? history[history.length - 1] : 0;
    const change = lastPrice - entryPrice;
    const changePct = entryPrice > 0 ? (change / entryPrice) * 100 : 0;
    const averagePrice =
      history.length > 0
        ? history.reduce((sum, price) => sum + price, 0) / history.length
        : 0;
    const tickRange = maxPrice - minPrice;
    const isUp = change >= 0;
    const range = Math.max(maxPrice - minPrice, 0.00001);
    const width = 100;
    const height = 100;
    const points = history
      .map((price, index) => {
        const x =
          history.length === 1
            ? width / 2
            : (index / (history.length - 1)) * width;
        const y = height - ((price - minPrice) / range) * height;
        return `${x},${Number.isFinite(y) ? y : height / 2}`;
      })
      .join(" ");

    return (
      <div className="bg-gray-800/95 rounded-xl border border-gray-700 p-5 space-y-4 h-full shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-white font-semibold text-base flex items-center gap-2">
            <svg
              className="w-4 h-4 text-cyan-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 17l6-6 4 4 8-8"
              />
            </svg>
            Accumulator Tick Chart
          </h2>
          <div className="flex items-center gap-3">
            {currentPrice && (
              <span className="text-gray-400 text-xs">
                Price:{" "}
                <span className="text-white font-mono font-semibold">
                  {currentPrice}
                </span>
              </span>
            )}
            <span className="text-gray-400 text-xs">
              {history.length} tick{history.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {history.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            Waiting for accumulator ticks…
          </div>
        ) : (
          <>
            <div className="border-b border-gray-700 pb-2">
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
                <span className="text-gray-400">
                  Ticks:{" "}
                  <span className="font-mono text-white">{history.length}</span>
                </span>
                <span className="text-gray-400">
                  Entry:{" "}
                  <span className="font-mono text-cyan-200">
                    {entryPrice.toFixed(2)}
                  </span>
                </span>
                <span className="text-gray-400">
                  Current:{" "}
                  <span className="font-mono text-white">
                    {lastPrice.toFixed(2)}
                  </span>
                </span>
                <span className="text-gray-400">
                  Change:{" "}
                  <span
                    className={`font-mono ${isUp ? "text-emerald-300" : "text-rose-300"}`}
                  >
                    {isUp ? "+" : ""}
                    {change.toFixed(2)} ({isUp ? "+" : ""}
                    {changePct.toFixed(2)}%)
                  </span>
                </span>
                <span className="text-gray-400">
                  Low:{" "}
                  <span className="font-mono text-cyan-200">
                    {minPrice.toFixed(2)}
                  </span>
                </span>
                <span className="text-gray-400">
                  High:{" "}
                  <span className="font-mono text-cyan-200">
                    {maxPrice.toFixed(2)}
                  </span>
                </span>
                <span className="text-gray-400">
                  Range:{" "}
                  <span className="font-mono text-cyan-200">
                    {tickRange.toFixed(2)}
                  </span>
                </span>
                <span className="text-gray-400">
                  Average:{" "}
                  <span className="font-mono text-cyan-200">
                    {averagePrice.toFixed(2)}
                  </span>
                </span>
              </div>
            </div>

            <div className="h-full min-h-[220px] rounded-xl border border-gray-700 bg-[linear-gradient(180deg,rgba(34,211,238,0.08),rgba(17,24,39,0.2))] p-3">
              <svg
                viewBox={`0 0 ${width} ${height}`}
                className="h-full w-full overflow-visible"
              >
                <defs>
                  <linearGradient id="accuLine" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#67e8f9" stopOpacity="1" />
                    <stop
                      offset="100%"
                      stopColor="#22d3ee"
                      stopOpacity="0.35"
                    />
                  </linearGradient>
                </defs>
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="100"
                  stroke="rgba(148,163,184,0.18)"
                  strokeWidth="0.5"
                />
                <line
                  x1="0"
                  y1="50"
                  x2="100"
                  y2="50"
                  stroke="rgba(148,163,184,0.18)"
                  strokeWidth="0.5"
                />
                <line
                  x1="0"
                  y1="100"
                  x2="100"
                  y2="100"
                  stroke="rgba(148,163,184,0.18)"
                  strokeWidth="0.5"
                />
                <polyline
                  fill="none"
                  stroke="url(#accuLine)"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={points}
                />
                {history.length > 0 && (
                  <circle
                    cx={history.length === 1 ? width / 2 : width}
                    cy={
                      height -
                      ((history[history.length - 1] - minPrice) / range) *
                        height
                    }
                    r="2.5"
                    fill="#fff"
                    stroke="#22d3ee"
                    strokeWidth="1.5"
                  />
                )}
              </svg>
            </div>

            <div className="flex items-center justify-between border-t border-gray-700 pt-2 text-xs text-gray-500">
              <span>Previous accumulator ticks</span>
              <span>Last {history.length} prices</span>
            </div>
          </>
        )}
      </div>
    );
  }

  const recentDigits = digits.slice(-STREAM_LEN);
  const historyDigits = digits.slice(-HISTORY_LEN);

  // Frequency count
  const counts = DIGITS.map((d) => historyDigits.filter((x) => x === d).length);
  const maxCount = Math.max(...counts, 1);
  const total = historyDigits.length;

  return (
    <div className="bg-gray-800/95 rounded-xl border border-gray-700 p-5 space-y-4 h-full shadow-lg">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
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
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          Last Digit Analysis
        </h2>
        <div className="flex items-center gap-3">
          {currentPrice && (
            <span className="text-gray-400 text-xs">
              Price:{" "}
              <span className="text-white font-mono font-semibold">
                {currentPrice}
              </span>
            </span>
          )}
          <span className="text-gray-400 text-xs">
            {total} tick{total !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Live digit stream */}
      {digits.length === 0 ? (
        <div className="flex items-center justify-center h-10 text-gray-500 text-sm">
          Waiting for ticks…
        </div>
      ) : (
        <div className="flex gap-1 flex-wrap">
          {recentDigits.map((d, i) => {
            const isLatest = i === recentDigits.length - 1;
            const isPredicted = d === predictedDigit;
            return (
              <span
                key={i}
                className={`
                  w-7 h-7 flex items-center justify-center rounded font-bold text-sm transition-all
                  ${isLatest ? "ring-2 ring-white scale-110" : ""}
                  ${
                    isPredicted
                      ? "bg-red-600 text-white"
                      : "bg-gray-700 text-gray-200"
                  }
                `}
              >
                {d}
              </span>
            );
          })}
        </div>
      )}

      {/* Frequency bar chart */}
      <div className="pt-1">
        <div className="flex items-end gap-1.5 h-24 sm:h-28">
          {DIGITS.map((d) => {
            const count = counts[d];
            const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
            const freq = total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";
            const isPredicted = d === predictedDigit;
            return (
              <div
                key={d}
                className="flex flex-col items-center gap-1 flex-1"
                title={`Digit ${d}: ${count} times (${freq}%)`}
              >
                {/* Count label */}
                <span className="text-gray-400 text-[10px] leading-none">
                  {count}
                </span>
                {/* Bar */}
                <div className="w-full flex flex-col justify-end h-16">
                  <div
                    className={`w-full rounded-t transition-all duration-300 ${
                      isPredicted ? "bg-red-500" : "bg-indigo-500"
                    }`}
                    style={{ height: `${Math.max(pct, 2)}%` }}
                  />
                </div>
                {/* Digit label */}
                <span
                  className={`text-xs font-bold ${
                    isPredicted ? "text-red-400" : "text-gray-300"
                  }`}
                >
                  {d}
                </span>
                {/* Freq % */}
                <span
                  className={`text-[10px] leading-none ${
                    isPredicted ? "text-red-400" : "text-gray-500"
                  }`}
                >
                  {freq}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-gray-700">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-indigo-500" />
          <span className="text-gray-400 text-xs">Digit frequency</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-red-500" />
          <span className="text-gray-400 text-xs">
            Predicted digit ({predictedDigit})
          </span>
        </div>
        <span className="ml-auto text-gray-500 text-xs">
          Last {Math.min(total, HISTORY_LEN)} ticks
        </span>
      </div>
    </div>
  );
}
