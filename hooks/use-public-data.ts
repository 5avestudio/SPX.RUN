"use client"

import { useState, useEffect, useCallback, useRef } from "react"

// Default watchlist tickers
export const DEFAULT_WATCHLIST = ["SPY", "QQQ", "AAPL", "TSLA", "GOOGL", "NVDA"]

// Polling interval in ms
const POLLING_INTERVAL = 3000

// Symbol sanitization
export function sanitizeSymbol(input: string): string {
  return input.replace(/^\$/, "").trim().toUpperCase()
}

export interface NormalizedQuote {
  symbol: string
  symbolType?: string
  type?: string
  description?: string
  bid: number
  ask: number
  last: number
  mark: number
  displayPrice: number
  change: number
  changePercent: number
  prevClose: number
  open: number
  high: number
  low: number
  volume: number
  bidTime?: number | null
  askTime?: number | null
  tradeTime?: number | null
  lastUpdated: number
  status: string
  statusReason?: string
  isIndex?: boolean
  source?: string
}

export interface NormalizedOption {
  symbol: string
  underlying: string
  strike: number
  expiration: string
  optionType: 'call' | 'put'
  bid: number
  ask: number
  last: number
  mark: number
  displayPrice: number
  volume: number
  openInterest: number
  impliedVolatility?: number
  delta?: number
  gamma?: number
  theta?: number
  vega?: number
  source?: string
}

interface UsePublicDataOptions {
  symbols?: string[]
  enableDebugLogs?: boolean
}

interface PublicDataState {
  quotes: Map<string, NormalizedQuote>
  isPolling: boolean
  lastEventTime: number | null
  error: string | null
}

export function usePublicData(options: UsePublicDataOptions = {}) {
  const { symbols = DEFAULT_WATCHLIST, enableDebugLogs = false } = options

  const [state, setState] = useState<PublicDataState>({
    quotes: new Map(),
    isPolling: false,
    lastEventTime: null,
    error: null,
  })

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const log = useCallback(
    (message: string, data?: unknown) => {
      if (enableDebugLogs) {
        console.log(`[v0] PublicData: ${message}`, data || "")
      }
    },
    [enableDebugLogs]
  )

  // Fetch quotes via REST API
  const fetchQuotes = useCallback(async () => {
    try {
      const sanitizedSymbols = symbols.map(sanitizeSymbol).filter((s) => s.length > 0)
      const symbolList = sanitizedSymbols.join(",")

      const response = await fetch(`/api/public/quote?symbols=${symbolList}`, {
        cache: "no-store",
      })

      if (!response.ok) {
        throw new Error(`Quote fetch failed: ${response.status}`)
      }

      const data = await response.json()
      log("Fetched quotes", data)

      if (data.quotes && Array.isArray(data.quotes)) {
        setState((prev) => {
          const newQuotes = new Map(prev.quotes)
          for (const quote of data.quotes) {
            newQuotes.set(quote.symbol, quote)
          }
          return {
            ...prev,
            quotes: newQuotes,
            lastEventTime: Date.now(),
            error: null,
          }
        })
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error"
      log("Quote fetch error", errorMsg)
      setState((prev) => ({ ...prev, error: errorMsg }))
    }
  }, [symbols, log])

  // Start polling
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return

    log("Starting polling")
    setState((prev) => ({ ...prev, isPolling: true }))

    // Fetch immediately
    fetchQuotes()

    // Then poll at interval
    pollingIntervalRef.current = setInterval(fetchQuotes, POLLING_INTERVAL)
  }, [fetchQuotes, log])

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      log("Stopping polling")
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
      setState((prev) => ({ ...prev, isPolling: false }))
    }
  }, [log])

  // Initialize on mount
  useEffect(() => {
    startPolling()

    return () => {
      stopPolling()
    }
  }, [])

  // Handle symbol changes
  useEffect(() => {
    if (state.isPolling) {
      fetchQuotes()
    }
  }, [symbols.join(",")])

  // Get quote for a specific symbol
  const getQuote = useCallback(
    (symbol: string): NormalizedQuote | undefined => {
      const cleanSymbol = sanitizeSymbol(symbol)
      return state.quotes.get(cleanSymbol)
    },
    [state.quotes]
  )

  // Get all quotes as array
  const quotesArray = Array.from(state.quotes.values())

  return {
    quotes: state.quotes,
    quotesArray,
    getQuote,
    isPolling: state.isPolling,
    lastEventTime: state.lastEventTime,
    error: state.error,
    refreshQuotes: fetchQuotes,
  }
}

// Hook for fetching options chain from Public.com
interface UsePublicOptionsChainOptions {
  symbol: string | null
  enableDebugLogs?: boolean
}

