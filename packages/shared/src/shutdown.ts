/**
 * Регистрация корректного завершения: SIGINT/SIGTERM → callbacks по порядку.
 */

export type ShutdownFn = () => void | Promise<void>;

export interface GracefulShutdownOptions {
  timeoutMs?: number;
  onSignal?: (signal: string) => void;
}

export function registerGracefulShutdown(
  callbacks: ShutdownFn[],
  options: GracefulShutdownOptions = {}
): void {
  const timeoutMs = options.timeoutMs ?? 25_000;
  let shuttingDown = false;

  const run = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    options.onSignal?.(signal);

    const timer = setTimeout(() => {
      process.exit(1);
    }, timeoutMs);

    try {
      for (const fn of callbacks) {
        await fn();
      }
    } finally {
      clearTimeout(timer);
    }
    process.exit(0);
  };

  process.once("SIGINT", () => {
    void run("SIGINT");
  });
  process.once("SIGTERM", () => {
    void run("SIGTERM");
  });
}
