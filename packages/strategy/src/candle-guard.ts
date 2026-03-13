/**
 * Защита от двойной обработки одного бара.
 * Race: два воркера — вне домена нужен distributed lock; здесь in-memory/set на процесс.
 */

export class ProcessedCandleGuard {
  private readonly seen = new Set<string>();

  /** @returns true если первый раз для ключа */
  tryMarkProcessed(dedupKey: string): boolean {
    if (this.seen.has(dedupKey)) return false;
    this.seen.add(dedupKey);
    return true;
  }

  has(dedupKey: string): boolean {
    return this.seen.has(dedupKey);
  }
}
