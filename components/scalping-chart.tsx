"use client"

import type { OHLCData } from "@/lib/finnhub"
import { useEffect, useRef, useState, useMemo, useCallback } from "react"

interface BollingerBands {
  upper: number[]
  middle: number[]
  lower: number[]
}

interface SqueezeData {
  squeezeOn: boolean
  momentum: number[]
}

interface PivotLevels {
  pivot: number
  r1: number
  r2: number
  r3?: number
  s1: number
  s2: number
  s3?: number
}

interface ScalpingChartProps {
  marketData: OHLCData[]
  currentPrice: number
  pivotLevels: PivotLevels
  superTrendSignal: "BUY" | "SELL" | "HOLD"
  superTrendValue: number
  bollingerBands?: BollingerBands
  squeeze?: SqueezeData
  timeframe?: string
  onSentimentChange?: (sentiment: "Bullish" | "Bearish" | "Neutral") => void
  showPivotLabels?: boolean
}

// Calculate Tenkan (9-period)
function calculateTenkan(data: OHLCData[], period = 9): number[] {
  const result: number[] = []
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(data[i].close)
    } else {
      const slice = data.slice(i - period + 1, i + 1)
      const high = Math.max(...slice.map((d) => d.high))
      const low = Math.min(...slice.map((d) => d.low))
      result.push((high + low) / 2)
    }
  }
  return result
}

// Calculate Kijun (26-period)
function calculateKijun(data: OHLCData[], period = 26): number[] {
  const result: number[] = []
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(data[i].close)
    } else {
      const slice = data.slice(i - period + 1, i + 1)
      const high = Math.max(...slice.map((d) => d.high))
      const low = Math.min(...slice.map((d) => d.low))
      result.push((high + low) / 2)
    }
  }
  return result
}

// Calculate SuperTrend line
function calculateSuperTrendLine(
  data: OHLCData[],
  period = 10,
  multiplier = 3,
): { line: number[]; direction: ("up" | "down")[] } {
  const result: number[] = []
  const directions: ("up" | "down")[] = []

  // Calculate ATR
  const tr: number[] = []
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      tr.push(data[i].high - data[i].low)
    } else {
      const hl = data[i].high - data[i].low
      const hc = Math.abs(data[i].high - data[i - 1].close)
      const lc = Math.abs(data[i].low - data[i - 1].close)
      tr.push(Math.max(hl, hc, lc))
    }
  }

  const atr: number[] = []
  for (let i = 0; i < tr.length; i++) {
    if (i < period - 1) {
      atr.push(tr[i])
    } else {
      const slice = tr.slice(i - period + 1, i + 1)
      atr.push(slice.reduce((a, b) => a + b, 0) / period)
    }
  }

  let superTrend = 0
  let direction: "up" | "down" = "up"

  for (let i = 0; i < data.length; i++) {
    const hl2 = (data[i].high + data[i].low) / 2
    const upperBand = hl2 + multiplier * atr[i]
    const lowerBand = hl2 - multiplier * atr[i]

    if (i === 0) {
      superTrend = lowerBand
      direction = "up"
    } else {
      if (data[i].close > superTrend) {
        superTrend = Math.max(lowerBand, superTrend)
        direction = "up"
      } else {
        superTrend = Math.min(upperBand, superTrend)
        direction = "down"
      }
    }

    result.push(superTrend)
    directions.push(direction)
  }

  return { line: result, direction: directions }
}

