// Server-side route handler for SPX index quote using Public.com API
// NEVER expose API keys on the client - all requests are proxied through this route

import { NextResponse } from 'next/server'

const PUBLIC_API_BASE = 'https://api.public.com'

// Normalized response type
interface NormalizedQuote {
  symbol: string
  type: string
  last: number
  bid: number | null
  ask: number | null
  change: number
  changePct: number
  updatedAt: string
  source: string
  error?: string
}

// Resolve instrument using Public.com API
async function resolveInstrument(
  apiKey: string,
  accountId: string
): Promise<{ symbol: string; type: string } | null> {
  // Try SPX as INDEX first
  const attempts = [
    { symbol: 'SPX', type: 'INDEX' },
    { symbol: 'SPX-INDEX', type: 'INDEX' },
    { symbol: '$SPX', type: 'INDEX' },
    { symbol: '^GSPC', type: 'INDEX' },
  ]
  
  for (const attempt of attempts) {
    try {
      const url = `${PUBLIC_API_BASE}/userapigateway/trading/instruments/${attempt.symbol}/${attempt.type}`
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
        cache: 'no-store',
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log(`[v0] Resolved instrument: ${attempt.symbol}/${attempt.type}`)
        return {
          symbol: data.symbol || attempt.symbol,
          type: data.type || attempt.type,
        }
      }
    } catch (error) {
      console.log(`[v0] Failed to resolve ${attempt.symbol}/${attempt.type}:`, error)
    }
  }
  
  // If all INDEX attempts fail, try using SPY as a proxy for SPX
  return { symbol: 'SPY', type: 'EQUITY' }
}

// Get quote from Public.com API
async function getPublicQuote(
  apiKey: string,
  accountId: string,
  instrument: { symbol: string; type: string }
): Promise<NormalizedQuote | null> {
  try {
    const url = `${PUBLIC_API_BASE}/userapigateway/marketdata/${accountId}/quotes`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        instruments: [{ symbol: instrument.symbol, type: instrument.type }]
      }),
      cache: 'no-store',
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[v0] Public API quote error ${response.status}:`, errorText)
      return null
    }
    
    const data = await response.json()
    console.log('[v0] Public API quote response:', JSON.stringify(data).slice(0, 500))
    
    // Handle different response formats
    const quote = Array.isArray(data) ? data[0] : (data.quotes?.[0] || data)
    
    if (!quote) {
      return null
    }
    
    // Extract price - handle various field names
    const last = quote.last || quote.lastPrice || quote.price || quote.mark || quote.close || 0
    const bid = quote.bid || quote.bidPrice || null
    const ask = quote.ask || quote.askPrice || null
    const change = quote.change || quote.netChange || quote.changeToday || 0
    const changePct = quote.changePct || quote.changePercent || quote.percentChange || 
                      (quote.previousClose && last ? ((last - quote.previousClose) / quote.previousClose) * 100 : 0)
    
    return {
      symbol: instrument.symbol,
      type: instrument.type,
      last,
      bid,
      ask,
      change,
      changePct,
      updatedAt: new Date().toISOString(),
      source: 'public.com',
    }
  } catch (error) {
    console.error('[v0] Public API quote fetch error:', error)
    return null
  }
}

export async function GET() {
  const apiKey = process.env.PUBLIC_API_KEY
  const accountId = process.env.PUBLIC_ACCOUNT_ID
  
  // Validate credentials
  if (!apiKey) {
    return NextResponse.json(
      { error: 'PUBLIC_API_KEY is not configured', symbol: 'SPX' },
      { status: 500 }
    )
  }
  
  if (!accountId) {
    return NextResponse.json(
      { error: 'PUBLIC_ACCOUNT_ID is not configured', symbol: 'SPX' },
      { status: 500 }
    )
  }
  
  try {
    // Step 1: Resolve the instrument
    const instrument = await resolveInstrument(apiKey, accountId)
    
    if (!instrument) {
      return NextResponse.json(
        { error: 'Failed to resolve SPX instrument', symbol: 'SPX' },
        { status: 404 }
      )
    }
    
    // Step 2: Get the quote
    const quote = await getPublicQuote(apiKey, accountId, instrument)
    
    if (!quote) {
      return NextResponse.json(
        { error: 'Failed to fetch quote from Public.com', symbol: instrument.symbol },
        { status: 502 }
      )
    }
    
    // Step 3: Return normalized response
    return NextResponse.json(quote, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      }
    })
  } catch (error) {
    console.error('[v0] SPX quote route error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        symbol: 'SPX'
      },
      { status: 500 }
    )
  }
}
