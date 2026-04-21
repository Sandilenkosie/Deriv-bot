import { useCallback, useEffect, useRef, useState } from "react";
import "./index.css";
import { Toaster, toast } from "sonner";
import { derivApi, type DerivMessage } from "./services/derivApi";
import Header from "./components/Header";
import BotConfigPanel, { type BotConfig } from "./components/BotConfigPanel";
import TradeLog, { type TradeRecord } from "./components/TradeLog";
import LastDigitsChart from "./components/LastDigitsChart";

const DEFAULT_CONFIG: BotConfig = {
  symbol: "R_50",
  strategy: "DIGITS_DIFFER",
  contractType: "AUTO",
  digitPrediction: 3,
  duration: 5,
  durationUnit: "t",
  initialStake: 1,
  takeProfit: 10,
  accumulatorTakeProfitMode: "USD",
  accumulatorTakeProfitTicks: 20,
  accumulatorGrowthRate: 1,
  accumulatorMartingaleGrowthRate: 2,
  accumulatorMartingaleMultiplier: 1,
  accumulatorDelayMartingale: false,
  accumulatorDelayTrades: 3,
  stopLoss: 10,
  martingale: true,
  martingaleMultiplier: 11,
  martingaleSplit: 1,
  holdStakeUntilLowDigitRate: true,
  holdStakeAmount: 1,
  digitRateThreshold: 5,
  holdStakeUntilTradeCount: false,
  holdStakeTradeCount: 6,
};

const DIGIT_RATE_LOOKBACK = 500;
const TRADE_HISTORY_LIMIT = 500;

type TaskCallback = () => void;

interface BackgroundScheduler {
  schedule: (cb: TaskCallback, delayMs: number) => number;
  cancel: (id: number) => void;
  dispose: () => void;
}

function createBackgroundScheduler(): BackgroundScheduler {
  let nextId = 1;
  const callbacks = new Map<number, TaskCallback>();
  const fallbackTimeouts = new Map<number, number>();
  let worker: Worker | null = null;
  let workerScriptUrl: string | null = null;

  const clearCallback = (id: number) => {
    callbacks.delete(id);
    const timeoutId = fallbackTimeouts.get(id);
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
      fallbackTimeouts.delete(id);
    }
  };

  try {
    const workerCode = `
      const timers = new Map();
      self.onmessage = (event) => {
        const data = event.data || {};
        if (data.action === "schedule") {
          const timerId = setTimeout(() => {
            self.postMessage({ id: data.id });
            timers.delete(data.id);
          }, data.delayMs || 0);
          timers.set(data.id, timerId);
          return;
        }
        if (data.action === "cancel") {
          const timerId = timers.get(data.id);
          if (timerId !== undefined) {
            clearTimeout(timerId);
            timers.delete(data.id);
          }
        }
      };
    `;
    workerScriptUrl = URL.createObjectURL(
      new Blob([workerCode], { type: "application/javascript" }),
    );
    worker = new Worker(workerScriptUrl);
    worker.onmessage = (event: MessageEvent<{ id?: number }>) => {
      const id = Number(event.data?.id);
      if (!Number.isFinite(id)) return;
      const cb = callbacks.get(id);
      if (!cb) return;
      callbacks.delete(id);
      cb();
    };
  } catch {
    worker = null;
  }

  return {
    schedule(cb, delayMs) {
      const id = nextId++;
      callbacks.set(id, cb);
      if (worker) {
        worker.postMessage({ action: "schedule", id, delayMs });
      } else {
        const timeoutId = window.setTimeout(() => {
          const run = callbacks.get(id);
          if (!run) return;
          callbacks.delete(id);
          fallbackTimeouts.delete(id);
          run();
        }, delayMs);
        fallbackTimeouts.set(id, timeoutId);
      }
      return id;
    },
    cancel(id) {
      clearCallback(id);
      if (worker) {
        worker.postMessage({ action: "cancel", id });
      }
    },
    dispose() {
      const ids = Array.from(callbacks.keys());
      ids.forEach((id) => clearCallback(id));
      if (worker) {
        worker.terminate();
        worker = null;
      }
      if (workerScriptUrl) {
        URL.revokeObjectURL(workerScriptUrl);
        workerScriptUrl = null;
      }
    },
  };
}

function nowStr() {
  return new Date().toLocaleTimeString();
}

