"use client";

import { fetchHistoricalCandles } from "@/lib/api";
import { TIMEFRAME_SECONDS } from "@/lib/constants";
import type {
  MarketSummary,
  OHLCV,
  Price,
  Timeframe,
  WSChannelMessage,
} from "@/lib/types";
import { useCallback, useEffect, useRef, useState } from "react";

interface UseMarketDataParams {
  symbol: string;
  timeframe: Timeframe;
  subscribe: (
    channel: string,
    handler: (msg: WSChannelMessage) => void,
  ) => () => void;
}

interface MarketDataState {
  currentPrice: number | null;
  priceChange24h: number | null;
  volume24h: string | null;
  longOiQty: string | null;
  shortOiQty: string | null;
  fundingRate: string | null;
  oraclePrice: string | null;
  poolPrice: string | null;
  candles: OHLCV[];
  isLoadingHistory: boolean;
}

export function useMarketData({
  symbol,
  timeframe,
  subscribe,
}: UseMarketDataParams): MarketDataState & {
  loadMoreCandles: () => Promise<void>;
  hasMoreHistory: boolean;
} {
  const [state, setState] = useState<MarketDataState>({
    currentPrice: null,
    priceChange24h: null,
    volume24h: null,
    longOiQty: null,
    shortOiQty: null,
    fundingRate: null,
    oraclePrice: null,
    poolPrice: null,
    candles: [],
    isLoadingHistory: true,
  });

  const candlesRef = useRef<Map<number, OHLCV>>(new Map());
  const timeframeRef = useRef(timeframe);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isLoadingMoreRef = useRef(false);
  const hasMoreHistoryRef = useRef(true);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);

  const getCandleTime = useCallback(
    (timestampMs: number) => {
      const seconds = Math.floor(timestampMs / 1000);
      const interval = TIMEFRAME_SECONDS[timeframe];
      return Math.floor(seconds / interval) * interval;
    },
    [timeframe],
  );

  // Fetch historical candles on mount and when symbol/timeframe changes
  useEffect(() => {
    // Cancel any in-flight request
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Clear existing candles on timeframe/symbol change
    candlesRef.current.clear();
    timeframeRef.current = timeframe;
    hasMoreHistoryRef.current = true;
    setHasMoreHistory(true);

    queueMicrotask(() => {
      setState((prev) => ({ ...prev, candles: [], isLoadingHistory: true }));
    });

    fetchHistoricalCandles(symbol, timeframe)
      .then((historicalCandles) => {
        if (controller.signal.aborted) return;

        // Populate the candles ref with historical data
        for (const candle of historicalCandles) {
          candlesRef.current.set(candle.time, candle);
        }

        // If we got fewer than 200, there's no more history
        if (historicalCandles.length < 200) {
          hasMoreHistoryRef.current = false;
          setHasMoreHistory(false);
        }

        const sorted = Array.from(candlesRef.current.values()).sort(
          (a, b) => a.time - b.time,
        );

        setState((prev) => ({
          ...prev,
          candles: sorted,
          isLoadingHistory: false,
        }));
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error("Failed to fetch historical candles:", err);
        setState((prev) => ({ ...prev, isLoadingHistory: false }));
      });

    return () => {
      controller.abort();
    };
  }, [symbol, timeframe]);

  // Load more historical candles (infinite scroll)
  const loadMoreCandles = useCallback(async () => {
    if (isLoadingMoreRef.current || !hasMoreHistoryRef.current) return;
    isLoadingMoreRef.current = true;

    try {
      // Find the earliest candle time to paginate backwards
      const keys = Array.from(candlesRef.current.keys());
      if (keys.length === 0) return;

      const earliestTime = Math.min(...keys);
      // endTime is in milliseconds for the API
      const endTimeMs = earliestTime * 1000;

      const olderCandles = await fetchHistoricalCandles(
        symbol,
        timeframeRef.current as Timeframe,
        endTimeMs,
      );

      if (olderCandles.length === 0) {
        hasMoreHistoryRef.current = false;
        setHasMoreHistory(false);
        return;
      }

      // Filter out any candles we already have
      let newCount = 0;
      for (const candle of olderCandles) {
        if (!candlesRef.current.has(candle.time)) {
          candlesRef.current.set(candle.time, candle);
          newCount++;
        }
      }

      // If no genuinely new candles, we've reached the end
      if (newCount === 0) {
        hasMoreHistoryRef.current = false;
        setHasMoreHistory(false);
        return;
      }

      // If fewer than 200 returned, no more history available
      if (olderCandles.length < 200) {
        hasMoreHistoryRef.current = false;
        setHasMoreHistory(false);
      }

      const sorted = Array.from(candlesRef.current.values()).sort(
        (a, b) => a.time - b.time,
      );

      setState((prev) => ({
        ...prev,
        candles: sorted,
      }));
    } catch (err) {
      console.error("Failed to load more candles:", err);
    } finally {
      isLoadingMoreRef.current = false;
    }
  }, [symbol]);

  // Subscribe to price data
  useEffect(() => {
    const unSubscribe = subscribe(
      `/v2/prices/${symbol}`,
      (msg: WSChannelMessage) => {
        const data = msg.data as Price;
        const price = parseFloat(data.oraclePrice);
        if (isNaN(price)) return;

        const candleTime = getCandleTime(data.updatedAt);
        const existing = candlesRef.current.get(candleTime);

        if (existing) {
          existing.high = Math.max(existing.high, price);
          existing.low = Math.min(existing.low, price);
          existing.close = price;
        } else {
          candlesRef.current.set(candleTime, {
            time: candleTime,
            open: price,
            high: price,
            low: price,
            close: price,
            volume: 0,
          });
        }

        const candles = Array.from(candlesRef.current.values()).sort(
          (a, b) => a.time - b.time,
        );

        setState((prev) => ({
          ...prev,
          currentPrice: price,
          oraclePrice: data.oraclePrice,
          poolPrice: data.poolPrice ?? null,
          candles,
        }));
      },
    );

    return unSubscribe;
  }, [symbol, subscribe, getCandleTime]);

  // Subscribe to market summary
  useEffect(() => {
    const unSubscribe = subscribe(
      `/v2/market/${symbol}/summary`,
      (msg: WSChannelMessage) => {
        const data = msg.data as MarketSummary;
        setState((prev) => ({
          ...prev,
          priceChange24h: data.pxChange24h
            ? parseFloat(data.pxChange24h)
            : null,
          volume24h: data.volume24h,
          longOiQty: data.longOiQty,
          shortOiQty: data.shortOiQty,
          fundingRate: data.fundingRate,
        }));
      },
    );

    return unSubscribe;
  }, [symbol, subscribe]);

  return { ...state, loadMoreCandles, hasMoreHistory };
}
