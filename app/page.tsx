"use client";

import MarketHeader from "@/components/MarketHeader";
import OrderBookPanel from "@/components/OrderBookPanel";
import TradesPanel from "@/components/TradesPanel";
import { useMarketData } from "@/hooks/useMarketData";
import { useOrderBook } from "@/hooks/useOrderBook";
import { useTrades } from "@/hooks/useTrades";
import { useWebSocket } from "@/hooks/useWebSocket";
import { AVAILABLE_SYMBOLS, DEFAULT_SYMBOL } from "@/lib/constants";
import type { Timeframe } from "@/lib/types";
import dynamic from "next/dynamic";
import { useState } from "react";

// Dynamic import for the chart (it accesses window/document)
const CandlestickChart = dynamic(
  () => import("@/components/CandlestickChart"),
  {
    ssr: false,
    loading: () => <div className="chart-loading">Loading chart...</div>,
  },
);

export default function TradingPage() {
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [timeframe, setTimeframe] = useState<Timeframe>("1m");

  const { connectionState, subscribe } = useWebSocket();

  const marketData = useMarketData({ symbol, timeframe, subscribe });
  const trades = useTrades({ symbol, subscribe });
  const orderBook = useOrderBook({ symbol, subscribe });

  return (
    <div className="trading-app">
      <MarketHeader
        symbol={symbol}
        currentPrice={marketData.currentPrice}
        priceChange24h={marketData.priceChange24h}
        volume24h={marketData.volume24h}
        oiQty={marketData.oiQty}
        fundingRate={marketData.fundingRate}
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
        onSymbolChange={setSymbol}
        availableSymbols={AVAILABLE_SYMBOLS}
        connectionState={connectionState}
      />
      <div className="trading-body">
        <div className="chart-area">
          <CandlestickChart
            candles={marketData.candles}
            symbol={symbol}
            isLoading={marketData.isLoadingHistory}
            onLoadMore={marketData.loadMoreCandles}
          />
        </div>
        <div className="side-panels">
          <TradesPanel trades={trades} />
          <OrderBookPanel
            bids={orderBook.bids}
            asks={orderBook.asks}
            spread={orderBook.spread}
            spreadPercent={orderBook.spreadPercent}
          />
        </div>
      </div>
    </div>
  );
}
