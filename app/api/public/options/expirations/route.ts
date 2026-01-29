// /api/public/options/expirations - Public.com API option expirations
// Usage: GET /api/public/options/expirations?symbol=SPY

import { NextResponse } from "next/server"
import {
  getOptionExpirations,
  validatePublicApiConfig,
  mapSymbolForPublic,
  getCached,
  setCache,
} from "@/lib/public-api"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"
export const revalidate = 0

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Pragma": "no-cache",
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
  
  const symbol = mapSymbolForPublic(rawSymbol.toUpperCase().replace(/^\$/, ""))

  if (!symbol) {
    return NextResponse.json(
      { error: "Invalid symbol" },
      { status: 400, headers: NO_CACHE_HEADERS }
    )
  }

  // Check cache (expirations don't change often)
  const cacheKey = `expirations:${symbol}`
  const cached = getCached<string[]>(cacheKey)

  if (cached && cached.length > 0) {
    return NextResponse.json({
      expirations: cached,
      symbol,
      source: "public",
      cached: true,
    }, { headers: NO_CACHE_HEADERS })
  }

  try {
    const expirations = await getOptionExpirations(symbol)

    if (expirations.length === 0) {
      return NextResponse.json({
        expirations: [],
        symbol,
        source: "public",
        error: "No expirations available",
      }, { headers: NO_CACHE_HEADERS })
    }

    // Cache the results
    setCache(cacheKey, expirations)

    return NextResponse.json({
      expirations,
      symbol,
      source: "public",
    }, { headers: NO_CACHE_HEADERS })

  } catch (error) {
    console.error("[Public Expirations] Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch expirations", details: String(error) },
      { status: 500, headers: NO_CACHE_HEADERS }
    )
  }
}
