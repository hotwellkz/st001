import { loadEngineEnv } from "@pkg/config";
import { createLogger } from "@pkg/logger";
import { registerGracefulShutdown } from "@pkg/shared";
import {
  getServerFirestore,
  OrdersRepository,
  FillsRepository,
  PositionsRepository,
  EngineStateRepository,
  IdempotencyRepository,
  LogsRepository,
} from "@pkg/storage";
import { PaperBroker } from "./brokers/paper-broker.js";
import { LiveBrokerStub } from "./brokers/live-broker-stub.js";
import { MemoryBarProcessedStore } from "./state/bar-processed-store.js";
import { FirestoreBarProcessedStore } from "./state/firestore-bar-store.js";
import { StaticUniverseService } from "./universe/universe-service.js";
import { PositionManager } from "./position-manager.js";
import { runEngineCycle } from "./runner.js";
import { TelegramNotifier } from "@pkg/notifications";
import { persistPaperPlaceOrder } from "./persistence/paper-firestore.js";

const env = loadEngineEnv();
const log = createLogger({ name: "engine", level: env.LOG_LEVEL });
const instanceId = env.ENGINE_INSTANCE_ID ?? "default";

const universe = new StaticUniverseService(
  (process.env["ENGINE_UNIVERSE"] ?? "BTCUSDT,ETHUSDT").split(",").map((s) => s.trim())
);

async function bootstrap(): Promise<{
  barStore: MemoryBarProcessedStore | FirestoreBarProcessedStore;
  positions: PositionManager;
  broker: PaperBroker | InstanceType<typeof LiveBrokerStub>;
  idempotencyTryReserve: (key: string) => Promise<boolean>;
  idempotencyComplete: (key: string) => Promise<void>;
  storeEmergencyHalt: boolean;
  fillsRepo: FillsRepository | undefined;
  renewLeader: (() => Promise<void>) | undefined;
  leaderAcquired: boolean;
  engineState: EngineStateRepository | undefined;
}> {
  const positions = new PositionManager();

  if (env.ENGINE_PERSISTENCE !== "firestore") {
    const barStore = new MemoryBarProcessedStore();
    const idem = new Set<string>();
    const broker = new PaperBroker();
    return {
      barStore,
      positions,
      broker,
      idempotencyTryReserve: async (key: string) => {
        if (idem.has(key)) return false;
        idem.add(key);
        return true;
      },
      idempotencyComplete: async () => {},
      storeEmergencyHalt: false,
      fillsRepo: undefined,
      renewLeader: undefined,
      leaderAcquired: true,
      engineState: undefined,
    };
  }

  const db = getServerFirestore();
  const engineState = new EngineStateRepository(db);
  const idemRepo = new IdempotencyRepository(db);
  const ordersRepo = new OrdersRepository(db);
  const fillsRepo = new FillsRepository(db);
  const positionsRepo = new PositionsRepository(db);
  const logsRepo = new LogsRepository(db);

  const holderId = `${instanceId}-${String(process.pid)}`;
  const acquired = await engineState.tryAcquireLeader(instanceId, holderId, env.ENGINE_LEADER_LEASE_MS);
  if (!acquired) {
    log.warn(
      { instanceId },
      "leader lease held — engine idle (no bar/idempotency/order writes); поднимите один инстанс или дождитесь истечения lease"
    );
  }

  const renewLeader = async () => {
    if (acquired) await engineState.renewLeader(instanceId, env.ENGINE_LEADER_LEASE_MS);
  };

  const stateDoc = await engineState.get(instanceId);
  const storeEmergencyHaltFirestore = stateDoc?.emergencyHalt === true;

  const barStore = new FirestoreBarProcessedStore(instanceId, engineState);
  await barStore.hydrateFromEngineState();

  const paperPersist = {
    userId: env.ENGINE_USER_ID,
    orders: ordersRepo,
    fills: fillsRepo,
    positions: positionsRepo,
    logs: logsRepo,
  };

  const broker = new PaperBroker({
    onPersist: async (req, result, lastPrice) => {
      await persistPaperPlaceOrder(paperPersist, req, result, lastPrice);
    },
  });

  const open = await positionsRepo.listOpenPaperPositions(env.ENGINE_USER_ID);
  for (const row of open) {
    const qty = Number(row.quantity);
    const avg = Number(row.avgEntryPrice ?? 0);
    broker.setLastPrice(row.symbol, avg || 1);
    const cid = row.clientOrderIdOpen;
    if (cid) {
      const od = await ordersRepo.get(cid);
      if (od)
        broker.seedFromFirestoreOrder({
          clientOrderId: od.clientOrderId,
          exchangeOrderId: od.exchangeOrderId,
          executedQty: od.executedQty,
          quantity: od.quantity,
        });
    }
    const openPayload: Parameters<PositionManager["openLong"]>[0] = {
      symbol: row.symbol,
      qty,
      avgEntry: avg,
      stopPrice: avg * 0.97,
    };
    if (cid !== undefined) openPayload.clientOrderIdOpen = cid;
    positions.openLong(openPayload);
  }

  return {
    barStore,
    positions,
    broker,
    idempotencyTryReserve: (key) => idemRepo.tryReserve(key, { instanceId }),
    idempotencyComplete: (key) => idemRepo.complete(key),
    storeEmergencyHalt: storeEmergencyHaltFirestore,
    fillsRepo,
    renewLeader: acquired ? renewLeader : undefined,
    leaderAcquired: acquired,
    engineState,
  };
}

