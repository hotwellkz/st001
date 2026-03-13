/**
 * DTO: ответы размещения /query order. Placement ≠ execution.
 */

export interface BinanceOrderResponseDto {
  symbol: string;
  orderId: number;
  orderListId: number;
  clientOrderId: string;
  transactTime?: number;
  price: string;
  origQty: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  status: string;
  timeInForce?: string;
  type: string;
  side: string;
  workingTime?: number;
  selfTradePreventionMode?: string;
}
