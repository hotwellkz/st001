/**
 * @pkg/logger — единый structured logging (pino) для api/engine/backtester.
 */

import pino from "pino";

export type Logger = pino.Logger;

export interface CreateLoggerOptions {
  name: string;
  level?: string;
}

export function createLogger(options: CreateLoggerOptions): Logger {
  const level = options.level ?? process.env["LOG_LEVEL"] ?? "info";
  return pino({
    name: options.name,
    level,
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    base: { service: options.name },
  });
}
