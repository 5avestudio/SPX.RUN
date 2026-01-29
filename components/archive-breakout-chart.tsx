"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import {
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  Lightbulb,
  Target,
  Shield,
  Zap,
} from "lucide-react"
import type { ArchivedTrade } from "@/lib/trade-archive"

interface ArchiveBreakoutChartProps {
  trade: ArchivedTrade
  className?: string
}

interface CandleData {
  time: number
  open: number
  high: number
  low: number
  close: number
  ewo?: number
  ewoSignal?: number
}

// Generate simulated candle data based on trade
function generateBreakoutCandles(trade: ArchivedTrade): CandleData[] {
  const isPut = trade.type === "PUT"
  const basePrice = trade.strike
  const candles: CandleData[] = []

  // Generate 30 candles simulating a breakout pattern
  let price = basePrice + (isPut ? 5 : -5)

  let prevEwo = 0

  for (let i = 0; i < 30; i++) {
    const time = Date.now() - (30 - i) * 60000

    // First 15 candles: consolidation
    if (i < 15) {
      const change = (Math.random() - 0.5) * 3
      const open = price
      const close = price + change
      price = close
      // EWO in squeeze zone
      const ewo = (Math.random() - 0.5) * 2
      candles.push({
        time,
        open,
        close,
        high: Math.max(open, close) + Math.random() * 2,
        low: Math.min(open, close) - Math.random() * 2,
        ewo,
        ewoSignal: prevEwo * 0.9 + ewo * 0.1,
      })
      prevEwo = ewo
    }
    // Candles 15-20: breakout starts
    else if (i < 20) {
      const breakoutMove = isPut ? -2 - Math.random() * 3 : 2 + Math.random() * 3
      const open = price
      const close = price + breakoutMove
      price = close
      // EWO starts trending
      const ewo = isPut ? -3 - (i - 15) * 1.5 : 3 + (i - 15) * 1.5
      candles.push({
        time,
        open,
        close,
        high: Math.max(open, close) + Math.random() * 1.5,
        low: Math.min(open, close) - Math.random() * 1.5,
        ewo,
        ewoSignal: prevEwo * 0.9 + ewo * 0.1,
      })
      prevEwo = ewo
    }
    // Candles 20-30: continuation
    else {
      const contMove = isPut ? -1 - Math.random() * 2 : 1 + Math.random() * 2
      const open = price
      const close = price + contMove
      price = close
      // EWO continues trend
      const ewo = isPut ? -8 - Math.random() * 2 : 8 + Math.random() * 2
      candles.push({
        time,
        open,
        close,
        high: Math.max(open, close) + Math.random() * 1,
        low: Math.min(open, close) - Math.random() * 1,
        ewo,
        ewoSignal: prevEwo * 0.9 + ewo * 0.1,
      })
      prevEwo = ewo
    }
  }

  return candles
}

function detectEwoCrossoverType(candles: CandleData[]): { index: number; type: "squeeze" | "reversal" } | null {
  for (let i = 15; i < 20; i++) {
    const prev = candles[i - 1]
    const curr = candles[i]
    if (!prev.ewo || !curr.ewo) continue

    // Squeeze run: EWO breaks out from near zero
    if (Math.abs(prev.ewo) < 2 && Math.abs(curr.ewo) >= 2) {
      return { index: i, type: "squeeze" }
    }
    // Reversal run: EWO crosses zero from opposite direction
    if ((prev.ewo > 0 && curr.ewo < -2) || (prev.ewo < 0 && curr.ewo > 2)) {
      return { index: i, type: "reversal" }
    }
  }
  // Default to squeeze at breakout point
  return { index: 15, type: "squeeze" }
}

