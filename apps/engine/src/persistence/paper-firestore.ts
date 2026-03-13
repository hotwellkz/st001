/**
 * Запись paper ордеров / fills / позиций / логов в Firestore после PaperBroker.placeOrder.
 */

import type {
  OrdersRepository,
  FillsRepository,
  PositionsRepository,
  LogsRepository,
} from "@pkg/storage";
import type { PlaceOrderRequest, PlaceOrderResult } from "../brokers/types.js";

export interface PaperFirestorePersistence {
  userId: string;
  orders: OrdersRepository;
  fills: FillsRepository;
  positions: PositionsRepository;
  logs: LogsRepository;
}

export async function persistPaperPlaceOrder(
  p: PaperFirestorePersistence,
  req: PlaceOrderRequest,
  result: PlaceOrderResult,
  lastPrice: number
): Promise<void> {
  const userId = p.userId;
  const sym = req.symbol;
  const side = req.side;
  const qty = result.executedQty;
  const quoteQty = String(Number(qty) * lastPrice);

  await p.orders.upsert(result.clientOrderId, {
    userId,
    clientOrderId: result.clientOrderId,
    exchangeOrderId: result.exchangeOrderId,
    symbol: sym,
    side,
    type: req.type,
    status: "filled",
    quantity: req.quantity,
    executedQty: result.executedQty,
    quoteQty,
  });

  await p.fills.appendPaperFill({
    userId,
    orderClientId: result.clientOrderId,
    exchangeOrderId: result.exchangeOrderId,
    symbol: sym,
    tradeId: result.exchangeOrderId,
    price: String(lastPrice),
    qty,
    quoteQty,
    isBuyer: side === "BUY",
  });

  if (side === "BUY") {
    await p.positions.upsert(userId, sym, {
      userId,
      symbol: sym,
      quantity: qty,
      avgEntryPrice: String(lastPrice),
      clientOrderIdOpen: result.clientOrderId,
      source: "paper",
    });
  } else {
    await p.positions.closePaperPosition(userId, sym);
  }

  await p.logs.append({
    level: "info",
    service: "engine",
    message: "paper_fill",
    contextJson: JSON.stringify({
      symbol: sym,
      side,
      clientOrderId: result.clientOrderId,
      qty,
      price: lastPrice,
    }),
  });
}
