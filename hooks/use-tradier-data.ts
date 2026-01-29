"use client"

// This hook now uses Public.com API instead of Tradier for more reliable quotes
// The Tradier API has been disabled due to intermittent quote conflicts

import { useState, useEffect, useCallback, useRef } from "react"
import type { NormalizedQuote, NormalizedOption, DataHealthStatus } from "@/lib/tradier-types"

// Default watchlist tickers - using SPY instead of SPX for Public.com compatibility
export const DEFAULT_WATCHLIST = ["SPY", "QQQ", "AAPL", "TSLA", "GOOGL", "NVDA"]

// Polling interval in ms - Public.com uses REST polling
const POLLING_INTERVAL = 3000

// Symbol sanitization (matches server-side)
export function sanitizeSymbol(input: string): string {
  return input.replace(/^\$/, "").trim().toUpperCase()
}

// Map symbols for Public.com compatibility
function mapSymbolForPublic(symbol: string): string {
  const upper = symbol.toUpperCase().replace('$', '')
  const symbolMap: Record<string, string> = {
    'SPX': 'SPY',
    '^GSPC': 'SPY',
    '^SPX': 'SPY',
  }
  return symbolMap[upper] || upper
}

interface UseTradierDataOptions {
  symbols?: string[]
  useStreaming?: boolean
  useSPYProxy?: boolean
  enableDebugLogs?: boolean
}

interface TradierDataState {
  quotes: Map<string, NormalizedQuote>
  isStreaming: boolean
  isPolling: boolean
  lastEventTime: number | null
  streamStatus: "connected" | "connecting" | "disconnected" | "error"
  error: string | null
}