function generateTradeAnalysis(trade: ArchivedTrade): {
  isWin: boolean
  whatWentRight: string[]
  whatWentWrong: string[]
  improvements: string[]
  recoveryTips: string[]
  proStrategies: string[]
  overallGrade: "A" | "B" | "C" | "D" | "F"
  keyLesson: string
} {
  const isWin = trade.pnlPercent > 0
  const isPut = trade.type === "PUT"
  const adx = trade.indicators.adx
  const rsi = trade.indicators.rsi
  const rvol = trade.indicators.rvol
  const ewo = trade.indicators.ewo
  const stSignal = trade.superTrend.signal
  const signalDelay = trade.superTrend.signalDelay || 0

  const whatWentRight: string[] = []
  const whatWentWrong: string[] = []
  const improvements: string[] = []
  const recoveryTips: string[] = []
  const proStrategies: string[] = []

  // Analyze what went right
  if (adx >= 25) whatWentRight.push("Strong trend entry (ADX >= 25)")
  if (adx >= 35) whatWentRight.push("Excellent trend strength for momentum plays")
  if (Math.abs(ewo) >= 5) whatWentRight.push("EWO confirmed directional bias")
  if (rvol >= 1.8) whatWentRight.push("High relative volume supported the move")
  if (signalDelay <= 30) whatWentRight.push("Quick signal execution (< 30s delay)")
  if ((isPut && rsi > 70) || (!isPut && rsi < 30)) whatWentRight.push("RSI extreme supported reversal thesis")
  if (stSignal !== "HOLD") whatWentRight.push(`SuperTrend confirmed ${stSignal} signal`)
  if (isWin && trade.pnlPercent > 100) whatWentRight.push("Held through volatility for max gain")

  // Analyze what went wrong
  if (adx < 25) whatWentWrong.push("Weak ADX (< 25) - entered during consolidation")
  if (adx < 20) whatWentWrong.push("Very weak trend - should have waited for breakout")
  if (signalDelay > 60) whatWentWrong.push(`Late entry - ${signalDelay}s signal delay cost premium`)
  if (signalDelay > 180) whatWentWrong.push("Severely late entry - missed the bulk of the move")
  if (rvol < 1.5) whatWentWrong.push("Low volume - insufficient conviction in the move")
  if ((isPut && rsi < 30) || (!isPut && rsi > 70)) whatWentWrong.push("Entered against RSI extreme")
  if (!isWin && stSignal === "HOLD") whatWentWrong.push("No clear SuperTrend signal - choppy conditions")
  if (!isWin && Math.abs(ewo) < 3) whatWentWrong.push("EWO near zero - no momentum confirmation")

  // Improvements based on analysis
  if (adx < 25) improvements.push("Wait for ADX to cross above 25 before entry")
  if (signalDelay > 60) improvements.push("Set alerts for SuperTrend flips to enter within 30 seconds")
  if (rvol < 1.8) improvements.push("Only enter when RVOL > 1.8x for conviction")
  improvements.push("Use limit orders 1-2 cents below ask for better fills")
  if (!isWin) improvements.push("Consider scaling into position (50% initial, 50% on confirmation)")
  if (trade.pnlPercent < -50) improvements.push("Set hard stop at 30-40% loss to preserve capital")

  // Recovery tips for losses
  if (!isWin) {
    recoveryTips.push("Take a 15-30 minute break to reset emotionally")
    recoveryTips.push("Review: Was this a setup failure or execution failure?")
    recoveryTips.push("Reduce position size by 50% on next 2-3 trades")
    recoveryTips.push("Look for A+ setups only - ADX > 30, RVOL > 2x, clear ST signal")
    if (trade.pnlPercent < -80) {
      recoveryTips.push("Consider taking the rest of the day off")
      recoveryTips.push("Journal this trade with detailed entry/exit reasoning")
    }
  }

  // Pro scalping strategies
  proStrategies.push("Average up on winners: Add 25% more at first target hit")
  proStrategies.push("Trail stop using SuperTrend line as dynamic exit")
  proStrategies.push("Scale out: 50% at 50% gain, 25% at 100%, let 25% run")
  if (isPut) {
    proStrategies.push("On PUT runs: Exit 70% when RSI hits oversold (< 30)")
  } else {
    proStrategies.push("On CALL runs: Exit 70% when RSI hits overbought (> 70)")
  }
  proStrategies.push("Time exits: Most momentum fades within 8-12 minutes")
  proStrategies.push("Use pivot points as profit targets (S1/S2 for PUTs, R1/R2 for CALLs)")

  // Calculate grade
  let grade: "A" | "B" | "C" | "D" | "F" = "C"
  let score = 50

  if (isWin) score += 20
  if (trade.pnlPercent > 100) score += 15
  if (trade.pnlPercent > 300) score += 10
  if (adx >= 25) score += 10
  if (adx >= 35) score += 5
  if (signalDelay <= 30) score += 10
  if (rvol >= 1.8) score += 5
  if (!isWin) score -= 20
  if (trade.pnlPercent < -50) score -= 15
  if (trade.pnlPercent < -90) score -= 10
  if (adx < 20) score -= 10
  if (signalDelay > 120) score -= 10

  if (score >= 90) grade = "A"
  else if (score >= 75) grade = "B"
  else if (score >= 55) grade = "C"
  else if (score >= 40) grade = "D"
  else grade = "F"

  // Key lesson
  let keyLesson = ""
  if (isWin && adx >= 30 && signalDelay <= 30) {
    keyLesson = "Perfect execution - strong trend, quick entry. Replicate this setup."
  } else if (isWin && adx < 25) {
    keyLesson = "Lucky win in weak trend. Don't rely on this - wait for better setups."
  } else if (!isWin && adx < 20) {
    keyLesson = "ADX below 20 = chop zone. No trend = no edge. Wait for breakouts."
  } else if (!isWin && signalDelay > 120) {
    keyLesson = "Late entries kill profits. Set alerts and be ready to execute fast."
  } else if (!isWin && trade.pnlPercent < -80) {
    keyLesson = "Large loss without stop. Always have a max loss plan before entry."
  } else {
    keyLesson = isWin
      ? "Solid trade. Focus on replicating the conditions that led to this win."
      : "Review your checklist before entries. Most losses come from skipping steps."
  }

  return {
    isWin,
    whatWentRight,
    whatWentWrong,
    improvements,
    recoveryTips,
    proStrategies,
    overallGrade: grade,
    keyLesson,
  }
}

