// Public.com API Integration for Market Data
// Documentation: https://public.com/api/docs

export interface PublicQuote {
  symbol: string
  name?: string
  price: number
  change: number
  change_percent: number
  open: number
  high: number
  low: number
  close: number
  previous_close: number
  volume: number
  timestamp: number
  bid?: number
  ask?: number
  bid_size?: number
  ask_size?: number
}

export interface PublicCandle {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface PublicOptionContract {
  symbol: string
  underlying: string
  strike: number
  expiration: string
  option_type: 'call' | 'put'
  bid: number
  ask: number
  last: number
  volume: number
  open_interest: number
  implied_volatility?: number
  delta?: number
  gamma?: number
  theta?: number
  vega?: number
}

export interface PublicExpirationDate {
  date: string
  strikes: number[]
}

// API Configuration
const PUBLIC_API_BASE = 'https://api.public.com/v1'

// Headers for Public.com API
function getHeaders(): HeadersInit {
  const apiKey = process.env.PUBLIC_API_KEY
  const secretKey = process.env.PUBLIC_SECRET_KEY

  if (!secretKey) {
    throw new Error('PUBLIC_SECRET_KEY is not configured')
  }

  return {
    'Authorization': `Bearer ${secretKey}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
}

// Fetch with retry and timeout
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = 3,
  timeout = 10000
): Promise<Response> {
  let lastError: Error | null = null

  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      const urlObj = new URL(url)
      if (options.method === 'GET' || !options.method) {
        urlObj.searchParams.set('_t', Date.now().toString())
      }

      const response = await fetch(urlObj.toString(), {
        ...options,
        cache: 'no-store',
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        return response
      }

      // Handle rate limiting
      if (response.status === 429) {
        console.warn('[Public API] Rate limited, retrying...')
        await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)))
        continue
      }

      // Try to get error details
      const errorText = await response.text()
      throw new Error(`Public API error ${response.status}: ${errorText.slice(0, 200)}`)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (lastError.name === 'AbortError') {
        throw new Error('Request timeout - Public API is not responding')
      }

      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)))
      }
    }
  }

  throw lastError || new Error('Failed to fetch from Public API')
}

// Get stock quote
export async function getQuote(symbol: string): Promise<PublicQuote | null> {
  try {
    const url = `${PUBLIC_API_BASE}/market-data/quotes?symbols=${encodeURIComponent(symbol)}`

    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: getHeaders(),
    })

    const data = await response.json()

    if (data.quotes && data.quotes.length > 0) {
      const quote = data.quotes[0]
      return {
        symbol: quote.symbol,
        name: quote.name,
        price: quote.last_price || quote.price || 0,
        change: quote.change || 0,
        change_percent: quote.change_percent || quote.percent_change || 0,
        open: quote.open || 0,
        high: quote.high || 0,
        low: quote.low || 0,
        close: quote.close || quote.last_price || 0,
        previous_close: quote.previous_close || quote.prev_close || 0,
        volume: quote.volume || 0,
        timestamp: quote.timestamp ? new Date(quote.timestamp).getTime() : Date.now(),
        bid: quote.bid,
        ask: quote.ask,
        bid_size: quote.bid_size,
        ask_size: quote.ask_size,
      }
    }

    return null
  } catch (error) {
    console.error('[Public API] Quote error:', error)
    return null
  }
}

// Get multiple quotes
export async function getQuotes(symbols: string[]): Promise<PublicQuote[]> {
  try {
    const symbolList = symbols.join(',')
    const url = `${PUBLIC_API_BASE}/market-data/quotes?symbols=${encodeURIComponent(symbolList)}`

    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: getHeaders(),
    })

    const data = await response.json()

    if (data.quotes && Array.isArray(data.quotes)) {
      return data.quotes.map((quote: any) => ({
        symbol: quote.symbol,
        name: quote.name,
        price: quote.last_price || quote.price || 0,
        change: quote.change || 0,
        change_percent: quote.change_percent || quote.percent_change || 0,
        open: quote.open || 0,
        high: quote.high || 0,
        low: quote.low || 0,
        close: quote.close || quote.last_price || 0,
        previous_close: quote.previous_close || quote.prev_close || 0,
        volume: quote.volume || 0,
        timestamp: quote.timestamp ? new Date(quote.timestamp).getTime() : Date.now(),
        bid: quote.bid,
        ask: quote.ask,
        bid_size: quote.bid_size,
        ask_size: quote.ask_size,
      }))
    }

    return []
  } catch (error) {
    console.error('[Public API] Quotes error:', error)
    return []
  }
}

// Get historical candles/bars
export async function getCandles(
  symbol: string,
  resolution: string = '5',
  from?: number,
  to?: number
): Promise<PublicCandle[]> {
  try {
    // Map resolution to Public.com interval format
    const intervalMap: Record<string, string> = {
      '1': '1min',
      '5': '5min',
      '15': '15min',
      '30': '30min',
      '60': '1hour',
      'D': '1day',
      'W': '1week',
      'M': '1month',
    }

    const interval = intervalMap[resolution] || '5min'

    // Default time range
    const now = Math.floor(Date.now() / 1000)
    const fromTime = from || (now - (resolution === 'D' ? 90 * 86400 : 7 * 86400))
    const toTime = to || now

    const params = new URLSearchParams({
      symbol,
      interval,
      start: new Date(fromTime * 1000).toISOString(),
      end: new Date(toTime * 1000).toISOString(),
    })

    const url = `${PUBLIC_API_BASE}/market-data/candles?${params.toString()}`

    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: getHeaders(),
    })

    const data = await response.json()

    if (data.candles && Array.isArray(data.candles)) {
      return data.candles.map((candle: any) => ({
        timestamp: new Date(candle.timestamp || candle.time).getTime(),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume || 0,
      }))
    }

    // Try alternate response format
    if (data.bars && Array.isArray(data.bars)) {
      return data.bars.map((bar: any) => ({
        timestamp: new Date(bar.t || bar.timestamp).getTime(),
        open: bar.o || bar.open,
        high: bar.h || bar.high,
        low: bar.l || bar.low,
        close: bar.c || bar.close,
        volume: bar.v || bar.volume || 0,
      }))
    }

    return []
  } catch (error) {
    console.error('[Public API] Candles error:', error)
    return []
  }
}

// Get option expirations
export async function getOptionExpirations(symbol: string): Promise<string[]> {
  try {
    const url = `${PUBLIC_API_BASE}/market-data/options/expirations?underlying=${encodeURIComponent(symbol)}`

    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: getHeaders(),
    })

    const data = await response.json()

    if (data.expirations && Array.isArray(data.expirations)) {
      return data.expirations.map((exp: any) =>
        typeof exp === 'string' ? exp : exp.date
      )
    }

    return []
  } catch (error) {
    console.error('[Public API] Option expirations error:', error)
    return []
  }
}

// Get option chain
export async function getOptionChain(
  symbol: string,
  expiration: string
): Promise<{ calls: PublicOptionContract[], puts: PublicOptionContract[] }> {
  try {
    const params = new URLSearchParams({
      underlying: symbol,
      expiration,
    })

    const url = `${PUBLIC_API_BASE}/market-data/options/chains?${params.toString()}`

    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: getHeaders(),
    })

    const data = await response.json()

    const calls: PublicOptionContract[] = []
    const puts: PublicOptionContract[] = []

    if (data.options && Array.isArray(data.options)) {
      for (const option of data.options) {
        const contract: PublicOptionContract = {
          symbol: option.symbol,
          underlying: option.underlying || symbol,
          strike: option.strike || option.strike_price,
          expiration: option.expiration || expiration,
          option_type: option.option_type || option.type,
          bid: option.bid || 0,
          ask: option.ask || 0,
          last: option.last || option.last_price || 0,
          volume: option.volume || 0,
          open_interest: option.open_interest || 0,
          implied_volatility: option.implied_volatility || option.iv,
          delta: option.delta,
          gamma: option.gamma,
          theta: option.theta,
          vega: option.vega,
        }

        if (contract.option_type === 'call') {
          calls.push(contract)
        } else {
          puts.push(contract)
        }
      }
    }

    // Sort by strike
    calls.sort((a, b) => a.strike - b.strike)
    puts.sort((a, b) => a.strike - b.strike)

    return { calls, puts }
  } catch (error) {
    console.error('[Public API] Option chain error:', error)
    return { calls: [], puts: [] }
  }
}

// Validate API configuration
export function validatePublicApiConfig(): { valid: boolean; error?: string } {
  const secretKey = process.env.PUBLIC_SECRET_KEY

  if (!secretKey) {
    return { valid: false, error: 'PUBLIC_SECRET_KEY is not configured' }
  }

  return { valid: true }
}

// Cache for API responses
const apiCache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_TTL = 3000 // 3 seconds for real-time data

export function getCached<T>(key: string): T | null {
  const entry = apiCache.get(key)
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data as T
  }
  apiCache.delete(key)
  return null
}

export function setCache(key: string, data: unknown): void {
  apiCache.set(key, { data, timestamp: Date.now() })

  // Clean old entries
  if (apiCache.size > 100) {
    const now = Date.now()
    for (const [k, v] of apiCache.entries()) {
      if (now - v.timestamp > CACHE_TTL) {
        apiCache.delete(k)
      }
    }
  }
}

// Symbol mapping for index symbols
export function mapSymbolForPublic(symbol: string): string {
  const upper = symbol.toUpperCase().replace('$', '')

  // Map common index symbols
  const symbolMap: Record<string, string> = {
    'SPX': 'SPY', // Use SPY as proxy for SPX (SPX may not be available)
    '^GSPC': 'SPY',
    '^SPX': 'SPY',
  }

  return symbolMap[upper] || upper
}

// Check if Public.com API is available
export async function checkApiHealth(): Promise<boolean> {
  try {
    const config = validatePublicApiConfig()
    if (!config.valid) return false

    // Try a simple quote request
    const quote = await getQuote('SPY')
    return quote !== null && quote.price > 0
  } catch {
    return false
  }
}
