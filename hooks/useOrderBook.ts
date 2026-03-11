"use client";

import type {
  Depth,
  DepthLevel,
  WSErrorMessage,
  WSChannelMessage,
} from "@/lib/types";
import { useEffect, useRef, useState } from "react";

interface UseOrderBookParams {
  symbol: string;
  subscribe: (
    channel: string,
    handler: (msg: WSChannelMessage) => void,
  ) => () => void;
  subscribeError: (
    channel: string,
    handler: (msg: WSErrorMessage) => void,
  ) => () => void;
}

interface OrderBookState {
  bids: DepthLevel[];
  asks: DepthLevel[];
  spread: number | null;
  spreadPercent: number | null;
  status: "loading" | "live" | "unsupported";
  errorMessage: string | null;
}

const INITIAL_STATE: OrderBookState = {
  bids: [],
  asks: [],
  spread: null,
  spreadPercent: null,
  status: "loading",
  errorMessage: null,
};

const MAX_LEVELS = 15;

function applyLevelUpdates(sideMap: Map<string, string>, updates: DepthLevel[]) {
  for (const level of updates) {
    const qty = parseFloat(level.qty);
    if (!isFinite(qty) || qty <= 0) {
      sideMap.delete(level.px);
    } else {
      sideMap.set(level.px, level.qty);
    }
  }
}

function toSortedLevels(
  sideMap: Map<string, string>,
  side: "bids" | "asks",
): DepthLevel[] {
  const levels = Array.from(sideMap, ([px, qty]) => ({ px, qty }));
  levels.sort((a, b) => {
    const left = parseFloat(a.px);
    const right = parseFloat(b.px);
    return side === "bids" ? right - left : left - right;
  });
  return levels.slice(0, MAX_LEVELS);
}

export function useOrderBook({
  symbol,
  subscribe,
  subscribeError,
}: UseOrderBookParams): OrderBookState {
  const [state, setState] = useState<OrderBookState>(INITIAL_STATE);
  const bidsMapRef = useRef<Map<string, string>>(new Map());
  const asksMapRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const depthChannel = `/v2/market/${symbol}/depth`;
    bidsMapRef.current.clear();
    asksMapRef.current.clear();

    const unSubscribe = subscribe(depthChannel, (msg: WSChannelMessage) => {
      const data = msg.data as Depth;

      if (data.type === "SNAPSHOT") {
        bidsMapRef.current = new Map((data.bids ?? []).map((level) => [level.px, level.qty]));
        asksMapRef.current = new Map((data.asks ?? []).map((level) => [level.px, level.qty]));
      } else {
        applyLevelUpdates(bidsMapRef.current, data.bids ?? []);
        applyLevelUpdates(asksMapRef.current, data.asks ?? []);
      }

      const bids = toSortedLevels(bidsMapRef.current, "bids");
      const asks = toSortedLevels(asksMapRef.current, "asks");

      let spread: number | null = null;
      let spreadPercent: number | null = null;

      if (bids.length > 0 && asks.length > 0) {
        const bestBid = parseFloat(bids[0].px);
        const bestAsk = parseFloat(asks[0].px);
        spread = bestAsk - bestBid;
        spreadPercent = bestAsk > 0 ? (spread / bestAsk) * 100 : null;
      }

      setState({
        bids,
        asks,
        spread,
        spreadPercent,
        status: "live",
        errorMessage: null,
      });
    });

    const unSubscribeError = subscribeError(
      depthChannel,
      (msg: WSErrorMessage) => {
        bidsMapRef.current.clear();
        asksMapRef.current.clear();
        setState({
          ...INITIAL_STATE,
          status: "unsupported",
          errorMessage: msg.message,
        });
      },
    );

    return () => {
      unSubscribe();
      unSubscribeError();
      bidsMapRef.current.clear();
      asksMapRef.current.clear();
      setState(INITIAL_STATE);
    };
  }, [symbol, subscribe, subscribeError]);

  return state;
}