export function ScalpingChart({
  marketData,
  currentPrice,
  pivotLevels,
  superTrendSignal,
  superTrendValue,
  bollingerBands,
  squeeze,
  timeframe = "1m",
  onSentimentChange,
  showPivotLabels = false,
}: ScalpingChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dimensionsRef = useRef({ width: 0, height: 0 })
  const [, forceUpdate] = useState({})

  const candleCount = useMemo(() => {
    switch (timeframe) {
      case "1":
        return 40
      case "5":
        return 35
      case "15":
        return 30
      case "30":
        return 25
      default:
        return 40
    }
  }, [timeframe])

  // Calculate indicators
  const indicators = useMemo(() => {
    if (marketData.length < 2) return null

    const tenkan = calculateTenkan(marketData, 9)
    const kijun = calculateKijun(marketData, 26)
    const superTrend = calculateSuperTrendLine(marketData, 10, 3)

    return { tenkan, kijun, superTrend }
  }, [marketData])

  const allPivotLevels = useMemo(() => {
    if (!pivotLevels) return []
    return [
      { price: pivotLevels.r3, label: "R3", color: "#ec3b70", type: "resistance" },
      { price: pivotLevels.r2, label: "R2", color: "#ec3b70", type: "resistance" },
      { price: pivotLevels.r1, label: "R1", color: "#ec3b70", type: "resistance" },
      { price: pivotLevels.pivot, label: "PP", color: "#ffffff", type: "pivot" },
      { price: pivotLevels.s1, label: "S1", color: "#10b981", type: "support" },
      { price: pivotLevels.s2, label: "S2", color: "#10b981", type: "support" },
      { price: pivotLevels.s3, label: "S3", color: "#10b981", type: "support" },
    ].filter((l) => l.price && !isNaN(l.price))
  }, [pivotLevels])

  const nearestLevel = useMemo(() => {
    const supports = allPivotLevels.filter((l) => l.price < currentPrice)
    const resistances = allPivotLevels.filter((l) => l.price > currentPrice)

    const nearestSupport = supports[0] // First one below (highest support)
    const nearestResistance = resistances[resistances.length - 1] // Last one above (lowest resistance)

    const supportDist = nearestSupport ? currentPrice - nearestSupport.price : Number.POSITIVE_INFINITY
    const resistanceDist = nearestResistance ? nearestResistance.price - currentPrice : Number.POSITIVE_INFINITY

    return {
      support: nearestSupport,
      resistance: nearestResistance,
      supportDistance: supportDist,
      resistanceDistance: resistanceDist,
      closest: supportDist < resistanceDist ? nearestSupport : nearestResistance,
      closestDirection: supportDist < resistanceDist ? ("below" as const) : ("above" as const),
    }
  }, [currentPrice, allPivotLevels])

  // Calculate sentiment
  const sentiment = useMemo(() => {
    let bullishPoints = 0
    let bearishPoints = 0

    // SuperTrend signal (primary weight)
    if (superTrendSignal === "BUY") bullishPoints += 3
    else if (superTrendSignal === "SELL") bearishPoints += 3

    // Recent candle momentum
    if (marketData.length >= 3) {
      const recent = marketData.slice(-3)
      const momentum = recent.reduce((sum, d) => sum + (d.close - d.open), 0)
      if (momentum > 0) bullishPoints += 1
      else if (momentum < 0) bearishPoints += 1
    }

    // Price vs pivot
    if (currentPrice > pivotLevels.pivot) bullishPoints += 1
    else if (currentPrice < pivotLevels.pivot) bearishPoints += 1

    // Proximity to levels
    if (nearestLevel.closest) {
      if (nearestLevel.closest.type === "support" && nearestLevel.supportDistance < 5) {
        bullishPoints += 1 // Near support = potential bounce
      } else if (nearestLevel.closest.type === "resistance" && nearestLevel.resistanceDistance < 5) {
        bearishPoints += 1 // Near resistance = potential rejection
      }
    }

    // Previously required +2 difference, now just needs any difference
    if (bullishPoints > bearishPoints) return "Bullish" as const
    if (bearishPoints > bullishPoints) return "Bearish" as const
    return "Neutral" as const
  }, [superTrendSignal, marketData, currentPrice, pivotLevels.pivot, nearestLevel])

  useEffect(() => {
    onSentimentChange?.(sentiment)
  }, [sentiment, onSentimentChange])

  useEffect(() => {
    if (!containerRef.current) return

    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect()
        const newHeight = Math.max(height, 220)
        // Only update if dimensions actually changed significantly
        if (
          Math.abs(dimensionsRef.current.width - width) > 1 ||
          Math.abs(dimensionsRef.current.height - newHeight) > 1
        ) {
          dimensionsRef.current = { width, height: newHeight }
          forceUpdate({})
        }
      }
    }

    // Initial measurement
    updateDimensions()

    const resizeObserver = new ResizeObserver(() => {
      updateDimensions()
    })

    resizeObserver.observe(containerRef.current)
    return () => resizeObserver.disconnect()
  }, [])

  const distanceInfo = useMemo(() => {
    const closest = nearestLevel.closest
    if (!closest) return null

    const distance = Math.abs(currentPrice - closest.price)
    const direction = closest.price > currentPrice ? "above" : "below"

    return {
      label: closest.label,
      price: closest.price,
      distance,
      direction,
      type: closest.type,
    }
  }, [nearestLevel, currentPrice])

  const drawChart = useCallback(() => {
    const canvas = canvasRef.current
    const dimensions = dimensionsRef.current
    if (!canvas || dimensions.width === 0 || marketData.length < 5) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = dimensions.width * dpr
    canvas.height = dimensions.height * dpr
    ctx.scale(dpr, dpr)

    const width = dimensions.width
    const height = dimensions.height
    const padding = { top: 15, right: 55, bottom: 15, left: 10 }
    const chartWidth = width - padding.left - padding.right
    const chartHeight = height - padding.top - padding.bottom

    ctx.clearRect(0, 0, width, height)

    const displayData = marketData.slice(-candleCount)

    // Get all prices for range calculation
    const allPrices: number[] = []
    displayData.forEach((d) => {
      allPrices.push(d.high, d.low)
    })

    // Add BB to price range if available
    if (bollingerBands) {
      const bbSlice = {
        upper: bollingerBands.upper.slice(-candleCount),
        lower: bollingerBands.lower.slice(-candleCount),
      }
      bbSlice.upper.forEach((v) => v && allPrices.push(v))
      bbSlice.lower.forEach((v) => v && allPrices.push(v))
    }

    allPivotLevels.forEach((level) => {
      if (level.price > 0) allPrices.push(level.price)
    })

    const minPrice = Math.min(...allPrices) * 0.9995
    const maxPrice = Math.max(...allPrices) * 1.0005
    const priceRange = maxPrice - minPrice

    const scaleY = (price: number) => padding.top + chartHeight - ((price - minPrice) / priceRange) * chartHeight
    const candleWidth = chartWidth / displayData.length
    const bodyWidth = Math.max(candleWidth * 0.8, 2)

    // Squeeze overlay
    if (squeeze?.squeezeOn) {
      ctx.fillStyle = "rgba(168, 85, 247, 0.08)"
      ctx.fillRect(padding.left, padding.top, chartWidth, chartHeight)

      ctx.fillStyle = "#a855f7"
      ctx.font = "bold 10px system-ui"
      ctx.textAlign = "center"
      ctx.fillText("SQUEEZE RUN", padding.left + chartWidth / 2, padding.top + 12)
    }

    // Draw Bollinger Bands
    if (bollingerBands && bollingerBands.upper.length > 0) {
      const bbOffset = bollingerBands.upper.length - candleCount

      // Draw BB fill (cloud)
      ctx.beginPath()
      ctx.fillStyle = "rgba(168, 85, 247, 0.06)"

      for (let i = 0; i < displayData.length; i++) {
        const bbIdx = bbOffset + i
        if (bbIdx >= 0 && bollingerBands.upper[bbIdx]) {
          const x = padding.left + i * candleWidth + candleWidth / 2
          const y = scaleY(bollingerBands.upper[bbIdx])
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
      }
      for (let i = displayData.length - 1; i >= 0; i--) {
        const bbIdx = bbOffset + i
        if (bbIdx >= 0 && bollingerBands.lower[bbIdx]) {
          const x = padding.left + i * candleWidth + candleWidth / 2
          const y = scaleY(bollingerBands.lower[bbIdx])
          ctx.lineTo(x, y)
        }
      }
      ctx.closePath()
      ctx.fill()

      // Draw BB lines
      ctx.strokeStyle = "rgba(168, 85, 247, 0.5)"
      ctx.lineWidth = 1
      ctx.setLineDash([])

      // Upper band
      ctx.beginPath()
      for (let i = 0; i < displayData.length; i++) {
        const bbIdx = bbOffset + i
        if (bbIdx >= 0 && bollingerBands.upper[bbIdx]) {
          const x = padding.left + i * candleWidth + candleWidth / 2
          const y = scaleY(bollingerBands.upper[bbIdx])
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
      }
      ctx.stroke()

      // Lower band
      ctx.beginPath()
      for (let i = 0; i < displayData.length; i++) {
        const bbIdx = bbOffset + i
        if (bbIdx >= 0 && bollingerBands.lower[bbIdx]) {
          const x = padding.left + i * candleWidth + candleWidth / 2
          const y = scaleY(bollingerBands.lower[bbIdx])
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
      }
      ctx.stroke()
    }

    // Draw Ichimoku cloud (Tenkan/Kijun)
    if (indicators) {
      const tenkanSlice = indicators.tenkan.slice(-candleCount)
      const kijunSlice = indicators.kijun.slice(-candleCount)

      // Draw cloud fill
      ctx.beginPath()
      for (let i = 0; i < displayData.length; i++) {
        const x = padding.left + i * candleWidth + candleWidth / 2
        const tenkanY = scaleY(tenkanSlice[i])
        if (i === 0) ctx.moveTo(x, tenkanY)
        else ctx.lineTo(x, tenkanY)
      }
      for (let i = displayData.length - 1; i >= 0; i--) {
        const x = padding.left + i * candleWidth + candleWidth / 2
        const kijunY = scaleY(kijunSlice[i])
        ctx.lineTo(x, kijunY)
      }
      ctx.closePath()

      const lastTenkan = tenkanSlice[tenkanSlice.length - 1]
      const lastKijun = kijunSlice[kijunSlice.length - 1]
      ctx.fillStyle = lastTenkan > lastKijun ? "rgba(16, 185, 129, 0.08)" : "rgba(236, 59, 112, 0.08)"
      ctx.fill()

      // Draw Tenkan line (green)
      ctx.strokeStyle = "#10b981"
      ctx.lineWidth = 1.5
      ctx.setLineDash([])
      ctx.beginPath()
      for (let i = 0; i < displayData.length; i++) {
        const x = padding.left + i * candleWidth + candleWidth / 2
        const y = scaleY(tenkanSlice[i])
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      // Draw Kijun line (pink)
      ctx.strokeStyle = "#ec3b70"
      ctx.lineWidth = 1.5
      ctx.beginPath()
      for (let i = 0; i < displayData.length; i++) {
        const x = padding.left + i * candleWidth + candleWidth / 2
        const y = scaleY(kijunSlice[i])
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }

    allPivotLevels.forEach((level) => {
      const y = scaleY(level.price)

      // Only draw if within visible range
      if (y < padding.top - 10 || y > height - padding.bottom + 10) return

      // Draw dashed line
      ctx.strokeStyle = level.color
      ctx.setLineDash([4, 4])
      ctx.lineWidth = 1
      ctx.globalAlpha = level.label === "PP" ? 0.8 : 0.5
      ctx.beginPath()
      ctx.moveTo(padding.left, y)
      ctx.lineTo(padding.left + chartWidth, y)
      ctx.stroke()
      ctx.globalAlpha = 1
      ctx.setLineDash([])

      // Draw label background
      const bgColor =
        level.type === "resistance"
          ? "rgba(236, 59, 112, 0.3)"
          : level.type === "pivot"
            ? "rgba(255, 255, 255, 0.2)"
            : "rgba(16, 185, 129, 0.3)"
      ctx.fillStyle = bgColor
      ctx.fillRect(width - padding.right + 2, y - 8, 22, 14)

      // Draw label text and price if showPivotLabels is true
      if (showPivotLabels) {
        ctx.fillStyle = level.color
        ctx.font = "bold 9px system-ui"
        ctx.textAlign = "left"
        ctx.fillText(level.label, width - padding.right + 5, y + 3)

        ctx.fillStyle = "#ffffff80"
        ctx.font = "9px system-ui"
        ctx.fillText(level.price.toFixed(0), width - padding.right + 26, y + 3)
      }
    })

    // Draw SuperTrend line
    if (indicators?.superTrend) {
      const stSlice = indicators.superTrend.line.slice(-candleCount)
      const dirSlice = indicators.superTrend.direction.slice(-candleCount)

      for (let i = 1; i < displayData.length; i++) {
        const x1 = padding.left + (i - 1) * candleWidth + candleWidth / 2
        const x2 = padding.left + i * candleWidth + candleWidth / 2
        const y1 = scaleY(stSlice[i - 1])
        const y2 = scaleY(stSlice[i])

        ctx.strokeStyle = dirSlice[i] === "up" ? "#10b981" : "#ec3b70"
        ctx.lineWidth = 2
        ctx.setLineDash([])
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()

        // Draw signal change triangles
        if (i > 0 && dirSlice[i] !== dirSlice[i - 1]) {
          const triangleSize = 6
          ctx.fillStyle = dirSlice[i] === "up" ? "#10b981" : "#ec3b70"
          ctx.beginPath()
          if (dirSlice[i] === "up") {
            // Up triangle
            ctx.moveTo(x2, y2 + triangleSize * 2)
            ctx.lineTo(x2 - triangleSize, y2 + triangleSize * 3)
            ctx.lineTo(x2 + triangleSize, y2 + triangleSize * 3)
          } else {
            // Down triangle
            ctx.moveTo(x2, y2 - triangleSize * 2)
            ctx.lineTo(x2 - triangleSize, y2 - triangleSize * 3)
            ctx.lineTo(x2 + triangleSize, y2 - triangleSize * 3)
          }
          ctx.closePath()
          ctx.fill()
        }
      }
    }

    // Draw candlesticks
    displayData.forEach((candle, i) => {
      const x = padding.left + i * candleWidth + candleWidth / 2
      const isGreen = candle.close >= candle.open
      const color = isGreen ? "#10b981" : "#ec3b70"

      // Wick
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, scaleY(candle.high))
      ctx.lineTo(x, scaleY(candle.low))
      ctx.stroke()

      // Body
      const bodyTop = scaleY(Math.max(candle.open, candle.close))
      const bodyBottom = scaleY(Math.min(candle.open, candle.close))
      const bodyHeight = Math.max(bodyBottom - bodyTop, 1)

      ctx.fillStyle = color
      ctx.fillRect(x - bodyWidth / 2, bodyTop, bodyWidth, bodyHeight)
    })

    // Draw current price line
    const currentY = scaleY(currentPrice)
    ctx.strokeStyle = "#ffffff"
    ctx.setLineDash([2, 2])
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(padding.left + chartWidth - 50, currentY)
    ctx.lineTo(padding.left + chartWidth, currentY)
    ctx.stroke()
    ctx.setLineDash([])

    // Current price dot
    ctx.fillStyle = "#ffffff"
    ctx.beginPath()
    ctx.arc(padding.left + chartWidth, currentY, 4, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = "rgba(0, 0, 0, 0.6)"
    ctx.fillRect(padding.left + 4, padding.top + 20, 100, 36)

    ctx.font = "bold 18px system-ui"
    ctx.fillStyle = "#ffffff"
    ctx.textAlign = "left"
    ctx.fillText(`$${currentPrice.toFixed(2)}`, padding.left + 10, padding.top + 40)

    // PP info below price
    if (distanceInfo) {
      ctx.font = "10px system-ui"
      ctx.fillStyle =
        distanceInfo.type === "resistance" ? "#ec3b70" : distanceInfo.type === "pivot" ? "#ffffff" : "#10b981"
      ctx.fillText(
        `${distanceInfo.label} $${distanceInfo.distance.toFixed(2)} ${distanceInfo.direction}`,
        padding.left + 10,
        padding.top + 52,
      )
    }
  }, [
    marketData,
    candleCount,
    bollingerBands,
    squeeze,
    indicators,
    allPivotLevels,
    currentPrice,
    showPivotLabels,
    distanceInfo,
  ])

  // Draw chart when dependencies change
  useEffect(() => {
    drawChart()
  }, [drawChart])

  return (
    <div className="flex flex-col relative w-full">
      {/* Chart canvas */}
      <div ref={containerRef} className="relative w-full h-[220px]">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 py-2 text-[9px] text-white/50 bg-gradient-to-t from-black/40 to-transparent">
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-[#a855f7]" />
          <span>BB</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-[#10b981]" />
          <span>Tenkan</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-[#ec3b70]" />
          <span>Kijun</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-[#ec3b70]" style={{ background: "linear-gradient(90deg, #10b981, #ec3b70)" }} />
          <span>ST Line</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-b-[6px] border-transparent border-b-[#10b981]" />
          <span>ST Buy</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[6px] border-transparent border-t-[#ec3b70]" />
          <span>ST Sell</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-white" style={{ boxShadow: "0 0 4px rgba(255,255,255,0.6)" }} />
          <span>Pivots</span>
        </div>
      </div>
    </div>
  )
}
