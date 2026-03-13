/**
 * Валидация окружения при старте процесса. Секреты не логируются.
 */

import { z } from "zod";

const baseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  GCP_PROJECT_ID: z.string().min(1).optional(),
});

const apiEnvSchema = baseEnvSchema.extend({
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  API_HOST: z.string().default("0.0.0.0"),
});

const engineEnvSchema = baseEnvSchema.extend({
  ENGINE_INSTANCE_ID: z.string().min(1).optional(),
  /** Только server-side (engine/Cloud Run). Пусто в api/web. */
  BINANCE_BASE_URL: z.string().url().default("https://api.binance.com"),
  BINANCE_API_KEY: z.string().optional(),
  BINANCE_API_SECRET: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_DEFAULT_CHAT_ID: z.string().optional(),
  /** paper | live — live только при LIVE_TRADING_ENABLED=true */
  ENGINE_TRADING_MODE: z.enum(["paper", "live"]).default("paper"),
  LIVE_TRADING_ENABLED: z
    .string()
    .default("false")
    .transform((v) => v === "true" || v === "1"),
  ENGINE_POLL_INTERVAL_MS: z.coerce.number().default(60_000),
  ENGINE_USER_ID: z.string().default("system"),
});

export type BaseEnv = z.infer<typeof baseEnvSchema>;
export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type EngineEnv = z.infer<typeof engineEnvSchema>;

export function loadBaseEnv(env: NodeJS.ProcessEnv = process.env): BaseEnv {
  return baseEnvSchema.parse(env);
}

export function loadApiEnv(env: NodeJS.ProcessEnv = process.env): ApiEnv {
  return apiEnvSchema.parse(env);
}

export function loadEngineEnv(env: NodeJS.ProcessEnv = process.env): EngineEnv {
  return engineEnvSchema.parse(env);
}

/**
 * Явная загрузка секретов для торгового движка. Не вызывать из web.
 */
export function requireBinanceCredentials(env: EngineEnv): {
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
} {
  const apiKey = env.BINANCE_API_KEY;
  const apiSecret = env.BINANCE_API_SECRET;
  if (!apiKey?.length || !apiSecret?.length) {
    throw new Error(
      "BINANCE_API_KEY and BINANCE_API_SECRET required for signed REST / user stream"
    );
  }
  return { apiKey, apiSecret, baseUrl: env.BINANCE_BASE_URL };
}
