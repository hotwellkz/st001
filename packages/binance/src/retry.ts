/**
 * Retry с exponential backoff + jitter. Идемпотентные GET и безопасные повторы.
 */

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryOnStatus?: (status: number) => boolean;
}

const defaultRetryOnStatus = (s: number) => s === 429 || s >= 500;

export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 5;
  const baseDelayMs = options.baseDelayMs ?? 500;
  const maxDelayMs = options.maxDelayMs ?? 15_000;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (e) {
      lastErr = e;
      if (attempt >= maxAttempts) break;
      const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1) + Math.random() * 250);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

export interface FetchRetryResult {
  response: Response;
  bodyText: string;
}

/**
 * fetch + retry по статусу; тело читается один раз.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit | undefined,
  options: Partial<RetryOptions> = {}
): Promise<FetchRetryResult> {
  const shouldRetry = options.retryOnStatus ?? defaultRetryOnStatus;
  return withRetry(async () => {
    const response = await fetch(url, init);
    const bodyText = await response.text();
    if (!response.ok && shouldRetry(response.status)) {
      throw new Error(`HTTP ${String(response.status)}: ${bodyText.slice(0, 200)}`);
    }
    return { response, bodyText };
  }, options);
}
