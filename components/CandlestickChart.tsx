"use client";

import { COLORS } from "@/lib/constants";
import type { OHLCV } from "@/lib/types";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  HistogramSeries,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";
import { useCallback, useEffect, useRef } from "react";

interface CandlestickChartProps {
  candles: OHLCV[];
  symbol: string;
  isLoading?: boolean;
  onLoadMore?: () => void;
}

export default function CandlestickChart({
  candles,
  symbol,
  isLoading = false,
  onLoadMore,
}: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const prevDataLenRef = useRef(0);
  const onLoadMoreRef = useRef(onLoadMore);

  // Keep the ref up-to-date without re-subscribing
  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  // Initialize chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: COLORS.bg },
        textColor: COLORS.textSecondary,
        fontFamily: "'Inter', sans-serif",
        fontSize: 12,
      },
      grid: {
        vertLines: { color: "rgba(42, 45, 53, 0.5)" },
        horzLines: { color: "rgba(42, 45, 53, 0.5)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "rgba(255, 255, 255, 0.2)",
          width: 1,
          style: 3,
          labelBackgroundColor: COLORS.bgTertiary,
        },
        horzLine: {
          color: "rgba(255, 255, 255, 0.2)",
          width: 1,
          style: 3,
          labelBackgroundColor: COLORS.bgTertiary,
        },
      },
      rightPriceScale: {
        borderColor: COLORS.border,
        scaleMargins: { top: 0.1, bottom: 0.25 },
      },
      timeScale: {
        borderColor: COLORS.border,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,
        barSpacing: 8,
      },
      handleScale: { axisPressedMouseMove: true },
      handleScroll: { vertTouchDrag: false },
    });

    // lightweight-charts v5 uses chart.addSeries(SeriesType, options)
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: COLORS.buy,
      downColor: COLORS.sell,
      borderUpColor: COLORS.buy,
      borderDownColor: COLORS.sell,
      wickUpColor: COLORS.buy,
      wickDownColor: COLORS.sell,
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    // Infinite scroll: detect when user scrolls near the left edge
    const timeScale = chart.timeScale();
    timeScale.subscribeVisibleLogicalRangeChange((logicalRange) => {
      if (!logicalRange) return;
      // When the left edge of the visible range is near bar index 0 or negative,
      // the user has scrolled to the beginning of the data — load more
      if (logicalRange.from <= 10) {
        onLoadMoreRef.current?.();
      }
    });

    // Responsive resize
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        chart.applyOptions({ width, height });
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, []);

  // Update data
  const updateChart = useCallback(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;
    if (candles.length === 0) return;

    const candleData: CandlestickData<Time>[] = candles.map((c) => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    const volumeData: HistogramData<Time>[] = candles.map((c) => ({
      time: c.time as Time,
      value: c.volume,
      color:
        c.close >= c.open
          ? "rgba(0, 192, 135, 0.3)"
          : "rgba(255, 73, 118, 0.3)",
    }));

    // If just the last candle updated, use update() for performance
    if (candles.length === prevDataLenRef.current && candles.length > 0) {
      const lastCandle = candleData[candleData.length - 1];
      const lastVolume = volumeData[volumeData.length - 1];
      candleSeriesRef.current.update(lastCandle);
      volumeSeriesRef.current.update(lastVolume);
    } else {
      // Save the current visible range before setData to preserve scroll position
      const timeScale = chartRef.current?.timeScale();
      const visibleRange = timeScale?.getVisibleLogicalRange();

      candleSeriesRef.current.setData(candleData);
      volumeSeriesRef.current.setData(volumeData);

      if (prevDataLenRef.current === 0 && candles.length > 0) {
        // First load: fit all content
        timeScale?.fitContent();
      } else if (visibleRange && prevDataLenRef.current > 0) {
        // Data prepended (infinite scroll): adjust range to keep same candles visible
        const addedCount = candles.length - prevDataLenRef.current;
        if (addedCount > 0) {
          timeScale?.setVisibleLogicalRange({
            from: visibleRange.from + addedCount,
            to: visibleRange.to + addedCount,
          });
        }
      }
    }

    prevDataLenRef.current = candles.length;
  }, [candles]);

  useEffect(() => {
    updateChart();
  }, [updateChart]);

  return (
    <div className="chart-container">
      <div className="chart-watermark">{symbol} · Reya</div>
      {isLoading && (
        <div className="chart-loading-overlay">Loading chart data...</div>
      )}
      <div ref={containerRef} className="chart-inner" />
    </div>
  );
}
