import Fastify from "fastify";
import { loadApiEnv } from "@pkg/config";
import { createLogger } from "@pkg/logger";
import { registerGracefulShutdown } from "@pkg/shared";

const env = loadApiEnv();
const log = createLogger({ name: "api", level: env.LOG_LEVEL });

const app = Fastify({ logger: false });

app.get("/health", async (_request, reply) => {
  const body = {
    status: "ok" as const,
    service: "api",
    timestampIso: new Date().toISOString(),
  };
  return reply.send(body);
});

async function main(): Promise<void> {
  await app.listen({ host: env.API_HOST, port: env.API_PORT });
  log.info({ host: env.API_HOST, port: env.API_PORT }, "api listening");

  registerGracefulShutdown(
    [
      async () => {
        log.info("closing http server");
        await app.close();
      },
    ],
    {
      onSignal: (signal) => {
        log.info({ signal }, "shutdown requested");
      },
    }
  );
}

main().catch((err: unknown) => {
  log.error({ err }, "fatal");
  process.exit(1);
});
