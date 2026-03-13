/**
 * Портфель: cash + позиции long. Equity = cash + mark-to-close последнего обработанного бара.
 */

export interface Position {
  symbol: string;
  qty: number;
  avgEntry: number;
  stopPrice: number;
  riskFrac: number;
  entryBarIndex: number;
}

export class PortfolioSimulator {
  cash: number;
  positions = new Map<string, Position>();
  readonly initialCash: number;

  constructor(initialCash: number) {
    this.cash = initialCash;
    this.initialCash = initialCash;
  }

  equity(markPrices: Record<string, number>): number {
    let eq = this.cash;
    for (const [sym, p] of this.positions) {
      const px = markPrices[sym] ?? p.avgEntry;
      eq += p.qty * px;
    }
    return eq;
  }

  openLong(
    symbol: string,
    qty: number,
    fillPrice: number,
    feeRate: number,
    stopPrice: number,
    riskFrac: number,
    entryBarIndex: number
  ): void {
    const notional = qty * fillPrice;
    const fee = notional * feeRate;
    this.cash -= notional + fee;
    this.positions.set(symbol, {
      symbol,
      qty,
      avgEntry: fillPrice,
      stopPrice,
      riskFrac,
      entryBarIndex,
    });
  }

  closeLong(symbol: string, qty: number, fillPrice: number, feeRate: number): number {
    const p = this.positions.get(symbol);
    if (!p || p.qty <= 0) return 0;
    const q = Math.min(qty, p.qty);
    const notional = q * fillPrice;
    const fee = notional * feeRate;
    this.cash += notional - fee;
    const pnl = (fillPrice - p.avgEntry) * q - fee - (p.avgEntry * q * feeRate);
    if (q >= p.qty - 1e-12) this.positions.delete(symbol);
    else this.positions.set(symbol, { ...p, qty: p.qty - q });
    return pnl;
  }

  openPositionsRisk(): { riskFrac: number }[] {
    return [...this.positions.values()].map((p) => ({ riskFrac: p.riskFrac }));
  }
}
