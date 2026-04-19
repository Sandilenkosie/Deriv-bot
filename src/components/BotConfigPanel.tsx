export interface BotConfig {
  symbol: string;
  strategy: "RISE_FALL" | "DIGITS_DIFFER";
  contractType: "CALL" | "PUT" | "AUTO";
  digitPrediction: number;
  duration: number;
  durationUnit: string;
  initialStake: number;
  takeProfit: number;
  stopLoss: number;
  martingale: boolean;
  martingaleMultiplier: number;
  martingaleSplit: 1 | 2 | 3;
  holdStakeUntilLowDigitRate: boolean;
  holdStakeAmount: number;
  digitRateThreshold: number;
  holdStakeUntilTradeCount: boolean;
  holdStakeTradeCount: number;
}

interface BotConfigPanelProps {
  config: BotConfig;
  onChange: (config: BotConfig) => void;
  disabled: boolean;
}

const SYMBOLS = [
  { value: "R_10", label: "Volatility 10 Index" },
  { value: "R_25", label: "Volatility 25 Index" },
  { value: "R_50", label: "Volatility 50 Index" },
  { value: "R_75", label: "Volatility 75 Index" },
  { value: "R_100", label: "Volatility 100 Index" },
  { value: "1HZ10V", label: "Volatility 10 (1s) Index" },
  { value: "1HZ100V", label: "Volatility 100 (1s) Index" },
];

const DURATION_UNITS = [
  { value: "t", label: "Ticks" },
  { value: "s", label: "Seconds" },
  { value: "m", label: "Minutes" },
  { value: "h", label: "Hours" },
];

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-gray-400 text-xs mb-1">{label}</label>
      {children}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-red-500 transition-colors disabled:opacity-50"
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500 transition-colors disabled:opacity-50"
    />
  );
}

