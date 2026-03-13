/**
 * Telegram Bot API sendMessage. Токен только server-side.
 */

export interface TelegramConfig {
  botToken: string;
  defaultChatId: string;
}

export interface SendTelegramOptions {
  chatId?: string;
  parseMode?: "HTML" | "MarkdownV2";
}

export class TelegramNotifier {
  private readonly baseUrl: string;

  constructor(private readonly cfg: TelegramConfig) {
    this.baseUrl = `https://api.telegram.org/bot${cfg.botToken}`;
  }

  async sendMessage(
    text: string,
    options: SendTelegramOptions = {}
  ): Promise<{ ok: boolean; messageId?: number }> {
    const chatId = options.chatId ?? this.cfg.defaultChatId;
    const url = `${this.baseUrl}/sendMessage`;
    const body = {
      chat_id: chatId,
      text,
      parse_mode: options.parseMode,
    };
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = (await r.json()) as { ok: boolean; result?: { message_id: number } };
    if (!r.ok || !j.ok) {
      throw new Error(`Telegram sendMessage failed: ${String(r.status)} ${JSON.stringify(j)}`);
    }
    const out: { ok: boolean; messageId?: number } = { ok: true };
    if (j.result?.message_id !== undefined) out.messageId = j.result.message_id;
    return out;
  }
}
