"use client";

import { COLORS } from "@/lib/constants";
import type { PerpExecution } from "@/lib/types";
import { useEffect, useRef } from "react";

interface TradesPanelProps {
  trades: PerpExecution[];
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatTradePrice(price: string): string {
  const n = parseFloat(price);
  if (n >= 1000)
    return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (n >= 1) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(6)}`;
}

export default function TradesPanel({ trades }: TradesPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to top on new trades
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [trades.length]);

  return (
    <div className="trades-panel">
      <div className="panel-header">
        <h3>Trades</h3>
      </div>
      <div className="trades-table-header">
        <span>Price</span>
        <span>Size</span>
        <span>Time</span>
      </div>
      <div className="trades-scroll" ref={scrollRef}>
        {trades.length === 0 ? (
          <div className="panel-empty">Waiting for trades...</div>
        ) : (
          trades.map((trade, i) => (
            <div
              key={`${trade.timestamp}-${trade.sequenceNumber}-${i}`}
              className="trade-row"
            >
              <span
                className="trade-price"
                style={{
                  color: trade.side === "B" ? COLORS.buy : COLORS.sell,
                }}
              >
                {formatTradePrice(trade.price)}
              </span>
              <span className="trade-size">
                {parseFloat(trade.qty).toFixed(4)}
              </span>
              <span className="trade-time">{formatTime(trade.timestamp)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
