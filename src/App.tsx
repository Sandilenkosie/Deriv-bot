import { useCallback, useEffect, useRef, useState } from "react";
import "./index.css";
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

  useEffect(() => {
    configRef.current = config;
  }, [config]);

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

  // Re-subscribe ticks when the symbol changes
  useEffect(() => {
    if (!connected) return;
    if (subscribedSymbolRef.current === config.symbol) return;
    if (subscribedSymbolRef.current) {
      derivApi.unsubscribeTicks(subscribedSymbolRef.current);
    }
    setLastDigits([]);
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
        setStatusMsg(`Error: ${errMsg}`);
        openContractIdRef.current = null;
        setTimeout(() => {
          if (runningRef.current) placeNextTrade();
        }, 2000);
        return;
      }
      const buy = msg.buy as Record<string, unknown>;
      const contractId = String(buy?.contract_id ?? "");
      const tempId = openContractIdRef.current;
      if (!contractId) {
        setStatusMsg("Error: contract id missing from buy response.");
        openContractIdRef.current = null;
        setTrades((prev) => prev.filter((t) => t.id !== tempId));
        if (runningRef.current) {
          setTimeout(() => {
            if (runningRef.current) placeNextTrade();
          }, 2000);
        }
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

      const isSettled = Number(poc.is_sold) === 1 || poc.status === "sold";
      if (!isSettled) return;

      const profit = Number(poc.profit ?? 0);
      const won = profit > 0;
      const stake = currentStakeRef.current;

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

      const cfg = configRef.current;

      if (won) {
        winsRef.current += 1;
        setWins(winsRef.current);
        if (pendingDelayedMartingaleRef.current) {
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
          const shouldDelayMartingale =
            cfg.strategy === "DIGITS_DIFFER" &&
            (cfg.holdStakeUntilLowDigitRate || cfg.holdStakeUntilTradeCount) &&
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
                setTimeout(() => {
                  if (runningRef.current) placeNextTrade();
                }, 500);
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
      derivApi.unsubscribeOpenContract(contractId);

      if (cfg.takeProfit > 0 && netProfitRef.current >= cfg.takeProfit) {
        setStatusMsg(
          `Take Profit reached: +${netProfitRef.current.toFixed(2)}`,
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
        setTimeout(() => {
          if (runningRef.current) placeNextTrade();
        }, 500);
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
    derivApi.disconnect();
    setConnected(false);
    setBalance(null);
    setLoginId("");
    setStatusMsg("");
    setLastDigits([]);
    setCurrentPrice("");
    lastDigitsRef.current = [];
    openTradeIdsRef.current.clear();
    pendingDelayedMartingaleRef.current = false;
    pendingDelayedMartingaleTradesRef.current = 0;
    delayedMartingaleTargetStakeRef.current = null;
    delayedMartingaleSplitRemainingRef.current = 0;
    subscribedSymbolRef.current = null;
  };

  // ─── Bot logic ───────────────────────────────────────────────────────────
  function placeNextTrade() {
    if (!runningRef.current) return;
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
    } else {
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
    }
  }

  const startBot = () => {
    runningRef.current = true;
    currentStakeRef.current = config.initialStake;
    netProfitRef.current = 0;
    winsRef.current = 0;
    nextTypeRef.current = "CALL";
    splitRemainingRef.current = 0;
    openTradeIdsRef.current.clear();
    pendingDelayedMartingaleRef.current = false;
    pendingDelayedMartingaleTradesRef.current = 0;
    delayedMartingaleTargetStakeRef.current = null;
    delayedMartingaleSplitRemainingRef.current = 0;
    setTrades([]);
    setTotalProfit(0);
    setWins(0);
    setRunning(true);
    setStatusMsg("Bot started — placing first trade…");
    placeNextTrade();
  };

  function stopBot() {
    runningRef.current = false;
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
                totalProfit={totalProfit}
                totalTrades={trades.filter((t) => t.status !== "open").length}
                wins={wins}
                losses={trades.filter((t) => t.status === "lost").length}
                running={running}
                connected={connected}
                onStart={startBot}
                onStop={stopBot}
                statusMessage={statusMsg}
              />
            </div>
            <div className="flex-1 min-h-0">
              <LastDigitsChart
                digits={lastDigits}
                currentPrice={currentPrice}
                predictedDigit={config.digitPrediction}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
