/** DTO: поток @kline_4h и combined */

export interface BinanceWsKlineDto {
  e: "kline";
  E: number;
  s: string;
  k: {
    t: number;
    T: number;
    s: string;
    i: string;
    f: number;
    L: number;
    o: string;
    c: string;
    h: string;
    l: string;
    v: string;
    n: number;
    x: boolean;
    q: string;
    V: string;
    Q: string;
    B: string;
  };
}

export interface BinanceWsStreamEnvelopeDto {
  stream?: string;
  data?: BinanceWsKlineDto | Record<string, unknown>;
}
