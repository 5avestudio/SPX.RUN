// Tradier Market Data Integration

export interface MarketDataPoint {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface QuoteData {
  c: number // Current price
  d: number // Change
  dp: number // Percent change
  h: number // High price of the day
  l: number // Low price of the day
  o: number // Open price of the day
  pc: number // Previous close price
  t: number // Timestamp
  source?: string // Data source
}

export async function fetchQuote(symbol = "SPX"): Promise<QuoteData | null> {
  try {
    const params = new URLSearchParams({ endpoint: "quote", symbol })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    const response = await fetch(`/api/market-data?${params.toString()}`, {
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) return null
    const data = await response.json()
    console.log("[v0] Quote data source:", data.source, "symbol:", symbol)
    return data
  } catch (error) {
    console.log("[v0] Quote fetch failed, using simulated data for", symbol)
    // Base prices for different tickers
    const basePrices: Record<string, number> = {
      SPX: 6858,
      SPY: 685,
      QQQ: 520,
      AAPL: 195,
      GOOGL: 175,
      TSLA: 245,
      NVDA: 135,
    }
    const basePrice = basePrices[symbol] || 100
    const simulatedPrice = basePrice + (Math.random() - 0.5) * (basePrice * 0.01)
    const previousClose = basePrice * 0.998
    return {
      c: simulatedPrice,
      d: simulatedPrice - previousClose,
      dp: ((simulatedPrice - previousClose) / previousClose) * 100,
      h: simulatedPrice + basePrice * 0.005,
      l: simulatedPrice - basePrice * 0.005,
      o: previousClose + basePrice * 0.002,
      pc: previousClose,
      t: Math.floor(Date.now() / 1000),
    }
  }
}

export async function fetchCandles(resolution = "5", symbol = "SPX"): Promise<MarketDataPoint[]> {
  try {
    console.log("[v0] fetchCandles called with resolution:", resolution, "symbol:", symbol)

    const params = new URLSearchParams({ endpoint: "candles", resolution, symbol })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(`/api/market-data?${params.toString()}`, {
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) return generateMockData(symbol)
    const data = await response.json()
    console.log("[v0] Candles data source:", data.source, "symbol:", symbol, "Count:", data.candles?.length || 0)
    return data.candles || generateMockData(symbol)
  } catch (error) {
    console.log("[v0] Candles fetch failed, using mock data for", symbol)
    return generateMockData(symbol)
  }
}

// Base prices for different tickers
const TICKER_BASE_PRICES: Record<string, number> = {
  SPX: 6050,
  SPY: 605,
  QQQ: 530,
  AAPL: 225,
  GOOGL: 198,
  TSLA: 410,
  NVDA: 138,
}

export function generateMockData(symbol = "SPX"): MarketDataPoint[] {
  const basePrice = TICKER_BASE_PRICES[symbol] || 100
  const volatility = symbol === "TSLA" ? 3 : symbol === "NVDA" ? 2.5 : 1.5 // Higher volatility for meme stocks
  const data: MarketDataPoint[] = []
  const now = Date.now()

  for (let i = 100; i >= 0; i--) {
    const timestamp = now - i * 60 * 1000
    const randomWalk = (Math.random() - 0.5) * (basePrice * 0.005 * volatility)
    const open = basePrice + randomWalk + i * (basePrice * 0.0001)
    const high = open + Math.random() * (basePrice * 0.003)
    const low = open - Math.random() * (basePrice * 0.003)
    const close = low + Math.random() * (high - low)
    const volume = Math.floor(Math.random() * 1000000) + 500000
    data.push({ timestamp, open, high, low, close, volume })
  }

  return data
}

export function generateMockSPXData(): MarketDataPoint[] {
  return generateMockData("SPX")
}

// Simulate real-time update when API not available
export function simulateRealTimeUpdate(lastData: MarketDataPoint): MarketDataPoint {
  const timestamp = Date.now()
  const priceChange = (Math.random() - 0.48) * 5
  const open = lastData.close
  const close = open + priceChange
  const high = Math.max(open, close) + Math.random() * 3
  const low = Math.min(open, close) - Math.random() * 3
  const volume = Math.floor(Math.random() * 100000) + 50000

  return { timestamp, open, high, low, close, volume }
}

// Calculate time until optimal entry (10am PT / 1pm ET)
export function getTimeUntilOptimalEntry(): {
  hours: number
  minutes: number
  isOptimalTime: boolean
} {
  const now = new Date()
  const targetHour = 13
  const targetMinute = 0

  const currentHour = now.getUTCHours() - 5
  const currentMinute = now.getMinutes()

  const isOptimalTime = currentHour >= targetHour && currentHour < 16

  let hours = targetHour - currentHour
  let minutes = targetMinute - currentMinute

  if (minutes < 0) {
    hours -= 1
    minutes += 60
  }

  if (hours < 0) {
    hours += 24
  }

  return { hours, minutes, isOptimalTime }
}

// Calculate time until optimal entry (10am PT / 1pm ET)
export function getSPXTimingWindow(): SPXTimingWindow {
  const now = new Date()
  const hour = now.getHours()
  const minute = now.getMinutes()
  const dayOfWeek = now.getDay()
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5

  // Market closed on weekends
  if (!isWeekday) {
    return {
      window: "CLOSED",
      label: "Market Closed",
      description: "Markets open Monday 9:30am ET",
      action: "WAIT",
      isSPXGoldenWindow: false,
    }
  }

  // Pre-market (before 9:30am)
  if (hour < 9 || (hour === 9 && minute < 30)) {
    const minutesUntilOpen = (9 - hour) * 60 + (30 - minute)
    return {
      window: "PRE_MARKET",
      label: "Pre-Market",
      description: "Market opens at 9:30am ET",
      action: "WAIT",
      minutesRemaining: minutesUntilOpen,
      isSPXGoldenWindow: false,
    }
  }

  // Opening volatility (9:30-10:00am)
  if (hour === 9 && minute >= 30) {
    return {
      window: "OPENING",
      label: "Opening Bell",
      description: "High spreads, wide swings - wait for stability",
      action: "CAUTION",
      minutesRemaining: 60 - minute,
      isSPXGoldenWindow: false,
    }
  }

  // Morning session (10:00am-12:00pm)
  if (hour >= 10 && hour < 12) {
    return {
      window: "MORNING",
      label: "Morning Session",
      description: "Trend establishment - watch for setups",
      action: "ENTER",
      isSPXGoldenWindow: false,
    }
  }

  // Lunch lull (12:00-1:00pm)
  if (hour === 12) {
    const minutesUntilPowerHour = 60 - minute
    return {
      window: "LUNCH",
      label: "Lunch Lull",
      description: "Low volume - prepare for power hour",
      action: "WAIT",
      minutesRemaining: minutesUntilPowerHour,
      isSPXGoldenWindow: false,
    }
  }

  // Power Hour (1:00-3:45pm)
  if (hour >= 13 && (hour < 15 || (hour === 15 && minute < 45))) {
    const minutesUntilFinalRush = (15 - hour) * 60 + (45 - minute)
    return {
      window: "POWER_HOUR",
      label: "Power Hour",
      description: "OTM options 1-5 strikes away can explode on reversals",
      action: "SCALP",
      minutesRemaining: minutesUntilFinalRush,
      isSPXGoldenWindow: false,
    }
  }

  // SPX FINAL RUSH - THE GOLDEN WINDOW (3:45-4:00pm)
  if (hour === 15 && minute >= 45) {
    const minutesRemaining = 60 - minute
    return {
      window: "FINAL_RUSH",
      label: "SPX FINAL RUSH",
      description: "$3-60 entries explode! Enter NOW, exit within 15 min",
      action: "SCALP",
      minutesRemaining,
      isSPXGoldenWindow: true, // This is THE window for SPX
    }
  }

  // Market closed (after 4pm)
  return {
    window: "CLOSED",
    label: "Market Closed",
    description: "Markets open tomorrow 9:30am ET",
    action: "WAIT",
    isSPXGoldenWindow: false,
  }
}

// Check if we're in SPX Final Rush window
export function isSPXFinalRush(): boolean {
  const now = new Date()
  const hour = now.getHours()
  const minute = now.getMinutes()
  const dayOfWeek = now.getDay()
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5

  // 3:45-4:00pm ET on weekdays
  return isWeekday && hour === 15 && minute >= 45
}

// Get cheap OTM strikes for Final Rush scalping
export function getFinalRushStrikes(currentPrice: number, direction: "CALL" | "PUT"): number[] {
  const atmStrike = Math.round(currentPrice / 5) * 5
  const strikes: number[] = []

  // 1-5 strikes away in the trend direction
  for (let i = 1; i <= 5; i++) {
    if (direction === "CALL") {
      strikes.push(atmStrike + i * 5) // Above ATM for calls
    } else {
      strikes.push(atmStrike - i * 5) // Below ATM for puts
    }
  }

  return strikes
}

export function aggregateToTimeframe(data: MarketDataPoint[], minutesPerCandle: number): MarketDataPoint[] {
  if (data.length === 0 || minutesPerCandle <= 1) return data

  const aggregated: MarketDataPoint[] = []
  let currentCandle: MarketDataPoint | null = null
  let candleCount = 0

  for (const point of data) {
    if (candleCount === 0) {
      currentCandle = {
        timestamp: point.timestamp,
        open: point.open,
        high: point.high,
        low: point.low,
        close: point.close,
        volume: point.volume,
      }
    } else if (currentCandle) {
      currentCandle.high = Math.max(currentCandle.high, point.high)
      currentCandle.low = Math.min(currentCandle.low, point.low)
      currentCandle.close = point.close
      currentCandle.volume += point.volume
    }

    candleCount++

    if (candleCount >= minutesPerCandle && currentCandle) {
      aggregated.push(currentCandle)
      currentCandle = null
      candleCount = 0
    }
  }

  // Push any remaining partial candle
  if (currentCandle) {
    aggregated.push(currentCandle)
  }

  return aggregated
}

export interface SPXTimingWindow {
  window: "PRE_MARKET" | "OPENING" | "MORNING" | "LUNCH" | "POWER_HOUR" | "FINAL_RUSH" | "CLOSED"
  label: string
  description: string
  action: "WAIT" | "CAUTION" | "ENTER" | "SCALP" | "CLOSE"
  minutesRemaining?: number
  isSPXGoldenWindow: boolean // 3:45-4pm specifically for SPX
}

export interface OHLCData {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}
