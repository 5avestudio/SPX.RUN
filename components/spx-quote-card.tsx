"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RefreshCw, TrendingUp, TrendingDown, AlertCircle, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

interface SPXQuote {
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

interface SPXQuoteCardProps {
  className?: string
  pollInterval?: number // in milliseconds, default 2000
}

export function SPXQuoteCard({ className, pollInterval = 2000 }: SPXQuoteCardProps) {
  const [quote, setQuote] = useState<SPXQuote | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)

  const fetchQuote = useCallback(async () => {
    try {
      const response = await fetch('/api/quotes/spx', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      })
      
      const data = await response.json()
      
      if (!response.ok || data.error) {
        setError(data.error || 'Failed to fetch quote')
        setQuote(null)
      } else {
        setQuote(data)
        setError(null)
      }
      
      setLastFetch(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
      setQuote(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchQuote()
  }, [fetchQuote])

  // Poll every 2 seconds
  useEffect(() => {
    const interval = setInterval(fetchQuote, pollInterval)
    return () => clearInterval(interval)
  }, [fetchQuote, pollInterval])

  const isPositive = quote ? quote.change >= 0 : false
  const formattedTime = lastFetch 
    ? lastFetch.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      })
    : '--:--:--'

  // Loading state
  if (loading && !quote) {
    return (
      <Card className={cn("w-full max-w-md", className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
            Loading SPX...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-10 bg-muted rounded w-32" />
            <div className="h-4 bg-muted rounded w-24" />
            <div className="h-4 bg-muted rounded w-40" />
          </div>
        </CardContent>
      </Card>
    )
  }

  // Error state
  if (error && !quote) {
    return (
      <Card className={cn("w-full max-w-md border-destructive/50", className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            SPX Quote Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">{error}</p>
          <button
            onClick={fetchQuote}
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn("w-full max-w-md", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            {quote?.symbol || 'SPX'}
            <span className="text-xs font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {quote?.type || 'INDEX'}
            </span>
          </CardTitle>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formattedTime}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Last Price */}
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold tabular-nums">
            ${quote?.last?.toLocaleString('en-US', { 
              minimumFractionDigits: 2, 
              maximumFractionDigits: 2 
            }) || '0.00'}
          </span>
          <div className={cn(
            "flex items-center gap-1 text-sm font-medium",
            isPositive ? "text-emerald-500" : "text-red-500"
          )}>
            {isPositive ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            <span>
              {isPositive ? '+' : ''}{quote?.change?.toFixed(2) || '0.00'}
            </span>
            <span className="text-muted-foreground">
              ({isPositive ? '+' : ''}{quote?.changePct?.toFixed(2) || '0.00'}%)
            </span>
          </div>
        </div>

        {/* Bid / Ask */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Bid</p>
            <p className="text-lg font-semibold tabular-nums">
              ${quote?.bid?.toLocaleString('en-US', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
              }) || '--'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Ask</p>
            <p className="text-lg font-semibold tabular-nums">
              ${quote?.ask?.toLocaleString('en-US', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
              }) || '--'}
            </p>
          </div>
        </div>

        {/* Source & Timestamp */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
          <span>Source: {quote?.source || 'public.com'}</span>
          <span>
            {quote?.updatedAt 
              ? new Date(quote.updatedAt).toLocaleTimeString('en-US')
              : '--'
            }
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
