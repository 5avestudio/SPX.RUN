// Finnhub API Integration for Real-Time SPX Data

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || ""
const BASE_URL = "https://finnhub.io/api/v1"

export async function fetchFinnhubQuote(): Promise<any | null> {
  try {
    const response = await fetch(`${BASE_URL}/quote?symbol=SPX&token=${FINNHUB_API_KEY}`, { next: { revalidate: 0 } })

    if (!response.ok) {
      console.log("[v0] Finnhub quote API error:", response.status)
      return null
    }

    const data = await response.json()
    console.log("[v0] Finnhub quote received:", data.c)
    return {
      c: data.c, // Current price
      d: data.d, // Change
      dp: data.dp, // Percent change
      h: data.h, // High
      l: data.l, // Low
      o: data.o, // Open
      pc: data.pc, // Previous close
      t: Math.floor(Date.now() / 1000),
      source: "finnhub-realtime",
    }
  } catch (error) {
    console.log("[v0] Finnhub quote error:", error)
    return null
  }
}

export async function fetchFinnhubCandles(resolution = "5"): Promise<any[] | null> {
  try {
    // Map our resolution format to Finnhub format
    const resolutionMap: Record<string, string> = {
      "1": "1",
      "5": "5",
      "15": "15",
      "30": "30",
      "60": "60",
      D: "D",
      W: "W",
      M: "M",
    }

    const finnhubResolution = resolutionMap[resolution] || "5"
    const to = Math.floor(Date.now() / 1000)
    const from = to - 24 * 60 * 60 // Last 24 hours

    const response = await fetch(
      `${BASE_URL}/stock/candle?symbol=SPX&resolution=${finnhubResolution}&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`,
      { next: { revalidate: 0 } },
    )

    if (!response.ok) {
      console.log("[v0] Finnhub candles API error:", response.status)
      return null
    }

    const data = await response.json()

    if (data.s !== "ok" || !data.t || data.t.length === 0) {
      console.log("[v0] Finnhub returned no candle data")
      return null
    }

    // Convert Finnhub format to our format
    const candles = data.t.map((timestamp: number, i: number) => ({
      timestamp: timestamp * 1000, // Convert to ms
      open: data.o[i],
      high: data.h[i],
      low: data.l[i],
      close: data.c[i],
      volume: data.v[i],
    }))

    console.log("[v0] Finnhub candles received:", candles.length)
    return candles
  } catch (error) {
    console.log("[v0] Finnhub candles error:", error)
    return null
  }
}
