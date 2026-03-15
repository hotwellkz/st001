#!/usr/bin/env node
/**
 * CLI: fetch historical data and/or run backtest.
 *
 * Fetch:  pnpm run backtest -- --fetch [--data-dir backtest-data] [--symbols BTCUSDT,ETHUSDT] [--years 5]
 * Run:    pnpm run backtest -- [--data-dir backtest-data] [--out backtest-out]
 * OOS:    pnpm run backtest -- --oos 0.3 [--data-dir ...] [--out ...]
 * Synthetic (no fetch): pnpm run backtest -- --synthetic [--out backtest-out]
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { runAlignedBacktest } from "./sim/runner.js";
import { computeMetrics } from "./metrics/metrics.js";
import {
  metricsToJson,
  metricsToCsv,
  equityCurveCsv,
  tradesToCsv,
  byYearCsv,
  bySymbolCsv,
  reportMd,
} from "./export/report.js";
import { defaultSimulationConfig } from "./sim-config.js";
import { syntheticAlignedBars } from "./synthetic-data.js";
import {
  fetchAndSaveKlines,
  loadCandlesFromDataDir,
  alignBarsByCloseTime,
} from "./data/binance-fetch.js";
import { generateWindows, runWalkForward, sliceAlignedBars } from "./walkforward/walkforward.js";

const args = process.argv.slice(2);
const getArg = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const hasFlag = (name: string) => args.includes(name);

const dataDir = getArg("--data-dir") ?? "backtest-data";
const outDir = getArg("--out") ?? "backtest-out";
const symbolsArg = getArg("--symbols") ?? "BTCUSDT,ETHUSDT";
const symbols = symbolsArg.split(",").map((s) => s.trim()).filter(Boolean);
const years = Number(getArg("--years") ?? "5");
const oosFrac = getArg("--oos");
const doFetch = hasFlag("--fetch");
const useSynthetic = hasFlag("--synthetic");
const walkForward = hasFlag("--walkforward");
const feeBps = getArg("--fee-bps");
const slippageBps = getArg("--slippage-bps");

async function main(): Promise<void> {
  if (doFetch) {
    const endMs = Date.now();
    const startMs = endMs - years * 365.25 * 24 * 60 * 60 * 1000;
    console.log("Fetching", symbols.join(", "), "4h from Binance,", years, "years...");
    const { bars, closeTimes, firstCloseTime, lastCloseTime } = await fetchAndSaveKlines({
      symbols,
      dataDir,
      startTimeMs: startMs,
      endTimeMs: endMs,
    });
    const { bars: aligned, closeTimes: alignedCt } = alignBarsByCloseTime(bars, symbols);
    console.log(
      "Fetched:",
      alignedCt.length,
      "aligned bars,",
      new Date(firstCloseTime).toISOString(),
      "->",
      new Date(lastCloseTime).toISOString()
    );
    return;
  }

  let bars: Record<string, { openTime: number; closeTime: number; open: number; high: number; low: number; close: number; volume: number; isClosed: boolean }[]>;
  let closeTimes: number[];

  if (useSynthetic) {
    const syn = syntheticAlignedBars({ symbols, numBars: 800, seedBase: 50_000 });
    bars = syn.bars as Record<string, { openTime: number; closeTime: number; open: number; high: number; low: number; close: number; volume: number; isClosed: boolean }[]>;
    closeTimes = syn.closeTimes;
    console.log("Using synthetic data, 800 bars");
  } else {
    const loaded = loadCandlesFromDataDir(dataDir, symbols);
    const aligned = alignBarsByCloseTime(loaded.bars, symbols);
    bars = aligned.bars;
    closeTimes = aligned.closeTimes;
    console.log("Loaded", closeTimes.length, "aligned bars from", dataDir);
  }

  const sim = defaultSimulationConfig();
  sim.minNotional = 5;
  sim.stepSize = 0.001;
  sim.minQty = 0.001;
  if (feeBps != null) {
    const bps = Number(feeBps);
    if (Number.isFinite(bps) && bps >= 0) sim.feeRateTaker = bps / 10_000;
  }
  if (slippageBps != null) {
    const bps = Number(slippageBps);
    if (Number.isFinite(bps) && bps >= 0) {
      sim.slippageBuyFrac = sim.slippageSellFrac = bps / 10_000;
    }
  }

  if (walkForward) {
    const windows = generateWindows({
      totalBars: closeTimes.length,
      trainBars: Math.floor(closeTimes.length * 0.5),
      testBars: Math.floor(closeTimes.length * 0.2),
      stepBars: Math.floor(closeTimes.length * 0.1),
    });
    const wf = runWalkForward({
      symbols,
      bars,
      windows,
      simConfig: sim,
      initialCash: sim.initialCashQuote,
    });
    mkdirSync(outDir, { recursive: true });
    writeFileSync(
      join(outDir, "walkforward-summary.json"),
      JSON.stringify(
        wf.map((w) => ({
          test: [w.window.testStart, w.window.testEnd],
          totalReturnPct: w.metrics.totalReturnFrac * 100,
          maxDrawdownPct: w.metrics.maxDrawdownFrac * 100,
          trades: w.metrics.numRoundTrips,
        })),
        null,
        2
      )
    );
    console.log("Walk-forward done →", join(outDir, "walkforward-summary.json"));
    return;
  }

  if (oosFrac != null) {
    const frac = Math.max(0.1, Math.min(0.5, Number(oosFrac)));
    const splitIdx = Math.floor(closeTimes.length * (1 - frac));
    const train = { bars: {} as typeof bars, closeTimes: closeTimes.slice(0, splitIdx) };
    const test = { bars: {} as typeof bars, closeTimes: closeTimes.slice(splitIdx) };
    for (const sym of symbols) {
      const arr = bars[sym];
      if (arr) {
        train.bars[sym] = arr.slice(0, splitIdx);
        test.bars[sym] = arr.slice(splitIdx);
      }
    }
    const resTrain = runAlignedBacktest({ symbols, bars: train.bars, closeTimes: train.closeTimes, simConfig: sim });
    const resTest = runAlignedBacktest({ symbols, bars: test.bars, closeTimes: test.closeTimes, simConfig: sim });
    const metTrain = computeMetrics(sim.initialCashQuote, resTrain.equityCurve, resTrain.trades);
    const metTest = computeMetrics(sim.initialCashQuote, resTest.equityCurve, resTest.trades);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(
      join(outDir, "oos-comparison.json"),
      JSON.stringify(
        {
          inSample: { bars: splitIdx, totalReturnPct: metTrain.totalReturnFrac * 100, maxDrawdownPct: metTrain.maxDrawdownFrac * 100, trades: metTrain.numRoundTrips },
          outOfSample: { bars: closeTimes.length - splitIdx, totalReturnPct: metTest.totalReturnFrac * 100, maxDrawdownPct: metTest.maxDrawdownFrac * 100, trades: metTest.numRoundTrips },
        },
        null,
        2
      )
    );
    writeFileSync(
      join(outDir, "oos-report.md"),
      [
        "# In-sample vs Out-of-sample",
        "",
        `In-sample: ${splitIdx} bars, Return ${(metTrain.totalReturnFrac * 100).toFixed(2)}%, MaxDD ${(metTrain.maxDrawdownFrac * 100).toFixed(2)}%, Trades ${metTrain.numRoundTrips}`,
        `Out-of-sample: ${closeTimes.length - splitIdx} bars, Return ${(metTest.totalReturnFrac * 100).toFixed(2)}%, MaxDD ${(metTest.maxDrawdownFrac * 100).toFixed(2)}%, Trades ${metTest.numRoundTrips}`,
      ].join("\n")
    );
    console.log("OOS comparison →", join(outDir, "oos-comparison.json"));
    return;
  }

  const result = runAlignedBacktest({ symbols, bars, closeTimes, simConfig: sim });
  const metrics = computeMetrics(sim.initialCashQuote, result.equityCurve, result.trades);

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "summary.json"), metricsToJson(metrics, result));
  writeFileSync(join(outDir, "metrics.csv"), metricsToCsv(metrics));
  writeFileSync(join(outDir, "equity.csv"), equityCurveCsv(metrics.equityCurve));
  writeFileSync(join(outDir, "trades.csv"), tradesToCsv(result.trades));
  writeFileSync(join(outDir, "by-year.csv"), byYearCsv(metrics.byYear));
  writeFileSync(join(outDir, "by-symbol.csv"), bySymbolCsv(metrics.bySymbol));
  writeFileSync(join(outDir, "report.md"), reportMd(metrics, result));

  console.log("Backtest done →", outDir);
  console.log(
    "Return %:",
    (metrics.totalReturnFrac * 100).toFixed(2),
    "MaxDD %:",
    (metrics.maxDrawdownFrac * 100).toFixed(2),
    "Trades:",
    metrics.numRoundTrips,
    "Sharpe:",
    metrics.sharpeFrac != null ? metrics.sharpeFrac.toFixed(2) : "n/a"
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
