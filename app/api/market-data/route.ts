import { NextResponse } from "next/server"
import { getMarketStatus } from "@/lib/market-calendar"
import { generateRealisticCandles } from "@/lib/simulated-data"
import {
  getQuote as getPublicQuote,
  getCandles as getPublicCandles,
  validatePublicApiConfig,
  mapSymbolForPublic
} from "@/lib/public-api"

// Aggregate candles for larger timeframes
function aggregateCandles(candles: any[], factor: number) {
  const aggregatedCandles = []
  for (let i = 0; i < candles.length; i += factor) {
    const chunk = candles.slice(i, i + factor)
    if (chunk.length === 0) continue
    const open = chunk[0].open
    const high = Math.max(...chunk.map((c: any) => c.high))
    const low = Math.min(...chunk.map((c: any) => c.low))
    const close = chunk[chunk.length - 1].close
    const volume = chunk.reduce((sum: number, c: any) => sum + c.volume, 0)
    aggregatedCandles.push({ timestamp: chunk[0].timestamp, open, high, low, close, volume })
  }
  return aggregatedCandles
}

// Get interval minutes for resolution
function getIntervalMinutes(resolution: string) {
  const intervalMap: Record<string, number> = {
    "1": 1,
    "5": 5,
    "15": 15,
    "30": 30,
    "60": 60,
    "D": 1440,
    "W": 10080,
    "M": 43200,
  }
  return intervalMap[resolution] || 5
}

