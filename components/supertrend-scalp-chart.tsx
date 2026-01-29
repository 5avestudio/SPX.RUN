"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { ChevronDown, ChevronUp, Zap } from "lucide-react"

interface SuperTrendData {
  timestamp: number
  close: number
  superTrendUpper: number
  superTrendLower: number
  signal: "BUY" | "SELL" | "HOLD"
  isFlip: boolean
}

interface IndicatorNote {
  time: string
  indicator: string
  value: string
  signal: "bullish" | "bearish" | "neutral"
  note: string
}

interface SuperTrendScalpChartProps {
  data: Array<{
    timestamp: number
    open: number
    high: number
    low: number
    close: number
  }>
  currentPrice: number
  timeframe: "1m" | "5m" | "10m" | "15m"
  onTimeframeChange?: (tf: "1m" | "5m" | "10m" | "15m") => void
  superTrendPeriod?: number
  superTrendMultiplier?: number
  indicatorNotes?: IndicatorNote[]
  className?: string
}

export function SuperTrendScalpChart({
  data,
  currentPrice,
  timeframe,
  onTimeframeChange,
  superTrendPeriod = 10,
  superTrendMultiplier = 3,
  indicatorNotes = [],
  className,
}: SuperTrendScalpChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [expandedNotes, setExpandedNotes] = useState(false)
  const [selectedSignal, setSelectedSignal] = useState<SuperTrendData | null>(null)
  const animationRef = useRef<number>(0)
  const timeRef = useRef(0)

  // Calculate SuperTrend
  const superTrendData = calculateSuperTrendForChart(data, superTrendPeriod, superTrendMultiplier)
  const lastSignal = superTrendData[superTrendData.length - 1]
  const recentFlips = superTrendData.filter((d) => d.isFlip).slice(-5)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const updateDimensions = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      setDimensions({ width: rect.width, height: rect.height })
    }

    updateDimensions()
    window.addEventListener("resize", updateDimensions)
    return () => window.removeEventListener("resize", updateDimensions)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || dimensions.width === 0 || superTrendData.length === 0) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    ctx.scale(dpr, dpr)

    const { width, height } = dimensions
    const padding = { top: 30, bottom: 40, left: 10, right: 50 }
    const chartWidth = width - padding.left - padding.right
    const chartHeight = height - padding.top - padding.bottom

    const visibleData = superTrendData.slice(-60)
    const allPrices = visibleData.flatMap((d) => [d.close, d.superTrendUpper, d.superTrendLower].filter(Boolean))
    const priceMin = Math.min(...allPrices) * 0.9998
    const priceMax = Math.max(...allPrices) * 1.0002
    const priceRange = priceMax - priceMin

    const priceToY = (price: number) => {
      return padding.top + chartHeight - ((price - priceMin) / priceRange) * chartHeight
    }

    const indexToX = (i: number) => {
      return padding.left + (i / (visibleData.length - 1)) * chartWidth
    }

    const animate = () => {
      timeRef.current += 0.02
      ctx.clearRect(0, 0, width, height)

      // Background gradient based on current signal
      const bgGradient = ctx.createLinearGradient(0, 0, 0, height)
      if (lastSignal?.signal === "BUY") {
        bgGradient.addColorStop(0, "rgba(16, 185, 129, 0.03)")
        bgGradient.addColorStop(1, "transparent")
      } else if (lastSignal?.signal === "SELL") {
        bgGradient.addColorStop(0, "rgba(236, 59, 112, 0.03)")
        bgGradient.addColorStop(1, "transparent")
      } else {
        bgGradient.addColorStop(0, "rgba(255, 255, 255, 0.02)")
        bgGradient.addColorStop(1, "transparent")
      }
      ctx.fillStyle = bgGradient
      ctx.fillRect(0, 0, width, height)

      // Draw SuperTrend bands (filled area between upper and lower)
      ctx.beginPath()
      visibleData.forEach((d, i) => {
        const x = indexToX(i)
        const yUpper = priceToY(d.superTrendUpper || d.close)
        if (i === 0) ctx.moveTo(x, yUpper)
        else ctx.lineTo(x, yUpper)
      })
      for (let i = visibleData.length - 1; i >= 0; i--) {
        const x = indexToX(i)
        const yLower = priceToY(visibleData[i].superTrendLower || visibleData[i].close)
        ctx.lineTo(x, yLower)
      }
      ctx.closePath()
      ctx.fillStyle = "rgba(100, 100, 100, 0.05)"
      ctx.fill()

      // Draw price line
      ctx.beginPath()
      visibleData.forEach((d, i) => {
        const x = indexToX(i)
        const y = priceToY(d.close)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.strokeStyle = "rgba(255, 255, 255, 0.6)"
      ctx.lineWidth = 2
      ctx.stroke()

      // Draw SuperTrend line (colored by signal)
      let prevSignal: "BUY" | "SELL" | "HOLD" = "HOLD"
      visibleData.forEach((d, i) => {
        if (i === 0) {
          prevSignal = d.signal
          return
        }

        const x1 = indexToX(i - 1)
        const x2 = indexToX(i)
        const prevData = visibleData[i - 1]
        const y1 = priceToY(prevData.signal === "BUY" ? prevData.superTrendLower : prevData.superTrendUpper)
        const y2 = priceToY(d.signal === "BUY" ? d.superTrendLower : d.superTrendUpper)

        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.strokeStyle = d.signal === "BUY" ? "rgba(16, 185, 129, 0.9)" : "rgba(236, 59, 112, 0.9)"
        ctx.lineWidth = 2
        ctx.stroke()

        // Draw flip markers
        if (d.isFlip) {
          const markerY = d.signal === "BUY" ? priceToY(d.close) + 15 : priceToY(d.close) - 15

          // Glow effect
          ctx.beginPath()
          ctx.arc(x2, markerY, 8, 0, Math.PI * 2)
          ctx.fillStyle = d.signal === "BUY" ? "rgba(16, 185, 129, 0.3)" : "rgba(236, 59, 112, 0.3)"
          ctx.fill()

          // Triangle marker
          ctx.beginPath()
          if (d.signal === "BUY") {
            ctx.moveTo(x2, markerY - 5)
            ctx.lineTo(x2 - 5, markerY + 5)
            ctx.lineTo(x2 + 5, markerY + 5)
          } else {
            ctx.moveTo(x2, markerY + 5)
            ctx.lineTo(x2 - 5, markerY - 5)
            ctx.lineTo(x2 + 5, markerY - 5)
          }
          ctx.closePath()
          ctx.fillStyle = d.signal === "BUY" ? "#10b981" : "#ec3b70"
          ctx.fill()
        }

        prevSignal = d.signal
      })

      // Draw current price line
      const currentY = priceToY(currentPrice)
      const pulse = Math.sin(timeRef.current * 3) * 0.3 + 0.7

      ctx.beginPath()
      ctx.moveTo(padding.left, currentY)
      ctx.lineTo(width - padding.right, currentY)
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 * pulse})`
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.stroke()
      ctx.setLineDash([])

      // Price label
      ctx.font = "bold 10px system-ui"
      ctx.fillStyle = "#fff"
      ctx.textAlign = "right"
      ctx.fillText(`$${currentPrice.toFixed(2)}`, width - padding.right + 45, currentY + 4)

      // Timeframe label
      ctx.font = "bold 10px system-ui"
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)"
      ctx.textAlign = "left"
      ctx.fillText(`${timeframe} SuperTrend`, padding.left + 4, padding.top - 10)

      // Signal label
      const signalLabel =
        lastSignal?.signal === "BUY" ? "BULLISH" : lastSignal?.signal === "SELL" ? "BEARISH" : "NEUTRAL"
      const signalColor =
        lastSignal?.signal === "BUY"
          ? "rgba(16, 185, 129, 0.9)"
          : lastSignal?.signal === "SELL"
            ? "rgba(236, 59, 112, 0.9)"
            : "rgba(255, 255, 255, 0.6)"
      ctx.font = "bold 10px system-ui"
      ctx.fillStyle = signalColor
      ctx.textAlign = "right"
      ctx.fillText(signalLabel, width - padding.right, padding.top - 10)

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [dimensions, superTrendData, currentPrice, timeframe, lastSignal])

  return (
    <div className={cn("glass-frost rounded-3xl p-4 flex flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
          <span className="text-white/60 text-xs uppercase tracking-wider">SuperTrend Scalp</span>
        </div>

        {/* Timeframe Selector */}
        <div className="flex gap-1">
          {(["1m", "5m", "10m", "15m"] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => onTimeframeChange?.(tf)}
              className={cn(
                "px-2 py-1 rounded-lg text-[10px] font-medium transition-all min-w-[36px] min-h-[28px]",
                timeframe === tf
                  ? "bg-white/20 text-white border border-white/30 drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]"
                  : "bg-white/5 text-white/40 hover:text-white/60",
              )}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full flex-1 min-h-[180px] rounded-2xl"
        style={{ background: "rgba(0, 0, 0, 0.3)" }}
      />

      {/* Recent Flips */}
      {recentFlips.length > 0 && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/40 uppercase tracking-wider">Recent Flips</span>
            <div className="flex gap-1">
              {recentFlips.map((flip, i) => (
                <div
                  key={i}
                  className={cn("w-2 h-2 rounded-full", flip.signal === "BUY" ? "bg-emerald-400" : "bg-[#ec3b70]")}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Expandable Notes */}
      {indicatorNotes.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setExpandedNotes(!expandedNotes)}
            className="w-full flex items-center justify-between py-2 px-3 rounded-xl bg-white/5 border border-white/10"
          >
            <span className="text-[10px] text-white/40 uppercase tracking-wider">Indicator Notes</span>
            {expandedNotes ? (
              <ChevronUp className="w-4 h-4 text-white/40" />
            ) : (
              <ChevronDown className="w-4 h-4 text-white/40" />
            )}
          </button>

          {expandedNotes && (
            <div className="mt-2 space-y-2">
              {indicatorNotes.map((note, i) => (
                <div
                  key={i}
                  className={cn(
                    "p-2 rounded-lg border",
                    note.signal === "bullish"
                      ? "bg-emerald-500/5 border-emerald-500/20"
                      : note.signal === "bearish"
                        ? "bg-[#ec3b70]/5 border-[#ec3b70]/20"
                        : "bg-white/5 border-white/10",
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-white/60">{note.indicator}</span>
                    <span
                      className={cn(
                        "text-[10px] font-semibold",
                        note.signal === "bullish"
                          ? "text-emerald-400"
                          : note.signal === "bearish"
                            ? "text-[#ec3b70]"
                            : "text-white/60",
                      )}
                    >
                      {note.value}
                    </span>
                  </div>
                  <p className="text-[9px] text-white/40">{note.note}</p>
                  <p className="text-[8px] text-white/30 mt-1">{note.time}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Helper function to calculate SuperTrend for chart
function calculateSuperTrendForChart(
  data: Array<{ timestamp: number; open: number; high: number; low: number; close: number }>,
  period: number,
  multiplier: number,
): SuperTrendData[] {
  if (data.length < period) return []

  const result: SuperTrendData[] = []
  let prevSignal: "BUY" | "SELL" | "HOLD" = "HOLD"
  let prevUpperBand = 0
  let prevLowerBand = 0

  // Calculate ATR
  const atr: number[] = []
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      atr.push(data[i].high - data[i].low)
      continue
    }
    const tr = Math.max(
      data[i].high - data[i].low,
      Math.abs(data[i].high - data[i - 1].close),
      Math.abs(data[i].low - data[i - 1].close),
    )
    if (i < period) {
      atr.push(tr)
    } else {
      const avgTR = atr.slice(-period).reduce((a, b) => a + b, 0) / period
      atr.push(avgTR)
    }
  }

  for (let i = 0; i < data.length; i++) {
    const hl2 = (data[i].high + data[i].low) / 2
    const currentATR = atr[i] || 0

    let upperBand = hl2 + multiplier * currentATR
    let lowerBand = hl2 - multiplier * currentATR

    // Adjust bands based on previous values
    if (i > 0) {
      upperBand = upperBand < prevUpperBand || data[i - 1].close > prevUpperBand ? upperBand : prevUpperBand
      lowerBand = lowerBand > prevLowerBand || data[i - 1].close < prevLowerBand ? lowerBand : prevLowerBand
    }

    // Determine signal
    let signal: "BUY" | "SELL" | "HOLD" = "HOLD"
    if (data[i].close > upperBand) {
      signal = "BUY"
    } else if (data[i].close < lowerBand) {
      signal = "SELL"
    } else {
      signal = prevSignal
    }

    const isFlip = i > 0 && signal !== prevSignal && signal !== "HOLD"

    result.push({
      timestamp: data[i].timestamp,
      close: data[i].close,
      superTrendUpper: upperBand,
      superTrendLower: lowerBand,
      signal,
      isFlip,
    })

    prevSignal = signal
    prevUpperBand = upperBand
    prevLowerBand = lowerBand
  }

  return result
}
