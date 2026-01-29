// Tradier API Types - Mark-First Pricing with Data Health Status

export type DataHealthStatus = "LIVE" | "POSSIBLY_DELAYED" | "STALE"
export type DataStatus = DataHealthStatus // Alias for backward compatibility

export type SymbolType = "index" | "etf" | "equity"

// REST base URL - hardcoded to production
export function getTradierBaseUrl(): string {
  return "https://api.tradier.com/v1"
}

// Streaming base URL - hardcoded to production
export function getTradierStreamUrl(): string {
  return "https://stream.tradier.com/v1"
}

// Default watchlist
export const DEFAULT_WATCHLIST = ["SPX", "SPY", "QQQ", "AAPL", "TSLA", "GOOGL", "NVDA"] as const

// Symbol sanitization: remove $, trim, uppercase
export function sanitizeSymbol(input: string): string {
  return input.replace(/^\$/, "").trim().toUpperCase()
}

export function sanitizeSymbols(input: string): string[] {
  return input
    .split(",")
    .map((s) => sanitizeSymbol(s))
    .filter((s) => s.length > 0)
}

// Raw Tradier quote response
export interface TradierRawQuote {
  symbol: string
  description?: string
  exch?: string
  type?: string
  last?: number
  change?: number
  volume?: number
  open?: number
  high?: number
  low?: number
  close?: number
  bid?: number
  bidsize?: number
  bidexch?: string
  bid_date?: number
  ask?: number
  asksize?: number
  askexch?: string
  ask_date?: number
  underlying?: string
  strike?: number
  change_percentage?: number
  average_volume?: number
  last_volume?: number
  trade_date?: number
  prevclose?: number
  week_52_high?: number
  week_52_low?: number
  biddate?: number
  askdate?: number
  root_symbols?: string
}

// Normalized quote with mark-first displayPrice
export interface NormalizedQuote {
  symbol: string
  symbolType?: SymbolType
  type?: string
  description?: string

  // Pricing - all available values
  bid: number
  ask: number
  last: number
  mark: number // (bid + ask) / 2
  displayPrice: number // Mark-first: mark if available, else last

  // Change values
  change: number
  changePercent: number
  prevClose: number

  // OHLC
  open?: number
  high?: number
  low?: number

  // Volume
  volume: number

  // Timestamps (Unix ms)
  bidTime?: number | null
  askTime?: number | null
  tradeTime?: number | null
  lastUpdated?: number

  // Data health
  status: DataHealthStatus
  statusReason?: string

  // Index flag
  isIndex?: boolean

  // Raw data for debugging
  raw?: TradierRawQuote
}

// Options contract - raw from Tradier
export interface TradierRawOption {
  symbol: string
  description?: string
  exch?: string
  type?: string
  last?: number
  change?: number
  volume?: number
  open?: number
  high?: number
  low?: number
  close?: number
  bid?: number
  ask?: number
  underlying?: string
  strike?: number
  change_percentage?: number
  contract_size?: number
  expiration_date?: string
  expiration_type?: string
  option_type?: "call" | "put"
  root_symbol?: string
  bid_date?: number
  ask_date?: number
  trade_date?: number
  open_interest?: number
  greeks?: {
    delta?: number
    gamma?: number
    theta?: number
    vega?: number
    rho?: number
    phi?: number
    bid_iv?: number
    mid_iv?: number
    ask_iv?: number
    smv_vol?: number
    updated_at?: string
  }
}

// Normalized option - UI-facing (minimal fields per requirement)
export interface NormalizedOption {
  symbol: string
  underlying?: string
  strike: number
  expiration?: string
  optionType: "call" | "put"

  // Pricing - mark-first
  bid: number
  ask: number
  last: number
  mark: number
  displayPrice: number

  // Volume only (no OI, IV, Greeks in UI per requirement)
  volume: number

  // Data health
  status: DataHealthStatus
  statusReason?: string
}

// Full normalized option (for server-side analysis)
export interface NormalizedOptionFull extends NormalizedOption {
  change: number
  changePercent: number
  openInterest: number
  delta: number | null
  gamma: number | null
  theta: number | null
  vega: number | null
  iv: number | null
  bidTime: number | null
  askTime: number | null
  tradeTime: number | null
  lastUpdated: number
}

// Options chain response
export interface OptionsChainResponse {
  symbol: string
  root?: string
  expirations: string[]
  chain: {
    expiration: string
    calls: NormalizedOption[]
    puts: NormalizedOption[]
  }[]
  lastUpdated: number
  error?: string
}

