/**
 * Доменные события (лог/аудит снаружи). Без Firebase.
 */

export type DomainEvent =
  | {
      type: "signal_detected";
      symbol: string;
      closeTime: number;
      side: "LONG";
      entryRefPrice: number;
      stopPrice: number;
    }
  | {
      type: "position_opened";
      symbol: string;
      closeTime: number;
      qty: number;
      entryPrice: number;
      stopPrice: number;
    }
  | {
      type: "stop_updated";
      symbol: string;
      closeTime: number;
      oldStop: number;
      newStop: number;
    }
  | {
      type: "position_closed";
      symbol: string;
      closeTime: number;
      reason: "exit_signal" | "stop" | "manual";
      price: number;
    }
  | {
      type: "signal_skipped";
      symbol: string;
      closeTime: number;
      reason: string;
    };
