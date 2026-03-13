import { loadEngineEnv } from "@pkg/config";
import { createLogger } from "@pkg/logger";
import { registerGracefulShutdown } from "@pkg/shared";
import { PaperBroker } from "./brokers/paper-broker.js";
import { LiveBrokerStub } from "./brokers/live-broker-stub.js";
import { MemoryBarProcessedStore } from "./state/bar-processed-store.js";
import { StaticUniverseService } from "./universe/universe-service.js";
import { PositionManager } from "./position-manager.js";
import { runEngineCycle } from "./runner.js";
import { TelegramNotifier } from "@pkg/notifications";

const env = loadEngineEnv();
const log = createLogger({ name: "engine", level: env.LOG_LEVEL });

const barStore = new MemoryBarProcessedStore();
const positions = new PositionManager();
const universe = new StaticUniverseService(
  (process.env["ENGINE_UNIVERSE"] ?? "BTCUSDT,ETHUSDT").split(",").map((s) => s.trim())
);

const idem = new Set<string>();
function idempotencyTryReserve(key: string): Promise<boolean> {
  if (idem.has(key)) return Promise.resolve(false);
  idem.add(key);
  return Promise.resolve(true);
}
function idempotencyComplete(_key: string): Promise<void> {
  return Promise.resolve();
}

/** Paper по умолчанию. Live только при LIVE_TRADING_ENABLED + реальный брокер (stub не шлёт ордера). */
const broker =
  env.ENGINE_TRADING_MODE === "live" && env.LIVE_TRADING_ENABLED
    ? new LiveBrokerStub(env)
    : new PaperBroker();
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

let timer: ReturnType<typeof setInterval> | null = null;

async function tick(): Promise<void> {
  await runEngineCycle({
    env,
    log,
    universe,
    barStore,
    positions,
    broker,
    idempotencyTryReserve,
    idempotencyComplete,
    telegram: tg,
    equityQuote: Number(process.env["PAPER_EQUITY"] ?? "100000"),
    tickSize: 0.01,
    stepSize: 0.00001,
    minQty: 0.00001,
    maxQty: 9000,
    minNotional: 5,
  });
}

function main(): void {
  log.info(
    {
      instanceId: env.ENGINE_INSTANCE_ID ?? "default",
      mode: env.ENGINE_TRADING_MODE,
      liveEnabled: env.LIVE_TRADING_ENABLED,
    },
    "engine runner started"
  );

  void tick();
  timer = setInterval(() => void tick(), env.ENGINE_POLL_INTERVAL_MS);

  registerGracefulShutdown(
    [
      () => {
        if (timer) clearInterval(timer);
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

main();
