/**
 * Бары: lastBarCloseTime в engineState + in-memory кэш для быстрого цикла.
 */

import type { EngineStateRepository } from "@pkg/storage";
import type { BarProcessedStore } from "./bar-processed-store.js";

export class FirestoreBarProcessedStore implements BarProcessedStore {
  private readonly cache = new Map<string, number>();

  constructor(
    private readonly instanceId: string,
    private readonly engineState: EngineStateRepository
  ) {}

  /** Вызвать один раз при старте. */
  async hydrateFromEngineState(): Promise<void> {
    const doc = await this.engineState.get(this.instanceId);
    const map = doc?.lastBarCloseTime;
    if (!map) return;
    for (const [sym, t] of Object.entries(map)) {
      if (typeof t === "number") this.cache.set(sym, t);
    }
  }

  getLastCloseTime(symbol: string): Promise<number | undefined> {
    return Promise.resolve(this.cache.get(symbol));
  }

  async markProcessed(symbol: string, closeTime: number): Promise<void> {
    const prev = this.cache.get(symbol) ?? 0;
    if (closeTime > prev) {
      this.cache.set(symbol, closeTime);
      await this.engineState.setLastBarCloseTime(this.instanceId, symbol, closeTime);
    }
  }
}
