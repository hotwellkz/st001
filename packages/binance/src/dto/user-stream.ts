/**
 * DTO: события user data stream (executionReport, outboundAccountPosition, …).
 * Используются для reconciliation, не как «истина» до сверки с REST.
 */

export interface BinanceUserStreamExecutionReportDto {
  e: "executionReport";
  E: number;
  s: string;
  c: string;
  S: string;
  o: string;
  f: string;
  q: string;
  p: string;
  P: string;
  F: string;
  g: number;
  C: string;
  x: string;
  X: string;
  r: string;
  i: number;
  l: string;
  z: string;
  L: string;
  n: string;
  N: string | null;
  T: number;
  t: number;
  I: number;
  w: boolean;
  m: boolean;
  M: boolean;
  O: number;
  Z: string;
  Y: string;
  Q: string;
  W: number;
  V: string;
}

export interface BinanceListenKeyDto {
  listenKey: string;
}
