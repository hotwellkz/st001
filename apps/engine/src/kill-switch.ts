/**
 * Аварийный стоп: env EMERGENCY_HALT или Firestore emergencyHalt.
 */

import type { Logger } from "@pkg/logger";

export function envEmergencyHalt(): boolean {
  return process.env["EMERGENCY_HALT"] === "true" || process.env["EMERGENCY_HALT"] === "1";
}

export function resolveHalt(params: {
  envHalt: boolean;
  storeHalt?: boolean;
  log: Logger;
}): Promise<boolean> {
  if (params.envHalt) {
    params.log.warn("emergency halt: EMERGENCY_HALT env");
    return Promise.resolve(true);
  }
  if (params.storeHalt) {
    params.log.warn("emergency halt: storage flag");
    return Promise.resolve(true);
  }
  return Promise.resolve(false);
}
