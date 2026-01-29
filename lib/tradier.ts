// Tradier API Integration for Real-Time SPX Options Data

export interface TradierOption {
  symbol: string
  description: string
  exch: string
  type?: "call" | "put"
  option_type?: string
  last: number | null
  change: number | null
  volume: number
  open: number | null
  high: number | null
  low: number | null
  close: number | null
  bid: number
  ask: number
  underlying: string
  strike: number
  change_percentage: number | null
  average_volume: number
  last_volume: number
  trade_date: number
  prevclose: number | null
  week_52_high: number
  week_52_low: number
  bidsize: number
  bidexch: string
  bid_date: number
  asksize: number
  askexch: string
  ask_date: number
  open_interest: number
  contract_size: number
  expiration_date: string
  expiration_type: string
  root_symbol: string
  greeks?: TradierGreeks
}

export interface TradierGreeks {
  delta: number
  gamma: number
  theta: number
  vega: number
  rho: number
  phi: number
  bid_iv: number
  mid_iv: number
  ask_iv: number
  smv_vol: number
  updated_at: string
}

export interface TradierExpiration {
  date: string
  contract_size: number
  expiration_type: string
  strikes: number[]
}

export interface OptionsChainResponse {
  options: {
    option: TradierOption[] | TradierOption
  } | null
}

export interface ExpirationsResponse {
  expirations: {
    expiration: TradierExpiration[] | TradierExpiration
  } | null
}

export interface QuoteResponse {
  quotes: {
    quote: {
      symbol: string
      description: string
      last: number
      change: number
      change_percentage: number
      volume: number
      open: number
      high: number
      low: number
      close: number
      bid: number
      ask: number
      bidsize: number
      asksize: number
    }
  }
}

// SPX options: use SPXW for 0DTE/weekly options (daily expirations)
// SPX = monthly options only, SPXW = weekly/0DTE options
export function getOptionsSymbol(symbol: string, for0DTE = true): string {
  const upper = symbol.toUpperCase().replace("$", "")
  // For SPX variants, use SPXW to get 0DTE/daily expirations
  if (upper === "SPX" || upper === "SPXW" || upper === "SPX.X" || upper === "SPXAM") {
    return for0DTE ? "SPXW" : "SPX"
  }
  return upper
}

// Get today's expiration date in YYYY-MM-DD format
export function getTodayExpiration(): string {
  const now = new Date()
  return now.toISOString().split("T")[0]
}

// Get next trading day expiration
export function getNextTradingDayExpiration(): string {
  const now = new Date()
  const day = now.getDay()

  // If weekend, get Monday
  if (day === 0) now.setDate(now.getDate() + 1)
  if (day === 6) now.setDate(now.getDate() + 2)

  return now.toISOString().split("T")[0]
}

async function fetchWithRetry(url: string, options: RequestInit, retries = 3, timeout = 10000): Promise<Response> {
  if (!url || typeof url !== "string") {
    throw new Error(`Invalid URL: ${url}`)
  }

  // Validate URL is properly formed
  try {
    const parsed = new URL(url)
    if (!parsed.protocol.startsWith("http")) {
      throw new Error(`Invalid protocol: ${parsed.protocol}`)
    }
  } catch (urlError) {
    throw new Error(`Invalid URL format: ${url}`)
  }

  let lastError: Error | null = null

  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      }).catch((fetchError) => {
        // Handle network-level errors (Load failed, network errors, etc.)
        clearTimeout(timeoutId)
        const errMsg = fetchError?.message || String(fetchError)
        if (errMsg.includes("Load failed") || errMsg.includes("Failed to fetch") || errMsg.includes("NetworkError")) {
          console.log("[v0] Network error during fetch:", errMsg)
          throw new Error("NETWORK_ERROR")
        }
        throw fetchError
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        return response
      }

      if (response.status === 429) {
        console.warn("[v0] Rate limited by Tradier API (429), retrying...")
        await new Promise((resolve) => setTimeout(resolve, 2000 * (i + 1)))
        continue
      }

      // Check for rate limiting in response body (sometimes returns 200 with error text)
      const responseText = await response.text()
      if (responseText.startsWith("Too Many") || responseText.includes("Rate limit") || responseText.includes("Too Many Requests")) {
        console.warn("[v0] Rate limited by Tradier API (text response), retrying...")
        await new Promise((resolve) => setTimeout(resolve, 2000 * (i + 1)))
        continue
      }

      // Try to parse error message from response body
      let errorMessage = `${response.status} ${response.statusText}`
      try {
        if (responseText.trim().startsWith("{")) {
          const errorData = JSON.parse(responseText)
          errorMessage = errorData.message || errorData.error || errorMessage
        } else if (responseText && responseText.length < 200) {
          errorMessage = responseText
        }
      } catch {
        // If we can't parse the error, use the status text
      }

      throw new Error(`Tradier API error: ${errorMessage}`)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Don't retry on abort (timeout)
      if (lastError.name === "AbortError") {
        throw new Error("Request timeout - Tradier API is not responding")
      }

      // Don't retry on network errors - they usually won't recover quickly
      if (lastError.message === "NETWORK_ERROR") {
        throw lastError
      }

      if (lastError.message.includes("did not match the expected pattern")) {
        console.log("[v0] Safari URL pattern issue, will return empty result")
        throw new Error("SAFARI_PATTERN_ERROR")
      }

      // Wait before retry
      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500 * (i + 1)))
      }
    }
  }

  throw lastError || new Error("Failed to fetch from Tradier API")
}

