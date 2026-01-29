// /api/tradier/quote - Now using Public.com API for more reliable quotes
// Tradier API disabled due to intermittent quote conflicts
// Usage: GET /api/tradier/quote?symbols=SPY,AAPL,TSLA,GOOGL,NVDA,QQQ

import { NextResponse } from "next/server"
import {
  getQuotes,
  validatePublicApiConfig,
  mapSymbolForPublic,
} from "@/lib/public-api"

// Force dynamic - no caching
export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"
export const revalidate = 0

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Pragma": "no-cache",
}

// Default watchlist - using SPY instead of SPX for Public.com
const DEFAULT_WATCHLIST = ["SPY", "QQQ", "AAPL", "TSLA", "GOOGL", "NVDA"]

// Sanitize symbols
function sanitizeSymbols(input: string): string[] {
  return input
    .split(",")
    .map((s) => s.trim().toUpperCase().replace(/^\$/, ""))
    .filter((s) => s.length > 0 && s.length <= 10 && /^[A-Z0-9.^]+$/.test(s))
}

// Get symbol type
function getSymbolType(symbol: string): "index" | "equity" | "etf" {
  const upper = symbol.toUpperCase()
  if (upper.startsWith("^") || upper === "SPX" || upper === "VIX" || upper === "DJI" || upper === "NDX") {
    return "index"
  }
  if (["SPY", "QQQ", "IWM", "DIA", "VTI", "VOO", "ARKK"].includes(upper)) {
    return "etf"
  }
  return "equity"
}

// Calculate mark price (bid/ask midpoint, with last as fallback)
function calculateMarkPrice(bid: number | undefined, ask: number | undefined, last: number | undefined) {
  const validBid = bid && bid > 0 ? bid : 0
  const validAsk = ask && ask > 0 ? ask : 0
  const validLast = last && last > 0 ? last : 0

  let mark = 0
  if (validBid > 0 && validAsk > 0) {
    mark = (validBid + validAsk) / 2
  } else if (validLast > 0) {
    mark = validLast
  }

  const displayPrice = mark > 0 ? mark : validLast

  return { mark, displayPrice }
}

// Normalize quote to standard format
function normalizeQuote(quote: any, includeRaw = false) {
  const symbolType = getSymbolType(quote.symbol)
  const { mark, displayPrice } = calculateMarkPrice(quote.bid, quote.ask, quote.price || quote.last)

  const prevClose = quote.previous_close || quote.prevClose || quote.price || 0
  const change = quote.change ?? (displayPrice > 0 && prevClose > 0 ? displayPrice - prevClose : 0)
  const changePercent = quote.change_percent ?? quote.changePercent ?? (prevClose > 0 ? (change / prevClose) * 100 : 0)

  return {
    symbol: quote.symbol,
    symbolType,
    type: symbolType,
    description: quote.name || quote.description || quote.symbol,

    bid: quote.bid || 0,
    ask: quote.ask || 0,
    last: quote.price || quote.last || 0,
    mark,
    displayPrice,

    change,
    changePercent,
    prevClose,

    open: quote.open,
    high: quote.high,
    low: quote.low,

    volume: quote.volume || 0,

    lastUpdated: quote.timestamp || Date.now(),

    status: "LIVE",
    statusReason: "Public.com API",
    isIndex: symbolType === "index",
    source: "public",

    ...(includeRaw ? { raw: quote } : {}),
  }
}

export async function GET(request: Request) {
  // Check Public.com API config
  const config = validatePublicApiConfig()
  if (!config.valid) {
    return NextResponse.json(
      { error: config.error || "Public.com API not configured" },
      { status: 500, headers: NO_CACHE_HEADERS }
    )
  }

  const { searchParams } = new URL(request.url)
  const symbolsParam = searchParams.get("symbols")
  const includeRaw = searchParams.get("raw") === "true"

  // Sanitize and default to watchlist if no symbols provided
  const rawSymbols = symbolsParam ? sanitizeSymbols(symbolsParam) : [...DEFAULT_WATCHLIST]

  // Map symbols for Public.com (e.g., SPX -> SPY)
  const mappedSymbols = rawSymbols.map(mapSymbolForPublic)
  const uniqueSymbols = [...new Set(mappedSymbols)]

  if (uniqueSymbols.length === 0) {
    return NextResponse.json(
      { error: "No valid symbols provided" },
      { status: 400, headers: NO_CACHE_HEADERS }
    )
  }

  try {
    console.log("[v0] Fetching quotes from Public.com API:", uniqueSymbols)

    const publicQuotes = await getQuotes(uniqueSymbols)

    if (!publicQuotes || publicQuotes.length === 0) {
      console.log("[v0] No quotes returned from Public.com")
      return NextResponse.json(
        { quotes: [], timestamp: Date.now(), error: "No quotes available" },
        { headers: NO_CACHE_HEADERS }
      )
    }

    // Normalize all quotes
    const quotes = publicQuotes.map((q) => normalizeQuote(q, includeRaw))

    console.log("[v0] Public.com quotes fetched:", quotes.length)

    return NextResponse.json(
      {
        quotes,
        timestamp: Date.now(),
        source: "public",
        streamAvailable: false, // Public.com uses polling, not streaming
      },
      { headers: NO_CACHE_HEADERS }
    )
  } catch (error) {
    console.error("[v0] Public.com quote error:", error)
    return NextResponse.json(
      { error: "Failed to fetch quotes", details: String(error) },
      { status: 500, headers: NO_CACHE_HEADERS }
    )
  }
}
