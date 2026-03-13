/**
 * Идемпотентность по бару: не обрабатывать дважды один closeTime.
 * Память + опционально Firestore для рестарта.
 */

export interface BarProcessedStore {
  getLastCloseTime(symbol: string): Promise<number | undefined>;
  markProcessed(symbol: string, closeTime: number): Promise<void>;
}

export class MemoryBarProcessedStore implements BarProcessedStore {
  private readonly map = new Map<string, number>();

  getLastCloseTime(symbol: string): Promise<number | undefined> {
    return Promise.resolve(this.map.get(symbol));
  }

  markProcessed(symbol: string, closeTime: number): Promise<void> {
    const prev = this.map.get(symbol) ?? 0;
    if (closeTime > prev) this.map.set(symbol, closeTime);
    return Promise.resolve();
  }
}
