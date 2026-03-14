/** Один цикл: Binance klines + pipeline (memory idempotency/bar). */
import { loadEngineEnv } from "@pkg/config";
import { createLogger } from "@pkg/logger";
import { StaticUniverseService } from "../src/universe/universe-service.js";
import { PositionManager } from "../src/position-manager.js";
import { PaperBroker } from "../src/brokers/paper-broker.js";
import { MemoryBarProcessedStore } from "../src/state/bar-processed-store.js";
import { runEngineCycle } from "../src/runner.js";

const env = loadEngineEnv();
const log = createLogger({ name: "paper-smoke", level: "info" });
const universe = new StaticUniverseService(["BTCUSDT"]);
const idem = new Set<string>();

await runEngineCycle({
  env,
  log,
  universe,
  barStore: new MemoryBarProcessedStore(),
  positions: new PositionManager(),
  broker: new PaperBroker(),
  idempotencyTryReserve: async (k) => (!idem.has(k) && (idem.add(k), true)) as Promise<boolean>,
  idempotencyComplete: async () => {},
  telegram: null,
  equityQuote: 100_000,
  tickSize: 0.01,
  stepSize: 0.00001,
  minQty: 0.00001,
  maxQty: 9000,
  minNotional: 5,
});
console.log("paper-smoke-once: OK (Binance + pipeline one cycle)");