export function ArchiveBreakoutChart({ trade, className }: ArchiveBreakoutChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const [selectedTimeframe, setSelectedTimeframe] = useState<"1m" | "5m" | "10m" | "15m">(trade.superTrend.timeframe)
  const [showAnalysis, setShowAnalysis] = useState(false)
  const animationRef = useRef<number>(0)
  const timeRef = useRef(0)

  const candles = useMemo(() => generateBreakoutCandles(trade), [trade])
  const isPut = trade.type === "PUT"
  const analysis = useMemo(() => generateTradeAnalysis(trade), [trade])

  const ewoCrossover = useMemo(() => detectEwoCrossoverType(candles), [candles])

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
    const padding = { top: 30, bottom: 30, left: 10, right: 55 }
    const chartWidth = width - padding.left - padding.right
    const chartHeight = height - padding.top - padding.bottom

    const allPrices = candles.flatMap((c) => [c.high, c.low])
    if (trade.pivotPoints) {
      const pivots = Object.values(trade.pivotPoints).filter(Boolean) as number[]
      allPrices.push(...pivots)
    }
    const priceMin = Math.min(...allPrices) * 0.999
    const priceMax = Math.max(...allPrices) * 1.001
    const priceRange = priceMax - priceMin

    const priceToY = (price: number) => {
      return padding.top + chartHeight - ((price - priceMin) / priceRange) * chartHeight
    }

    const candleWidth = chartWidth / candles.length
    const candleBodyWidth = candleWidth * 0.6

    // Calculate indicators for drawing
    const closes = candles.map((c) => c.close)

    // Bollinger Bands (simplified)
    const bbPeriod = 20
    const bbMultiplier = 2
    const bbUpper: number[] = []
    const bbMiddle: number[] = []
    const bbLower: number[] = []

    for (let i = bbPeriod - 1; i < closes.length; i++) {
      const slice = closes.slice(i - bbPeriod + 1, i + 1)
      const mean = slice.reduce((a, b) => a + b, 0) / bbPeriod
      const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / bbPeriod
      const std = Math.sqrt(variance)
      bbUpper.push(mean + bbMultiplier * std)
      bbMiddle.push(mean)
      bbLower.push(mean - bbMultiplier * std)
    }

    // Ichimoku Cloud (simplified - tenkan, kijun, senkou span)
    const tenkanPeriod = 9
    const kijunPeriod = 26
    const tenkan: number[] = []
    const kijun: number[] = []

    for (let i = 0; i < candles.length; i++) {
      if (i >= tenkanPeriod - 1) {
        const slice = candles.slice(i - tenkanPeriod + 1, i + 1)
        const high = Math.max(...slice.map((c) => c.high))
        const low = Math.min(...slice.map((c) => c.low))
        tenkan.push((high + low) / 2)
      }
      if (i >= kijunPeriod - 1) {
        const slice = candles.slice(i - kijunPeriod + 1, i + 1)
        const high = Math.max(...slice.map((c) => c.high))
        const low = Math.min(...slice.map((c) => c.low))
        kijun.push((high + low) / 2)
      }
    }

    const stPeriod = 10
    const stMultiplier = 3
    const superTrendLine: { x: number; y: number; signal: "BUY" | "SELL" }[] = []
    const superTrendSignals: { x: number; y: number; type: "BUY" | "SELL" }[] = []
    let prevTrend = 1
    let prevUpperBand = 0
    let prevLowerBand = 0

    for (let i = stPeriod; i < candles.length; i++) {
      const slice = candles.slice(i - stPeriod, i)
      const atr = slice.reduce((sum, c) => sum + (c.high - c.low), 0) / stPeriod
      const hl2 = (candles[i].high + candles[i].low) / 2
      const upperBand = hl2 + stMultiplier * atr
      const lowerBand = hl2 - stMultiplier * atr

      // Smooth the bands
      const smoothUpper = prevUpperBand ? Math.min(upperBand, prevUpperBand) : upperBand
      const smoothLower = prevLowerBand ? Math.max(lowerBand, prevLowerBand) : lowerBand
      prevUpperBand = candles[i].close > smoothUpper ? upperBand : smoothUpper
      prevLowerBand = candles[i].close < smoothLower ? lowerBand : smoothLower

      const close = candles[i].close
      let trend = prevTrend

      if (close > smoothUpper) trend = 1
      else if (close < smoothLower) trend = -1

      const x = padding.left + i * candleWidth + candleWidth / 2
      const y = priceToY(trend === 1 ? smoothLower : smoothUpper)

      superTrendLine.push({ x, y, signal: trend === 1 ? "BUY" : "SELL" })

      if (trend !== prevTrend) {
        superTrendSignals.push({ x, y, type: trend === 1 ? "BUY" : "SELL" })
      }
      prevTrend = trend
    }

    // Pivot Points from trade data
    const pivotLevels: { label: string; value: number; color: string }[] = []
    if (trade.pivotPoints) {
      if (trade.pivotPoints.r3)
        pivotLevels.push({ label: "R3", value: trade.pivotPoints.r3, color: "rgba(236, 59, 112, 0.6)" })
      if (trade.pivotPoints.r2)
        pivotLevels.push({ label: "R2", value: trade.pivotPoints.r2, color: "rgba(236, 59, 112, 0.4)" })
      if (trade.pivotPoints.r1)
        pivotLevels.push({ label: "R1", value: trade.pivotPoints.r1, color: "rgba(236, 59, 112, 0.25)" })
      if (trade.pivotPoints.p)
        pivotLevels.push({ label: "P", value: trade.pivotPoints.p, color: "rgba(255, 193, 7, 0.4)" })
      if (trade.pivotPoints.s1)
        pivotLevels.push({ label: "S1", value: trade.pivotPoints.s1, color: "rgba(16, 185, 129, 0.25)" })
      if (trade.pivotPoints.s2)
        pivotLevels.push({ label: "S2", value: trade.pivotPoints.s2, color: "rgba(16, 185, 129, 0.4)" })
      if (trade.pivotPoints.s3)
        pivotLevels.push({ label: "S3", value: trade.pivotPoints.s3, color: "rgba(16, 185, 129, 0.6)" })
    }

    let isAnimating = true

    const animate = () => {
      if (!isAnimating) return

      timeRef.current += 0.02
      ctx.clearRect(0, 0, width, height)

      // Background
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)"
      ctx.fillRect(0, 0, width, height)

      if (ewoCrossover) {
        const crossoverX = padding.left + ewoCrossover.index * candleWidth
        const gradientWidth = (candles.length - ewoCrossover.index) * candleWidth

        const gradient = ctx.createLinearGradient(crossoverX, 0, crossoverX + gradientWidth, 0)
        if (isPut) {
          gradient.addColorStop(0, "rgba(236, 59, 112, 0)")
          gradient.addColorStop(0.2, "rgba(236, 59, 112, 0.12)")
          gradient.addColorStop(0.5, "rgba(236, 59, 112, 0.08)")
          gradient.addColorStop(1, "rgba(236, 59, 112, 0.03)")
        } else {
          gradient.addColorStop(0, "rgba(16, 185, 129, 0)")
          gradient.addColorStop(0.2, "rgba(16, 185, 129, 0.12)")
          gradient.addColorStop(0.5, "rgba(16, 185, 129, 0.08)")
          gradient.addColorStop(1, "rgba(16, 185, 129, 0.03)")
        }

        ctx.fillStyle = gradient
        ctx.fillRect(crossoverX, padding.top, gradientWidth, chartHeight)

        // Draw crossover label
        const labelY = padding.top + 12
        const labelText = ewoCrossover.type === "squeeze" ? "SQUEEZE RUN" : "REVERSAL RUN"
        ctx.font = "bold 8px system-ui"
        ctx.fillStyle = isPut ? "rgba(236, 59, 112, 0.8)" : "rgba(16, 185, 129, 0.8)"
        ctx.textAlign = "left"
        ctx.fillText(labelText, crossoverX + 4, labelY)

        // Draw vertical line at crossover
        ctx.beginPath()
        ctx.moveTo(crossoverX, padding.top)
        ctx.lineTo(crossoverX, height - padding.bottom)
        ctx.strokeStyle = isPut ? "rgba(236, 59, 112, 0.3)" : "rgba(16, 185, 129, 0.3)"
        ctx.lineWidth = 1
        ctx.setLineDash([4, 4])
        ctx.stroke()
        ctx.setLineDash([])
      }

      // Draw Ichimoku Cloud
      if (tenkan.length > 1 && kijun.length > 1) {
        const cloudOffset = tenkanPeriod - 1
        ctx.beginPath()
        ctx.moveTo(padding.left + cloudOffset * candleWidth, priceToY(tenkan[0]))
        for (let i = 1; i < tenkan.length; i++) {
          ctx.lineTo(padding.left + (i + cloudOffset) * candleWidth, priceToY(tenkan[i]))
        }
        ctx.strokeStyle = "rgba(16, 185, 129, 0.4)"
        ctx.lineWidth = 1
        ctx.stroke()

        const kijunOffset = kijunPeriod - 1
        ctx.beginPath()
        ctx.moveTo(padding.left + kijunOffset * candleWidth, priceToY(kijun[0]))
        for (let i = 1; i < kijun.length; i++) {
          ctx.lineTo(padding.left + (i + kijunOffset) * candleWidth, priceToY(kijun[i]))
        }
        ctx.strokeStyle = "rgba(236, 59, 112, 0.4)"
        ctx.lineWidth = 1
        ctx.stroke()

        // Cloud fill
        if (tenkan.length >= kijun.length) {
          ctx.beginPath()
          const alignOffset = tenkan.length - kijun.length
          for (let i = 0; i < kijun.length; i++) {
            const x = padding.left + (i + kijunOffset) * candleWidth
            const y1 = priceToY(tenkan[i + alignOffset])
            if (i === 0) ctx.moveTo(x, y1)
            else ctx.lineTo(x, y1)
          }
          for (let i = kijun.length - 1; i >= 0; i--) {
            const x = padding.left + (i + kijunOffset) * candleWidth
            ctx.lineTo(x, priceToY(kijun[i]))
          }
          ctx.closePath()
          const isGreenCloud = tenkan[tenkan.length - 1] > kijun[kijun.length - 1]
          ctx.fillStyle = isGreenCloud ? "rgba(16, 185, 129, 0.08)" : "rgba(236, 59, 112, 0.08)"
          ctx.fill()
        }
      }

      // Draw Bollinger Bands
      if (bbUpper.length > 1) {
        const bbOffset = bbPeriod - 1

        // Upper band
        ctx.beginPath()
        ctx.moveTo(padding.left + bbOffset * candleWidth, priceToY(bbUpper[0]))
        for (let i = 1; i < bbUpper.length; i++) {
          ctx.lineTo(padding.left + (i + bbOffset) * candleWidth, priceToY(bbUpper[i]))
        }
        ctx.strokeStyle = "rgba(139, 92, 246, 0.3)"
        ctx.lineWidth = 1
        ctx.stroke()

        // Lower band
        ctx.beginPath()
        ctx.moveTo(padding.left + bbOffset * candleWidth, priceToY(bbLower[0]))
        for (let i = 1; i < bbLower.length; i++) {
          ctx.lineTo(padding.left + (i + bbOffset) * candleWidth, priceToY(bbLower[i]))
        }
        ctx.strokeStyle = "rgba(139, 92, 246, 0.3)"
        ctx.stroke()

        // Fill between bands
        ctx.beginPath()
        ctx.moveTo(padding.left + bbOffset * candleWidth, priceToY(bbUpper[0]))
        for (let i = 1; i < bbUpper.length; i++) {
          ctx.lineTo(padding.left + (i + bbOffset) * candleWidth, priceToY(bbUpper[i]))
        }
        for (let i = bbLower.length - 1; i >= 0; i--) {
          ctx.lineTo(padding.left + (i + bbOffset) * candleWidth, priceToY(bbLower[i]))
        }
        ctx.closePath()
        ctx.fillStyle = "rgba(139, 92, 246, 0.05)"
        ctx.fill()
      }

      pivotLevels.forEach((level) => {
        const y = priceToY(level.value)
        if (y < padding.top || y > height - padding.bottom) return

        ctx.beginPath()
        ctx.moveTo(padding.left, y)
        ctx.lineTo(width - padding.right, y)
        ctx.strokeStyle = level.color
        ctx.lineWidth = 1
        ctx.setLineDash([2, 4])
        ctx.stroke()
        ctx.setLineDash([])

        // Background pill for label
        ctx.font = "bold 7px system-ui"
        const textWidth = ctx.measureText(level.label).width
        const pillWidth = textWidth + 6
        const pillHeight = 12
        const pillX = width - padding.right + 2
        const pillY = y - pillHeight / 2

        ctx.fillStyle = level.color.replace(/[\d.]+\)$/, "0.2)")
        ctx.beginPath()
        ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 3)
        ctx.fill()

        ctx.fillStyle = level.color.replace(/[\d.]+\)$/, "1)")
        ctx.textAlign = "left"
        ctx.fillText(level.label, pillX + 3, y + 2.5)

        // Price value on the right
        ctx.font = "9px system-ui"
        ctx.fillStyle = "rgba(255,255,255,0.5)"
        ctx.textAlign = "right"
        ctx.fillText(level.value.toFixed(0), width - 2, y + 3)
      })

      // Draw Candles
      candles.forEach((candle, i) => {
        const x = padding.left + i * candleWidth + candleWidth / 2
        const isGreen = candle.close >= candle.open

        const bodyTop = priceToY(Math.max(candle.open, candle.close))
        const bodyBottom = priceToY(Math.min(candle.open, candle.close))
        const bodyHeight = Math.max(bodyBottom - bodyTop, 1)

        const wickTop = priceToY(candle.high)
        const wickBottom = priceToY(candle.low)

        // Wick
        ctx.beginPath()
        ctx.moveTo(x, wickTop)
        ctx.lineTo(x, wickBottom)
        ctx.strokeStyle = isGreen ? "rgba(16, 185, 129, 0.6)" : "rgba(236, 59, 112, 0.6)"
        ctx.lineWidth = 1
        ctx.stroke()

        // Body
        ctx.fillStyle = isGreen ? "rgba(16, 185, 129, 0.85)" : "rgba(236, 59, 112, 0.85)"
        ctx.fillRect(x - candleBodyWidth / 2, bodyTop, candleBodyWidth, bodyHeight)
      })

      if (superTrendLine.length > 1) {
        ctx.beginPath()
        let currentSignal = superTrendLine[0].signal
        ctx.moveTo(superTrendLine[0].x, superTrendLine[0].y)

        for (let i = 1; i < superTrendLine.length; i++) {
          const point = superTrendLine[i]

          if (point.signal !== currentSignal) {
            // End current segment
            ctx.strokeStyle = currentSignal === "BUY" ? "rgba(16, 185, 129, 0.9)" : "rgba(236, 59, 112, 0.9)"
            ctx.lineWidth = 2
            ctx.stroke()

            // Start new segment
            ctx.beginPath()
            ctx.moveTo(superTrendLine[i - 1].x, superTrendLine[i - 1].y)
            currentSignal = point.signal
          }

          ctx.lineTo(point.x, point.y)
        }

        ctx.strokeStyle = currentSignal === "BUY" ? "rgba(16, 185, 129, 0.9)" : "rgba(236, 59, 112, 0.9)"
        ctx.lineWidth = 2
        ctx.stroke()
      }

      // Draw SuperTrend Flip Signals (triangles)
      superTrendSignals.forEach((signal) => {
        const size = 8
        ctx.beginPath()
        if (signal.type === "BUY") {
          ctx.moveTo(signal.x, signal.y + size)
          ctx.lineTo(signal.x - size / 2, signal.y + size + size)
          ctx.lineTo(signal.x + size / 2, signal.y + size + size)
        } else {
          ctx.moveTo(signal.x, signal.y - size)
          ctx.lineTo(signal.x - size / 2, signal.y - size - size)
          ctx.lineTo(signal.x + size / 2, signal.y - size - size)
        }
        ctx.closePath()
        ctx.fillStyle = signal.type === "BUY" ? "rgba(16, 185, 129, 0.9)" : "rgba(236, 59, 112, 0.9)"
        ctx.fill()

        // Glow effect
        const glowGradient = ctx.createRadialGradient(signal.x, signal.y, 0, signal.x, signal.y, 15)
        if (signal.type === "BUY") {
          glowGradient.addColorStop(0, "rgba(16, 185, 129, 0.3)")
        } else {
          glowGradient.addColorStop(0, "rgba(236, 59, 112, 0.3)")
        }
        glowGradient.addColorStop(1, "transparent")
        ctx.beginPath()
        ctx.arc(signal.x, signal.y, 15, 0, Math.PI * 2)
        ctx.fillStyle = glowGradient
        ctx.fill()
      })

      const entryX = padding.left + 15 * candleWidth + candleWidth / 2
      const exitX = padding.left + 28 * candleWidth + candleWidth / 2
      const entryY = priceToY(candles[15].close)
      const exitY = priceToY(candles[28].close)

      // Entry marker
      ctx.beginPath()
      ctx.arc(entryX, entryY, 6, 0, Math.PI * 2)
      ctx.fillStyle = "#fff"
      ctx.fill()
      ctx.strokeStyle = "rgba(255,255,255,0.3)"
      ctx.lineWidth = 2
      ctx.stroke()

      // Entry label with price
      ctx.font = "bold 8px system-ui"
      ctx.fillStyle = "#fff"
      ctx.textAlign = "center"
      ctx.fillText("ENTRY", entryX, entryY - 16)
      ctx.font = "bold 9px system-ui"
      ctx.fillStyle = "rgba(255,255,255,0.8)"
      ctx.fillText(`$${trade.entry.toFixed(2)}`, entryX, entryY - 6)

      // Exit marker
      ctx.beginPath()
      ctx.arc(exitX, exitY, 6, 0, Math.PI * 2)
      ctx.fillStyle = isPut ? "rgba(236, 59, 112, 1)" : "rgba(16, 185, 129, 1)"
      ctx.fill()
      ctx.strokeStyle = isPut ? "rgba(236, 59, 112, 0.3)" : "rgba(16, 185, 129, 0.3)"
      ctx.lineWidth = 2
      ctx.stroke()

      // Exit label with price
      ctx.font = "bold 8px system-ui"
      ctx.fillStyle = isPut ? "#ec3b70" : "#10b981"
      ctx.textAlign = "center"
      ctx.fillText("EXIT", exitX, exitY - 16)
      ctx.font = "bold 9px system-ui"
      ctx.fillStyle = isPut ? "rgba(236, 59, 112, 0.9)" : "rgba(16, 185, 129, 0.9)"
      ctx.fillText(`$${trade.exit.toFixed(2)}`, exitX, exitY - 6)

      ctx.beginPath()
      ctx.moveTo(entryX, entryY)
      ctx.lineTo(exitX, exitY)
      ctx.strokeStyle = isPut ? "rgba(236, 59, 112, 0.2)" : "rgba(16, 185, 129, 0.2)"
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.stroke()
      ctx.setLineDash([])

      // White glow on current price
      const currentY = priceToY(candles[candles.length - 1].close)
      const pulse = Math.sin(timeRef.current * 3) * 0.3 + 0.7
      const currentGlowGradient = ctx.createRadialGradient(
        width - padding.right,
        currentY,
        0,
        width - padding.right,
        currentY,
        12,
      )
      currentGlowGradient.addColorStop(0, `rgba(255, 255, 255, ${0.8 * pulse})`)
      currentGlowGradient.addColorStop(0.5, `rgba(255, 255, 255, ${0.3 * pulse})`)
      currentGlowGradient.addColorStop(1, "transparent")
      ctx.beginPath()
      ctx.arc(width - padding.right, currentY, 12, 0, Math.PI * 2)
      ctx.fillStyle = currentGlowGradient
      ctx.fill()

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      isAnimating = false
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [dimensions, trade, isPut, candles, ewoCrossover])

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Trade Header */}
      <div
        className="p-4 rounded-2xl"
        style={
          isPut
            ? {
                background:
                  "linear-gradient(135deg, rgba(236, 59, 112, 0.2) 0%, rgba(239, 68, 68, 0.1) 50%, rgba(251, 113, 133, 0.05) 100%)",
              }
            : {
                background:
                  "linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(6, 182, 212, 0.1) 50%, rgba(59, 130, 246, 0.05) 100%)",
              }
        }
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={
                isPut
                  ? { background: "linear-gradient(135deg, rgba(236, 59, 112, 0.4) 0%, rgba(239, 68, 68, 0.2) 100%)" }
                  : { background: "linear-gradient(135deg, rgba(16, 185, 129, 0.4) 0%, rgba(6, 182, 212, 0.2) 100%)" }
              }
            >
              {isPut ? (
                <TrendingDown className="w-6 h-6 text-[#ec3b70]" />
              ) : (
                <TrendingUp className="w-6 h-6 text-emerald-400" />
              )}
            </div>
            <div>
              <p className="text-lg font-semibold text-white">
                {trade.type} ${trade.strike}
              </p>
              <p className="text-xs text-white/50">
                {trade.date} · {trade.time}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className={cn("text-2xl font-bold", analysis.isWin ? "text-emerald-400" : "text-red-400")}>
              {analysis.isWin ? "+" : ""}
              {trade.pnlPercent.toFixed(0)}%
            </p>
            <p className="text-xs text-white/50">
              ${trade.entry.toFixed(2)} → ${trade.exit.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10">
          <div
            className={cn(
              "px-3 py-1 rounded-lg text-sm font-bold",
              analysis.overallGrade === "A" && "bg-emerald-500/30 text-emerald-400",
              analysis.overallGrade === "B" && "bg-cyan-500/30 text-cyan-400",
              analysis.overallGrade === "C" && "bg-yellow-500/30 text-yellow-400",
              analysis.overallGrade === "D" && "bg-orange-500/30 text-orange-400",
              analysis.overallGrade === "F" && "bg-red-500/30 text-red-400",
            )}
          >
            Grade: {analysis.overallGrade}
          </div>
          <button
            onClick={() => setShowAnalysis(!showAnalysis)}
            className="ml-auto flex items-center gap-1 px-3 py-1 rounded-lg bg-white/10 text-white/70 text-xs hover:bg-white/20 transition-colors min-h-[36px]"
          >
            <Lightbulb className="w-3.5 h-3.5" />
            {showAnalysis ? "Hide" : "View"} Analysis
            {showAnalysis ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {showAnalysis && (
        <div className="space-y-3">
          {/* Key Lesson */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-500/20 to-pink-500/10 border border-purple-500/20">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/30 flex items-center justify-center flex-shrink-0">
                <Lightbulb className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-purple-400 uppercase tracking-wider font-medium mb-1">Key Lesson</p>
                <p className="text-sm text-white">{analysis.keyLesson}</p>
              </div>
            </div>
          </div>

          {/* What Went Right */}
          {analysis.whatWentRight.length > 0 && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <p className="text-xs text-emerald-400 uppercase tracking-wider font-medium">What Went Right</p>
              </div>
              <ul className="space-y-2">
                {analysis.whatWentRight.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                    <span className="text-emerald-400 mt-0.5">+</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* What Went Wrong */}
          {analysis.whatWentWrong.length > 0 && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
              <div className="flex items-center gap-2 mb-3">
                <XCircle className="w-4 h-4 text-red-400" />
                <p className="text-xs text-red-400 uppercase tracking-wider font-medium">What Went Wrong</p>
              </div>
              <ul className="space-y-2">
                {analysis.whatWentWrong.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                    <span className="text-red-400 mt-0.5">-</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Improvements */}
          <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-cyan-400" />
              <p className="text-xs text-cyan-400 uppercase tracking-wider font-medium">How to Improve</p>
            </div>
            <ul className="space-y-2">
              {analysis.improvements.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                  <span className="text-cyan-400 mt-0.5">{i + 1}.</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Recovery Tips (only for losses) */}
          {!analysis.isWin && analysis.recoveryTips.length > 0 && (
            <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-orange-400" />
                <p className="text-xs text-orange-400 uppercase tracking-wider font-medium">Recovery Plan</p>
              </div>
              <ul className="space-y-2">
                {analysis.recoveryTips.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                    <span className="text-orange-400 mt-0.5">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Pro Scalping Strategies */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/20">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-yellow-400" />
              <p className="text-xs text-yellow-400 uppercase tracking-wider font-medium">Pro Scalper Strategies</p>
            </div>
            <ul className="space-y-2">
              {analysis.proStrategies.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                  <span className="text-yellow-400 mt-0.5">★</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Existing chart canvas */}
      <div className="relative aspect-[16/10] rounded-2xl overflow-hidden bg-black/40">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      </div>

      {/* Timeframe Selector */}
      <div className="px-3 py-2 border-b border-white/5 flex items-center gap-2">
        <span className="text-[9px] text-white/40 uppercase tracking-wider">ST:</span>
        {(["1m", "5m", "10m", "15m"] as const).map((tf) => (
          <button
            key={tf}
            onClick={() => setSelectedTimeframe(tf)}
            className={cn(
              "px-2 py-1 rounded text-[10px] uppercase transition-all min-h-[28px]",
              selectedTimeframe === tf ? "bg-white/10 text-white" : "text-white/30 hover:text-white/50",
            )}
          >
            {tf}
          </button>
        ))}
        {ewoCrossover && (
          <span
            className={cn(
              "ml-auto px-2 py-0.5 rounded-full text-[8px] uppercase font-medium",
              ewoCrossover.type === "squeeze" ? "bg-amber-500/20 text-amber-400" : "bg-cyan-500/20 text-cyan-400",
            )}
          >
            {ewoCrossover.type}
          </span>
        )}
      </div>

      {/* Legend */}
      <div className="px-3 py-2 border-t border-white/5 flex flex-wrap gap-3">
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-purple-500/50" />
          <span className="text-[9px] text-white/40">BB</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-emerald-500/50" />
          <span className="text-[9px] text-white/40">Tenkan</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-[#ec3b70]/50" />
          <span className="text-[9px] text-white/40">Kijun</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-gradient-to-r from-emerald-500 to-[#ec3b70]" />
          <span className="text-[9px] text-white/40">ST Line</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-b-[6px] border-l-transparent border-r-transparent border-b-emerald-500" />
          <span className="text-[9px] text-white/40">ST Buy</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[6px] border-l-transparent border-r-transparent border-t-[#ec3b70]" />
          <span className="text-[9px] text-white/40">ST Sell</span>
        </div>
        {trade.pivotPoints && (
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-amber-500/40" />
            <span className="text-[9px] text-white/40">Pivots</span>
          </div>
        )}
      </div>

      {/* Expandable Indicator Sections */}
      <div className="border-t border-white/5">
        <button
          onClick={() => toggleSection("prices")}
          className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-white/5 transition-colors min-h-[44px]"
        >
          <span className="text-[10px] text-white/50 uppercase tracking-wider">Entry / Exit Prices</span>
          {expandedSection === "prices" ? (
            <ChevronUp className="w-4 h-4 text-white/30" />
          ) : (
            <ChevronDown className="w-4 h-4 text-white/30" />
          )}
        </button>
        {expandedSection === "prices" && (
          <div className="px-3 pb-3 grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
              <p className="text-[9px] text-white/40 uppercase tracking-wider">Entry Price</p>
              <p className="text-lg font-bold text-white">${trade.entry.toFixed(2)}</p>
            </div>
            <div
              className={cn(
                "p-2.5 rounded-xl border",
                trade.pnlPercent >= 0
                  ? "bg-emerald-500/10 border-emerald-500/30"
                  : "bg-[#ec3b70]/10 border-[#ec3b70]/30",
              )}
            >
              <p className="text-[9px] text-white/40 uppercase tracking-wider">Exit Price</p>
              <p className={cn("text-lg font-bold", trade.pnlPercent >= 0 ? "text-emerald-400" : "text-[#ec3b70]")}>
                ${trade.exit.toFixed(2)}
              </p>
            </div>
            {trade.pnlDollar && (
              <div className="col-span-2 p-2 rounded-xl bg-white/5 border border-white/10 flex justify-between">
                <span className="text-[10px] text-white/50">P&L</span>
                <span
                  className={cn("text-sm font-semibold", trade.pnlPercent >= 0 ? "text-emerald-400" : "text-[#ec3b70]")}
                >
                  {trade.pnlPercent >= 0 ? "+" : ""}
                  {trade.pnlPercent.toFixed(1)}% (${trade.pnlDollar >= 0 ? "+" : ""}
                  {trade.pnlDollar.toFixed(0)})
                </span>
              </div>
            )}
          </div>
        )}

        {/* Indicators Section */}
        <button
          onClick={() => toggleSection("indicators")}
          className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-white/5 transition-colors border-t border-white/5 min-h-[44px]"
        >
          <span className="text-[10px] text-white/50 uppercase tracking-wider">Indicator Readings</span>
          {expandedSection === "indicators" ? (
            <ChevronUp className="w-4 h-4 text-white/30" />
          ) : (
            <ChevronDown className="w-4 h-4 text-white/30" />
          )}
        </button>
        {expandedSection === "indicators" && (
          <div className="px-3 pb-3 grid grid-cols-3 gap-2">
            <IndicatorCard
              label="ADX"
              value={trade.indicators.adx.toFixed(1)}
              trend={trade.indicators.adxTrend}
              highlight={trade.indicators.adx >= 25}
            />
            <IndicatorCard
              label="EWO"
              value={trade.indicators.ewo.toFixed(1)}
              highlight={Math.abs(trade.indicators.ewo) >= 5}
            />
            <IndicatorCard label="RSI" value={trade.indicators.rsi.toFixed(0)} />
            <IndicatorCard
              label="RVOL"
              value={`${trade.indicators.rvol.toFixed(1)}x`}
              highlight={trade.indicators.rvol >= 1.8}
            />
            <IndicatorCard label="MACD" value={trade.indicators.macdHistogram.toFixed(2)} />
            <IndicatorCard label="VWAP" value={trade.indicators.vwapPosition} />
          </div>
        )}

        {trade.pivotPoints && (
          <>
            <button
              onClick={() => toggleSection("pivots")}
              className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-white/5 transition-colors border-t border-white/5 min-h-[44px]"
            >
              <span className="text-[10px] text-white/50 uppercase tracking-wider">Pivot Points</span>
              {expandedSection === "pivots" ? (
                <ChevronUp className="w-4 h-4 text-white/30" />
              ) : (
                <ChevronDown className="w-4 h-4 text-white/30" />
              )}
            </button>
            {expandedSection === "pivots" && (
              <div className="px-3 pb-3">
                <div className="grid grid-cols-7 gap-1">
                  {trade.pivotPoints.r3 && <PivotCell label="R3" value={trade.pivotPoints.r3} type="resistance" />}
                  {trade.pivotPoints.r2 && <PivotCell label="R2" value={trade.pivotPoints.r2} type="resistance" />}
                  {trade.pivotPoints.r1 && <PivotCell label="R1" value={trade.pivotPoints.r1} type="resistance" />}
                  {trade.pivotPoints.p && <PivotCell label="P" value={trade.pivotPoints.p} type="pivot" />}
                  {trade.pivotPoints.s1 && <PivotCell label="S1" value={trade.pivotPoints.s1} type="support" />}
                  {trade.pivotPoints.s2 && <PivotCell label="S2" value={trade.pivotPoints.s2} type="support" />}
                  {trade.pivotPoints.s3 && <PivotCell label="S3" value={trade.pivotPoints.s3} type="support" />}
                </div>
              </div>
            )}
          </>
        )}

        {/* SuperTrend Section */}
        <button
          onClick={() => toggleSection("supertrend")}
          className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-white/5 transition-colors border-t border-white/5 min-h-[44px]"
        >
          <span className="text-[10px] text-white/50 uppercase tracking-wider">SuperTrend Timing</span>
          {expandedSection === "supertrend" ? (
            <ChevronUp className="w-4 h-4 text-white/30" />
          ) : (
            <ChevronDown className="w-4 h-4 text-white/30" />
          )}
        </button>
        {expandedSection === "supertrend" && (
          <div className="px-3 pb-3 space-y-2">
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/50">Signal</span>
                <span
                  className={cn(
                    "text-xs font-medium",
                    trade.superTrend.signal === "SELL" ? "text-[#ec3b70]" : "text-emerald-400",
                  )}
                >
                  {trade.superTrend.signal}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-white/50">Timeframe</span>
                <span className="text-xs text-white">{trade.superTrend.timeframe}</span>
              </div>
              {trade.superTrend.trendFlipTime && (
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-white/50">Flip Time</span>
                  <span className="text-xs text-white">{trade.superTrend.trendFlipTime}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notes Section */}
        {trade.notes && (
          <>
            <button
              onClick={() => toggleSection("notes")}
              className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-white/5 transition-colors border-t border-white/5 min-h-[44px]"
            >
              <span className="text-[10px] text-white/50 uppercase tracking-wider">Trade Notes</span>
              {expandedSection === "notes" ? (
                <ChevronUp className="w-4 h-4 text-white/30" />
              ) : (
                <ChevronDown className="w-4 h-4 text-white/30" />
              )}
            </button>
            {expandedSection === "notes" && (
              <div className="px-3 pb-3">
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-xs text-white/70">{trade.notes}</p>
                  {trade.tags && trade.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {trade.tags.map((tag) => (
                        <span key={tag} className="px-2 py-0.5 rounded-full bg-white/10 text-[9px] text-white/50">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Trade Analysis Section */}
        <button
          onClick={() => setShowAnalysis(!showAnalysis)}
          className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-white/5 transition-colors border-t border-white/5 min-h-[44px]"
        >
          <span className="text-[10px] text-white/50 uppercase tracking-wider">Trade Analysis</span>
          {showAnalysis ? (
            <ChevronUp className="w-4 h-4 text-white/30" />
          ) : (
            <ChevronDown className="w-4 h-4 text-white/30" />
          )}
        </button>
        {showAnalysis && (
          <div className="px-3 pb-3 space-y-2">
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
              <p className="text-[9px] text-white/40 uppercase tracking-wider">Overall Grade</p>
              <p className="text-lg font-bold text-white">{analysis.overallGrade}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
              <p className="text-[9px] text-white/40 uppercase tracking-wider">Key Lesson</p>
              <p className="text-sm font-semibold text-white">{analysis.keyLesson}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
              <p className="text-[9px] text-white/40 uppercase tracking-wider">What Went Right</p>
              <ul className="list-disc list-inside text-sm text-white">
                {analysis.whatWentRight.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
              <p className="text-[9px] text-white/40 uppercase tracking-wider">What Went Wrong</p>
              <ul className="list-disc list-inside text-sm text-white">
                {analysis.whatWentWrong.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
              <p className="text-[9px] text-white/40 uppercase tracking-wider">Improvements</p>
              <ul className="list-disc list-inside text-sm text-white">
                {analysis.improvements.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
              <p className="text-[9px] text-white/40 uppercase tracking-wider">Recovery Tips</p>
              <ul className="list-disc list-inside text-sm text-white">
                {analysis.recoveryTips.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
              <p className="text-[9px] text-white/40 uppercase tracking-wider">Pro Strategies</p>
              <ul className="list-disc list-inside text-sm text-white">
                {analysis.proStrategies.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function IndicatorCard({
  label,
  value,
  trend,
  highlight,
}: {
  label: string
  value: string
  trend?: "rising" | "falling" | "flat"
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        "p-2 rounded-xl text-center border",
        highlight ? "bg-emerald-500/10 border-emerald-500/30" : "bg-white/5 border-white/10",
      )}
    >
      <p className="text-[9px] text-white/40 uppercase tracking-wider">{label}</p>
      <p className={cn("text-sm font-semibold", highlight ? "text-emerald-400" : "text-white")}>{value}</p>
      {trend && (
        <p className="text-[8px] text-white/30">
          {trend === "rising" ? "↑ Rising" : trend === "falling" ? "↓ Falling" : "→ Flat"}
        </p>
      )}
    </div>
  )
}

function PivotCell({
  label,
  value,
  type,
}: {
  label: string
  value: number
  type: "resistance" | "support" | "pivot"
}) {
  return (
    <div
      className={cn(
        "p-1.5 rounded-lg text-center border",
        type === "resistance" && "bg-[#ec3b70]/10 border-[#ec3b70]/20",
        type === "support" && "bg-emerald-500/10 border-emerald-500/20",
        type === "pivot" && "bg-amber-500/10 border-amber-500/20",
      )}
    >
      <p
        className={cn(
          "text-[8px] font-medium",
          type === "resistance" && "text-[#ec3b70]",
          type === "support" && "text-emerald-400",
          type === "pivot" && "text-amber-400",
        )}
      >
        {label}
      </p>
      <p className="text-[9px] text-white/70">{value.toFixed(0)}</p>
    </div>
  )
}
