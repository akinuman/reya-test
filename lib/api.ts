import { REST_API_URL } from "./constants";
import type { OHLCV, Timeframe } from "./types";

interface CandleHistoryResponse {
  t: number[];
  o: string[];
  h: string[];
  l: string[];
  c: string[];
}

/**
 * Fetch historical candles from the Reya REST API.
 * Returns up to 200 candles sorted ascending by time.
 */
export async function fetchHistoricalCandles(
  symbol: string,
  resolution: Timeframe,
  endTime?: number,
): Promise<OHLCV[]> {
  const end = endTime ?? Date.now();
  const url = `${REST_API_URL}/candleHistory/${symbol}/${resolution}?endTime=${end}`;

  const resp = await fetch(url);

  if (!resp.ok) {
    throw new Error(
      `Failed to fetch candles: ${resp.status} ${resp.statusText}`,
    );
  }

  const data: CandleHistoryResponse = await resp.json();

  if (!data.t || data.t.length === 0) {
    return [];
  }

  // Map parallel arrays into OHLCV objects
  const candles: OHLCV[] = data.t.map((time, i) => ({
    time,
    open: parseFloat(data.o[i]),
    high: parseFloat(data.h[i]),
    low: parseFloat(data.l[i]),
    close: parseFloat(data.c[i]),
    volume: 0, // REST API doesn't return volume
  }));

  // Sort ascending by time (API returns descending)
  candles.sort((a, b) => a.time - b.time);

  return candles;
}
