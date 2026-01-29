"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { ZoomIn, ZoomOut } from "lucide-react"

interface CandleData {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
}

interface TeslaChartProps {
  data: CandleData[]
  currentPrice: number
  signal: string
  pivotLevels?: {
    pivot: number
    r1: number
    r2: number
    s1: number
    s2: number
  }
  className?: string
}

// Zoom levels: fewer candles = more zoomed in, more candles = zoomed out
const ZOOM_LEVELS = [10, 15, 20, 30, 45, 60, 90, 120]
const DEFAULT_ZOOM_INDEX = 3 // Start at 30 candles

export function TeslaChart({ data, currentPrice, signal, pivotLevels, className }: TeslaChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const animationRef = useRef<number>(0)
  const timeRef = useRef(0)
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX)

  // Get the number of candles to display based on zoom level
  const candleCount = Math.min(ZOOM_LEVELS[zoomIndex], data.length)
  const candles = data.slice(-candleCount)

  const handleZoomIn = useCallback(() => {
    setZoomIndex((prev) => Math.max(0, prev - 1))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoomIndex((prev) => Math.min(ZOOM_LEVELS.length - 1, prev + 1))
  }, [])

  const signalType: "buy" | "sell" | "hold" =
    signal === "BUY" || signal === "STRONG_BUY"
      ? "buy"
      : signal === "SELL" || signal === "STRONG_SELL"
        ? "sell"
        : "hold"

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
    if (!canvas || dimensions.width === 0 || candles.length === 0) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    ctx.scale(dpr, dpr)

    const { width, height } = dimensions
    const padding = { top: 20, bottom: 30, left: 10, right: 60 }
    const chartWidth = width - padding.left - padding.right
    const chartHeight = height - padding.top - padding.bottom

    const allPrices = candles.flatMap((c) => [c.high, c.low])
    if (pivotLevels) {
      allPrices.push(pivotLevels.r2, pivotLevels.s2)
    }
    const priceMin = Math.min(...allPrices) * 0.9995
    const priceMax = Math.max(...allPrices) * 1.0005
    const priceRange = priceMax - priceMin

    const priceToY = (price: number) => {
      return padding.top + chartHeight - ((price - priceMin) / priceRange) * chartHeight
    }

    const candleWidth = chartWidth / candles.length
    // Dynamic candle bar width based on zoom level
    const barWidth = Math.max(2, Math.min(8, candleWidth * 0.6))

    const animate = () => {
      timeRef.current += 0.01
      ctx.clearRect(0, 0, width, height)

      const bgGradient = ctx.createLinearGradient(0, 0, 0, height)
      bgGradient.addColorStop(0, "rgba(10, 10, 12, 1)")
      bgGradient.addColorStop(1, "rgba(0, 0, 0, 1)")
      ctx.fillStyle = bgGradient
      ctx.fillRect(0, 0, width, height)

      // Calculate timestamp label interval based on available space
      // Each label needs roughly 35px of space
      const labelWidth = 35
      const maxLabels = Math.floor(chartWidth / labelWidth)
      const labelInterval = Math.max(1, Math.ceil(candles.length / maxLabels))

      candles.forEach((candle, i) => {
        const x = padding.left + i * candleWidth + candleWidth / 2
        const isGreen = candle.close >= candle.open

        const highY = priceToY(candle.high)
        const lowY = priceToY(candle.low)
        const barHeight = lowY - highY

        const alpha = 0.4 + (i / candles.length) * 0.4 // Fade in effect
        const color = isGreen ? `rgba(0, 230, 118, ${alpha})` : `rgba(255, 70, 85, ${alpha})`

        ctx.fillStyle = color
        // Draw candle bar from high to low with dynamic width
        ctx.fillRect(x - barWidth / 2, highY, barWidth, barHeight)

        // Draw timestamp labels - show all when zoomed in, interval when zoomed out
        const showLabel = candles.length <= 20 || i % labelInterval === 0 || i === candles.length - 1
        if (showLabel) {
          const date = new Date(candle.timestamp)
          const hours = date.getHours()
          const minutes = date.getMinutes().toString().padStart(2, "0")
          const timeStr = `${hours}:${minutes}`

          // Smaller font when showing more labels
          const fontSize = candles.length <= 15 ? 9 : candles.length <= 30 ? 8 : 7
          ctx.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, system-ui, sans-serif`
          ctx.fillStyle = "rgba(255, 255, 255, 0.4)"
          ctx.textAlign = "center"
          ctx.fillText(timeStr, x, height - padding.bottom + 14)
        }
      })

      ctx.beginPath()
      candles.forEach((candle, i) => {
        const x = padding.left + i * candleWidth + candleWidth / 2
        const y = priceToY(candle.close)
        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })

      const lineGradient = ctx.createLinearGradient(padding.left, 0, width - padding.right, 0)
      if (signalType === "buy") {
        lineGradient.addColorStop(0, "rgba(0, 230, 118, 0.3)")
        lineGradient.addColorStop(0.5, "rgba(0, 230, 118, 0.7)")
        lineGradient.addColorStop(1, "rgba(0, 230, 118, 0.9)")
      } else if (signalType === "sell") {
        lineGradient.addColorStop(0, "rgba(255, 70, 85, 0.3)")
        lineGradient.addColorStop(0.5, "rgba(255, 70, 85, 0.7)")
        lineGradient.addColorStop(1, "rgba(255, 70, 85, 0.9)")
      } else {
        lineGradient.addColorStop(0, "rgba(150, 150, 150, 0.3)")
        lineGradient.addColorStop(1, "rgba(200, 200, 200, 0.6)")
      }

      ctx.strokeStyle = lineGradient
      ctx.lineWidth = 1.5
      ctx.stroke()

      const priceY = priceToY(currentPrice)
      const pulse = Math.sin(timeRef.current * 2) * 0.15 + 0.85

      // Thin horizontal line
      ctx.beginPath()
      ctx.moveTo(padding.left, priceY)
      ctx.lineTo(width - padding.right, priceY)
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.25 * pulse})`
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.stroke()
      ctx.setLineDash([])

      const dotX = width - padding.right + 6

      ctx.beginPath()
      ctx.arc(dotX, priceY, 2.5, 0, Math.PI * 2)
      ctx.fillStyle = "#ffffff"
      ctx.fill()

      ctx.font = "500 11px -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
      ctx.fillStyle = "#ffffff"
      ctx.textAlign = "left"
      ctx.fillText(`${currentPrice.toFixed(2)}`, dotX + 8, priceY + 3.5)

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [dimensions, candles, currentPrice, signalType, pivotLevels])

  const suggestedEntry =
    signalType === "buy" && pivotLevels?.s1
      ? pivotLevels.s1
      : signalType === "sell" && pivotLevels?.r1
        ? pivotLevels.r1
        : currentPrice

  const entryDistance = Math.abs(currentPrice - suggestedEntry)
  const entryDirection = suggestedEntry < currentPrice ? "below" : "above"

  return (
    <div className={cn("glass-frost rounded-3xl p-3.5 flex flex-col", className)}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-white/30 text-[10px] uppercase tracking-[0.15em] font-medium">Price Action</p>
        </div>
        <div
          className={cn(
            "px-2 py-0.5 rounded-full text-[9px] font-medium tracking-wide",
            signalType === "buy"
              ? "bg-emerald-500/10 text-emerald-400"
              : signalType === "sell"
                ? "bg-red-500/10 text-red-400"
                : "bg-white/5 text-white/40",
          )}
        >
          {signalType === "buy" ? "LONG" : signalType === "sell" ? "SHORT" : "HOLD"}
        </div>
      </div>

      <div className="relative flex-1 min-h-0 mt-1">
        <canvas
          ref={canvasRef}
          className="w-full h-full rounded-2xl"
          style={{ background: "rgba(0, 0, 0, 0.3)" }}
        />
        
        {/* Zoom Controls */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1">
          <button
            onClick={handleZoomIn}
            disabled={zoomIndex === 0}
            className={cn(
              "w-7 h-7 rounded-lg flex items-center justify-center transition-all",
              "bg-black/50 backdrop-blur-sm border border-white/10",
              zoomIndex === 0 ? "opacity-30" : "opacity-70 hover:opacity-100 active:scale-95"
            )}
          >
            <ZoomIn className="w-3.5 h-3.5 text-white" />
          </button>
          <button
            onClick={handleZoomOut}
            disabled={zoomIndex === ZOOM_LEVELS.length - 1}
            className={cn(
              "w-7 h-7 rounded-lg flex items-center justify-center transition-all",
              "bg-black/50 backdrop-blur-sm border border-white/10",
              zoomIndex === ZOOM_LEVELS.length - 1 ? "opacity-30" : "opacity-70 hover:opacity-100 active:scale-95"
            )}
          >
            <ZoomOut className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
        
        {/* Candle Count Indicator */}
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/50 backdrop-blur-sm">
          <span className="text-[9px] text-white/50 font-medium">{candles.length} candles</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-2.5 mt-2 border-t border-white/5">
        <div className="flex flex-col">
          <p className="text-white/20 text-[8px] uppercase tracking-[0.15em] mb-0.5 font-medium">Entry</p>
          <p
            className={cn(
              "text-sm font-medium tabular-nums",
              signalType === "buy" ? "text-emerald-400" : signalType === "sell" ? "text-red-400" : "text-white/50",
            )}
          >
            {suggestedEntry.toFixed(2)}
          </p>
        </div>
        <div className="flex flex-col">
          <p className="text-white/20 text-[8px] uppercase tracking-[0.15em] mb-0.5 font-medium">Distance</p>
          <p className="text-sm font-medium text-white/50 tabular-nums">{entryDistance.toFixed(2)}</p>
        </div>
      </div>
    </div>
  )
}
