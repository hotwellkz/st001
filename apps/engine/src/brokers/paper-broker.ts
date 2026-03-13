/**
 * Paper: внутренний учёт, мгновенное исполнение по last price.
 * Опционально — запись в Firestore после каждого fill.
 */

import type { Broker, PlaceOrderRequest, PlaceOrderResult } from "./types.js";

export type PaperPersistHook = (
  req: PlaceOrderRequest,
  result: PlaceOrderResult,
  lastPrice: number
) => Promise<void>;

export class PaperBroker implements Broker {
  private orderId = 1;
  private readonly orders = new Map<string, PlaceOrderResult>();
  private readonly lastPrice = new Map<string, number>();
  private readonly onPersist: PaperPersistHook | undefined;

  constructor(opts?: { onPersist?: PaperPersistHook }) {
    this.onPersist = opts?.onPersist;
  }

  setLastPrice(symbol: string, price: number): void {
    this.lastPrice.set(symbol, price);
  }

  async placeOrder(req: PlaceOrderRequest): Promise<PlaceOrderResult> {
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
    /* Persist до записи в память: при ошибке Firestore пайплайн откатится, нет «тихого» рассинхрона. */
    if (this.onPersist) await this.onPersist(req, r, px);
    this.orders.set(req.clientOrderId, r);
    return r;
  }

  getOrder(_symbol: string, clientOrderId: string): Promise<PlaceOrderResult | null> {
    return Promise.resolve(this.orders.get(clientOrderId) ?? null);
  }

  /** После рестарта — восстановить из Firestore, чтобы getOrder/reconcile работали. */
  seedFromFirestoreOrder(doc: {
    clientOrderId: string;
    exchangeOrderId?: number | undefined;
    executedQty: string;
    quantity: string;
  }): void {
    const id = doc.exchangeOrderId != null ? doc.exchangeOrderId : this.orderId++;
    if (id >= this.orderId) this.orderId = id + 1;
    this.orders.set(doc.clientOrderId, {
      clientOrderId: doc.clientOrderId,
      exchangeOrderId: id,
      status: "FILLED",
      executedQty: doc.executedQty,
      origQty: doc.quantity,
    });
  }
}
