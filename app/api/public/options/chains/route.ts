// /api/public/options/chains - Public.com API option chains
// Usage: GET /api/public/options/chains?symbol=SPY&expiration=2026-01-30

import { NextResponse } from "next/server"
import {
  getOptionChain,
  validatePublicApiConfig,
  mapSymbolForPublic,
  getCached,
  setCache,
  type PublicOptionContract,
} from "@/lib/public-api"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"
export const revalidate = 0

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Pragma": "no-cache",
}

// Normalize option contract to standard format
function normalizeOption(option: PublicOptionContract) {
  const mark = option.bid && option.ask ? (option.bid + option.ask) / 2 : option.last
  
  return {
    symbol: option.symbol,
    underlying: option.underlying,
    strike: option.strike,
    expiration: option.expiration,
    optionType: option.option_type,
    
    bid: option.bid,
    ask: option.ask,
    last: option.last,
    mark,
    displayPrice: mark || option.last,
    
    volume: option.volume,
    openInterest: option.open_interest,
    
    // Greeks
    impliedVolatility: option.implied_volatility,
    delta: option.delta,
    gamma: option.gamma,
    theta: option.theta,
    vega: option.vega,
    
    source: "public",
  }
}

export async function GET(request: Request) {
  const config = validatePublicApiConfig()
  if (!config.valid) {
    return NextResponse.json(
      { error: config.error },
      { status: 500, headers: NO_CACHE_HEADERS }
    )
  }

  const { searchParams } = new URL(request.url)
  const rawSymbol = searchParams.get("symbol") || "SPY"
  const expiration = searchParams.get("expiration")

  const symbol = mapSymbolForPublic(rawSymbol.toUpperCase().replace(/^\$/, ""))

  if (!symbol) {
    return NextResponse.json(
      { error: "Invalid symbol" },
      { status: 400, headers: NO_CACHE_HEADERS }
    )
  }

  if (!expiration) {
    return NextResponse.json(
      { error: "Expiration date required" },
      { status: 400, headers: NO_CACHE_HEADERS }
    )
  }

  // Check cache
  const cacheKey = `chain:${symbol}:${expiration}`
  const cached = getCached<{ calls: PublicOptionContract[], puts: PublicOptionContract[] }>(cacheKey)

  if (cached) {
    return NextResponse.json({
      chain: [{
        expiration,
        calls: cached.calls.map(normalizeOption),
        puts: cached.puts.map(normalizeOption),
      }],
      symbol,
      source: "public",
      cached: true,
      lastUpdated: Date.now(),
    }, { headers: NO_CACHE_HEADERS })
  }

  try {
    const { calls, puts } = await getOptionChain(symbol, expiration)

    if (calls.length === 0 && puts.length === 0) {
      return NextResponse.json({
        chain: [],
        symbol,
        expiration,
        source: "public",
        error: "No options available for this expiration",
      }, { headers: NO_CACHE_HEADERS })
    }

    // Cache the results
    setCache(cacheKey, { calls, puts })

    console.log("[Public Options] Fetched", calls.length, "calls and", puts.length, "puts for", symbol)

    return NextResponse.json({
      chain: [{
        expiration,
        calls: calls.map(normalizeOption),
        puts: puts.map(normalizeOption),
      }],
      symbol,
      source: "public",
      lastUpdated: Date.now(),
    }, { headers: NO_CACHE_HEADERS })

  } catch (error) {
    console.error("[Public Options Chain] Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch option chain", details: String(error) },
      { status: 500, headers: NO_CACHE_HEADERS }
    )
  }
}
