export type DerivMessage = Record<string, unknown>;

type Listener = (msg: DerivMessage) => void;

const WS_URL = "wss://ws.derivws.com/websockets/v3?app_id=1089";

class DerivApiService {
  private ws: WebSocket | null = null;
  private listeners: Set<Listener> = new Set();
  private reqId = 1;

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (event) => {
        try {
          const data: DerivMessage = JSON.parse(event.data as string);
          this.listeners.forEach((fn) => fn(data));
        } catch {
          // ignore parse errors
        }
      };
    });
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }

  send(payload: DerivMessage): number {
    const id = this.reqId++;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ ...payload, req_id: id }));
    }
    return id;
  }

  addListener(fn: Listener) {
    this.listeners.add(fn);
  }

  removeListener(fn: Listener) {
    this.listeners.delete(fn);
  }

  authorize(token: string) {
    return this.send({ authorize: token });
  }

  getBalance() {
    return this.send({ balance: 1, subscribe: 1 });
  }

  subscribeTicks(symbol: string) {
    return this.send({ ticks: symbol, subscribe: 1 });
  }

  unsubscribeTicks(symbol: string) {
    return this.send({ forget_all: "ticks", ticks: symbol });
  }

  buyContract(params: {
    symbol: string;
    contractType: "CALL" | "PUT";
    duration: number;
    durationUnit: string;
    amount: number;
    basis: string;
  }) {
    return this.send({
      buy: 1,
      price: params.amount,
      parameters: {
        contract_type: params.contractType,
        symbol: params.symbol,
        duration: params.duration,
        duration_unit: params.durationUnit,
        amount: params.amount,
        basis: params.basis,
        currency: "USD",
      },
    });
  }

  buyDigitContract(params: {
    symbol: string;
    digit: number;
    duration: number;
    durationUnit: string;
    amount: number;
  }) {
    return this.send({
      buy: 1,
      price: params.amount,
      parameters: {
        contract_type: "DIGITDIFF",
        symbol: params.symbol,
        duration: params.duration,
        duration_unit: params.durationUnit,
        amount: params.amount,
        basis: "stake",
        barrier: String(params.digit),
        currency: "USD",
      },
    });
  }

  buyAccumulatorContract(params: {
    symbol: string;
    amount: number;
    growthRatePercent: number;
  }) {
    const rawRate = Number(params.growthRatePercent);
    const percentRate = rawRate <= 0.05 ? rawRate * 100 : rawRate;
    const normalizedPercent = Math.round(percentRate);
    const clampedPercent = Math.min(5, Math.max(1, normalizedPercent));
    const growthRate = clampedPercent / 100;

    return this.send({
      buy: 1,
      price: params.amount,
      parameters: {
        contract_type: "ACCU",
        symbol: params.symbol,
        amount: params.amount,
        basis: "stake",
        growth_rate: growthRate,
        currency: "USD",
      },
    });
  }

  subscribeOpenContract(contractId: string) {
    return this.send({
      proposal_open_contract: 1,
      contract_id: contractId,
      subscribe: 1,
    });
  }

  sellContract(contractId: string, price = 0) {
    return this.send({
      sell: contractId,
      price,
    });
  }

  unsubscribeOpenContract(contractId: string) {
    return this.send({
      forget_all: "proposal_open_contract",
      contract_id: contractId,
    });
  }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const derivApi = new DerivApiService();
