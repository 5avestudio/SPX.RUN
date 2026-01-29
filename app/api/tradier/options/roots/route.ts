// /api/tradier/options/roots - Get available option roots for a symbol
// Usage: GET /api/tradier/options/roots?underlying=SPX
// Returns available roots (e.g., SPX, SPXW) with preferred root selection

import { NextResponse } from "next/server"
import {
  type OptionsRootsResponse,
  sanitizeSymbol,
  validateTradierConfig,
  NO_CACHE_HEADERS,
} from "@/lib/tradier-types"

// Force dynamic - no caching
export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"
export const revalidate = 0

export async function GET(request: Request) {
  const config = validateTradierConfig()
  if (!config.valid) {
    console.log("[v0] Tradier Roots - Config invalid:", config.error)
    return NextResponse.json({ error: config.error }, { status: 500, headers: NO_CACHE_HEADERS })
  }

  // Parse URL safely
  let underlyingParam: string | null = null
  try {
    const url = new URL(request.url)
    underlyingParam = url.searchParams.get("underlying") || url.searchParams.get("symbol")
  } catch {
    // Fallback: parse query string manually
    const queryString = request.url.split("?")[1] || ""
    const params = new URLSearchParams(queryString)
    underlyingParam = params.get("underlying") || params.get("symbol")
  }

  if (!underlyingParam) {
    return NextResponse.json(
      { error: "underlying parameter is required" },
      { status: 400, headers: NO_CACHE_HEADERS }
    )
  }

  const underlying = sanitizeSymbol(underlyingParam)

  try {
    // Build URL safely
    const baseUrl = config.baseUrl.replace(/\/$/, "")
    const endpoint = `${baseUrl}/markets/options/lookup?underlying=${encodeURIComponent(underlying)}`

    console.log("[v0] Tradier Roots - Fetching:", endpoint)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

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
      console.error("[v0] Tradier Roots - Network error:", errMsg)
      // Fall back to underlying on network error
      const fallbackResponse: OptionsRootsResponse = {
        underlying,
        roots: [underlying],
        preferredRoot: underlying,
      }
      return NextResponse.json(fallbackResponse, { headers: NO_CACHE_HEADERS })
    }

    clearTimeout(timeoutId)

    if (!response.ok) {
      // If lookup fails, fall back to using the underlying symbol as the only root
      console.warn(`[Tradier Roots] Lookup failed for ${underlying}, falling back to [${underlying}]`)
      const fallbackResponse: OptionsRootsResponse = {
        underlying,
        roots: [underlying],
        preferredRoot: underlying,
      }
      return NextResponse.json(fallbackResponse, { headers: NO_CACHE_HEADERS })
    }

    const data = await response.json()

    // Extract roots from response
    let roots: string[] = []

    if (data.symbols) {
      // Tradier returns symbols array with root_symbol field
      const symbolsArray = Array.isArray(data.symbols) ? data.symbols : [data.symbols]
      const rootSet = new Set<string>()

      for (const sym of symbolsArray) {
        if (sym.root_symbol) {
          rootSet.add(sym.root_symbol)
        }
      }

      roots = Array.from(rootSet)
    }

    // If no roots found, fall back to underlying
    if (roots.length === 0) {
      roots = [underlying]
    }

    // Determine preferred root
    // For SPX: prefer SPXW (weekly) over SPX (monthly) for more frequent expirations
    let preferredRoot = underlying
    if (underlying === "SPX") {
      if (roots.includes("SPXW")) {
        preferredRoot = "SPXW"
      } else if (roots.includes("SPX")) {
        preferredRoot = "SPX"
      }
    } else {
      // For other symbols, prefer the underlying itself if available
      preferredRoot = roots.includes(underlying) ? underlying : roots[0]
    }

    const responseData: OptionsRootsResponse = {
      underlying,
      roots,
      preferredRoot,
    }

    return NextResponse.json(responseData, { headers: NO_CACHE_HEADERS })
  } catch (error) {
    console.error("[Tradier Roots] Fetch error:", error)

    // Fall back to underlying on error
    const fallbackResponse: OptionsRootsResponse = {
      underlying,
      roots: [underlying],
      preferredRoot: underlying,
    }
    return NextResponse.json(fallbackResponse, { headers: NO_CACHE_HEADERS })
  }
}
