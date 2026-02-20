"use client";

import { COLORS } from "@/lib/constants";
import type { Timeframe } from "@/lib/types";

interface MarketHeaderProps {
  symbol: string;
  currentPrice: number | null;
  priceChange24h: number | null;
  volume24h: string | null;
  oiQty: string | null;
  fundingRate: string | null;
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  onSymbolChange: (symbol: string) => void;
  availableSymbols: string[];
  connectionState: string;
}

const TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1h", "1d"];

function formatPrice(price: number | null): string {
  if (price === null) return "---";
  if (price >= 1000)
    return price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  if (price >= 1) return price.toFixed(4);
  return price.toFixed(6);
}

function formatVolume(vol: string | null): string {
  if (!vol) return "---";
  const n = parseFloat(vol);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

function formatFundingRate(rate: string | null): string {
  if (!rate) return "---";
  const n = parseFloat(rate);
  return `${(n * 100).toFixed(4)}%`;
}

function formatSymbolDisplay(symbol: string): string {
  return symbol.replace("PERP", "").replace("RUSD", "-rUSD");
}

export default function MarketHeader({
  symbol,
  currentPrice,
  priceChange24h,
  volume24h,
  oiQty,
  fundingRate,
  timeframe,
  onTimeframeChange,
  onSymbolChange,
  availableSymbols,
  connectionState,
}: MarketHeaderProps) {
  const isPositiveChange = priceChange24h !== null && priceChange24h >= 0;
  const changeColor =
    priceChange24h === null
      ? COLORS.textSecondary
      : isPositiveChange
        ? COLORS.buy
        : COLORS.sell;

  return (
    <header className="market-header">
      <div className="market-header-left">
        {/* Connection status dot */}
        <div
          className="connection-dot"
          style={{
            backgroundColor:
              connectionState === "connected"
                ? COLORS.buy
                : connectionState === "connecting"
                  ? "#f0b90b"
                  : COLORS.sell,
          }}
          title={connectionState}
        />

        {/* Symbol selector */}
        <select
          className="symbol-select"
          value={symbol}
          onChange={(e) => onSymbolChange(e.target.value)}
        >
          {availableSymbols.map((s) => (
            <option key={s} value={s}>
              {formatSymbolDisplay(s)}
            </option>
          ))}
        </select>

        {/* Price */}
        <span className="header-price" style={{ color: changeColor }}>
          {formatPrice(currentPrice)}
        </span>

        {/* Stats */}
        <div className="header-stats">
          <div className="stat">
            <span className="stat-label">24h Change</span>
            <span className="stat-value" style={{ color: changeColor }}>
              {priceChange24h !== null
                ? `${isPositiveChange ? "+" : ""}${priceChange24h.toFixed(2)}`
                : "---"}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">24h Volume</span>
            <span className="stat-value">{formatVolume(volume24h)}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Open Interest</span>
            <span className="stat-value">
              {oiQty ? parseFloat(oiQty).toFixed(2) : "---"}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">1hr Funding</span>
            <span
              className="stat-value"
              style={{
                color: fundingRate
                  ? parseFloat(fundingRate) >= 0
                    ? COLORS.buy
                    : COLORS.sell
                  : COLORS.textSecondary,
              }}
            >
              {formatFundingRate(fundingRate)}
            </span>
          </div>
        </div>
      </div>

      {/* Timeframe selector */}
      <div className="timeframe-selector">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            className={`tf-btn ${timeframe === tf ? "tf-btn-active" : ""}`}
            onClick={() => onTimeframeChange(tf)}
          >
            {tf}
          </button>
        ))}
      </div>
    </header>
  );
}
