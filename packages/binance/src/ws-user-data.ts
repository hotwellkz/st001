/**
 * User data stream: listenKey + WS + keepalive. Reconnect получает новый listenKey.
 * События — триггеры reconciliation, не единственный источник истины.
 */

import WebSocket from "ws";
import type { BinanceRestClient } from "./rest-client.js";

export type UserStreamEventHandler = (event: Record<string, unknown>) => void;

export interface UserDataStreamOptions {
  wsBaseUrl?: string;
  keepAliveIntervalMs?: number;
  baseReconnectMs?: number;
  maxReconnectMs?: number;
}

const DEFAULT_WS = "wss://stream.binance.com:9443";

export class BinanceUserDataStream {
  private ws: WebSocket | null = null;
  private keepAlive: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private listenKey: string | null = null;
  private attempts = 0;

  constructor(
    private readonly rest: BinanceRestClient,
    private readonly onEvent: UserStreamEventHandler,
    private readonly onError: (err: Error) => void,
    private readonly options: UserDataStreamOptions = {}
  ) {}

  async start(): Promise<void> {
    this.closed = false;
    await this.connectCycle();
  }

  private async connectCycle(): Promise<void> {
    if (this.closed) return;
    try {
      this.listenKey = await this.rest.createListenKey();
    } catch (e) {
      this.onError(e instanceof Error ? e : new Error(String(e)));
      this.scheduleReconnect();
      return;
    }

    const base = this.options.wsBaseUrl ?? DEFAULT_WS;
    const url = `${base}/ws/${this.listenKey}`;
    this.ws = new WebSocket(url);

    const keepMs = this.options.keepAliveIntervalMs ?? 25 * 60 * 1000;
    this.keepAlive = setInterval(() => {
      if (this.listenKey)
        void this.rest.keepAliveListenKey(this.listenKey).catch((err: unknown) => {
          this.onError(err instanceof Error ? err : new Error(String(err)));
        });
    }, keepMs);

    this.ws.on("open", () => {
      this.attempts = 0;
    });

    this.ws.on("message", (data: WebSocket.RawData) => {
      try {
        const text =
          typeof data === "string" ? data : Buffer.isBuffer(data) ? data.toString("utf8") : "";
        const ev = JSON.parse(text) as Record<string, unknown>;
        this.onEvent(ev);
      } catch {
        /* ignore */
      }
    });

    this.ws.on("close", () => {
      this.clearKeepAlive();
      if (!this.closed) this.scheduleReconnect();
    });

    this.ws.on("error", (err) => {
      this.onError(err);
    });
  }

  private clearKeepAlive(): void {
    if (this.keepAlive) {
      clearInterval(this.keepAlive);
      this.keepAlive = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.closed) return;
    this.clearSocket();
    this.attempts++;
    const baseMs = this.options.baseReconnectMs ?? 2000;
    const maxMs = this.options.maxReconnectMs ?? 60_000;
    const delay = Math.min(
      maxMs,
      baseMs * 1.5 ** Math.min(this.attempts, 15) + Math.random() * 1000
    );
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connectCycle();
    }, delay);
  }

  private clearSocket(): void {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        /* */
      }
      this.ws = null;
    }
  }

  close(): void {
    this.closed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.clearKeepAlive();
    this.clearSocket();
    this.listenKey = null;
  }
}
