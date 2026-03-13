/**
 * Binance Spot REST: публичные и подписанные запросы.
 * Размещение ордера ≠ исполнение — всегда сверять через user stream + GET order.
 */

import { createHmac } from "node:crypto";
import type { BinanceExchangeInfoDto } from "./dto/exchange-info.js";
import type { BinanceKlineRowDto } from "./dto/klines.js";
import type { BinanceOrderResponseDto } from "./dto/order.js";
import type { BinanceListenKeyDto } from "./dto/user-stream.js";
import { fetchWithRetry } from "./retry.js";

export interface BinanceRestClientConfig {
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
  recvWindow?: number;
}

export class BinanceRestClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly recvWindow: number;

  constructor(cfg: BinanceRestClientConfig) {
    this.baseUrl = cfg.baseUrl.replace(/\/$/, "");
    this.apiKey = cfg.apiKey;
    this.apiSecret = cfg.apiSecret;
    this.recvWindow = cfg.recvWindow ?? 5000;
  }

  private sign(query: string): string {
    return createHmac("sha256", this.apiSecret).update(query).digest("hex");
  }

  async publicGet(path: string, params?: Record<string, string>): Promise<Response> {
    const q = params ? new URLSearchParams(params).toString() : "";
    const url = q ? `${this.baseUrl}${path}?${q}` : `${this.baseUrl}${path}`;
    const { response, bodyText } = await fetchWithRetry(url, { method: "GET" });
    return new Response(bodyText, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  private async signedRequest(
    method: "GET" | "POST" | "DELETE",
    path: string,
    params: Record<string, string>
  ): Promise<Response> {
    const timestamp = Date.now().toString();
    const all = { ...params, timestamp, recvWindow: String(this.recvWindow) };
    const query = new URLSearchParams(all).toString();
    const signature = this.sign(query);
    const url = `${this.baseUrl}${path}?${query}&signature=${signature}`;
    const { response, bodyText } = await fetchWithRetry(url, {
      method,
      headers: { "X-MBX-APIKEY": this.apiKey },
    });
    return new Response(bodyText, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  async getExchangeInfo(): Promise<BinanceExchangeInfoDto> {
    const r = await this.publicGet("/api/v3/exchangeInfo");
    if (!r.ok) throw new Error(`exchangeInfo ${String(r.status)}`);
    return (await r.json()) as BinanceExchangeInfoDto;
  }

  async getKlines(
    symbol: string,
    interval: string,
    options?: { limit?: number; startTime?: number; endTime?: number }
  ): Promise<BinanceKlineRowDto[]> {
    const p: Record<string, string> = { symbol, interval };
    if (options?.limit) p["limit"] = String(options.limit);
    if (options?.startTime) p["startTime"] = String(options.startTime);
    if (options?.endTime) p["endTime"] = String(options.endTime);
    const r = await this.publicGet("/api/v3/klines", p);
    if (!r.ok) throw new Error(`klines ${String(r.status)}`);
    return (await r.json()) as BinanceKlineRowDto[];
  }

  /** Listen key: только API key, без подписи (спецификация Binance). */
  async createListenKey(): Promise<string> {
    const url = `${this.baseUrl}/api/v3/userDataStream`;
    const { response, bodyText } = await fetchWithRetry(url, {
      method: "POST",
      headers: { "X-MBX-APIKEY": this.apiKey },
    });
    if (!response.ok) throw new Error(`userDataStream POST ${String(response.status)} ${bodyText}`);
    const j = JSON.parse(bodyText) as BinanceListenKeyDto;
    return j.listenKey;
  }

  async keepAliveListenKey(listenKey: string): Promise<void> {
    const q = new URLSearchParams({ listenKey }).toString();
    const url = `${this.baseUrl}/api/v3/userDataStream?${q}`;
    const { response, bodyText } = await fetchWithRetry(url, {
      method: "PUT",
      headers: { "X-MBX-APIKEY": this.apiKey },
    });
    if (!response.ok) throw new Error(`userDataStream PUT ${String(response.status)} ${bodyText}`);
  }

  /** Сверка: актуальное состояние ордера (никогда не полагаться только на place response) */
  async getOrder(
    symbol: string,
    orderId?: number,
    origClientOrderId?: string
  ): Promise<BinanceOrderResponseDto> {
    const p: Record<string, string> = { symbol };
    if (orderId !== undefined) p["orderId"] = String(orderId);
    if (origClientOrderId) p["origClientOrderId"] = origClientOrderId;
    const r = await this.signedRequest("GET", "/api/v3/order", p);
    if (!r.ok) throw new Error(`getOrder ${String(r.status)} ${await r.text()}`);
    return (await r.json()) as BinanceOrderResponseDto;
  }

  /**
   * Размещение ордера. Ответ — снимок; исполнение подтверждать executionReport + getOrder.
   */
  async placeOrder(params: {
    symbol: string;
    side: "BUY" | "SELL";
    type: string;
    timeInForce?: string;
    quantity?: string;
    quoteOrderQty?: string;
    price?: string;
    newClientOrderId: string;
  }): Promise<BinanceOrderResponseDto> {
    const p: Record<string, string> = {
      symbol: params.symbol,
      side: params.side,
      type: params.type,
      newClientOrderId: params.newClientOrderId,
    };
    if (params.timeInForce) p["timeInForce"] = params.timeInForce;
    if (params.quantity) p["quantity"] = params.quantity;
    if (params.quoteOrderQty) p["quoteOrderQty"] = params.quoteOrderQty;
    if (params.price) p["price"] = params.price;
    const r = await this.signedRequest("POST", "/api/v3/order", p);
    const text = await r.text();
    if (!r.ok) throw new Error(`placeOrder ${String(r.status)} ${text}`);
    return JSON.parse(text) as BinanceOrderResponseDto;
  }
}