// Options roots response
export interface OptionsRootsResponse {
  underlying: string
  roots: string[]
  preferredRoot: string
}

// Expirations response
export interface ExpirationsResponse {
  symbol: string
  expirations: string[]
}

// Streaming event types
export interface StreamEvent {
  type: "quote" | "trade" | "summary" | "timesale"
  symbol: string
  bid?: number
  ask?: number
  last?: number
  mark?: number
  displayPrice?: number
  bidTime?: number
  askTime?: number
  tradeTime?: number
  volume?: number
  size?: number
  status: DataHealthStatus
  timestamp: number
}

// API response wrappers
export interface QuoteApiResponse {
  quotes: NormalizedQuote[]
  timestamp: number
  streamAvailable?: boolean
}

export interface OptionsChainApiResponse {
  chain: OptionsChainResponse
  timestamp: number
}

// Symbol type detection
export function getSymbolType(symbol: string): SymbolType {
  const indexes = ["SPX", "NDX", "DJX", "RUT", "VIX"]
  const etfs = ["SPY", "QQQ", "IWM", "DIA", "GLD", "SLV", "TLT", "XLF", "XLE", "XLK"]

  const clean = sanitizeSymbol(symbol)
  if (indexes.includes(clean)) return "index"
  if (etfs.includes(clean)) return "etf"
  return "equity"
}

// Calculate data health status based on timestamps
export function calculateDataHealth(
  bidTime: number | null | undefined,
  askTime: number | null | undefined,
  tradeTime: number | null | undefined,
  symbolType: SymbolType
): { status: DataHealthStatus; reason: string } {
  const now = Date.now()
  const STALE_THRESHOLD = 60 * 1000 // 60 seconds
  const DELAYED_THRESHOLD = 15 * 1000 // 15 seconds

  const timestamps = [bidTime, askTime, tradeTime].filter((t): t is number => t !== null && t !== undefined && t > 0)

  if (timestamps.length === 0) {
    return { status: "STALE", reason: "No timestamp data available" }
  }

  const mostRecent = Math.max(...timestamps)
  const age = now - mostRecent

  // Indexes are often delayed by design
  if (symbolType === "index") {
    if (age > STALE_THRESHOLD) {
      return { status: "STALE", reason: `Index data ${Math.round(age / 1000)}s old` }
    }
    if (age > DELAYED_THRESHOLD) {
      return { status: "POSSIBLY_DELAYED", reason: "Index data may be delayed" }
    }
    return { status: "LIVE", reason: "Index data current" }
  }

  // Equities and ETFs
  if (age > STALE_THRESHOLD) {
    return { status: "STALE", reason: `Data ${Math.round(age / 1000)}s old` }
  }
  if (age > DELAYED_THRESHOLD) {
    return { status: "POSSIBLY_DELAYED", reason: `Data ${Math.round(age / 1000)}s old` }
  }

  return { status: "LIVE", reason: "Real-time" }
}

// Calculate mark and displayPrice (MARK-FIRST LOGIC)
export function calculateMarkPrice(
  bid: number | undefined,
  ask: number | undefined,
  last: number | undefined
): {
  mark: number
  displayPrice: number
  priceSource: "mark" | "last" | "none"
} {
  const validBid = bid && bid > 0 ? bid : 0
  const validAsk = ask && ask > 0 ? ask : 0
  const validLast = last && last > 0 ? last : 0

  // MARK-FIRST: Calculate mark if both bid and ask are valid
  if (validBid > 0 && validAsk > 0) {
    const mark = (validBid + validAsk) / 2
    return { mark, displayPrice: mark, priceSource: "mark" }
  }

  // Fallback to last
  if (validLast > 0) {
    return { mark: validLast, displayPrice: validLast, priceSource: "last" }
  }

  // No valid price
  return { mark: 0, displayPrice: 0, priceSource: "none" }
}

// No-cache headers for all responses
export const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
}

// Validate Tradier token
export function validateTradierConfig(): { valid: true; token: string; baseUrl: string } | { valid: false; error: string } {
  const token = process.env.TRADIER_API_KEY || process.env.TRADIER_TOKEN

  if (!token) {
    return { valid: false, error: "TRADIER_API_KEY or TRADIER_TOKEN environment variable is required" }
  }

  const baseUrl = getTradierBaseUrl()

  // Block sandbox URLs in production
  if (process.env.NODE_ENV === "production") {
    if (baseUrl.includes("sandbox")) {
      return { valid: false, error: "Sandbox URLs are not allowed in production" }
    }
  }

  return { valid: true, token, baseUrl }
}