// Fetch options chain from Tradier
export async function fetchOptionsChain(
  symbol: string,
  expiration: string,
  apiKey: string,
  includeGreeks = true,
): Promise<TradierOption[]> {
  const baseUrl = "https://api.tradier.com/v1/markets/options/chains"

  // SPXW gives us 0DTE options, SPX only gives monthly
  const mappedSymbol = getOptionsSymbol(symbol, true) // true = use SPXW for 0DTE
  console.log(`[v0] Fetching options chain - input: ${symbol}, mapped: ${mappedSymbol}, expiration: ${expiration}`)

  const params = new URLSearchParams({
    symbol: mappedSymbol,
    expiration,
    greeks: includeGreeks ? "true" : "false",
  })

  const fullUrl = `${baseUrl}?${params.toString()}`
  console.log("[v0] Options chain URL:", fullUrl)

  const response = await fetchWithRetry(fullUrl, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  })

  const responseText = await response.text()
  console.log("[v0] Tradier options chain status:", response.status)
  console.log("[v0] Tradier options chain raw response:", responseText.substring(0, 200))

  // Check for rate limiting or error text responses before parsing
  if (responseText.startsWith("Too Many") || responseText.includes("Rate limit")) {
    console.warn("[v0] Tradier rate limited on options chain request")
    return []
  }

  // Check if response looks like JSON
  if (!responseText.trim().startsWith("{") && !responseText.trim().startsWith("[")) {
    console.warn("[v0] Tradier options chain response is not JSON:", responseText.substring(0, 100))
    return []
  }

  let data: OptionsChainResponse
  try {
    data = JSON.parse(responseText)
  } catch (parseError) {
    console.error("[v0] Failed to parse Tradier options response:", responseText.substring(0, 100))
    return []
  }

  if (!data.options || !data.options.option) {
    console.log("[v0] No options data in response - market may be closed or symbol not found")
    return []
  }

  // Handle single option vs array
  const options = Array.isArray(data.options.option) ? data.options.option : [data.options.option]

  console.log("[v0] Successfully received", options.length, "options")
  return options
}

// Fetch available expirations for a symbol
export async function fetchExpirations(symbol: string, apiKey: string): Promise<TradierExpiration[]> {
  const baseUrl = "https://api.tradier.com/v1/markets/options/expirations"

  // SPXW gives us daily/0DTE expirations, SPX only gives monthly
  const mappedSymbol = getOptionsSymbol(symbol, true) // true = use SPXW for 0DTE
  console.log(`[v0] Fetching expirations - input: ${symbol}, mapped: ${mappedSymbol} (should be SPXW for 0DTE)`)

  const params = new URLSearchParams({
    symbol: mappedSymbol,
    strikes: "true",
  })

  const fullUrl = `${baseUrl}?${params.toString()}`
  console.log("[v0] Expirations URL:", fullUrl)

  try {
    const response = await fetchWithRetry(fullUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    })

    const responseText = await response.text()
    console.log("[v0] Tradier expirations raw response:", responseText.substring(0, 200))

    // Check for rate limiting or error text responses before parsing
    if (responseText.startsWith("Too Many") || responseText.includes("Rate limit")) {
      console.warn("[v0] Tradier rate limited on expirations request")
      return []
    }

    // Check if response looks like JSON
    if (!responseText.trim().startsWith("{") && !responseText.trim().startsWith("[")) {
      console.warn("[v0] Tradier expirations response is not JSON:", responseText.substring(0, 100))
      return []
    }

    let data: ExpirationsResponse
    try {
      data = JSON.parse(responseText)
    } catch (parseError) {
      console.error("[v0] Failed to parse Tradier expirations response:", responseText.substring(0, 100))
      return []
    }

    if (!data.expirations || !data.expirations.expiration) {
      console.log("[v0] No expirations data in response")
      return []
    }

    // Handle single expiration vs array
    const expirations = Array.isArray(data.expirations.expiration)
      ? data.expirations.expiration
      : [data.expirations.expiration]

    console.log("[v0] Found", expirations.length, "expirations")
    return expirations
  } catch (error) {
    const errorStr = String(error)
    if (!errorStr.includes("pattern")) {
      console.error("[v0] Expirations fetch error:", errorStr.substring(0, 100))
    }
    return []
  }
}

