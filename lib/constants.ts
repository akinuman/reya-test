export const WS_URL = "wss://ws.reya.xyz";
export const REST_API_URL = "https://api.reya.xyz/v2";

export const DEFAULT_SYMBOL = "BTCRUSDPERP";

export const TIMEFRAME_SECONDS: Record<string, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "1d": 86400,
};

export const AVAILABLE_SYMBOLS = [
  "BTCRUSDPERP",
  "ETHRUSDPERP",
  "SOLRUSDPERP",
  "kBONKRUSDPERP",
  "AI16ZRUSDPERP",
  "DOGERUSDPERP",
];

export const COLORS = {
  buy: "#00C087",
  sell: "#FF4976",
  bg: "#0b0e11",
  bgSecondary: "#1a1d23",
  bgTertiary: "#252830",
  border: "#2a2d35",
  textPrimary: "#eaecef",
  textSecondary: "#848e9c",
  textMuted: "#5e6673",
} as const;
