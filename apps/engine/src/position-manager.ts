/**
 * Состояние позиций в памяти + переходы. Восстановление: из storage при старте (MVP — пусто).
 */

export type PositionState = "flat" | "open" | "closing";

export interface ManagedPosition {
  symbol: string;
  state: PositionState;
  qty: number;
  avgEntry: number;
  stopPrice: number;
  clientOrderIdOpen?: string;
}

export class PositionManager {
  private readonly bySymbol = new Map<string, ManagedPosition>();

  get(symbol: string): ManagedPosition | undefined {
    return this.bySymbol.get(symbol);
  }

  openLong(p: Omit<ManagedPosition, "state">): void {
    this.bySymbol.set(p.symbol, { ...p, state: "open" });
  }

  close(symbol: string): void {
    const x = this.bySymbol.get(symbol);
    if (x) this.bySymbol.set(symbol, { ...x, state: "flat", qty: 0 });
  }

  updateStop(symbol: string, stop: number): void {
    const x = this.bySymbol.get(symbol);
    if (x && x.state === "open") this.bySymbol.set(symbol, { ...x, stopPrice: stop });
  }

  /** Partial fill: увеличить qty и пересчитать avg */
  addFill(symbol: string, qtyDelta: number, price: number): void {
    const x = this.bySymbol.get(symbol);
    if (!x || x.state !== "open") return;
    const newQty = x.qty + qtyDelta;
    const avg = newQty > 0 ? (x.avgEntry * x.qty + price * qtyDelta) / newQty : x.avgEntry;
    this.bySymbol.set(symbol, { ...x, qty: newQty, avgEntry: avg });
  }
}
