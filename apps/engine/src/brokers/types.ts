/**
 * Абстракция исполнения ордеров. Live/paper за флагами.
 */

export interface PlaceOrderRequest {
  symbol: string;
  side: "BUY" | "SELL";
  quantity: string;
  price?: string;
  clientOrderId: string;
  type: "MARKET" | "LIMIT";
}

export interface PlaceOrderResult {
  clientOrderId: string;
  exchangeOrderId: number;
  status: string;
  executedQty: string;
  origQty: string;
}

export interface Broker {
  placeOrder(req: PlaceOrderRequest): Promise<PlaceOrderResult>;
  getOrder(symbol: string, clientOrderId: string): Promise<PlaceOrderResult | null>;
}
