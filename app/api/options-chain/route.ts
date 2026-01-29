// Tradier Options Chain API Route
// ZERO CACHING - Uses mark-first pricing for stable display

import { type NextRequest, NextResponse } from "next/server"
import {
  fetchOptionsChain,
  fetchExpirations,
  filterOptionsNearPrice,
  getTodayExpiration,
  getOptionsSymbol,
} from "@/lib/tradier"
import { getMarketStatus } from "@/lib/market-calendar"
import { calculateMarkPrice, NO_CACHE_HEADERS, sanitizeSymbol } from "@/lib/tradier-types"

// Force dynamic - no caching
export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"
export const revalidate = 0

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const rawSymbol = searchParams.get("symbol") || "SPX"

  // IMPORTANT: For SPX, we MUST use SPXW to get 0DTE/daily expirations
  // SPX only returns monthly options (next expiration ~30 days out)
  // SPXW returns daily expirations including today's 0DTE
  const symbol = rawSymbol.toUpperCase() === "SPX" || rawSymbol.toUpperCase() === "SPXW" 
    ? "SPXW"  // Force SPXW for 0DTE options
    : getOptionsSymbol(rawSymbol)
  
  const expiration = searchParams.get("expiration") || getTodayExpiration()
  const currentPriceParam = searchParams.get("currentPrice")
  const range = Number.parseInt(searchParams.get("range") || "50", 10)

  const apiKey = process.env.TRADIER_API_KEY
  
  // Check if market is open - skip Tradier API calls when closed
  const marketStatus = getMarketStatus()
  
  // Return early with empty data if market is closed to avoid rate limiting
  if (!marketStatus.isOpen) {
    console.log("[v0] Market closed, skipping options chain API to avoid rate limits")
    return NextResponse.json({
      symbol: rawSymbol,
      expiration,
      expirations: [],
      options: [],
      count: 0,
      timestamp: Date.now(),
      warning: "Market is closed - options data unavailable",
      source: "market_closed",
      marketStatus: {
        isOpen: false,
        nextOpenLabel: marketStatus.nextOpenLabel,
      },
    })
  }

  if (!apiKey) {
    return NextResponse.json(
      {
        error: "TRADIER_API_KEY not configured",
        message: "Please add your Tradier API key to use real-time options data",
      },
      { status: 500 },
    )
  }

  console.log(
    `[v0] OPTIONS CHAIN API - rawSymbol: ${rawSymbol}, using: ${symbol}, expiration: ${expiration}, price: ${currentPriceParam}`,
  )

  // ZERO CACHING - always fetch fresh data
  try {
    // First check if the expiration is valid
    let expirations: Awaited<ReturnType<typeof fetchExpirations>>

    try {
      console.log(`[v0] Fetching expirations for ${symbol}`)
      expirations = await fetchExpirations(symbol, apiKey)
      console.log(`[v0] Found ${expirations.length} expirations`)
    } catch (expError) {
      const errorStr = String(expError)
      // Handle network errors gracefully
      if (errorStr.includes("NETWORK_ERROR") || errorStr.includes("Load failed")) {
        console.log("[v0] Network error fetching expirations, returning empty result")
        return NextResponse.json({
          symbol: rawSymbol,
          expiration,
          expirations: [],
          options: [],
          count: 0,
          timestamp: Date.now(),
          warning: "Network error - using simulated data",
          source: "simulated",
        })
      }
      if (!errorStr.includes("pattern")) {
        console.error("[v0] Failed to fetch expirations:", expError)
      }
      return NextResponse.json({
        symbol: rawSymbol,
        expiration,
        expirations: [],
        options: [],
        count: 0,
        timestamp: Date.now(),
        warning: "Market may be closed or API temporarily unavailable",
        source: "simulated",
      })
    }

    // Find matching expiration or closest one
    let targetExpiration = expiration
    if (expirations.length > 0) {
      const hasExactMatch = expirations.some((e) => e.date === expiration)
      if (!hasExactMatch) {
        // Use the closest expiration (usually today's 0DTE if available)
        const today = getTodayExpiration()
        const todayExp = expirations.find((e) => e.date === today)
        if (todayExp) {
          targetExpiration = todayExp.date
        } else {
          // Use first available expiration
          targetExpiration = expirations[0].date
        }
        console.log(`[v0] Adjusted expiration from ${expiration} to ${targetExpiration}`)
      }
    } else {
      // per Tradier support: the chain endpoint works directly
      console.log(`[v0] No expirations found, trying direct chain fetch for ${symbol} exp ${expiration}`)
    }

    // Fetch the options chain
    let options: Awaited<ReturnType<typeof fetchOptionsChain>>

    try {
      console.log(`[v0] Fetching options chain for ${symbol} exp ${targetExpiration}`)
      options = await fetchOptionsChain(symbol, targetExpiration, apiKey, true)
      console.log(`[v0] Received ${options.length} options from Tradier`)
    } catch (chainError) {
      const errorStr = String(chainError)
      // Handle network errors gracefully
      if (errorStr.includes("NETWORK_ERROR") || errorStr.includes("Load failed")) {
        console.log("[v0] Network error fetching options chain, returning empty result")
        return NextResponse.json({
          symbol: rawSymbol,
          expiration: targetExpiration,
          expirations: expirations.map((e) => e.date),
          options: [],
          count: 0,
          timestamp: Date.now(),
          warning: "Network error - using simulated data",
          source: "simulated",
        })
      }
      if (!errorStr.includes("pattern")) {
        console.error("[v0] Failed to fetch options chain:", chainError)
      }
      return NextResponse.json({
        symbol: rawSymbol,
        expiration: targetExpiration,
        expirations: expirations.map((e) => e.date),
        options: [],
        count: 0,
        timestamp: Date.now(),
        warning: "Options chain temporarily unavailable",
        source: "simulated",
      })
    }

    // Filter to relevant strikes if currentPrice provided
    let filteredOptions = options
    if (currentPriceParam) {
      const currentPrice = Number.parseFloat(currentPriceParam)
      filteredOptions = filterOptionsNearPrice(options, currentPrice, range)
      console.log(`[v0] Filtered to ${filteredOptions.length} options near price ${currentPrice}`)
    }

    // Sort by strike
    filteredOptions.sort((a, b) => a.strike - b.strike)

    // Tradier uses "option_type" but frontend expects "type"
    // Add mark-first pricing for stable display
    const transformedOptions = filteredOptions.map((opt) => {
      const { mark, displayPrice } = calculateMarkPrice(opt.bid, opt.ask, opt.last)
      return {
        symbol: opt.symbol,
        strike: opt.strike,
        // Map option_type to type for frontend compatibility
        type: (opt.option_type || opt.type) as "call" | "put",
        bid: opt.bid || 0,
        ask: opt.ask || 0,
        last: opt.last || 0,
        mark, // Calculated mid price
        displayPrice, // MARK-FIRST: stable price for UI
        volume: opt.volume || 0,
        open_interest: opt.open_interest || 0,
        greeks: opt.greeks
          ? {
              delta: opt.greeks.delta || 0,
              gamma: opt.greeks.gamma || 0,
              theta: opt.greeks.theta || 0,
              vega: opt.greeks.vega || 0,
              iv: opt.greeks.mid_iv || opt.greeks.smv_vol || 0,
            }
          : undefined,
      }
    })

    // Log options count for monitoring
    console.log(`[v0] OPTIONS CHAIN - Received ${transformedOptions.length} options for ${symbol} exp ${targetExpiration}`)

    const responseData = {
      symbol: rawSymbol,
      expiration: targetExpiration,
      expirations: expirations.map((e) => e.date),
      options: transformedOptions,
      count: transformedOptions.length,
      timestamp: Date.now(),
      source: transformedOptions.length > 0 ? "tradier" : "none",
    }

    // Return with no-cache headers
    return NextResponse.json(responseData, { headers: NO_CACHE_HEADERS })
  } catch (error) {
    const errorStr = String(error)
    if (!errorStr.includes("pattern")) {
      console.error("[v0] Options chain error:", error)
    }
    return NextResponse.json(
      {
        symbol: rawSymbol,
        expiration,
        expirations: [],
        options: [],
        count: 0,
        timestamp: Date.now(),
        warning: "Options data temporarily unavailable",
        source: "error",
      },
      { status: 200 },
    )
  }
}
