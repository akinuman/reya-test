// ============================================================
// Reya DEX WebSocket API v2 — TypeScript Types
// ============================================================

// ── Enums ────────────────────────────────────────────────────

export type Side = "B" | "A";

export type ExecutionType = "ORDER_MATCH" | "LIQUIDATION" | "ADL";

export type OrderStatus = "OPEN" | "FILLED" | "CANCELLED" | "REJECTED";

export type OrderType = "LIMIT" | "TP" | "SL";

export type TimeInForce = "IOC" | "GTC";

export type DepthType = "SNAPSHOT" | "UPDATE";

export type AccountType = "MAINPERP" | "SUBPERP" | "SPOT";

// ── Channel Data Payloads ────────────────────────────────────

export interface MarketSummary {
  symbol: string;
  updatedAt: number;
  longOiQty: string;
  shortOiQty: string;
  oiQty: string;
  fundingRate: string;
  longFundingValue: string;
  shortFundingValue: string;
  fundingRateVelocity: string;
  volume24h: string;
  pxChange24h?: string;
  throttledOraclePrice?: string;
  throttledPoolPrice?: string;
  pricesUpdatedAt?: number;
}

export interface Price {
  symbol: string;
  oraclePrice: string;
  poolPrice?: string;
  updatedAt: number;
}

export interface PerpExecution {
  exchangeId: number;
  symbol: string;
  accountId: number;
  qty: string;
  side: Side;
  price: string;
  fee: string;
  type: ExecutionType;
  timestamp: number;
  sequenceNumber: number;
}

export interface SpotExecution {
  exchangeId?: number;
  symbol: string;
  accountId: number;
  makerAccountId: number;
  orderId?: string;
  makerOrderId?: string;
  qty: string;
  side: Side;
  price: string;
  fee: string;
  type: ExecutionType;
  timestamp: number;
}

export interface DepthLevel {
  px: string;
  qty: string;
}

export interface Depth {
  symbol: string;
  type: DepthType;
  bids: DepthLevel[];
  asks: DepthLevel[];
  updatedAt: number;
}

export interface Position {
  exchangeId: number;
  symbol: string;
  accountId: number;
  qty: string;
  side: Side;
  avgEntryPrice: string;
  avgEntryFundingValue: string;
  lastTradeSequenceNumber: number;
}

export interface Order {
  exchangeId: number;
  symbol: string;
  accountId: number;
  side: Side;
  limitPx: string;
  orderType: OrderType;
  status: OrderStatus;
  createdAt: number;
  lastUpdateAt: number;
  orderId: string;
  qty?: string;
  execQty?: string;
  cumQty?: string;
  triggerPx?: string;
  timeInForce?: TimeInForce;
  reduceOnly?: boolean;
}

export interface AccountBalance {
  accountId: number;
  asset: string;
  realBalance: string;
  balance_DEPRECATED: string;
}

// ── WebSocket Message Envelope ───────────────────────────────

export interface WSChannelMessage<T = unknown> {
  type: "channel_data";
  timestamp: number;
  channel: string;
  data: T;
}

export interface WSPingMessage {
  type: "ping";
  timestamp: number;
}

export interface WSPongMessage {
  type: "pong";
  timestamp: number;
}

export interface WSSubscribeMessage {
  type: "subscribe";
  channel: string;
  id?: string;
}

export interface WSUnsubscribeMessage {
  type: "unsubscribe";
  channel: string;
  id?: string;
}

export interface WSSubscribedMessage {
  type: "subscribed";
  channel: string;
  contents?: unknown;
}

export interface WSUnsubscribedMessage {
  type: "unsubscribed";
  channel: string;
}

export interface WSErrorMessage {
  type: "error";
  message: string;
  channel?: string;
}

export type WSIncomingMessage =
  | WSChannelMessage
  | WSPingMessage
  | WSSubscribedMessage
  | WSUnsubscribedMessage
  | WSErrorMessage;

// ── Chart Types ──────────────────────────────────────────────

export type Timeframe = "1m" | "5m" | "15m" | "1h" | "1d";

export interface OHLCV {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
