// /api/public/candles - Public.com API candles/bars endpoint
// Usage: GET /api/public/candles?symbol=SPY&resolution=5

import { NextResponse } from "next/server"
import {
  getCandles,
  validatePublicApiConfig,
  mapSymbolForPublic,
  getCached,
  setCache,
  type PublicCandle
} from "@/lib/public-api"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"
export const revalidate = 0

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Pragma": "no-cache",
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
  const rawSymbol = searchParams.get("symbol") || "SPY"
  const resolution = searchParams.get("resolution") || "5"
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  // Map symbol for Public.com
  const symbol = mapSymbolForPublic(rawSymbol.toUpperCase().replace(/^\$/, ""))

  if (!symbol) {
    return NextResponse.json(
      { error: "Invalid symbol" },
      { status: 400, headers: NO_CACHE_HEADERS }
    )
  }

  // Check cache (shorter TTL for intraday)
  const isIntraday = !["D", "W", "M"].includes(resolution)
  const cacheKey = `candles:${symbol}:${resolution}:${from || ""}:${to || ""}`
  const cached = getCached<PublicCandle[]>(cacheKey)

  if (cached && cached.length > 0) {
    return NextResponse.json({
      candles: cached,
      source: "public",
      resolution,
      symbol,
      cached: true,
    }, { headers: NO_CACHE_HEADERS })
  }

  try {
    const fromTime = from ? parseInt(from) : undefined
    const toTime = to ? parseInt(to) : undefined

    const candles = await getCandles(symbol, resolution, fromTime, toTime)

    if (candles.length === 0) {
      console.log("[Public Candles] No candles returned for", symbol, resolution)
      return NextResponse.json({
        candles: [],
        source: "public",
        resolution,
        symbol,
        error: "No candles available",
      }, { headers: NO_CACHE_HEADERS })
    }

    // Cache the results
    setCache(cacheKey, candles)

    console.log("[Public Candles] Fetched", candles.length, "candles for", symbol)

    return NextResponse.json({
      candles,
      source: "public",
      resolution,
      symbol,
    }, { headers: NO_CACHE_HEADERS })

  } catch (error) {
    console.error("[Public Candles] Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch candles", details: String(error) },
      { status: 500, headers: NO_CACHE_HEADERS }
    )
  }
}
