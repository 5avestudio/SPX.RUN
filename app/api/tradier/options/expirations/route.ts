// /api/tradier/options/expirations - Get available expirations for a symbol
// Usage: GET /api/tradier/options/expirations?symbol=SPY

import { NextResponse } from "next/server"
import {
  type ExpirationsResponse,
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
    console.log("[v0] Tradier Expirations - Config invalid:", config.error)
    return NextResponse.json({ error: config.error }, { status: 500, headers: NO_CACHE_HEADERS })
  }

  // Parse URL safely
  let symbolParam: string | null = null
  try {
    const url = new URL(request.url)
    symbolParam = url.searchParams.get("symbol")
  } catch {
    // Fallback: parse query string manually
    const queryString = request.url.split("?")[1] || ""
    const params = new URLSearchParams(queryString)
    symbolParam = params.get("symbol")
  }

  if (!symbolParam) {
    return NextResponse.json(
      { error: "symbol parameter is required" },
      { status: 400, headers: NO_CACHE_HEADERS }
    )
  }

  const symbol = sanitizeSymbol(symbolParam)

  try {
    // Build URL safely
    const baseUrl = config.baseUrl.replace(/\/$/, "")
    const endpoint = `${baseUrl}/markets/options/expirations?symbol=${encodeURIComponent(symbol)}&includeAllRoots=true&strikes=false`

    console.log("[v0] Tradier Expirations - Fetching:", endpoint)
    console.log("[v0] Tradier Expirations - Token exists:", !!config.token)

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
        signal: controller.signal,
      })
    } catch (fetchError) {
      clearTimeout(timeoutId)
      const errMsg = fetchError instanceof Error ? fetchError.message : String(fetchError)
      console.error("[v0] Tradier Expirations - Network error:", errMsg)
      return NextResponse.json(
        { 
          error: "Network error connecting to Tradier API", 
          details: errMsg,
          symbol,
          hint: "Check if TRADIER_API_KEY is valid and the API is accessible"
        },
        { status: 503, headers: NO_CACHE_HEADERS }
      )
    }

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[Tradier Expirations] API error:", response.status, errorText.slice(0, 300))
      return NextResponse.json(
        { error: `Tradier API error: ${response.status}`, details: errorText.slice(0, 300) },
        { status: response.status, headers: NO_CACHE_HEADERS }
      )
    }

    const data = await response.json()

    // Extract expirations
    let expirations: string[] = []
    if (data.expirations?.date) {
      expirations = Array.isArray(data.expirations.date) ? data.expirations.date : [data.expirations.date]
    }

    const responseData: ExpirationsResponse = {
      symbol,
      expirations,
    }

    return NextResponse.json(responseData, { headers: NO_CACHE_HEADERS })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorName = error instanceof Error ? error.name : "Unknown"
    
    console.error("[v0] Tradier Expirations - Error:", {
      name: errorName,
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    })

    // Check for specific error types
    if (errorName === "AbortError") {
      return NextResponse.json(
        { error: "Request timeout - Tradier API took too long to respond" },
        { status: 504, headers: NO_CACHE_HEADERS }
      )
    }

    return NextResponse.json(
      { 
        error: "Failed to fetch expirations", 
        details: errorMessage,
        errorType: errorName,
      },
      { status: 500, headers: NO_CACHE_HEADERS }
    )
  }
}