export default function App() {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connError, setConnError] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [loginId, setLoginId] = useState("");

  const [config, setConfig] = useState<BotConfig>(DEFAULT_CONFIG);
  const [running, setRunning] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [totalProfit, setTotalProfit] = useState(0);
  const [wins, setWins] = useState(0);

  // Last-digit chart state
  const [lastDigits, setLastDigits] = useState<number[]>([]);
  const [priceHistory, setPriceHistory] = useState<number[]>([]);
  const [currentPrice, setCurrentPrice] = useState("");
  const subscribedSymbolRef = useRef<string | null>(null);
  const lastDigitsRef = useRef<number[]>([]);

  // Mutable refs for bot logic (avoid stale closures)
  const runningRef = useRef(false);
  const configRef = useRef(config);
  const currentStakeRef = useRef(config.initialStake);
  const netProfitRef = useRef(0);
  const winsRef = useRef(0);
  const nextTypeRef = useRef<"CALL" | "PUT">("CALL");
  const openContractIdRef = useRef<string | null>(null);
  const openTradeIdsRef = useRef<Set<string>>(new Set());
  const pendingDelayedMartingaleRef = useRef(false);
  const pendingDelayedMartingaleTradesRef = useRef(0);
  const delayedMartingaleTargetStakeRef = useRef<number | null>(null);
  const delayedMartingaleSplitRemainingRef = useRef(0);
  // split-martingale: how many recovery trades still need to win (0 = normal)
  const splitRemainingRef = useRef(0);
  const accumulatorTickProfitRef = useRef(0);
  const accumulatorPendingMartingaleRef = useRef(false);
  const accumulatorPendingMartingaleStakeRef = useRef<number | null>(null);
  const accumulatorPendingMartingaleWinsRef = useRef(0);
  const accumulatorSellPendingRef = useRef<Set<string>>(new Set());
  const accumulatorContractTickCountRef = useRef<Map<string, number>>(
    new Map(),
  );
  const accumulatorContractLastSpotTimeRef = useRef<
    Map<string, string | number>
  >(new Map());
  const schedulerRef = useRef<BackgroundScheduler | null>(null);
  const scheduledTradeTaskRef = useRef<number | null>(null);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    schedulerRef.current = createBackgroundScheduler();
    return () => {
      if (schedulerRef.current && scheduledTradeTaskRef.current !== null) {
        schedulerRef.current.cancel(scheduledTradeTaskRef.current);
      }
      schedulerRef.current?.dispose();
      schedulerRef.current = null;
      scheduledTradeTaskRef.current = null;
    };
  }, []);

  const lastToastMsgRef = useRef("");

  useEffect(() => {
    if (!statusMsg || statusMsg === lastToastMsgRef.current) return;
    lastToastMsgRef.current = statusMsg;

    if (statusMsg.startsWith("Error") || statusMsg.startsWith("Stop Loss")) {
      toast.error(statusMsg);
      return;
    }
    if (statusMsg.startsWith("Take Profit")) {
      toast.success(statusMsg);
      return;
    }

    toast(statusMsg);
  }, [statusMsg]);

  function getPredictedDigitRate(predictedDigit: number): number {
    const sample = lastDigitsRef.current.slice(-DIGIT_RATE_LOOKBACK);
    if (sample.length === 0) return 100;
    const hits = sample.filter((d) => d === predictedDigit).length;
    return (hits / sample.length) * 100;
  }

  function resolveDelayedMartingaleState() {
    const cfg = configRef.current;
    if (
      !pendingDelayedMartingaleRef.current ||
      cfg.strategy !== "DIGITS_DIFFER" ||
      !cfg.martingale
    ) {
      return null;
    }

    const hasDigitRule = cfg.holdStakeUntilLowDigitRate;
    const hasTradeRule = cfg.holdStakeUntilTradeCount;
    const predictedRate = hasDigitRule
      ? getPredictedDigitRate(cfg.digitPrediction)
      : null;
    const reachedDigitThreshold =
      hasDigitRule && predictedRate !== null
        ? predictedRate < cfg.digitRateThreshold
        : false;
    const reachedTradeThreshold =
      hasTradeRule &&
      pendingDelayedMartingaleTradesRef.current >= cfg.holdStakeTradeCount;

    if (reachedDigitThreshold || reachedTradeThreshold) {
      const split =
        delayedMartingaleSplitRemainingRef.current || cfg.martingaleSplit;
      const perSplitMultiplier = cfg.martingaleMultiplier / cfg.martingaleSplit;
      currentStakeRef.current =
        delayedMartingaleTargetStakeRef.current ??
        parseFloat((cfg.holdStakeAmount * perSplitMultiplier).toFixed(2));
      splitRemainingRef.current = split;
      pendingDelayedMartingaleRef.current = false;
      pendingDelayedMartingaleTradesRef.current = 0;
      delayedMartingaleTargetStakeRef.current = null;
      delayedMartingaleSplitRemainingRef.current = 0;
      return {
        mode: "activated" as const,
        predictedRate,
        holdTrades: pendingDelayedMartingaleTradesRef.current,
        activatedBy: reachedDigitThreshold ? "digit-rate" : "trade-count",
      };
    }

    currentStakeRef.current = cfg.holdStakeAmount;
    splitRemainingRef.current = 0;
    return {
      mode: "holding" as const,
      predictedRate,
      holdTrades: pendingDelayedMartingaleTradesRef.current,
    };
  }

  function clearScheduledTrade() {
    const taskId = scheduledTradeTaskRef.current;
    if (taskId === null) return;
    schedulerRef.current?.cancel(taskId);
    scheduledTradeTaskRef.current = null;
  }

  function queueNextTrade(delayMs: number) {
    clearScheduledTrade();
    if (!runningRef.current) return;
    if (!schedulerRef.current) {
      placeNextTrade();
      return;
    }
    scheduledTradeTaskRef.current = schedulerRef.current.schedule(() => {
      scheduledTradeTaskRef.current = null;
      if (runningRef.current) {
        placeNextTrade();
      }
    }, delayMs);
  }

  function closeTrackedOpenContracts(reason?: string) {
    const contractIds = Array.from(openTradeIdsRef.current);
    contractIds.forEach((contractId) => {
      derivApi.sellContract(contractId);
      derivApi.unsubscribeOpenContract(contractId);
    });
    openTradeIdsRef.current.clear();
    openContractIdRef.current = null;
    accumulatorSellPendingRef.current.clear();
    accumulatorContractTickCountRef.current.clear();
    accumulatorContractLastSpotTimeRef.current.clear();
    if (reason) {
      setStatusMsg(reason);
    }
  }

  // Re-subscribe ticks when the symbol changes
  useEffect(() => {
    if (!connected) return;
    if (subscribedSymbolRef.current === config.symbol) return;
    if (subscribedSymbolRef.current) {
      derivApi.unsubscribeTicks(subscribedSymbolRef.current);
    }
    setLastDigits([]);
    setPriceHistory([]);
    setCurrentPrice("");
    derivApi.subscribeTicks(config.symbol);
    subscribedSymbolRef.current = config.symbol;
  }, [config.symbol, connected]);

  // ─── WebSocket listener ──────────────────────────────────────────────────
  const handleMessage = useCallback((msg: DerivMessage) => {
    if (msg.msg_type === "authorize") {
      const auth = msg.authorize as Record<string, unknown>;
      setLoginId((auth?.loginid as string) ?? "");
      derivApi.getBalance();
      derivApi.subscribeTicks(configRef.current.symbol);
      subscribedSymbolRef.current = configRef.current.symbol;
    }

    if (msg.msg_type === "balance") {
      const bal = msg.balance as Record<string, unknown>;
      setBalance(Number(bal?.balance ?? 0));
      setCurrency((bal?.currency as string) ?? "USD");
    }

    if (msg.msg_type === "tick") {
      const tick = msg.tick as Record<string, unknown>;
      if (!tick) return;
      const rawQuote = Number(tick.quote);
      if (!Number.isFinite(rawQuote)) return;
      const pipSize = Number(tick.pip_size);
      const normalizedPipSize = Number.isInteger(pipSize)
        ? Math.max(0, pipSize)
        : 2;
      const formattedQuote = rawQuote.toFixed(normalizedPipSize);
      const lastChar = formattedQuote.slice(-1);
      const digit = Number(lastChar);
      if (Number.isInteger(digit) && digit >= 0 && digit <= 9) {
        setCurrentPrice(formattedQuote);
        setPriceHistory((prev) => {
          const next = [...prev, rawQuote];
          return next.length > 1000 ? next.slice(-1000) : next;
        });
        setLastDigits((prev) => {
          const next = [...prev, digit];
          const trimmed = next.length > 1000 ? next.slice(-1000) : next;
          lastDigitsRef.current = trimmed;
          return trimmed;
        });
      }
    }

    if (msg.msg_type === "buy") {
      if ((msg.error as Record<string, unknown>)?.code) {
        const errMsg =
          ((msg.error as Record<string, unknown>)?.message as string) ??
          "Buy error";
        if (/too many open positions/i.test(errMsg)) {
          closeTrackedOpenContracts(
            "Open position limit reached: closing tracked contracts and stopping bot.",
          );
          stopBot();
          return;
        }
        setStatusMsg(`Error: ${errMsg}`);
        openContractIdRef.current = null;
        queueNextTrade(1500);
        return;
      }
      const buy = msg.buy as Record<string, unknown>;
      const contractId = String(buy?.contract_id ?? "");
      const tempId = openContractIdRef.current;
      if (!contractId) {
        setStatusMsg("Error: contract id missing from buy response.");
        openContractIdRef.current = null;
        setTrades((prev) => prev.filter((t) => t.id !== tempId));
        queueNextTrade(1500);
        return;
      }
      openContractIdRef.current = contractId;
      openTradeIdsRef.current.add(contractId);
      setTrades((prev) =>
        prev.map((t) => (t.id === tempId ? { ...t, contractId } : t)),
      );
      derivApi.subscribeOpenContract(contractId);
      setStatusMsg(`Contract ${contractId} opened — waiting for result…`);
    }

    if (msg.msg_type === "proposal_open_contract") {
      const poc = msg.proposal_open_contract as Record<string, unknown>;
      if (!poc) return;
      const contractId = String(poc.contract_id ?? "");
      if (!openTradeIdsRef.current.has(contractId)) return;

      const cfg = configRef.current;
      const currentSpotTime =
        (poc.current_spot_time as string | number | undefined) ??
        (poc.exit_tick_time as string | number | undefined);
      let normalizedLiveTickCount =
        accumulatorContractTickCountRef.current.get(contractId) ?? 0;

      if (cfg.strategy === "ACCUMULATOR" && currentSpotTime !== undefined) {
        const lastSpotTime =
          accumulatorContractLastSpotTimeRef.current.get(contractId);

        if (lastSpotTime === undefined) {
          normalizedLiveTickCount = 1;
          accumulatorContractTickCountRef.current.set(contractId, 1);
          accumulatorContractLastSpotTimeRef.current.set(
            contractId,
            currentSpotTime,
          );
        } else if (lastSpotTime !== currentSpotTime) {
          normalizedLiveTickCount += 1;
          accumulatorContractTickCountRef.current.set(
            contractId,
            normalizedLiveTickCount,
          );
          accumulatorContractLastSpotTimeRef.current.set(
            contractId,
            currentSpotTime,
          );
        }
      }

      if (
        cfg.strategy === "ACCUMULATOR" &&
        cfg.accumulatorTakeProfitMode === "TICKS" &&
        cfg.accumulatorTakeProfitTicks > 0 &&
        normalizedLiveTickCount >= cfg.accumulatorTakeProfitTicks &&
        Number(poc.is_sold) !== 1 &&
        poc.status !== "sold" &&
        !accumulatorSellPendingRef.current.has(contractId)
      ) {
        accumulatorSellPendingRef.current.add(contractId);
        accumulatorTickProfitRef.current = normalizedLiveTickCount;
        setStatusMsg(
          `Take Profit reached: ${normalizedLiveTickCount} accumulator ticks — closing contract…`,
        );
        derivApi.sellContract(contractId);
        return;
      }

      const status = String(poc.status ?? "").toLowerCase();
      const isSettled =
        Number(poc.is_sold) === 1 ||
        status === "sold" ||
        status === "won" ||
        status === "lost" ||
        status === "expired" ||
        status === "cancelled";
      if (!isSettled) return;

      const profit = Number(poc.profit ?? 0);
      // Prefer terminal status over live profit fields.
      const won =
        status === "won"
          ? true
          : status === "lost" || status === "expired" || status === "cancelled"
            ? false
            : profit > 0;
      console.log("[Bot] Settlement", {
        contractId,
        status,
        is_sold: poc.is_sold,
        profit,
        sell_price: poc.sell_price,
        won,
        martingale: configRef.current.martingale,
        strategy: configRef.current.strategy,
        growthRate: configRef.current.accumulatorMartingaleGrowthRate,
      });
      const stake = currentStakeRef.current;
      const settledTicks = normalizedLiveTickCount;

      setTrades((prev) =>
        prev.map((t) =>
          t.contractId === contractId
            ? {
                ...t,
                profit,
                payout: Number(poc.payout ?? 0),
                status: won ? ("won" as const) : ("lost" as const),
              }
            : t,
        ),
      );

      netProfitRef.current += profit;
      setTotalProfit(netProfitRef.current);

      if (
        cfg.strategy === "ACCUMULATOR" &&
        cfg.accumulatorTakeProfitMode === "TICKS"
      ) {
        accumulatorTickProfitRef.current = settledTicks;
      }

      if (won) {
        winsRef.current += 1;
        setWins(winsRef.current);
        if (
          cfg.strategy === "ACCUMULATOR" &&
          accumulatorPendingMartingaleRef.current
        ) {
          accumulatorPendingMartingaleWinsRef.current += 1;
          const winsNeeded = Math.max(1, cfg.accumulatorDelayTrades);
          if (accumulatorPendingMartingaleWinsRef.current >= winsNeeded) {
            const pendingStake =
              accumulatorPendingMartingaleStakeRef.current ??
              configRef.current.initialStake;
            currentStakeRef.current = pendingStake;
            accumulatorPendingMartingaleRef.current = false;
            accumulatorPendingMartingaleStakeRef.current = null;
            accumulatorPendingMartingaleWinsRef.current = 0;
            setStatusMsg(
              `Delay complete: applying martingale — next stake $${pendingStake.toFixed(2)}`,
            );
          } else {
            currentStakeRef.current = configRef.current.initialStake;
            const remaining =
              winsNeeded - accumulatorPendingMartingaleWinsRef.current;
            setStatusMsg(
              `Won (delay martingale): ${remaining} more win(s) before $${(accumulatorPendingMartingaleStakeRef.current ?? configRef.current.initialStake).toFixed(2)} stake`,
            );
          }
        } else if (pendingDelayedMartingaleRef.current) {
          currentStakeRef.current = cfg.holdStakeAmount;
          splitRemainingRef.current = 0;
        } else if (splitRemainingRef.current > 0) {
          // completed one split recovery trade
          splitRemainingRef.current--;
          if (splitRemainingRef.current === 0) {
            // all split trades won — full recovery, reset stake
            currentStakeRef.current = configRef.current.initialStake;
          } else if (
            cfg.strategy === "DIGITS_DIFFER" &&
            (cfg.holdStakeUntilLowDigitRate || cfg.holdStakeUntilTradeCount)
          ) {
            pendingDelayedMartingaleRef.current = true;
            pendingDelayedMartingaleTradesRef.current = 0;
            delayedMartingaleTargetStakeRef.current = currentStakeRef.current;
            delayedMartingaleSplitRemainingRef.current =
              splitRemainingRef.current;
            currentStakeRef.current = cfg.holdStakeAmount;
            splitRemainingRef.current = 0;
          }
          // else: keep same stake and place next split trade
        } else {
          currentStakeRef.current = configRef.current.initialStake;
        }
      } else {
        if (cfg.martingale) {
          if (cfg.strategy === "ACCUMULATOR") {
            const growthPercent = Number.isFinite(
              cfg.accumulatorMartingaleGrowthRate,
            )
              ? Math.min(5, Math.max(1, cfg.accumulatorMartingaleGrowthRate))
              : 2;
            const safeMultiplier = Number.isFinite(
              cfg.accumulatorMartingaleMultiplier,
            )
              ? Math.max(1, cfg.accumulatorMartingaleMultiplier)
              : 1;
            const growthFactor = 1 + growthPercent / 100;
            const safeStake =
              Number.isFinite(stake) && stake > 0
                ? stake
                : Number.isFinite(cfg.initialStake) && cfg.initialStake > 0
                  ? cfg.initialStake
                  : 1;
            const stakeCents = Math.max(1, Math.round(safeStake * 100));
            let nextStakeCents = Math.round(
              stakeCents * growthFactor * safeMultiplier,
            );
            if (!Number.isFinite(nextStakeCents)) {
              nextStakeCents = stakeCents + 1;
            }
            if (
              (growthPercent > 0 || safeMultiplier > 1) &&
              nextStakeCents <= stakeCents
            ) {
              nextStakeCents = stakeCents + 1;
            }
            const computedNextStake = parseFloat(
              (nextStakeCents / 100).toFixed(2),
            );
            splitRemainingRef.current = 0;
            pendingDelayedMartingaleRef.current = false;
            pendingDelayedMartingaleTradesRef.current = 0;
            delayedMartingaleTargetStakeRef.current = null;
            delayedMartingaleSplitRemainingRef.current = 0;

            if (
              cfg.accumulatorDelayMartingale &&
              cfg.accumulatorDelayTrades > 0
            ) {
              // Save the stake for later; hold at initial stake until wins counted
              accumulatorPendingMartingaleStakeRef.current = computedNextStake;
              accumulatorPendingMartingaleRef.current = true;
              accumulatorPendingMartingaleWinsRef.current = 0;
              currentStakeRef.current = configRef.current.initialStake;
              setStatusMsg(
                `Loss: martingale delayed — waiting ${cfg.accumulatorDelayTrades} win(s) before $${computedNextStake.toFixed(2)} stake`,
              );
            } else {
              currentStakeRef.current = computedNextStake;
              console.log("[Bot] Accumulator martingale applied", {
                previousStake: safeStake,
                nextStake: currentStakeRef.current,
                growthPercent,
                multiplier: safeMultiplier,
              });
              setStatusMsg(
                `Accumulator loss: next stake $${currentStakeRef.current.toFixed(2)} (growth ${growthPercent.toFixed(2)}%, multiplier ${safeMultiplier.toFixed(2)}x)`,
              );
            }
          } else {
            const shouldDelayMartingale =
              cfg.strategy === "DIGITS_DIFFER" &&
              (cfg.holdStakeUntilLowDigitRate ||
                cfg.holdStakeUntilTradeCount) &&
              Math.abs(stake - cfg.holdStakeAmount) < 0.0001;

            if (shouldDelayMartingale) {
              const predictedRate = cfg.holdStakeUntilLowDigitRate
                ? getPredictedDigitRate(cfg.digitPrediction)
                : null;
              const shouldHoldForDigitRate =
                cfg.holdStakeUntilLowDigitRate &&
                predictedRate !== null &&
                predictedRate >= cfg.digitRateThreshold;
              const shouldHoldForTradeCount = cfg.holdStakeUntilTradeCount;

              if (shouldHoldForDigitRate || shouldHoldForTradeCount) {
                const split =
                  cfg.strategy === "DIGITS_DIFFER" ? cfg.martingaleSplit : 1;
                delayedMartingaleTargetStakeRef.current = parseFloat(
                  (
                    (cfg.holdStakeAmount * cfg.martingaleMultiplier) /
                    split
                  ).toFixed(2),
                );
                delayedMartingaleSplitRemainingRef.current = split;
                pendingDelayedMartingaleRef.current = true;
                pendingDelayedMartingaleTradesRef.current = 0;
                currentStakeRef.current = cfg.holdStakeAmount;
                splitRemainingRef.current = 0;
                setStatusMsg(
                  shouldHoldForDigitRate && predictedRate !== null
                    ? `Holding at $${cfg.holdStakeAmount.toFixed(2)} (digit ${cfg.digitPrediction} rate ${predictedRate.toFixed(2)}% >= ${cfg.digitRateThreshold.toFixed(2)}%)`
                    : `Holding at $${cfg.holdStakeAmount.toFixed(2)} until ${cfg.holdStakeTradeCount} trades complete before martingale`,
                );
                openContractIdRef.current = null;
                openTradeIdsRef.current.delete(contractId);
                derivApi.unsubscribeOpenContract(contractId);
                if (runningRef.current) {
                  queueNextTrade(120);
                }
                return;
              }
            }

            const split =
              cfg.strategy === "DIGITS_DIFFER" ? cfg.martingaleSplit : 1;
            const perSplitMultiplier = cfg.martingaleMultiplier / split;
            pendingDelayedMartingaleRef.current = false;
            pendingDelayedMartingaleTradesRef.current = 0;
            delayedMartingaleTargetStakeRef.current = null;
            delayedMartingaleSplitRemainingRef.current = 0;
            currentStakeRef.current = parseFloat(
              (stake * perSplitMultiplier).toFixed(2),
            );
            // set how many recovery trades remain (first one will be placed immediately)
            splitRemainingRef.current = split;
          }
        } else {
          pendingDelayedMartingaleRef.current = false;
          pendingDelayedMartingaleTradesRef.current = 0;
          delayedMartingaleTargetStakeRef.current = null;
          delayedMartingaleSplitRemainingRef.current = 0;
          currentStakeRef.current = configRef.current.initialStake;
          splitRemainingRef.current = 0;
        }
      }

      openContractIdRef.current = null;
      openTradeIdsRef.current.delete(contractId);
      accumulatorSellPendingRef.current.delete(contractId);
      accumulatorContractTickCountRef.current.delete(contractId);
      accumulatorContractLastSpotTimeRef.current.delete(contractId);
      derivApi.unsubscribeOpenContract(contractId);

      const hitTakeProfitByUsd =
        cfg.takeProfit > 0 && netProfitRef.current >= cfg.takeProfit;
      const hitTakeProfitByTicks = false;

      if (hitTakeProfitByUsd || hitTakeProfitByTicks) {
        setStatusMsg(
          hitTakeProfitByTicks
            ? `Take Profit reached: ${accumulatorTickProfitRef.current} accumulator ticks`
            : `Take Profit reached: +${netProfitRef.current.toFixed(2)}`,
        );
        stopBot();
        return;
      }
      if (cfg.stopLoss > 0 && netProfitRef.current <= -cfg.stopLoss) {
        setStatusMsg(`Stop Loss reached: ${netProfitRef.current.toFixed(2)}`);
        stopBot();
        return;
      }

      if (runningRef.current) {
        queueNextTrade(120);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    derivApi.addListener(handleMessage);
    return () => derivApi.removeListener(handleMessage);
  }, [handleMessage]);

  // ─── Connect / Disconnect ────────────────────────────────────────────────
  const handleConnect = async (token: string) => {
    setConnecting(true);
    setConnError("");
    try {
      await derivApi.connect();
      derivApi.authorize(token);
      setConnected(true);
    } catch {
      setConnError(
        "Failed to connect to Deriv. Check your internet connection.",
      );
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    stopBot();
    closeTrackedOpenContracts();
    derivApi.disconnect();
    setConnected(false);
    setBalance(null);
    setLoginId("");
    setStatusMsg("");
    setLastDigits([]);
    setPriceHistory([]);
    setCurrentPrice("");
    lastDigitsRef.current = [];
    clearScheduledTrade();
    accumulatorSellPendingRef.current.clear();
    accumulatorContractTickCountRef.current.clear();
    accumulatorContractLastSpotTimeRef.current.clear();
    accumulatorTickProfitRef.current = 0;
    pendingDelayedMartingaleRef.current = false;
    pendingDelayedMartingaleTradesRef.current = 0;
    delayedMartingaleTargetStakeRef.current = null;
    delayedMartingaleSplitRemainingRef.current = 0;
    accumulatorPendingMartingaleRef.current = false;
    accumulatorPendingMartingaleStakeRef.current = null;
    accumulatorPendingMartingaleWinsRef.current = 0;
    subscribedSymbolRef.current = null;
  };

  // ─── Bot logic ───────────────────────────────────────────────────────────
  function placeNextTrade() {
    if (!runningRef.current) return;
    if (openContractIdRef.current || openTradeIdsRef.current.size > 0) return;
    const cfg = configRef.current;
    if (pendingDelayedMartingaleRef.current) {
      pendingDelayedMartingaleTradesRef.current += 1;
    }
    const delayedMartingaleState = resolveDelayedMartingaleState();
    const stake = currentStakeRef.current;
    const tradeId = `trade_${Date.now()}`;

    if (cfg.strategy === "DIGITS_DIFFER") {
      const newTrade: TradeRecord = {
        id: tradeId,
        contractId: undefined,
        time: nowStr(),
        symbol: cfg.symbol,
        contractType: "DIGITDIFF",
        barrier: cfg.digitPrediction,
        stake,
        payout: null,
        profit: null,
        status: "open",
      };
      setTrades((prev) => {
        const next = [...prev, newTrade];
        return next.length > TRADE_HISTORY_LIMIT
          ? next.slice(-TRADE_HISTORY_LIMIT)
          : next;
      });
      const splitLabel =
        splitRemainingRef.current > 0
          ? ` [recovery ${cfg.martingaleSplit - splitRemainingRef.current + 1}/${cfg.martingaleSplit}]`
          : "";
      if (delayedMartingaleState?.mode === "holding") {
        if (
          cfg.holdStakeUntilLowDigitRate &&
          delayedMartingaleState.predictedRate !== null
        ) {
          setStatusMsg(
            `Holding at $${cfg.holdStakeAmount.toFixed(2)} until digit ${cfg.digitPrediction} rate drops below ${cfg.digitRateThreshold.toFixed(2)}% (current ${delayedMartingaleState.predictedRate.toFixed(2)}%)`,
          );
        } else {
          setStatusMsg(
            `Holding at $${cfg.holdStakeAmount.toFixed(2)} until ${cfg.holdStakeTradeCount} trades complete (${delayedMartingaleState.holdTrades}/${cfg.holdStakeTradeCount})`,
          );
        }
      } else if (delayedMartingaleState?.mode === "activated") {
        setStatusMsg(
          delayedMartingaleState.activatedBy === "trade-count"
            ? `${cfg.holdStakeTradeCount} hold trades reached — applying martingale with $${stake.toFixed(2)} stake${splitLabel}`
            : `Digit ${cfg.digitPrediction} rate ${delayedMartingaleState.predictedRate?.toFixed(2)}% < ${cfg.digitRateThreshold.toFixed(2)}% — applying martingale with $${stake.toFixed(2)} stake${splitLabel}`,
        );
      } else {
        setStatusMsg(
          `Digits Differ ≠${cfg.digitPrediction}${splitLabel} — $${stake.toFixed(2)} stake…`,
        );
      }
      openContractIdRef.current = tradeId;
      derivApi.buyDigitContract({
        symbol: cfg.symbol,
        digit: cfg.digitPrediction,
        duration: cfg.duration,
        durationUnit: cfg.durationUnit,
        amount: stake,
      });
    } else if (cfg.strategy === "RISE_FALL") {
      let contractType: "CALL" | "PUT";
      if (cfg.contractType === "AUTO") {
        contractType = nextTypeRef.current;
        nextTypeRef.current = nextTypeRef.current === "CALL" ? "PUT" : "CALL";
      } else {
        contractType = cfg.contractType;
      }
      const newTrade: TradeRecord = {
        id: tradeId,
        contractId: undefined,
        time: nowStr(),
        symbol: cfg.symbol,
        contractType,
        stake,
        payout: null,
        profit: null,
        status: "open",
      };
      setTrades((prev) => {
        const next = [...prev, newTrade];
        return next.length > TRADE_HISTORY_LIMIT
          ? next.slice(-TRADE_HISTORY_LIMIT)
          : next;
      });
      setStatusMsg(`Placing ${contractType} — $${stake.toFixed(2)} stake…`);
      openContractIdRef.current = tradeId;
      derivApi.buyContract({
        symbol: cfg.symbol,
        contractType,
        duration: cfg.duration,
        durationUnit: cfg.durationUnit,
        amount: stake,
        basis: "stake",
      });
    } else {
      const isAccumulatorRecoveryStake =
        cfg.martingale && stake > cfg.initialStake + 0.0001;
      const safeBaseGrowthRate = Number.isFinite(cfg.accumulatorGrowthRate)
        ? Math.min(5, Math.max(1, cfg.accumulatorGrowthRate))
        : 1;
      const safeMartingaleGrowthRate = Number.isFinite(
        cfg.accumulatorMartingaleGrowthRate,
      )
        ? Math.min(5, Math.max(1, cfg.accumulatorMartingaleGrowthRate))
        : 2;
      const effectiveAccumulatorGrowthRate = isAccumulatorRecoveryStake
        ? safeMartingaleGrowthRate
        : safeBaseGrowthRate;
      const newTrade: TradeRecord = {
        id: tradeId,
        contractId: undefined,
        time: nowStr(),
        symbol: cfg.symbol,
        contractType: "ACCU",
        accumulatorLabelRate: effectiveAccumulatorGrowthRate,
        stake,
        payout: null,
        profit: null,
        status: "open",
      };
      setTrades((prev) => {
        const next = [...prev, newTrade];
        return next.length > TRADE_HISTORY_LIMIT
          ? next.slice(-TRADE_HISTORY_LIMIT)
          : next;
      });
      setStatusMsg(
        `Placing ACCU (${effectiveAccumulatorGrowthRate.toFixed(0)}% growth) — $${stake.toFixed(2)} stake…`,
      );
      openContractIdRef.current = tradeId;
      derivApi.buyAccumulatorContract({
        symbol: cfg.symbol,
        amount: stake,
        growthRatePercent: effectiveAccumulatorGrowthRate,
      });
    }
  }

  const startBot = () => {
    closeTrackedOpenContracts();
    runningRef.current = true;
    currentStakeRef.current = config.initialStake;
    netProfitRef.current = 0;
    winsRef.current = 0;
    nextTypeRef.current = "CALL";
    splitRemainingRef.current = 0;
    openTradeIdsRef.current.clear();
    accumulatorSellPendingRef.current.clear();
    accumulatorContractTickCountRef.current.clear();
    accumulatorContractLastSpotTimeRef.current.clear();
    pendingDelayedMartingaleRef.current = false;
    pendingDelayedMartingaleTradesRef.current = 0;
    delayedMartingaleTargetStakeRef.current = null;
    delayedMartingaleSplitRemainingRef.current = 0;
    accumulatorPendingMartingaleRef.current = false;
    accumulatorPendingMartingaleStakeRef.current = null;
    accumulatorPendingMartingaleWinsRef.current = 0;
    accumulatorTickProfitRef.current = 0;
    setTrades([]);
    setTotalProfit(0);
    setWins(0);
    setRunning(true);
    setStatusMsg("Bot started — placing first trade…");
    clearScheduledTrade();
    placeNextTrade();
  };

  function stopBot() {
    runningRef.current = false;
    clearScheduledTrade();
    closeTrackedOpenContracts();
    setRunning(false);
    setStatusMsg((prev) =>
      prev.startsWith("Take Profit") || prev.startsWith("Stop Loss")
        ? prev
        : "",
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-b from-gray-950 via-gray-950 to-gray-900 text-white flex flex-col">
      <Header
        balance={balance}
        currency={currency}
        loginId={loginId}
        connected={connected}
        connecting={connecting}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        connError={connError}
      />

      <Toaster
        richColors
        closeButton
        position="top-right"
        toastOptions={{
          duration: 3500,
          className: "bg-gray-900 text-gray-100 border border-gray-700",
        }}
      />

      <main className="flex-1 min-h-0 overflow-hidden px-3 py-3 sm:px-4 sm:py-4 grid grid-cols-[340px_minmax(0,1fr)] gap-4 max-w-[1440px] mx-auto w-full">
        {/* Left sidebar */}
        <div className="flex flex-col gap-4 h-full min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-hidden">
            <div className="h-full overflow-y-auto pr-1">
              <BotConfigPanel
                config={config}
                onChange={setConfig}
                disabled={running}
              />
            </div>
          </div>
        </div>

        {/* Right content */}
        <div className="h-full min-h-0 overflow-hidden">
          <div className="flex flex-col gap-4 h-full min-h-0">
            <div className="h-[56%] min-h-0">
              <TradeLog
                trades={trades}
                accumulatorDefaultLabelRate={
                  config.accumulatorMartingaleGrowthRate
                }
                totalProfit={totalProfit}
                totalTrades={trades.filter((t) => t.status !== "open").length}
                wins={wins}
                losses={trades.filter((t) => t.status === "lost").length}
                running={running}
                connected={connected}
                onStart={startBot}
                onStop={stopBot}
              />
            </div>
            <div className="flex-1 min-h-0">
              <LastDigitsChart
                digits={lastDigits}
                priceHistory={priceHistory}
                currentPrice={currentPrice}
                strategy={config.strategy}
                predictedDigit={config.digitPrediction}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
