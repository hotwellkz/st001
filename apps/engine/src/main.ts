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
const holderId = `${instanceId}-${String(process.pid)}-${String(Math.random()).slice(2, 8)}`;

const universe = new StaticUniverseService(
  (process.env["ENGINE_UNIVERSE"] ?? "BTCUSDT,ETHUSDT").split(",").map((s) => s.trim())
);

async function bootstrap(): Promise<{
  barStore: MemoryBarProcessedStore | FirestoreBarProcessedStore;
  positions: PositionManager;
  broker: PaperBroker | InstanceType<typeof LiveBrokerStub>;
  idempotencyTryReserve: (key: string) => Promise<boolean>;
  idempotencyComplete: (key: string) => Promise<void>;
  fillsRepo: FillsRepository | undefined;
  renewLeader: (() => Promise<void>) | undefined;
  leaderAcquired: boolean;
  engineState: EngineStateRepository | undefined;
  positionsRepo: PositionsRepository | undefined;
  logsRepo: LogsRepository | undefined;
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
      fillsRepo: undefined,
      renewLeader: undefined,
      leaderAcquired: true,
      engineState: undefined,
      positionsRepo: undefined,
      logsRepo: undefined,
    };
  }

  const db = getServerFirestore();
  const engineState = new EngineStateRepository(db);
  const idemRepo = new IdempotencyRepository(db);
  const ordersRepo = new OrdersRepository(db);
  const fillsRepo = new FillsRepository(db);
  const positionsRepo = new PositionsRepository(db);
  const logsRepo = new LogsRepository(db);

  const acquired = await engineState.tryAcquireLeader(instanceId, holderId, env.ENGINE_LEADER_LEASE_MS);
  if (!acquired) {
    log.warn(
      { instanceId },
      "leader lease held — idle (no writes). Один инстанс на ENGINE_INSTANCE_ID или дождитесь lease."
    );
  }

  const renewLeader = async () => {
    const ok = await engineState.renewLeaderIfHolder(instanceId, holderId, env.ENGINE_LEADER_LEASE_MS);
    if (!ok) log.warn({ instanceId }, "leader renew skipped (not holder — possible failover)");
  };

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
    const stop = Number(row.stopPriceQuote);
    const stopPrice = Number.isFinite(stop) && stop > 0 ? stop : avg * 0.97;
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
      stopPrice,
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
    fillsRepo,
    renewLeader: acquired ? renewLeader : undefined,
    leaderAcquired: acquired,
    engineState,
    positionsRepo: acquired ? positionsRepo : undefined,
    logsRepo: acquired ? logsRepo : undefined,
  };
}

let pollTimer: ReturnType<typeof setTimeout> | null = null;
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

  const persistStopPrice =
    ctx.positionsRepo && ctx.leaderAcquired
      ? async (symbol: string, stopPrice: number) => {
          await ctx.positionsRepo!.upsert(env.ENGINE_USER_ID, symbol, {
            userId: env.ENGINE_USER_ID,
            symbol,
            stopPriceQuote: String(stopPrice),
            source: "paper",
          });
        }
      : undefined;

  const persistAuditLog =
    ctx.logsRepo && ctx.leaderAcquired && env.ENGINE_PERSISTENCE === "firestore"
      ? async (message: string, context: Record<string, unknown>) => {
          try {
            await ctx.logsRepo!.append({
              level: "info",
              service: "engine",
              message,
              contextJson: JSON.stringify(context),
            });
          } catch (e) {
            log.warn({ err: e, message }, "persistAuditLog failed");
          }
        }
      : undefined;

  async function tick(): Promise<void> {
    if (env.ENGINE_PERSISTENCE === "firestore") {
      if (!ctx.leaderAcquired) return;
      const still = await ctx.engineState!.isStillLeader(instanceId, holderId);
      if (!still) {
        log.warn("lost leader lease — halting cycles (restart or wait lease)");
        return;
      }
      const doc = await ctx.engineState!.get(instanceId);
      if (doc?.emergencyHalt === true) {
        log.warn("emergency halt: engineState.emergencyHalt");
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
      ...(persistStopPrice != null ? { persistStopPrice } : {}),
      ...(ctx.fillsRepo != null ? { fillsRepo: ctx.fillsRepo } : {}),
      ...(persistAuditLog != null ? { persistAuditLog } : {}),
    });
  }

  function schedulePoll(): void {
    const base = env.ENGINE_POLL_INTERVAL_MS;
    const jitter = base * env.ENGINE_POLL_JITTER_FRAC * (Math.random() * 2 - 1);
    const ms = Math.max(30_000, Math.round(base + jitter));
    pollTimer = setTimeout(() => {
      void tick().finally(schedulePoll);
    }, ms);
  }

  log.info(
    {
      instanceId,
      persistence: env.ENGINE_PERSISTENCE,
      pollMs: env.ENGINE_POLL_INTERVAL_MS,
      leaderLeaseMs: env.ENGINE_LEADER_LEASE_MS,
    },
    "engine runner started"
  );

  if (ctx.renewLeader && env.ENGINE_LEADER_RENEW_MS > 0) {
    leaderTimer = setInterval(() => void ctx.renewLeader!(), env.ENGINE_LEADER_RENEW_MS);
  }

  if (env.ENGINE_PERSISTENCE === "firestore" && !ctx.leaderAcquired) {
    log.warn("non-leader: no polls");
  } else {
    void tick().finally(schedulePoll);
  }

  registerGracefulShutdown(
    [
      () => {
        if (pollTimer) clearTimeout(pollTimer);
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
