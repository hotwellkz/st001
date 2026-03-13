/**
 * Допуск символа: только «ликвидные» по флагу из инфраструктуры (домен не ходит в API).
 */

export interface SymbolEligibility {
  symbol: string;
  /** В universe и статус TRADING на бирже — выставляет адаптер */
  isLiquid: boolean;
  inUniverse: boolean;
}

export function isEligibleForEntry(e: SymbolEligibility): boolean {
  return e.inUniverse && e.isLiquid;
}