export default function BotConfigPanel({
  config,
  onChange,
  disabled,
}: BotConfigPanelProps) {
  const set = <K extends keyof BotConfig>(key: K, value: BotConfig[K]) =>
    onChange({ ...config, [key]: value });

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
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        Bot Configuration
      </h2>

      <div className="space-y-3">
        <Field label="Symbol">
          <Select
            value={config.symbol}
            onChange={(e) => set("symbol", e.target.value)}
            disabled={disabled}
          >
            {SYMBOLS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Strategy">
          <Select
            value={config.strategy}
            onChange={(e) =>
              set("strategy", e.target.value as BotConfig["strategy"])
            }
            disabled={disabled}
          >
            <option value="DIGITS_DIFFER">Digits Differ</option>
            <option value="RISE_FALL">Rise / Fall</option>
          </Select>
        </Field>

        {config.strategy === "DIGITS_DIFFER" ? (
          <Field label="Last Digit Prediction (differ from)">
            <Select
              value={config.digitPrediction}
              onChange={(e) => set("digitPrediction", Number(e.target.value))}
              disabled={disabled}
            >
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field label="Contract Type">
            <Select
              value={config.contractType}
              onChange={(e) =>
                set("contractType", e.target.value as BotConfig["contractType"])
              }
              disabled={disabled}
            >
              <option value="AUTO">Auto (alternating)</option>
              <option value="CALL">Rise (CALL)</option>
              <option value="PUT">Fall (PUT)</option>
            </Select>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Duration">
            <Input
              type="number"
              min={1}
              value={config.duration}
              onChange={(e) => set("duration", Number(e.target.value))}
              disabled={disabled}
            />
          </Field>
          <Field label="Unit">
            <Select
              value={config.durationUnit}
              onChange={(e) => set("durationUnit", e.target.value)}
              disabled={disabled}
            >
              {DURATION_UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Initial Stake (USD)">
          <Input
            type="number"
            min={0.35}
            step={0.01}
            value={config.initialStake}
            onChange={(e) => set("initialStake", Number(e.target.value))}
            disabled={disabled}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Take Profit (USD)">
            <Input
              type="number"
              min={0}
              step={0.01}
              value={config.takeProfit}
              onChange={(e) => set("takeProfit", Number(e.target.value))}
              disabled={disabled}
            />
          </Field>
          <Field label="Stop Loss (USD)">
            <Input
              type="number"
              min={0}
              step={0.01}
              value={config.stopLoss}
              onChange={(e) => set("stopLoss", Number(e.target.value))}
              disabled={disabled}
            />
          </Field>
        </div>

        <div className="bg-gray-900/50 rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-300 text-sm font-medium">
              Martingale
            </span>
            <button
              onClick={() => set("martingale", !config.martingale)}
              disabled={disabled}
              className={`relative w-10 h-5 rounded-full transition-colors ${config.martingale ? "bg-red-600" : "bg-gray-600"} disabled:opacity-50`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${config.martingale ? "translate-x-5" : "translate-x-0.5"}`}
              />
            </button>
          </div>
          {config.martingale && (
            <>
              <Field label="Multiplier on loss">
                <Input
                  type="number"
                  min={1.1}
                  max={50}
                  step={0.1}
                  value={config.martingaleMultiplier}
                  onChange={(e) =>
                    set("martingaleMultiplier", Number(e.target.value))
                  }
                  disabled={disabled}
                />
              </Field>
              {config.strategy === "DIGITS_DIFFER" && (
                <>
                  <Field label="Split recovery trades">
                    <div className="grid grid-cols-3 gap-2">
                      {([1, 2, 3] as const).map((n) => (
                        <button
                          key={n}
                          onClick={() => set("martingaleSplit", n)}
                          disabled={disabled}
                          className={`py-1.5 rounded-lg text-sm font-semibold border transition-colors disabled:opacity-50 ${
                            config.martingaleSplit === n
                              ? "bg-red-600 border-red-500 text-white"
                              : "bg-gray-800 border-gray-600 text-gray-300 hover:border-red-500"
                          }`}
                        >
                          {n === 1 ? "1× full" : `${n}× split`}
                        </button>
                      ))}
                    </div>
                    <p className="text-gray-500 text-xs mt-1">
                      ×1 = one ×{config.martingaleMultiplier} trade
                      &nbsp;|&nbsp; ×2 = two ×
                      {(config.martingaleMultiplier / 2).toFixed(1)} trades
                      &nbsp;|&nbsp; ×3 = three ×
                      {(config.martingaleMultiplier / 3).toFixed(1)} trades
                    </p>
                  </Field>

                  <div className="bg-gray-900/70 rounded-lg p-3 space-y-3 border border-gray-700">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300 text-sm font-medium">
                        Delay martingale by digit %
                      </span>
                      <button
                        onClick={() =>
                          set(
                            "holdStakeUntilLowDigitRate",
                            !config.holdStakeUntilLowDigitRate,
                          )
                        }
                        disabled={disabled}
                        className={`relative w-10 h-5 rounded-full transition-colors ${config.holdStakeUntilLowDigitRate ? "bg-red-600" : "bg-gray-600"} disabled:opacity-50`}
                      >
                        <span
                          className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${config.holdStakeUntilLowDigitRate ? "translate-x-5" : "translate-x-0.5"}`}
                        />
                      </button>
                    </div>

                    {config.holdStakeUntilLowDigitRate && (
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Hold stake (USD)">
                          <Input
                            type="number"
                            min={0.35}
                            step={0.01}
                            value={config.holdStakeAmount}
                            onChange={(e) =>
                              set("holdStakeAmount", Number(e.target.value))
                            }
                            disabled={disabled}
                          />
                        </Field>
                        <Field label="Apply martingale below %">
                          <Input
                            type="number"
                            min={0.1}
                            max={100}
                            step={0.1}
                            value={config.digitRateThreshold}
                            onChange={(e) =>
                              set("digitRateThreshold", Number(e.target.value))
                            }
                            disabled={disabled}
                          />
                        </Field>
                      </div>
                    )}
                  </div>

                  <div className="bg-gray-900/70 rounded-lg p-3 space-y-3 border border-gray-700">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300 text-sm font-medium">
                        Delay martingale by trades
                      </span>
                      <button
                        onClick={() =>
                          set(
                            "holdStakeUntilTradeCount",
                            !config.holdStakeUntilTradeCount,
                          )
                        }
                        disabled={disabled}
                        className={`relative w-10 h-5 rounded-full transition-colors ${config.holdStakeUntilTradeCount ? "bg-red-600" : "bg-gray-600"} disabled:opacity-50`}
                      >
                        <span
                          className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${config.holdStakeUntilTradeCount ? "translate-x-5" : "translate-x-0.5"}`}
                        />
                      </button>
                    </div>

                    {config.holdStakeUntilTradeCount && (
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Hold stake (USD)">
                          <Input
                            type="number"
                            min={0.35}
                            step={0.01}
                            value={config.holdStakeAmount}
                            onChange={(e) =>
                              set("holdStakeAmount", Number(e.target.value))
                            }
                            disabled={disabled}
                          />
                        </Field>
                        <Field label="Apply after trades">
                          <Input
                            type="number"
                            min={1}
                            step={1}
                            value={config.holdStakeTradeCount}
                            onChange={(e) =>
                              set("holdStakeTradeCount", Number(e.target.value))
                            }
                            disabled={disabled}
                          />
                        </Field>
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
