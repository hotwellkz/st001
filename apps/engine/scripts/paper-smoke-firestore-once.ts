/** Один цикл с Firestore bar store + idempotency (нужен GOOGLE_APPLICATION_CREDENTIALS). */
import { loadEngineEnv } from "@pkg/config";
import { createLogger } from "@pkg/logger";
import {
  getServerFirestore,
  FillsRepository,
  EngineStateRepository,
  IdempotencyRepository,
} from "@pkg/storage";
import { StaticUniverseService } from "../src/universe/universe-service.js";
import { PositionManager } from "../src/position-manager.js";
import { PaperBroker } from "../src/brokers/paper-broker.js";
import { FirestoreBarProcessedStore } from "../src/state/firestore-bar-store.js";
import { runEngineCycle } from "../src/runner.js";

const env = loadEngineEnv();
if (env.ENGINE_PERSISTENCE !== "firestore") {
  console.error("ENGINE_PERSISTENCE must be firestore");
  process.exit(1);
}
const log = createLogger({ name: "paper-fs-smoke", level: "info" });
const instanceId = env.ENGINE_INSTANCE_ID ?? "default";
const db = getServerFirestore();
const engineState = new EngineStateRepository(db);
const holderId = `smoke-fs-${Date.now()}`;
const acquired = await engineState.tryAcquireLeader(instanceId, holderId, env.ENGINE_LEADER_LEASE_MS);
console.log("leader acquired:", acquired);
if (!acquired) {
  console.log("skip firestore cycle (lease held) — run again after lease expiry or other INSTANCE_ID");
  process.exit(0);
}
const barStore = new FirestoreBarProcessedStore(instanceId, engineState);
await barStore.hydrateFromEngineState();
const idemRepo = new IdempotencyRepository(db);
const universe = new StaticUniverseService(["BTCUSDT"]);

await runEngineCycle({
  env,
  log,
  universe,
  barStore,
  positions: new PositionManager(),
  broker: new PaperBroker(),
  idempotencyTryReserve: (k) => idemRepo.tryReserve(k, { smokeFs: "1" }),
  idempotencyComplete: (k) => idemRepo.complete(k),
  telegram: null,
  equityQuote: 100_000,
  tickSize: 0.01,
  stepSize: 0.00001,
  minQty: 0.00001,
  maxQty: 9000,
  minNotional: 5,
  fillsRepo: new FillsRepository(db),
  userId: env.ENGINE_USER_ID,
});

const st = await engineState.get(instanceId);
console.log("lastBarCloseTime.BTCUSDT:", st?.lastBarCloseTime?.["BTCUSDT"]);
console.log("paper-smoke-firestore-once: OK");