// Base prices for different tickers (used in simulated data) - Updated Jan 2026
const TICKER_BASE_PRICES: Record<string, number> = {
  SPX: 6050,
  SPY: 605,
  QQQ: 530,
  AAPL: 225,
  GOOGL: 198,
  TSLA: 415,
  NVDA: 138,
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get("endpoint") || "quote"
  const symbol = searchParams.get("symbol") || "SPX"

  // Check which APIs are available
  const publicApiConfig = validatePublicApiConfig()
  const hasPublicApi = publicApiConfig.valid
  const finnhubApiKey = process.env.FINNHUB_API_KEY

  const marketStatus = getMarketStatus()
  const basePrice = TICKER_BASE_PRICES[symbol] || 100

  // Validate and clean the Finnhub API key (prevent malformed keys)
  const cleanFinnhubKey = finnhubApiKey?.trim() || ""
  const isValidFinnhubKey = cleanFinnhubKey.length > 10 && /^[a-zA-Z0-9]+$/.test(cleanFinnhubKey)

  console.log("[v0] Market data request:", {
    endpoint,
    symbol,
    hasPublicApi,
    hasFinnhubKey: !!finnhubApiKey,
    marketOpen: marketStatus.isOpen
  })

  try {
    // ========== QUOTE ENDPOINT ==========
    if (endpoint === "quote") {

      // Try Public.com API FIRST (primary source)
      if (hasPublicApi) {
        try {
          const mappedSymbol = mapSymbolForPublic(symbol)
          console.log("[v0] Trying Public.com API for quote:", mappedSymbol)

          const quote = await getPublicQuote(mappedSymbol)

          if (quote && quote.price > 0) {
            console.log("[v0] Public.com quote:", { symbol: mappedSymbol, price: quote.price, change: quote.change })
            return NextResponse.json({
              c: quote.price,
              d: quote.change || 0,
              dp: quote.change_percent || 0,
              h: quote.high || quote.price,
              l: quote.low || quote.price,
              o: quote.open || quote.price,
              pc: quote.previous_close || quote.price - (quote.change || 0),
              t: Math.floor(Date.now() / 1000),
              source: "public",
              originalSymbol: symbol,
              mappedSymbol,
            })
          }
          console.log("[v0] Public.com quote returned no data, trying fallback")
        } catch (e) {
          console.log("[v0] Public.com quote error:", e)
        }
      }

      // Try Finnhub as backup (provides after-hours data for US stocks)
      if (isValidFinnhubKey) {
        try {
          // Finnhub uses different symbols - map common ones
          const finnhubSymbol = symbol === "SPX" ? "^GSPC" : symbol

          const finnhubUrl = new URL("https://finnhub.io/api/v1/quote")
          finnhubUrl.searchParams.set("symbol", finnhubSymbol)
          finnhubUrl.searchParams.set("token", cleanFinnhubKey)

          const response = await fetch(finnhubUrl.toString(), {
            cache: "no-store",
            next: { revalidate: 0 }
          })

          if (response.ok) {
            const data = await response.json()
            if (data.c && data.c > 0 && !data.error) {
              console.log("[v0] Finnhub quote:", { symbol: finnhubSymbol, price: data.c })
              return NextResponse.json({
                c: data.c,
                d: data.d || 0,
                dp: data.dp || 0,
                h: data.h || data.c,
                l: data.l || data.c,
                o: data.o || data.c,
                pc: data.pc || data.c,
                t: Math.floor(Date.now() / 1000),
                source: "finnhub",
              })
            }
          }
          console.log("[v0] Finnhub quote failed")
        } catch (e) {
          console.log("[v0] Finnhub quote error:", e)
        }
      } else if (finnhubApiKey) {
        console.log("[v0] Skipping Finnhub - API key appears invalid")
      }

      // Try Yahoo Finance as final backup (public API, works after hours)
      try {
        const yahooSymbol = symbol === "SPX" ? "^GSPC" : symbol
        const response = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1m&range=1d`,
          {
            cache: "no-store",
            next: { revalidate: 0 },
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          }
        )

        if (response.ok) {
          const data = await response.json()
          const result = data.chart?.result?.[0]
          const meta = result?.meta

          if (meta?.regularMarketPrice) {
            const price = meta.regularMarketPrice
            const prevClose = meta.previousClose || meta.chartPreviousClose || price
            const change = price - prevClose
            const changePercent = (change / prevClose) * 100

            console.log("[v0] Yahoo quote:", { symbol: yahooSymbol, price, afterHours: !marketStatus.isOpen })
            return NextResponse.json({
              c: price,
              d: change,
              dp: changePercent,
              h: meta.regularMarketDayHigh || price,
              l: meta.regularMarketDayLow || price,
              o: meta.regularMarketOpen || price,
              pc: prevClose,
              t: Math.floor(Date.now() / 1000),
              source: "yahoo",
              afterHours: !marketStatus.isOpen,
            })
          }
        }
        console.log("[v0] Yahoo quote failed")
      } catch (e) {
        console.log("[v0] Yahoo quote error:", e)
      }

      // Fallback to simulated data
      console.log("[v0] Using simulated quote for", symbol)
      const simulatedPrice = basePrice + (Math.random() - 0.5) * (basePrice * 0.003)
      const previousClose = basePrice * 0.998
      return NextResponse.json({
        c: simulatedPrice,
        d: simulatedPrice - previousClose,
        dp: ((simulatedPrice - previousClose) / previousClose) * 100,
        h: simulatedPrice + basePrice * 0.002,
        l: simulatedPrice - basePrice * 0.002,
        o: previousClose + basePrice * 0.001,
        pc: previousClose,
        t: Math.floor(Date.now() / 1000),
        source: "simulated",
      })
    }

    // ========== CANDLES ENDPOINT ==========
    if (endpoint === "candles") {
      const resolution = searchParams.get("resolution") || "5"
      const isIntraday = !["D", "W", "M"].includes(resolution)

      // Try Public.com API FIRST for candles
      if (hasPublicApi) {
        try {
          const mappedSymbol = mapSymbolForPublic(symbol)
          console.log("[v0] Trying Public.com API for candles:", mappedSymbol, resolution)

          const candles = await getPublicCandles(mappedSymbol, resolution)

          if (candles && candles.length > 0) {
            console.log("[v0] Public.com candles:", candles.length, "for", mappedSymbol)

            // Aggregate if needed for larger timeframes
            let processedCandles = candles
            if (resolution === "30" || resolution === "60") {
              const factor = resolution === "30" ? 2 : 4
              processedCandles = aggregateCandles(candles, factor)
            }

            return NextResponse.json({
              candles: processedCandles,
              source: "public",
              resolution,
              originalSymbol: symbol,
              mappedSymbol,
            })
          }
          console.log("[v0] Public.com candles returned no data, trying fallback")
        } catch (e) {
          console.log("[v0] Public.com candles error:", e)
        }
      }

      // Try Finnhub as backup for candles (only for daily+ timeframes)
      if (isValidFinnhubKey && !isIntraday) {
        try {
          const finnhubSymbol = symbol === "SPX" ? "^GSPC" : symbol
          const to = Math.floor(Date.now() / 1000)
          const from = to - 90 * 24 * 60 * 60 // 90 days

          const finnhubCandleUrl = new URL("https://finnhub.io/api/v1/stock/candle")
          finnhubCandleUrl.searchParams.set("symbol", finnhubSymbol)
          finnhubCandleUrl.searchParams.set("resolution", "D")
          finnhubCandleUrl.searchParams.set("from", from.toString())
          finnhubCandleUrl.searchParams.set("to", to.toString())
          finnhubCandleUrl.searchParams.set("token", cleanFinnhubKey)

          const response = await fetch(finnhubCandleUrl.toString(), {
            cache: "no-store",
            next: { revalidate: 0 }
          })

          if (response.ok) {
            const data = await response.json()
            if (data.s === "ok" && data.t && data.t.length > 0 && !data.error) {
              const candles = data.t.map((timestamp: number, i: number) => ({
                timestamp: timestamp * 1000,
                open: data.o[i],
                high: data.h[i],
                low: data.l[i],
                close: data.c[i],
                volume: data.v[i],
              }))
              console.log("[v0] Finnhub candles:", candles.length)
              return NextResponse.json({ candles, source: "finnhub", resolution })
            }
          }
          console.log("[v0] Finnhub candles failed")
        } catch (e) {
          console.log("[v0] Finnhub candles error:", e)
        }
      }

      // Try Yahoo Finance for candles (works after hours with extended hours data)
      try {
        const yahooSymbol = symbol === "SPX" ? "^GSPC" : symbol
        const intervalMap: Record<string, string> = {
          "1": "1m",
          "5": "5m",
          "15": "15m",
          "30": "30m",
          "60": "1h",
          "D": "1d",
          "W": "1wk",
          "M": "1mo",
        }
        const yahooInterval = intervalMap[resolution] || "5m"
        const rangeMap: Record<string, string> = {
          "1": "1d",
          "5": "5d",
          "15": "5d",
          "30": "1mo",
          "60": "1mo",
          "D": "6mo",
          "W": "2y",
          "M": "5y",
        }
        const yahooRange = rangeMap[resolution] || "5d"

        const response = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=${yahooInterval}&range=${yahooRange}&includePrePost=true`,
          {
            cache: "no-store",
            next: { revalidate: 0 },
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          }
        )

        if (response.ok) {
          const data = await response.json()
          const result = data.chart?.result?.[0]
          const timestamps = result?.timestamp
          const quote = result?.indicators?.quote?.[0]

          if (timestamps && quote && timestamps.length > 0) {
            const candles = timestamps.map((ts: number, i: number) => ({
              timestamp: ts * 1000,
              open: quote.open?.[i] || quote.close?.[i],
              high: quote.high?.[i] || quote.close?.[i],
              low: quote.low?.[i] || quote.close?.[i],
              close: quote.close?.[i],
              volume: quote.volume?.[i] || 0,
            })).filter((c: any) => c.close != null)

            if (candles.length > 0) {
              console.log("[v0] Yahoo candles:", candles.length, "for", symbol, "includePrePost=true")
              return NextResponse.json({ candles, source: "yahoo", resolution, afterHours: true })
            }
          }
        }
        console.log("[v0] Yahoo candles failed")
      } catch (e) {
        console.log("[v0] Yahoo candles error:", e)
      }

      // Fallback to simulated candles
      console.log("[v0] Using simulated candles for", symbol, resolution)
      const intervalMinutes = getIntervalMinutes(resolution)
      const candles = generateRealisticCandles(basePrice, 100, intervalMinutes)
      return NextResponse.json({ candles, source: "simulated", resolution })
    }

    return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 })
  } catch (error) {
    console.log("[v0] API error:", error)
    const candles = generateRealisticCandles(basePrice, 100, 5)
    return NextResponse.json({ candles, source: "simulated" })
  }
}
