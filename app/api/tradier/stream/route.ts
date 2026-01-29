/**
 * Tradier Streaming SSE Endpoint
 *
 * Creates a server-sent events stream that:
 * 1. Creates a Tradier streaming session
 * 2. Connects to the Tradier stream endpoint
 * 3. Forwards normalized quote/trade events to the browser
 *
 * ZERO CACHING - All data is real-time
 */

import { NextRequest } from "next/server"
import {
  type DataHealthStatus,
  getTradierBaseUrl,
  getTradierStreamUrl,
  validateTradierConfig,
  sanitizeSymbols,
  calculateMarkPrice,
  DEFAULT_WATCHLIST,
} from "@/lib/tradier-types"

// Force dynamic - no caching
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Compute data status based on timestamps
function computeDataStatus(bidDate?: number, askDate?: number, tradeDate?: number): DataHealthStatus {
  const now = Date.now()
  const mostRecentTime = Math.max(bidDate || 0, askDate || 0, tradeDate || 0)

  if (mostRecentTime === 0) return "STALE"

  const ageMs = now - mostRecentTime
  const ageSeconds = ageMs / 1000

  if (ageSeconds < 5) return "LIVE"
  if (ageSeconds < 30) return "POSSIBLY_DELAYED"
  return "STALE"
}

