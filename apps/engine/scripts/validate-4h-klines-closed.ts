/**
 * Проверка логики «последняя закрытая 4h свеча» без полного цикла.
 * Запуск: cd apps/engine && pnpm exec tsx scripts/validate-4h-klines-closed.ts
 *
 * Показывает: последний элемент массива (forming) vs последняя строка с closeTime < now (closed).
 */
import { binanceRestForMarketData } from "@pkg/binance";
import { loadEngineEnv } from "@pkg/config";

const env = loadEngineEnv();
const rest = binanceRestForMarketData(env.BINANCE_BASE_URL);
const symbol = "BTCUSDT";
const rows = await rest.getKlines(symbol, "4h", { limit: 5 });
const now = Date.now();

console.log("now (ms):", now, new Date(now).toISOString());
console.log("rows.length:", rows.length);

const lastRow = rows[rows.length - 1];
if (lastRow) {
  const closeTime = Number(lastRow[6]);
  console.log("\nLast element in array (Binance 'current' candle):");
  console.log("  openTime:", lastRow[0], new Date(Number(lastRow[0])).toISOString());
  console.log("  closeTime:", closeTime, new Date(closeTime).toISOString());
  console.log("  closeTime < now?", closeTime < now, "=> isClosed for array tail:", closeTime < now);
}

let lastClosedIdx = -1;
for (let i = rows.length - 1; i >= 0; i--) {
  const row = rows[i];
  if (row && Number(row[6]) < now) {
    lastClosedIdx = i;
    break;
  }
}
console.log("\nLast closed bar index (last i where row[6] < now):", lastClosedIdx);
if (lastClosedIdx >= 0) {
  const r = rows[lastClosedIdx]!;
  console.log("  openTime:", r[0], new Date(Number(r[0])).toISOString());
  console.log("  closeTime:", r[6], new Date(Number(r[6])).toISOString());
  console.log("  close:", r[4]);
}
console.log("\nConclusion: pipeline must use lastClosedIdx bar, not array[length-1].");
process.exit(0);
