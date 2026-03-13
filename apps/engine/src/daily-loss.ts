/**
 * Хуки дневного лимита: сравнение dailyPnlQuote с equity * dailyLossLimitFrac.
 * Вызывать перед новым входом; при срабатывании — halt + алерт.
 */

export interface DailyLossCheckInput {
  equityQuote: number;
  dailyPnlQuote: number;
  dailyLossLimitFrac: number;
}

export function dailyLossBreached(input: DailyLossCheckInput): boolean {
  const limit = -Math.abs(input.equityQuote * input.dailyLossLimitFrac);
  return input.dailyPnlQuote <= limit;
}
