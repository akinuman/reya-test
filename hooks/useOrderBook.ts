"use client";

import type { Depth, DepthLevel, WSChannelMessage } from "@/lib/types";
import { useEffect, useRef, useState } from "react";

interface UseOrderBookParams {
  symbol: string;
  subscribe: (
    channel: string,
    handler: (msg: WSChannelMessage) => void,
  ) => () => void;
}

interface OrderBookState {
  bids: DepthLevel[];
  asks: DepthLevel[];
  spread: number | null;
  spreadPercent: number | null;
}

const INITIAL_STATE: OrderBookState = {
  bids: [],
  asks: [],
  spread: null,
  spreadPercent: null,
};

export function useOrderBook({
  symbol,
  subscribe,
}: UseOrderBookParams): OrderBookState {
  const [state, setState] = useState<OrderBookState>(INITIAL_STATE);
  const needsResetRef = useRef(false);

  useEffect(() => {
    // Flag reset — will be applied on the next incoming message
    needsResetRef.current = true;

    const unsub = subscribe(
      `/v2/market/${symbol}/depth`,
      (msg: WSChannelMessage) => {
        needsResetRef.current = false;

        const data = msg.data as Depth;

        const bids = (data.bids ?? []).slice(0, 15);
        const asks = (data.asks ?? []).slice(0, 15);

        let spread: number | null = null;
        let spreadPercent: number | null = null;

        if (bids.length > 0 && asks.length > 0) {
          const bestBid = parseFloat(bids[0].px);
          const bestAsk = parseFloat(asks[0].px);
          spread = bestAsk - bestBid;
          spreadPercent = (spread / bestAsk) * 100;
        }

        setState({ bids, asks, spread, spreadPercent });
      },
    );

    return () => {
      unsub();
      // Reset state immediately on cleanup (symbol changed or unmount)
      setState(INITIAL_STATE);
    };
  }, [symbol, subscribe]);

  return state;
}
