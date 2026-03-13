/**
 * Live: без LIVE_TRADING_ENABLED всегда ошибка. С флагом — заглушка до реальной интеграции REST.
 */

import type { EngineEnv } from "@pkg/config";
import type { Broker, PlaceOrderRequest, PlaceOrderResult } from "./types.js";

export class LiveBrokerStub implements Broker {
  constructor(private readonly env: EngineEnv) {}

  placeOrder(_req: PlaceOrderRequest): Promise<PlaceOrderResult> {
    if (!this.env.LIVE_TRADING_ENABLED || this.env.ENGINE_TRADING_MODE !== "live") {
      return Promise.reject(
        new Error(
          "live broker disabled: set LIVE_TRADING_ENABLED=true and ENGINE_TRADING_MODE=live"
        )
      );
    }
    return Promise.reject(
      new Error("LiveBrokerStub: wire BinanceRestClient.placeOrder in next phase")
    );
  }

  getOrder(): Promise<PlaceOrderResult | null> {
    return Promise.resolve(null);
  }
}
