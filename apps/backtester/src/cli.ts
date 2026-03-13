#!/usr/bin/env node
/**
 * CLI: pnpm --filter @app/backtester backtest [--walkforward] [--out dir]
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { runAlignedBacktest } from "./sim/runner.js";
import { computeMetrics } from "./metrics/metrics.js";
import { metricsToJson, metricsToCsv, equityCurveCsv } from "./export/report.js";
import { defaultSimulationConfig } from "./sim-config.js";
import { syntheticAlignedBars } from "./synthetic-data.js";
import {
  generateWindows,
  runWalkForward,
} from "./walkforward/walkforward.js";

const args = process.argv.slice(2);
const walk = args.includes("--walkforward");
const outIdx = args.indexOf("--out");
const outDir: string = outIdx >= 0 ? (args[outIdx + 1] ?? "backtest-out") : "backtest-out";

const symbols = ["BTCUSDT", "ETHUSDT"];
const { bars, closeTimes } = syntheticAlignedBars({
  symbols,
  numBars: 800,
  seedBase: 50_000,
});

const sim = defaultSimulationConfig();
sim.minNotional = 5;
sim.stepSize = 0.001;
sim.minQty = 0.001;

if (walk) {
  const windows = generateWindows({
    totalBars: closeTimes.length,
    trainBars: 400,
    testBars: 150,
    stepBars: 75,
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
    join(outDir, "walkforward.json"),
    JSON.stringify(
      wf.map((w) => ({
        test: [w.window.testStart, w.window.testEnd],
        totalReturnPct: w.metrics.totalReturnFrac * 100,
        trades: w.metrics.numRoundTrips,
      })),
      null,
      2
    )
  );
  console.log("Walk-forward windows:", wf.length, "→", join(outDir, "walkforward.json"));
} else {
  const result = runAlignedBacktest({ symbols, bars, closeTimes, simConfig: sim });
  const metrics = computeMetrics(sim.initialCashQuote, result.equityCurve, result.trades);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "report.json"), metricsToJson(metrics, result));
  writeFileSync(join(outDir, "metrics.csv"), metricsToCsv(metrics));
  writeFileSync(join(outDir, "equity.csv"), equityCurveCsv(metrics.equityCurve));
  console.log("Backtest done →", outDir);
  console.log(
    "Return %:",
    (metrics.totalReturnFrac * 100).toFixed(2),
    "MaxDD %:",
    (metrics.maxDrawdownFrac * 100).toFixed(2),
    "Trades:",
    metrics.numRoundTrips
  );
}
