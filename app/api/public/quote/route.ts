// /api/public/quote - Public.com API quotes endpoint
// Usage: GET /api/public/quote?symbols=SPY,AAPL,TSLA

import { NextResponse } from "next/server"
import { 
  getQuotes, 
  validatePublicApiConfig,
  mapSymbolForPublic,
  getCached,
  setCache,
  type PublicQuote 
} from "@/lib/public-api"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"
export const revalidate = 0

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Pragma": "no-cache",
}

// Default watchlist
const DEFAULT_WATCHLIST = ["SPY", "QQQ", "AAPL", "TSLA", "GOOGL", "NVDA"]

// Sanitize and validate symbols
function sanitizeSymbols(input: string): string[] {
  return input
    .split(",")
    .map(s => s.trim().toUpperCase().replace(/^\$/, ""))
    .filter(s => s.length > 0 && s.length <= 10 && /^[A-Z0-9.^]+$/.test(s))
}

// Normalize quote to standard format
function normalizeQuote(quote: PublicQuote) {
  const mark = quote.bid && quote.ask ? (quote.bid + quote.ask) / 2 : quote.price
  
  return {
    symbol: quote.symbol,
    symbolType: quote.symbol.startsWith("^") ? "index" : "equity",
    description: quote.name || quote.symbol,
    
    bid: quote.bid || 0,
    ask: quote.ask || 0,
    last: quote.price,
    mark,
    displayPrice: mark || quote.price, // Mark-first pricing
    
    change: quote.change,
    changePercent: quote.change_percent,
    prevClose: quote.previous_close,
    
    open: quote.open,
    high: quote.high,
    low: quote.low,
    
    volume: quote.volume,
    
    lastUpdated: quote.timestamp || Date.now(),
    status: "LIVE",
    source: "public",
  }
}

export async function GET(request: Request) {
  // Validate API config
  const config = validatePublicApiConfig()
  if (!config.valid) {
    return NextResponse.json(
      { error: config.error },
      { status: 500, headers: NO_CACHE_HEADERS }
    )
  }

  const { searchParams } = new URL(request.url)
  const symbolsParam = searchParams.get("symbols")

  // Sanitize and default to watchlist
  const rawSymbols = symbolsParam ? sanitizeSymbols(symbolsParam) : DEFAULT_WATCHLIST
  
  // Map symbols for Public.com (e.g., SPX -> SPY)
  const mappedSymbols = rawSymbols.map(mapSymbolForPublic)
  const uniqueSymbols = [...new Set(mappedSymbols)]

  if (uniqueSymbols.length === 0) {
    return NextResponse.json(
      { error: "No valid symbols provided" },
      { status: 400, headers: NO_CACHE_HEADERS }
    )
  }

  // Check cache
  const cacheKey = `quotes:${uniqueSymbols.sort().join(",")}`
  const cached = getCached<PublicQuote[]>(cacheKey)
  
  if (cached) {
    const quotes = cached.map(normalizeQuote)
    return NextResponse.json({
      quotes,
      timestamp: Date.now(),
      source: "public",
      cached: true,
    }, { headers: NO_CACHE_HEADERS })
  }

  try {
    const publicQuotes = await getQuotes(uniqueSymbols)
    
    if (publicQuotes.length === 0) {
      return NextResponse.json({
        quotes: [],
        timestamp: Date.now(),
        source: "public",
        error: "No quotes returned",
      }, { headers: NO_CACHE_HEADERS })
    }

    // Cache the results
    setCache(cacheKey, publicQuotes)

    const quotes = publicQuotes.map(normalizeQuote)

    return NextResponse.json({
      quotes,
      timestamp: Date.now(),
      source: "public",
    }, { headers: NO_CACHE_HEADERS })

  } catch (error) {
    console.error("[Public Quote] Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch quotes", details: String(error) },
      { status: 500, headers: NO_CACHE_HEADERS }
    )
  }
}
