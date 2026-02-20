"use client";

import type { PerpExecution, WSChannelMessage } from "@/lib/types";
import { useEffect, useRef, useState } from "react";

const MAX_TRADES = 100;

interface UseTradesParams {
  symbol: string;
  subscribe: (
    channel: string,
    handler: (msg: WSChannelMessage) => void,
  ) => () => void;
}

export function useTrades({ symbol, subscribe }: UseTradesParams) {
  const [trades, setTrades] = useState<PerpExecution[]>([]);
  const tradesRef = useRef<PerpExecution[]>([]);

  useEffect(() => {
    tradesRef.current = [];

    const unSubscribe = subscribe(
      `/v2/market/${symbol}/perpExecutions`,
      (msg: WSChannelMessage) => {
        const data = msg.data as PerpExecution[];
        if (!Array.isArray(data)) return;

        const updated = [...data, ...tradesRef.current].slice(0, MAX_TRADES);
        tradesRef.current = updated;
        setTrades(updated);
      },
    );

    return () => {
      unSubscribe();
      // Clear trades on symbol change or unmount
      tradesRef.current = [];
      setTrades([]);
    };
  }, [symbol, subscribe]);

  return trades;
}
