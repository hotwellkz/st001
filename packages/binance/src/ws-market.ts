/**
 * WebSocket рыночные потоки (kline и combined). Reconnect с backoff.
 */

import WebSocket from "ws";
import type { BinanceWsKlineDto, BinanceWsStreamEnvelopeDto } from "./dto/market-ws.js";

export interface MarketStreamOptions {
  wsBaseUrl?: string;
  maxReconnectAttempts?: number;
  baseReconnectMs?: number;
  maxReconnectMs?: number;
}

const DEFAULT_WS = "wss://stream.binance.com:9443";

export type KlineHandler = (msg: BinanceWsKlineDto) => void;

export class BinanceMarketStream {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private attempts = 0;

  constructor(
    private readonly streamPath: string,
    private readonly onKline: KlineHandler,
    private readonly onError: (err: Error) => void,
    private readonly options: MarketStreamOptions = {}
  ) {}

  connect(): void {
    this.closed = false;
    this.connectInternal();
  }

  private connectInternal(): void {
    if (this.closed) return;
    const base = this.options.wsBaseUrl ?? DEFAULT_WS;
    const url = this.streamPath.startsWith("wss://")
      ? this.streamPath
      : `${base}/ws/${this.streamPath}`;

    try {
      this.ws = new WebSocket(url);
    } catch (e) {
      this.scheduleReconnect(e instanceof Error ? e : new Error(String(e)));
      return;
    }

    this.ws.on("open", () => {
      this.attempts = 0;
    });

    this.ws.on("message", (data: WebSocket.RawData) => {
      try {
        const text =
          typeof data === "string" ? data : Buffer.isBuffer(data) ? data.toString("utf8") : "";
        const raw = JSON.parse(text) as BinanceWsStreamEnvelopeDto | BinanceWsKlineDto;
        if ("stream" in raw && raw.data && typeof raw.data === "object" && "e" in raw.data) {
          this.onKline(raw.data as BinanceWsKlineDto);
          return;
        }
        if ("e" in raw && !("stream" in raw)) {
          this.onKline(raw);
        }
      } catch {
        /* ignore malformed */
      }
    });

    this.ws.on("close", () => {
      if (!this.closed) this.scheduleReconnect(new Error("ws closed"));
    });

    this.ws.on("error", (err) => {
      this.onError(err);
    });
  }

  private scheduleReconnect(_err: Error): void {
    if (this.closed) return;
    const max = this.options.maxReconnectAttempts ?? 1_000_000;
    if (this.attempts >= max) {
      this.onError(new Error("market stream max reconnect attempts"));
      return;
    }
    this.attempts++;
    const baseMs = this.options.baseReconnectMs ?? 1000;
    const maxMs = this.options.maxReconnectMs ?? 60_000;
    const delay = Math.min(
      maxMs,
      baseMs * 1.5 ** Math.min(this.attempts, 20) + Math.random() * 500
    );
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectInternal();
    }, delay);
  }

  close(): void {
    this.closed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

/** Путь потока для одной пары, например btcusdt@kline_4h */
export function klineStreamPath(symbolLower: string, interval: string): string {
  return `${symbolLower}@kline_${interval}`;
}
