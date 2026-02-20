"use client";

import { COLORS } from "@/lib/constants";
import type { DepthLevel } from "@/lib/types";

interface OrderBookPanelProps {
  bids: DepthLevel[];
  asks: DepthLevel[];
  spread: number | null;
  spreadPercent: number | null;
}

function formatOBPrice(price: string): string {
  const n = parseFloat(price);
  if (n >= 1000)
    return n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(6);
}

export default function OrderBookPanel({
  bids,
  asks,
  spread,
  spreadPercent,
}: OrderBookPanelProps) {
  // Compute max qty for bar widths
  const allLevels = [...bids, ...asks];
  const maxQty = allLevels.reduce(
    (max, l) => Math.max(max, parseFloat(l.qty)),
    0,
  );

  return (
    <div className="orderbook-panel">
      <div className="panel-header">
        <h3>Order Book</h3>
      </div>
      <div className="ob-table-header">
        <span>Price</span>
        <span>Size</span>
      </div>

      {/* Asks (reversed so lowest ask is nearest to spread) */}
      <div className="ob-asks">
        {asks.length === 0 ? (
          <div className="panel-empty">No asks</div>
        ) : (
          [...asks].reverse().map((level, i) => {
            const qty = parseFloat(level.qty);
            const barWidth = maxQty > 0 ? (qty / maxQty) * 100 : 0;
            return (
              <div key={`ask-${i}`} className="ob-row">
                <div
                  className="ob-bar ob-bar-ask"
                  style={{ width: `${barWidth}%` }}
                />
                <span className="ob-price" style={{ color: COLORS.sell }}>
                  {formatOBPrice(level.px)}
                </span>
                <span className="ob-size">{qty.toFixed(4)}</span>
              </div>
            );
          })
        )}
      </div>

      {/* Spread */}
      <div className="ob-spread">
        <span>Spread</span>
        <span>
          {spread !== null ? spread.toFixed(2) : "---"}
          {spreadPercent !== null ? ` (${spreadPercent.toFixed(3)}%)` : ""}
        </span>
      </div>

      {/* Bids */}
      <div className="ob-bids">
        {bids.length === 0 ? (
          <div className="panel-empty">No bids</div>
        ) : (
          bids.map((level, i) => {
            const qty = parseFloat(level.qty);
            const barWidth = maxQty > 0 ? (qty / maxQty) * 100 : 0;
            return (
              <div key={`bid-${i}`} className="ob-row">
                <div
                  className="ob-bar ob-bar-bid"
                  style={{ width: `${barWidth}%` }}
                />
                <span className="ob-price" style={{ color: COLORS.buy }}>
                  {formatOBPrice(level.px)}
                </span>
                <span className="ob-size">{qty.toFixed(4)}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