// Fetch quote for underlying
export async function fetchTradierQuote(symbol: string, apiKey: string): Promise<number | null> {
  const baseUrl = "https://api.tradier.com/v1/markets/quotes"

  const params = new URLSearchParams({ symbols: symbol })

  try {
    const response = await fetchWithRetry(
      `${baseUrl}?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      },
      2, // fewer retries for quote
      5000, // shorter timeout
    )

    const responseText = await response.text()
    
    // Check for rate limiting text response
    if (responseText.startsWith("Too Many") || responseText.includes("Rate limit")) {
      console.warn("[v0] fetchTradierQuote rate limited")
      return null
    }
    
    // Check if response looks like JSON
    if (!responseText.trim().startsWith("{")) {
      console.warn("[v0] fetchTradierQuote unexpected response:", responseText.substring(0, 50))
      return null
    }
    
    const data: QuoteResponse = JSON.parse(responseText)
    return data.quotes?.quote?.last ?? null
  } catch {
    return null
  }
}

// Filter options around current price
export function filterOptionsNearPrice(
  options: TradierOption[],
  currentPrice: number,
  range = 50, // dollars above/below current price
): TradierOption[] {
  return options.filter((opt) => Math.abs(opt.strike - currentPrice) <= range)
}

// Group options by type (call/put) and moneyness
export function categorizeOptions(
  options: TradierOption[],
  currentPrice: number,
): {
  calls: { itm: TradierOption[]; atm: TradierOption[]; otm: TradierOption[] }
  puts: { itm: TradierOption[]; atm: TradierOption[]; otm: TradierOption[] }
} {
  const atmThreshold = 5 // Within $5 of current price considered ATM

  const calls = options.filter((o) => o.type === "call" || o.option_type === "call")
  const puts = options.filter((o) => o.type === "put" || o.option_type === "put")

  const categorize = (opts: TradierOption[], isCall: boolean) => {
    const itm: TradierOption[] = []
    const atm: TradierOption[] = []
    const otm: TradierOption[] = []

    opts.forEach((o) => {
      const diff = o.strike - currentPrice
      if (Math.abs(diff) <= atmThreshold) {
        atm.push(o)
      } else if (isCall ? diff < 0 : diff > 0) {
        itm.push(o)
      } else {
        otm.push(o)
      }
    })

    return { itm, atm, otm }
  }

  return {
    calls: categorize(calls, true),
    puts: categorize(puts, false),
  }
}

const apiCache = new Map<string, { data: unknown; timestamp: number }>()
const API_CACHE_TTL = 5000 // 5 seconds - quick updates for 0DTE options

// Clear cache on module load to ensure fresh data with SPXW symbol
apiCache.clear()

export function getCached<T>(key: string): T | null {
  const entry = apiCache.get(key)
  if (entry && Date.now() - entry.timestamp < API_CACHE_TTL) {
    return entry.data as T
  }
  apiCache.delete(key)
  return null
}

export function setCache(key: string, data: unknown): void {
  apiCache.set(key, { data, timestamp: Date.now() })

  // Clean old entries
  if (apiCache.size > 50) {
    const now = Date.now()
    for (const [k, v] of apiCache.entries()) {
      if (now - v.timestamp > API_CACHE_TTL) {
        apiCache.delete(k)
      }
    }
  }
}

// Format: SPX + YYMMDD + P/C + 8-digit strike (e.g., SPX260116P06950000)
export function formatOptionSymbol(
  underlying: string,
  expiration: string, // YYYY-MM-DD format
  optionType: "call" | "put",
  strike: number,
): string {
  // Parse expiration date
  const [year, month, day] = expiration.split("-")
  const yy = year.slice(-2)
  const mm = month.padStart(2, "0")
  const dd = day.padStart(2, "0")

  // Format strike price as 8-digit number (multiply by 1000 to handle decimals)
  const strikeFormatted = Math.round(strike * 1000)
    .toString()
    .padStart(8, "0")

  // Option type: C for call, P for put
  const typeChar = optionType === "call" ? "C" : "P"

  return `${underlying}${yy}${mm}${dd}${typeChar}${strikeFormatted}`
}

export async function fetchOptionQuote(optionSymbol: string, apiKey: string): Promise<TradierOption | null> {
  const baseUrl = "https://api.tradier.com/v1/markets/quotes"

  const params = new URLSearchParams({
    symbols: optionSymbol,
    greeks: "true",
    includeLotSize: "false",
  })

  const fullUrl = `${baseUrl}?${params.toString()}`
  console.log("[v0] Fetching option quote from:", fullUrl)

  try {
    const response = await fetchWithRetry(fullUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    })

    const data = await response.json()
    console.log("[v0] Option quote response:", JSON.stringify(data).substring(0, 500))

    if (data.quotes?.quote) {
      return data.quotes.quote as TradierOption
    }

    return null
  } catch (error) {
    console.error("[v0] Option quote fetch error:", error)
    return null
  }
}