interface OptionsChainState {
  loading: boolean
  error: string | null
  expirations: string[]
  selectedExpiration: string | null
  calls: NormalizedOption[]
  puts: NormalizedOption[]
  lastUpdated: number | null
}

export function usePublicOptionsChain(options: UsePublicOptionsChainOptions) {
  const { symbol, enableDebugLogs = false } = options

  const [state, setState] = useState<OptionsChainState>({
    loading: false,
    error: null,
    expirations: [],
    selectedExpiration: null,
    calls: [],
    puts: [],
    lastUpdated: null,
  })

  const abortControllerRef = useRef<AbortController | null>(null)
  const currentSymbolRef = useRef<string | null>(null)

  const log = useCallback(
    (message: string, data?: unknown) => {
      if (enableDebugLogs) {
        console.log(`[v0] PublicOptionsChain: ${message}`, data || "")
      }
    },
    [enableDebugLogs]
  )

  // Fetch chain for the current symbol and expiration
  const fetchChain = useCallback(
    async (targetSymbol: string, expiration: string) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      const controller = new AbortController()
      abortControllerRef.current = controller

      const cleanSymbol = sanitizeSymbol(targetSymbol)

      try {
        setState((prev) => ({ ...prev, loading: true, error: null }))

        const response = await fetch(
          `/api/public/options/chains?symbol=${cleanSymbol}&expiration=${expiration}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        )

        if (controller.signal.aborted || currentSymbolRef.current !== cleanSymbol) {
          log("Request aborted or symbol changed")
          return
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `Failed to fetch chain: ${response.status}`)
        }

        const data = await response.json()

        if (currentSymbolRef.current !== cleanSymbol) {
          return
        }

        const chainData = data.chain?.[0]
        setState((prev) => ({
          ...prev,
          loading: false,
          calls: chainData?.calls || [],
          puts: chainData?.puts || [],
          lastUpdated: data.lastUpdated || Date.now(),
        }))

        log("Fetched chain", { calls: chainData?.calls?.length, puts: chainData?.puts?.length })
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          return
        }

        const errorMsg = err instanceof Error ? err.message : "Unknown error"
        log("Chain fetch error", errorMsg)

        if (currentSymbolRef.current === cleanSymbol) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: errorMsg,
          }))
        }
      }
    },
    [log]
  )

  // Load expirations for a symbol
  const loadExpirations = useCallback(
    async (targetSymbol: string) => {
      const cleanSymbol = sanitizeSymbol(targetSymbol)

      try {
        setState((prev) => ({ ...prev, loading: true, error: null }))

        const response = await fetch(`/api/public/options/expirations?symbol=${cleanSymbol}`, {
          cache: "no-store",
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `Failed to fetch expirations: ${response.status}`)
        }

        const data = await response.json()

        if (!data.expirations || data.expirations.length === 0) {
          throw new Error(`No expirations available for ${cleanSymbol}`)
        }

        const nearestExpiration = data.expirations[0]

        setState((prev) => ({
          ...prev,
          expirations: data.expirations,
          selectedExpiration: nearestExpiration,
        }))

        log("Loaded expirations", { count: data.expirations.length, nearest: nearestExpiration })

        await fetchChain(cleanSymbol, nearestExpiration)
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error"
        log("Expirations fetch error", errorMsg)
        setState((prev) => ({
          ...prev,
          loading: false,
          error: errorMsg,
        }))
      }
    },
    [fetchChain, log]
  )

  // Load symbol
  const loadSymbol = useCallback(
    async (targetSymbol: string) => {
      const cleanSymbol = sanitizeSymbol(targetSymbol)
      currentSymbolRef.current = cleanSymbol

      log("Loading symbol", cleanSymbol)

      setState({
        loading: true,
        error: null,
        expirations: [],
        selectedExpiration: null,
        calls: [],
        puts: [],
        lastUpdated: null,
      })

      await loadExpirations(cleanSymbol)
    },
    [loadExpirations, log]
  )

  // Change expiration
  const selectExpiration = useCallback(
    (expiration: string) => {
      if (!currentSymbolRef.current) return

      setState((prev) => ({ ...prev, selectedExpiration: expiration }))
      fetchChain(currentSymbolRef.current, expiration)
    },
    [fetchChain]
  )

  // Load symbol when it changes
  useEffect(() => {
    if (symbol) {
      loadSymbol(symbol)
    } else {
      currentSymbolRef.current = null
      setState({
        loading: false,
        error: null,
        expirations: [],
        selectedExpiration: null,
        calls: [],
        puts: [],
        lastUpdated: null,
      })
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [symbol, loadSymbol])

  return {
    ...state,
    selectExpiration,
    refresh: () => symbol && loadSymbol(symbol),
  }
}

// Re-export types for compatibility with existing code
export type { NormalizedQuote as PublicNormalizedQuote, NormalizedOption as PublicNormalizedOption }
