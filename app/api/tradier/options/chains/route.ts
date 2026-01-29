// /api/tradier/options/chains - Get options chain for a symbol
// Usage: GET /api/tradier/options/chains?symbol=SPY&expiration=2024-01-26
// REQUIRES expiration parameter - must call /expirations first

import { NextResponse } from "next/server"
import {
  type TradierRawOption,
  type NormalizedOption,
  type OptionsChainResponse,
  calculateMarkPrice,
  calculateDataHealth,
  sanitizeSymbol,
  validateTradierConfig,
  NO_CACHE_HEADERS,
} from "@/lib/tradier-types"

// Force dynamic - no caching
export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"
export const revalidate = 0

// Normalize option - returns ONLY UI-visible fields (no OI, IV, Greeks per requirement)
function normalizeOption(raw: TradierRawOption): NormalizedOption {
  // Calculate mark-first pricing
  const { mark, displayPrice } = calculateMarkPrice(raw.bid, raw.ask, raw.last)

  // Calculate data health
  const bidTime = raw.bid_date ? raw.bid_date * 1000 : null
  const askTime = raw.ask_date ? raw.ask_date * 1000 : null
  const tradeTime = raw.trade_date ? raw.trade_date * 1000 : null
  const { status, reason } = calculateDataHealth(bidTime, askTime, tradeTime, "equity")

  return {
    symbol: raw.symbol,
    underlying: raw.underlying || raw.root_symbol,
    strike: raw.strike || 0,
    expiration: raw.expiration_date,
    optionType: raw.option_type || "call",

    // Pricing - mark-first
    bid: raw.bid || 0,
    ask: raw.ask || 0,
    last: raw.last || 0,
    mark,
    displayPrice, // MARK-FIRST - stable price

    // Volume only (no OI, IV, Greeks in UI per requirement)
    volume: raw.volume || 0,

    status,
    statusReason: reason,
  }
}

export async function GET(request: Request) {
  const config = validateTradierConfig()
  if (!config.valid) {
    console.log("[v0] Tradier Chains - Config invalid:", config.error)
    return NextResponse.json({ error: config.error }, { status: 500, headers: NO_CACHE_HEADERS })
  }

  // Parse URL safely
  let symbolParam: string | null = null
  let expiration: string | null = null

  try {
    const url = new URL(request.url)
    symbolParam = url.searchParams.get("symbol")
    expiration = url.searchParams.get("expiration")
  } catch (urlError) {
    // Fallback: parse query string manually
    const queryString = request.url.split("?")[1] || ""
    const params = new URLSearchParams(queryString)
    symbolParam = params.get("symbol")
    expiration = params.get("expiration")
  }

  if (!symbolParam) {
    return NextResponse.json(
      { error: "symbol parameter is required" },
      { status: 400, headers: NO_CACHE_HEADERS }
    )
  }

  // REQUIRE expiration - do not auto-fetch
  if (!expiration) {
    return NextResponse.json(
      { error: "Missing expiration. Fetch expirations first via /api/tradier/options/expirations" },
      { status: 400, headers: NO_CACHE_HEADERS }
    )
  }

  const symbol = sanitizeSymbol(symbolParam)

  try {
    // Build URL safely
    const baseUrl = config.baseUrl.replace(/\/$/, "")
    const endpoint = `${baseUrl}/markets/options/chains?symbol=${encodeURIComponent(symbol)}&expiration=${encodeURIComponent(expiration)}&greeks=true`

    console.log("[v0] Tradier Chains - Fetching:", endpoint)
    console.log("[v0] Tradier Chains - Token present:", !!config.token, "Length:", config.token?.length)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000) // 15s timeout for chains

    let response: Response
    try {
      response = await fetch(endpoint, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${config.token}`,
          Accept: "application/json",
        },
        cache: "no-store",
        signal: controller.signal,
      })
    } catch (fetchError) {
      clearTimeout(timeoutId)
      const errMsg = fetchError instanceof Error ? fetchError.message : String(fetchError)
      console.error("[v0] Tradier Chains - Network error:", errMsg)
      return NextResponse.json(
        {
          error: "Network error connecting to Tradier API",
          details: errMsg,
          symbol,
          expiration,
          hint: "Check if TRADIER_API_KEY is valid and the API is accessible"
        },
        { status: 503, headers: NO_CACHE_HEADERS }
      )
    }

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[Tradier Chains] API error:", response.status, errorText.slice(0, 300))
      return NextResponse.json(
        {
          error: `Tradier API error: ${response.status}`,
          details: errorText.slice(0, 300),
          symbol,
          expiration,
        },
        { status: response.status, headers: NO_CACHE_HEADERS }
      )
    }

    const data = await response.json()

    // Parse options
    let rawOptions: TradierRawOption[] = []
    if (data.options?.option) {
      rawOptions = Array.isArray(data.options.option) ? data.options.option : [data.options.option]
    }

    // Normalize and separate calls/puts
    const normalizedOptions = rawOptions.map(normalizeOption)
    const calls = normalizedOptions.filter((o) => o.optionType === "call").sort((a, b) => a.strike - b.strike)
    const puts = normalizedOptions.filter((o) => o.optionType === "put").sort((a, b) => a.strike - b.strike)

    const responseData: OptionsChainResponse = {
      symbol,
      expirations: [expiration], // Only the requested expiration
      chain: [
        {
          expiration,
          calls,
          puts,
        },
      ],
      lastUpdated: Date.now(),
    }

    return NextResponse.json(responseData, { headers: NO_CACHE_HEADERS })
  } catch (error) {
    console.error("[Tradier Chains] Fetch error:", error)
    return NextResponse.json(
      { error: "Failed to fetch options chain", details: String(error), symbol, expiration },
      { status: 500, headers: NO_CACHE_HEADERS }
    )
  }
}
