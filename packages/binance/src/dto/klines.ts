/** DTO: одна свеча klines REST — массив примитивов */

export type BinanceKlineRowDto = [
  number, // open time
  string, // open
  string, // high
  string, // low
  string, // close
  string, // volume
  number, // close time
  string, // quote volume
  number, // trades
  string, // taker buy base
  string, // taker buy quote
  string, // ignore
];
