import type { TelegramNotifier } from "@pkg/notifications";
import type { Logger } from "@pkg/logger";

export type TelegramAlertKind =
  | "open"
  | "close"
  | "stop_loss"
  | "reconciliation_mismatch"
  | "error";

export async function alertTelegram(
  tg: TelegramNotifier | null,
  log: Logger,
  kind: TelegramAlertKind,
  body: string
): Promise<void> {
  const title = `[engine] ${kind}`;
  log.info({ kind }, body);
  if (!tg) return;
  try {
    await tg.sendMessage(`${title}\n${body}`);
  } catch (e) {
    log.error({ err: e }, "telegram send failed");
  }
}
