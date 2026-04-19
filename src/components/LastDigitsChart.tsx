interface LastDigitsChartProps {
  digits: number[]; // full history, latest last
  currentPrice: string;
  predictedDigit: number; // highlighted in red
}

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const STREAM_LEN = 30; // how many recent digits to show in the stream row
const HISTORY_LEN = 500; // how many ticks drive the frequency bars

export default function LastDigitsChart({
  digits,
  currentPrice,
  predictedDigit,
}: LastDigitsChartProps) {
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