export async function GET(request: NextRequest) {
  const config = validateTradierConfig()
  if (!config.valid) {
    return new Response(JSON.stringify({ error: config.error }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    })
  }

  const { token, baseUrl } = config
  const streamUrl = getTradierStreamUrl()

  const { searchParams } = new URL(request.url)
  const symbolsParam = searchParams.get("symbols")
  const symbols = symbolsParam ? sanitizeSymbols(symbolsParam) : [...DEFAULT_WATCHLIST]

  // Create SSE response
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      // Helper to send SSE event
      const sendEvent = (data: object) => {
        const message = `data: ${JSON.stringify(data)}\n\n`
        controller.enqueue(encoder.encode(message))
      }

      // Send initial connection event
      sendEvent({
        type: "connected",
        symbols,
        timestamp: Date.now(),
      })

      try {
        // Step 1: Create streaming session
        const sessionEndpoint = `${baseUrl}/markets/events/session`
        console.log("[Tradier Stream] Creating session at:", sessionEndpoint)
        const sessionResponse = await fetch(sessionEndpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          cache: "no-store",
        })

        if (!sessionResponse.ok) {
          // Fallback to polling mode
          sendEvent({
            type: "fallback",
            reason: "Failed to create streaming session, using polling",
            timestamp: Date.now(),
          })

          // Start polling loop
          let isActive = true

          const poll = async () => {
            while (isActive) {
              try {
                const quoteEndpoint = `${baseUrl}/markets/quotes?symbols=${encodeURIComponent(symbols.join(","))}&greeks=false`
                console.log("[Tradier Stream] Polling:", quoteEndpoint)

                const quoteResponse = await fetch(quoteEndpoint, {
                  method: "GET",
                  headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json",
                  },
                  cache: "no-store",
                })

                if (quoteResponse.ok) {
                  const data = await quoteResponse.json()
                  const quotes = data.quotes?.quote
                  const quotesArray = Array.isArray(quotes) ? quotes : quotes ? [quotes] : []

                  for (const q of quotesArray) {
                    const { displayPrice, mark } = calculateMarkPrice(q.bid || 0, q.ask || 0, q.last || 0)

                    const bidTime = q.bid_date ? q.bid_date * 1000 : undefined
                    const askTime = q.ask_date ? q.ask_date * 1000 : undefined
                    const tradeTime = q.trade_date ? q.trade_date * 1000 : undefined

                    sendEvent({
                      type: "quote",
                      symbol: q.symbol,
                      bid: q.bid || 0,
                      ask: q.ask || 0,
                      last: q.last || 0,
                      mark,
                      displayPrice,
                      bidTime,
                      askTime,
                      tradeTime,
                      prevClose: q.prevclose || 0,
                      change: q.change || 0,
                      changePercent: q.change_percentage || 0,
                      volume: q.volume || 0,
                      status: computeDataStatus(bidTime, askTime, tradeTime),
                      isIndex: q.type === "index",
                      description: q.description,
                    })
                  }
                }
              } catch (e) {
                sendEvent({
                  type: "error",
                  message: "Polling error",
                  timestamp: Date.now(),
                })
              }

              // Wait 3 seconds before next poll
              await new Promise((resolve) => setTimeout(resolve, 3000))
            }
          }

          // Start polling
          poll()

          // Handle client disconnect
          request.signal.addEventListener("abort", () => {
            isActive = false
            controller.close()
          })

          return
        }

        const sessionData = await sessionResponse.json()
        const sessionId = sessionData.stream?.sessionid

        if (!sessionId) {
          sendEvent({
            type: "error",
            message: "No session ID received",
            timestamp: Date.now(),
          })
          controller.close()
          return
        }

        sendEvent({
          type: "session_created",
          sessionId,
          timestamp: Date.now(),
        })

        // Step 2: Connect to streaming endpoint
        const tradierStreamEndpoint = `${streamUrl}/markets/events`
        console.log("[Tradier Stream] Connecting to stream:", tradierStreamEndpoint)
        const streamBody = new URLSearchParams({
          sessionid: sessionId,
          symbols: symbols.join(","),
          filter: "quote,trade",
          linebreak: "true",
        })

        const streamResponse = await fetch(tradierStreamEndpoint, {
          method: "POST",
          headers: {
            Accept: "application/json",
          },
          body: streamBody,
          cache: "no-store",
        })

        if (!streamResponse.ok || !streamResponse.body) {
          sendEvent({
            type: "error",
            message: "Failed to connect to stream",
            timestamp: Date.now(),
          })
          controller.close()
          return
        }

        sendEvent({
          type: "stream_connected",
          timestamp: Date.now(),
        })

        // Read from Tradier stream and forward to client
        const reader = streamResponse.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        const processStream = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read()

              if (done) {
                sendEvent({
                  type: "stream_ended",
                  timestamp: Date.now(),
                })
                break
              }

              buffer += decoder.decode(value, { stream: true })
              const lines = buffer.split("\n")
              buffer = lines.pop() || ""

              for (const line of lines) {
                if (!line.trim()) continue

                try {
                  const event = JSON.parse(line)

                  if (event.type === "quote") {
                    const { displayPrice, mark } = calculateMarkPrice(event.bid || 0, event.ask || 0, event.last || 0)

                    const bidTime = event.biddate ? event.biddate * 1000 : undefined
                    const askTime = event.askdate ? event.askdate * 1000 : undefined
                    const tradeTime = event.date ? event.date * 1000 : undefined

                    sendEvent({
                      type: "quote",
                      symbol: event.symbol,
                      bid: event.bid || 0,
                      ask: event.ask || 0,
                      last: event.last || 0,
                      mark,
                      displayPrice,
                      bidTime,
                      askTime,
                      tradeTime,
                      status: computeDataStatus(bidTime, askTime, tradeTime),
                    })
                  } else if (event.type === "trade") {
                    sendEvent({
                      type: "trade",
                      symbol: event.symbol,
                      price: event.price,
                      size: event.size,
                      timestamp: event.date ? event.date * 1000 : Date.now(),
                    })
                  }
                } catch {
                  // Ignore parse errors for incomplete lines
                }
              }
            }
          } catch (e) {
            sendEvent({
              type: "error",
              message: "Stream read error",
              timestamp: Date.now(),
            })
          } finally {
            controller.close()
          }
        }

        processStream()

        // Handle client disconnect
        request.signal.addEventListener("abort", () => {
          reader.cancel()
          controller.close()
        })
      } catch (e) {
        sendEvent({
          type: "error",
          message: "Stream initialization error",
          timestamp: Date.now(),
        })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