export function useTradierData(options: UseTradierDataOptions = {}) {
  const { symbols = DEFAULT_WATCHLIST, useStreaming = true, useSPYProxy = false, enableDebugLogs = false } = options

  const [state, setState] = useState<TradierDataState>({
    quotes: new Map(),
    isStreaming: false,
    isPolling: false,
    lastEventTime: null,
    streamStatus: "disconnected",
    error: null,
  })

  const eventSourceRef = useRef<EventSource | null>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5

  const log = useCallback(
    (message: string, data?: unknown) => {
      if (enableDebugLogs) {
        console.log(`[v0] TradierData: ${message}`, data || "")
      }
    },
    [enableDebugLogs]
  )

  // Fetch quotes via REST API (polling fallback)
  const fetchQuotes = useCallback(async () => {
    try {
      // Sanitize symbols before sending
      const sanitizedSymbols = symbols.map(sanitizeSymbol).filter((s) => s.length > 0)
      const symbolList = sanitizedSymbols.join(",")

      const response = await fetch(`/api/tradier/quote?symbols=${symbolList}`, {
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

  // Connect to SSE stream
  const connectStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    // Sanitize symbols before sending
    const sanitizedSymbols = symbols.map(sanitizeSymbol).filter((s) => s.length > 0)
    const symbolList = sanitizedSymbols.join(",")

    log("Connecting to stream", symbolList)
    setState((prev) => ({ ...prev, streamStatus: "connecting" }))

    const eventSource = new EventSource(`/api/tradier/stream?symbols=${symbolList}`)
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      log("Stream connected")
      reconnectAttempts.current = 0
      setState((prev) => ({
        ...prev,
        isStreaming: true,
        streamStatus: "connected",
        error: null,
      }))
      // Stop polling when streaming is active
      stopPolling()
    }

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        log("Stream event", data)

        if (data.type === "quote" || data.type === "trade") {
          setState((prev) => {
            const newQuotes = new Map(prev.quotes)
            const existing = newQuotes.get(data.symbol) || ({} as NormalizedQuote)

            // Merge new data with existing - displayPrice is MARK-FIRST from server
            const updated: NormalizedQuote = {
              ...existing,
              symbol: data.symbol,
              bid: data.bid ?? existing.bid ?? 0,
              ask: data.ask ?? existing.ask ?? 0,
              last: data.last ?? existing.last ?? 0,
              mark: data.mark ?? existing.mark ?? 0,
              displayPrice: data.displayPrice ?? existing.displayPrice ?? 0, // MARK-FIRST
              bidTime: data.bidTime ?? existing.bidTime,
              askTime: data.askTime ?? existing.askTime,
              tradeTime: data.tradeTime ?? existing.tradeTime,
              status: data.status ?? existing.status ?? "LIVE",
              change: data.change ?? existing.change ?? 0,
              changePercent: data.changePercent ?? existing.changePercent ?? 0,
              volume: data.volume ?? existing.volume ?? 0,
              prevClose: data.prevClose ?? existing.prevClose ?? 0,
              open: data.open ?? existing.open ?? 0,
              high: data.high ?? existing.high ?? 0,
              low: data.low ?? existing.low ?? 0,
              type: existing.type ?? "equity",
              description: existing.description ?? data.symbol,
            }

            newQuotes.set(data.symbol, updated)
            return {
              ...prev,
              quotes: newQuotes,
              lastEventTime: Date.now(),
            }
          })
        }
      } catch (err) {
        log("Stream parse error", err)
      }
    }

    eventSource.onerror = () => {
      log("Stream error, will reconnect")
      eventSource.close()
      eventSourceRef.current = null

      setState((prev) => ({
        ...prev,
        isStreaming: false,
        streamStatus: "error",
      }))

      // Exponential backoff reconnection
      if (reconnectAttempts.current < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000)
        reconnectAttempts.current++
        log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`)

        reconnectTimeoutRef.current = setTimeout(() => {
          connectStream()
        }, delay)
      } else {
        log("Max reconnect attempts reached, falling back to polling")
        startPolling()
      }
    }
  }, [symbols, log, stopPolling, startPolling])

  // Disconnect stream
  const disconnectStream = useCallback(() => {
    if (eventSourceRef.current) {
      log("Disconnecting stream")
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    reconnectAttempts.current = 0
    setState((prev) => ({
      ...prev,
      isStreaming: false,
      streamStatus: "disconnected",
    }))
  }, [log])

  // Toggle between streaming and polling
  const toggleDataMode = useCallback(
    (streaming: boolean) => {
      if (streaming) {
        stopPolling()
        connectStream()
      } else {
        disconnectStream()
        startPolling()
      }
    },
    [connectStream, disconnectStream, startPolling, stopPolling]
  )

  // Initialize on mount
  useEffect(() => {
    if (useStreaming) {
      connectStream()
    } else {
      startPolling()
    }

    return () => {
      disconnectStream()
      stopPolling()
    }
  }, []) // Only run on mount

  // Handle symbol changes
  useEffect(() => {
    if (state.isStreaming) {
      // Reconnect with new symbols
      disconnectStream()
      connectStream()
    } else if (state.isPolling) {
      // Refetch with new symbols
      fetchQuotes()
    }
  }, [symbols.join(",")])

  // Get quote for a specific symbol (with SPY proxy support for SPX)
  const getQuote = useCallback(
    (symbol: string): NormalizedQuote | undefined => {
      const cleanSymbol = sanitizeSymbol(symbol)
      const quote = state.quotes.get(cleanSymbol)

      // If SPY proxy is enabled and requesting SPX, overlay SPY data
      if (useSPYProxy && cleanSymbol === "SPX") {
        const spyQuote = state.quotes.get("SPY")
        if (spyQuote && quote) {
          return {
            ...quote,
            // Keep SPX symbol but add proxy indicator
            proxySymbol: "SPY",
            proxyPrice: spyQuote.displayPrice,
            proxyChange: spyQuote.change,
            proxyChangePercent: spyQuote.changePercent,
          } as NormalizedQuote & {
            proxySymbol: string
            proxyPrice: number
            proxyChange: number
            proxyChangePercent: number
          }
        }
      }

      return quote
    },
    [state.quotes, useSPYProxy]
  )

  // Get all quotes as array
  const quotesArray = Array.from(state.quotes.values())

  return {
    quotes: state.quotes,
    quotesArray,
    getQuote,
    isStreaming: state.isStreaming,
    isPolling: state.isPolling,
    streamStatus: state.streamStatus,
    lastEventTime: state.lastEventTime,
    error: state.error,
    toggleDataMode,
    refreshQuotes: fetchQuotes,
  }
}

// Hook for fetching options chain - SINGLE SYMBOL SCOPED with request cancellation
interface UseOptionsChainOptions {
  symbol: string | null
  enableDebugLogs?: boolean
}

interface OptionsChainState {
  loading: boolean
  error: string | null
  root: string | null
  expirations: string[]
  selectedExpiration: string | null
  calls: NormalizedOption[]
  puts: NormalizedOption[]
  lastUpdated: number | null
  debugInfo: {
    rootsStatus?: number
    expirationsStatus?: number
    chainsStatus?: number
    rawError?: string
  }
}

export function useOptionsChain(options: UseOptionsChainOptions) {
  const { symbol, enableDebugLogs = false } = options

  const [state, setState] = useState<OptionsChainState>({
    loading: false,
    error: null,
    root: null,
    expirations: [],
    selectedExpiration: null,
    calls: [],
    puts: [],
    lastUpdated: null,
    debugInfo: {},
  })

  const abortControllerRef = useRef<AbortController | null>(null)
  const currentSymbolRef = useRef<string | null>(null)

  const log = useCallback(
    (message: string, data?: unknown) => {
      if (enableDebugLogs) {
        console.log(`[v0] OptionsChain: ${message}`, data || "")
      }
    },
    [enableDebugLogs]
  )

  // Fetch chain for the current symbol and expiration
  const fetchChain = useCallback(
    async (targetSymbol: string, expiration: string) => {
      // Cancel previous request if any
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      const controller = new AbortController()
      abortControllerRef.current = controller

      const cleanSymbol = sanitizeSymbol(targetSymbol)

      try {
        setState((prev) => ({ ...prev, loading: true, error: null }))

        const response = await fetch(`/api/tradier/options/chains?symbol=${cleanSymbol}&expiration=${expiration}`, {
          cache: "no-store",
          signal: controller.signal,
        })

        // Check if request was aborted or symbol changed
        if (controller.signal.aborted || currentSymbolRef.current !== cleanSymbol) {
          log("Request aborted or symbol changed, ignoring response")
          return
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `Failed to fetch chain: ${response.status}`)
        }

        const data = await response.json()

        // Double-check symbol hasn't changed
        if (currentSymbolRef.current !== cleanSymbol) {
          log("Symbol changed during fetch, ignoring response")
          return
        }

        const chainData = data.chain?.[0]
        setState((prev) => ({
          ...prev,
          loading: false,
          calls: chainData?.calls || [],
          puts: chainData?.puts || [],
          lastUpdated: data.lastUpdated || Date.now(),
          debugInfo: { ...prev.debugInfo, chainsStatus: response.status },
        }))

        log("Fetched chain", { calls: chainData?.calls?.length, puts: chainData?.puts?.length })
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          log("Fetch aborted")
          return
        }

        const errorMsg = err instanceof Error ? err.message : "Unknown error"
        log("Chain fetch error", errorMsg)

        // Only update error if symbol hasn't changed
        if (currentSymbolRef.current === cleanSymbol) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: errorMsg,
            debugInfo: { ...prev.debugInfo, rawError: errorMsg.slice(0, 300) },
          }))
        }
      }
    },
    [log]
  )

  // Load expirations for a symbol
  const loadExpirations = useCallback(
    async (targetSymbol: string, preferredRoot?: string) => {
      const cleanSymbol = sanitizeSymbol(targetSymbol)
      const rootToUse = preferredRoot || cleanSymbol

      try {
        setState((prev) => ({ ...prev, loading: true, error: null, debugInfo: {} }))

        const response = await fetch(`/api/tradier/options/expirations?symbol=${rootToUse}`, {
          cache: "no-store",
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `Failed to fetch expirations: ${response.status}`)
        }

        const data = await response.json()

        if (!data.expirations || data.expirations.length === 0) {
          throw new Error(`No expirations available for ${rootToUse}`)
        }

        // Auto-select nearest expiration (first one is usually nearest)
        const nearestExpiration = data.expirations[0]

        setState((prev) => ({
          ...prev,
          root: rootToUse,
          expirations: data.expirations,
          selectedExpiration: nearestExpiration,
          debugInfo: { ...prev.debugInfo, expirationsStatus: response.status },
        }))

        log("Loaded expirations", { count: data.expirations.length, nearest: nearestExpiration })

        // Fetch chain for nearest expiration
        await fetchChain(rootToUse, nearestExpiration)
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error"
        log("Expirations fetch error", errorMsg)
        setState((prev) => ({
          ...prev,
          loading: false,
          error: errorMsg,
          debugInfo: { ...prev.debugInfo, rawError: errorMsg.slice(0, 300) },
        }))
      }
    },
    [fetchChain, log]
  )

  // Load roots first (for SPX special handling)
  const loadSymbol = useCallback(
    async (targetSymbol: string) => {
      const cleanSymbol = sanitizeSymbol(targetSymbol)
      currentSymbolRef.current = cleanSymbol

      log("Loading symbol", cleanSymbol)

      // Reset state for new symbol
      setState({
        loading: true,
        error: null,
        root: null,
        expirations: [],
        selectedExpiration: null,
        calls: [],
        puts: [],
        lastUpdated: null,
        debugInfo: {},
      })

      try {
        // For SPX, check for SPXW root first
        if (cleanSymbol === "SPX") {
          const rootsResponse = await fetch(`/api/tradier/options/roots?underlying=${cleanSymbol}`, {
            cache: "no-store",
          })

          if (rootsResponse.ok) {
            const rootsData = await rootsResponse.json()
            log("Loaded roots", rootsData)

            setState((prev) => ({
              ...prev,
              debugInfo: { ...prev.debugInfo, rootsStatus: rootsResponse.status },
            }))

            // Use preferred root (SPXW for SPX)
            const preferredRoot = rootsData.preferredRoot || cleanSymbol
            await loadExpirations(cleanSymbol, preferredRoot)
            return
          }
        }

        // For non-SPX symbols, go directly to expirations
        await loadExpirations(cleanSymbol)
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error"
        log("Load symbol error", errorMsg)
        setState((prev) => ({
          ...prev,
          loading: false,
          error: errorMsg,
        }))
      }
    },
    [loadExpirations, log]
  )

  // Change expiration
  const selectExpiration = useCallback(
    (expiration: string) => {
      if (!state.root) return

      setState((prev) => ({ ...prev, selectedExpiration: expiration }))
      fetchChain(state.root, expiration)
    },
    [state.root, fetchChain]
  )

  // Load symbol when it changes
  useEffect(() => {
    if (symbol) {
      loadSymbol(symbol)
    } else {
      // Clear state when symbol is null
      currentSymbolRef.current = null
      setState({
        loading: false,
        error: null,
        root: null,
        expirations: [],
        selectedExpiration: null,
        calls: [],
        puts: [],
        lastUpdated: null,
        debugInfo: {},
      })
    }

    // Cleanup on unmount or symbol change
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
