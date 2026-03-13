/**
 * Paper: внутренний учёт, мгновенное исполнение по last price (упрощение MVP).
 * Partial fills симулируются одним полным fill для интеграции; live — через stream.
 */

import type { Broker, PlaceOrderRequest, PlaceOrderResult } from "./types.js";

export class PaperBroker implements Broker {
  private orderId = 1;
  private readonly orders = new Map<string, PlaceOrderResult>();
  private readonly lastPrice = new Map<string, number>();

  setLastPrice(symbol: string, price: number): void {
    this.lastPrice.set(symbol, price);
  }

  placeOrder(req: PlaceOrderRequest): Promise<PlaceOrderResult> {
    const px = Number(req.price ?? this.lastPrice.get(req.symbol) ?? 0);
    if (px <= 0) throw new Error("paper: no price for symbol");
    const id = this.orderId++;
    const r: PlaceOrderResult = {
      clientOrderId: req.clientOrderId,
      exchangeOrderId: id,
      status: "FILLED",
      executedQty: req.quantity,
      origQty: req.quantity,
    };
    this.orders.set(req.clientOrderId, r);
    return Promise.resolve(r);
  }

  getOrder(_symbol: string, clientOrderId: string): Promise<PlaceOrderResult | null> {
    return Promise.resolve(this.orders.get(clientOrderId) ?? null);
  }
}