let timer: ReturnType<typeof setInterval> | null = null;
let leaderTimer: ReturnType<typeof setInterval> | null = null;

async function mainAsync(): Promise<void> {
  const ctx = await bootstrap();

  const broker =
    env.ENGINE_TRADING_MODE === "live" && env.LIVE_TRADING_ENABLED
      ? new LiveBrokerStub(env)
      : ctx.broker;
  if (env.ENGINE_TRADING_MODE === "live" && env.LIVE_TRADING_ENABLED) {
    log.warn("live stub active — replace LiveBrokerStub with REST broker");
  }

  const tg =
    env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_DEFAULT_CHAT_ID
      ? new TelegramNotifier({
          botToken: env.TELEGRAM_BOT_TOKEN,
          defaultChatId: env.TELEGRAM_DEFAULT_CHAT_ID,
        })
      : null;

  async function tick(): Promise<void> {
    if (env.ENGINE_PERSISTENCE === "firestore" && !ctx.leaderAcquired) return;
    if (ctx.engineState) {
      const doc = await ctx.engineState.get(instanceId);
      if (doc?.emergencyHalt === true) {
        log.warn("emergency halt: engineState");
        return;
      }
    }
    await runEngineCycle({
      env,
      log,
      universe,
      barStore: ctx.barStore,
      positions: ctx.positions,
      broker,
      idempotencyTryReserve: ctx.idempotencyTryReserve,
      idempotencyComplete: ctx.idempotencyComplete,
      telegram: tg,
      storeEmergencyHalt: false,
      equityQuote: Number(process.env["PAPER_EQUITY"] ?? "100000"),
      tickSize: 0.01,
      stepSize: 0.00001,
      minQty: 0.00001,
      maxQty: 9000,
      minNotional: 5,
      userId: env.ENGINE_USER_ID,
      ...(ctx.fillsRepo != null ? { fillsRepo: ctx.fillsRepo } : {}),
    });
  }

  log.info(
    {
      instanceId,
      mode: env.ENGINE_TRADING_MODE,
      liveEnabled: env.LIVE_TRADING_ENABLED,
      persistence: env.ENGINE_PERSISTENCE,
    },
    "engine runner started"
  );

  if (ctx.renewLeader && env.ENGINE_LEADER_RENEW_MS > 0) {
    leaderTimer = setInterval(() => void ctx.renewLeader!(), env.ENGINE_LEADER_RENEW_MS);
  }

  void tick();
  timer = setInterval(() => void tick(), env.ENGINE_POLL_INTERVAL_MS);

  registerGracefulShutdown(
    [
      () => {
        if (timer) clearInterval(timer);
        if (leaderTimer) clearInterval(leaderTimer);
        log.info("engine draining");
      },
    ],
    {
      onSignal: (signal) => {
        log.info({ signal }, "shutdown requested");
      },
    }
  );
}

mainAsync().catch((e) => {
  log.fatal({ err: e }, "engine bootstrap failed");
  process.exit(1);
});
