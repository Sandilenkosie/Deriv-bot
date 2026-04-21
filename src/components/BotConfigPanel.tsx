import { useEffect } from "react";

export interface BotConfig {
  symbol: string;
  strategy: "RISE_FALL" | "DIGITS_DIFFER" | "ACCUMULATOR";
  contractType: "CALL" | "PUT" | "AUTO";
  digitPrediction: number;
  duration: number;
  durationUnit: string;
  initialStake: number;
  takeProfit: number;
  accumulatorTakeProfitMode: "USD" | "TICKS";
  accumulatorTakeProfitTicks: number;
  accumulatorGrowthRate: number;
  accumulatorMartingaleGrowthRate: number;
  accumulatorMartingaleMultiplier: number;
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
  const normalizedProps = { ...props };
  if ("value" in normalizedProps && normalizedProps.value === undefined) {
    normalizedProps.value = "";
  }

  return (
    <input
      {...normalizedProps}
      className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-red-500 transition-colors disabled:opacity-50"
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const normalizedProps = { ...props };
  if ("value" in normalizedProps && normalizedProps.value === undefined) {
    normalizedProps.value = "";
  }

  return (
    <select
      {...normalizedProps}
      className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500 transition-colors disabled:opacity-50"
    />
  );
}

export default function BotConfigPanel({
  config,
  onChange,
  disabled,
}: BotConfigPanelProps) {
  const isAccumulator = config.strategy === "ACCUMULATOR";

  const set = <K extends keyof BotConfig>(key: K, value: BotConfig[K]) =>
    onChange({ ...config, [key]: value });

  useEffect(() => {
    // Ensure delay modes never stay enabled together.
    if (config.holdStakeUntilLowDigitRate && config.holdStakeUntilTradeCount) {
      onChange({ ...config, holdStakeUntilTradeCount: false });
    }
  }, [config, onChange]);

  useEffect(() => {
    if (!isAccumulator) return;
    const updates: Partial<BotConfig> = {};
    if (config.durationUnit !== "t") {
      updates.durationUnit = "t";
    }
    if (
      config.accumulatorMartingaleGrowthRate === undefined ||
      !Number.isFinite(config.accumulatorMartingaleGrowthRate)
    ) {
      updates.accumulatorMartingaleGrowthRate = 2;
    }
    if (
      config.accumulatorMartingaleMultiplier === undefined ||
      !Number.isFinite(config.accumulatorMartingaleMultiplier)
    ) {
      updates.accumulatorMartingaleMultiplier = 1;
    }
    if (Object.keys(updates).length > 0) {
      onChange({ ...config, ...updates });
    }
  }, [config, isAccumulator, onChange]);

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
            <option value="ACCUMULATOR">Accumulator</option>
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
        ) : config.strategy === "RISE_FALL" ? (
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
        ) : null}

        {isAccumulator ? (
          <div className="rounded-lg border border-cyan-800/60 bg-cyan-900/20 px-3 py-2 text-[11px] text-cyan-200">
            Accumulator contracts are no-expiry. Duration is not used.
          </div>
        ) : (
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
        )}

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
          {isAccumulator ? (
            <Field label="Take Profit Mode">
              <Select
                value={config.accumulatorTakeProfitMode}
                onChange={(e) =>
                  set(
                    "accumulatorTakeProfitMode",
                    e.target.value as BotConfig["accumulatorTakeProfitMode"],
                  )
                }
                disabled={disabled}
              >
                <option value="USD">USD</option>
                <option value="TICKS">Ticks</option>
              </Select>
            </Field>
          ) : (
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
          )}
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

        {isAccumulator && (
          <Field
            label={
              config.accumulatorTakeProfitMode === "USD"
                ? "Take Profit (USD)"
                : "Take Profit (Ticks)"
            }
          >
            <Input
              type="number"
              min={config.accumulatorTakeProfitMode === "USD" ? 0 : 1}
              step={config.accumulatorTakeProfitMode === "USD" ? 0.01 : 1}
              value={
                config.accumulatorTakeProfitMode === "USD"
                  ? config.takeProfit
                  : config.accumulatorTakeProfitTicks
              }
              onChange={(e) => {
                const next = Number(e.target.value);
                if (config.accumulatorTakeProfitMode === "USD") {
                  set("takeProfit", next);
                } else {
                  set("accumulatorTakeProfitTicks", next);
                }
              }}
              disabled={disabled}
            />
          </Field>
        )}

        <div className="bg-gray-900/50 rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-300 text-sm font-medium">
              Martingale
            </span>
            <button
              type="button"
              onClick={() => set("martingale", !config.martingale)}
              disabled={disabled}
              aria-pressed={config.martingale}
              className={`inline-flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                config.martingale
                  ? "border-red-500 bg-red-600/15 text-red-100"
                  : "border-gray-600 bg-gray-800 text-gray-300"
              }`}
            >
              <span>{config.martingale ? "ON" : "OFF"}</span>
              <span
                className={`relative h-5 w-9 rounded-full border transition-colors ${
                  config.martingale
                    ? "border-red-400 bg-red-500/30"
                    : "border-gray-500 bg-gray-700"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-all ${
                    config.martingale ? "right-0.5" : "left-0.5"
                  }`}
                />
              </span>
            </button>
          </div>

          <p className="text-[11px] text-gray-400">
            {isAccumulator
              ? "Accumulator martingale applies growth percent and multiplier together after a loss."
              : "Multiplies stake after losses using your configured multiplier and split rules."}
          </p>
          {config.martingale && (
            <>
              {isAccumulator ? (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Growth per loss (%)">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={config.accumulatorMartingaleGrowthRate}
                      onChange={(e) =>
                        set(
                          "accumulatorMartingaleGrowthRate",
                          Number(e.target.value),
                        )
                      }
                      disabled={disabled}
                    />
                  </Field>
                  <Field label="Multiplier on loss">
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      step={0.01}
                      value={config.accumulatorMartingaleMultiplier}
                      onChange={(e) =>
                        set(
                          "accumulatorMartingaleMultiplier",
                          Number(e.target.value),
                        )
                      }
                      disabled={disabled}
                    />
                  </Field>
                </div>
              ) : (
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
              )}
              {config.strategy === "DIGITS_DIFFER" && !isAccumulator && (
                <>
                  <Field label="Split recovery trades">
                    <div className="grid grid-cols-3 gap-2">
                      {([1, 2, 3] as const).map((n) => {
                        const perTradeMultiplier = (
                          config.martingaleMultiplier / n
                        ).toFixed(1);

                        return (
                          <label
                            key={n}
                            className={`group ${
                              disabled
                                ? "pointer-events-none opacity-50"
                                : "cursor-pointer"
                            }`}
                          >
                            <input
                              type="radio"
                              name="martingale-split"
                              value={n}
                              checked={config.martingaleSplit === n}
                              onChange={() => set("martingaleSplit", n)}
                              disabled={disabled}
                              className="peer sr-only"
                            />
                            <span className="flex min-h-[66px] flex-col justify-between rounded-xl border border-gray-600 bg-gray-800 px-3 py-2.5 transition-colors peer-checked:border-red-400 peer-checked:bg-red-600/15 peer-focus-visible:ring-2 peer-focus-visible:ring-red-400/70 group-hover:border-red-300/80">
                              <span className="flex items-center gap-2 text-sm font-semibold text-gray-100">
                                <span className="flex h-4 w-4 items-center justify-center rounded-full border border-gray-400 bg-gray-900 peer-checked:border-red-400 peer-checked:bg-red-500/20">
                                  <span className="h-2 w-2 scale-0 rounded-full bg-red-400 transition-transform peer-checked:scale-100" />
                                </span>
                                {n === 1 ? "1x full" : `${n}x split`}
                              </span>
                              <span className="text-[11px] text-gray-400 peer-checked:text-red-100">
                                x{perTradeMultiplier} each trade
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </Field>

                  <div className="bg-gray-900/70 rounded-lg p-3 space-y-3 border border-gray-700">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300 text-sm font-medium">
                        Delay martingale by digit %
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onChange({
                            ...config,
                            holdStakeUntilLowDigitRate:
                              !config.holdStakeUntilLowDigitRate,
                            holdStakeUntilTradeCount:
                              config.holdStakeUntilLowDigitRate
                                ? config.holdStakeUntilTradeCount
                                : false,
                          })
                        }
                        disabled={disabled}
                        aria-pressed={config.holdStakeUntilLowDigitRate}
                        className={`inline-flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                          config.holdStakeUntilLowDigitRate
                            ? "border-red-500 bg-red-600/15 text-red-100"
                            : "border-gray-600 bg-gray-800 text-gray-300"
                        }`}
                      >
                        <span>
                          {config.holdStakeUntilLowDigitRate ? "ON" : "OFF"}
                        </span>
                        <span
                          className={`relative h-5 w-9 rounded-full border transition-colors ${
                            config.holdStakeUntilLowDigitRate
                              ? "border-red-400 bg-red-500/30"
                              : "border-gray-500 bg-gray-700"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-all ${
                              config.holdStakeUntilLowDigitRate
                                ? "right-0.5"
                                : "left-0.5"
                            }`}
                          />
                        </span>
                      </button>
                    </div>

                    <p className="text-[11px] text-gray-400">
                      Keeps using hold stake until the predicted digit rate
                      drops below your threshold.
                    </p>

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
                        type="button"
                        onClick={() =>
                          onChange({
                            ...config,
                            holdStakeUntilTradeCount:
                              !config.holdStakeUntilTradeCount,
                            holdStakeUntilLowDigitRate:
                              config.holdStakeUntilTradeCount
                                ? config.holdStakeUntilLowDigitRate
                                : false,
                          })
                        }
                        disabled={disabled}
                        aria-pressed={config.holdStakeUntilTradeCount}
                        className={`inline-flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                          config.holdStakeUntilTradeCount
                            ? "border-red-500 bg-red-600/15 text-red-100"
                            : "border-gray-600 bg-gray-800 text-gray-300"
                        }`}
                      >
                        <span>
                          {config.holdStakeUntilTradeCount ? "ON" : "OFF"}
                        </span>
                        <span
                          className={`relative h-5 w-9 rounded-full border transition-colors ${
                            config.holdStakeUntilTradeCount
                              ? "border-red-400 bg-red-500/30"
                              : "border-gray-500 bg-gray-700"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-all ${
                              config.holdStakeUntilTradeCount
                                ? "right-0.5"
                                : "left-0.5"
                            }`}
                          />
                        </span>
                      </button>
                    </div>

                    <p className="text-[11px] text-gray-400">
                      Waits for a fixed number of hold trades before applying
                      martingale.
                    </p>

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
