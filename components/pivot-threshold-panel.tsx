"use client"

import { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface PivotThresholdPanelProps {
  currentPrice: number
  pivot: number
  r1: number
  r2: number
  r3: number
  s1: number
  s2: number
  s3: number
  bollingerBands?: {
    upper: number
    middle: number
    lower: number
  }
  trend?: "up" | "down" | "neutral"
  className?: string
}

export function PivotThresholdPanel({
  currentPrice = 0,
  pivot = 0,
  r1 = 0,
  r2 = 0,
  r3 = 0,
  s1 = 0,
  s2 = 0,
  s3 = 0,
  bollingerBands,
  trend = "neutral",
}: PivotThresholdPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const timeRef = useRef(0)

  const safeCurrentPrice = currentPrice || 0
  const safePivot = pivot || 0
  const safeR1 = r1 || 0
  const safeR2 = r2 || 0
  const safeR3 = r3 || 0
  const safeS1 = s1 || 0
  const safeS2 = s2 || 0
  const safeS3 = s3 || 0

  // Determine entry zone signal
  const priceAbovePivot = safeCurrentPrice > safePivot
  const nearResistance = safeR1 > 0 && safeCurrentPrice >= safeR1 * 0.998
  const nearSupport = safeS1 > 0 && safeCurrentPrice <= safeS1 * 1.002

  const entryZone =
    nearResistance && trend === "down"
      ? "PUT"
      : nearSupport && trend === "up"
        ? "CALL"
        : priceAbovePivot
          ? "PUT"
          : "CALL"

  const entryDescription =
    entryZone === "PUT" ? "Price at resistance + bearish signal" : "Price at support + bullish signal"

  // Calculate distances with safe values
  const toS1 = safeCurrentPrice - safeS1
  const toR1 = safeR1 - safeCurrentPrice
  const toS1Percent = safeCurrentPrice > 0 ? (toS1 / safeCurrentPrice) * 100 : 0
  const toR1Percent = safeCurrentPrice > 0 ? (toR1 / safeCurrentPrice) * 100 : 0
  const fromPP = safePivot > 0 ? ((safeCurrentPrice - safePivot) / safePivot) * 100 : 0

  // BB Width calculation
  const bbWidth =
    bollingerBands && bollingerBands.middle > 0
      ? ((bollingerBands.upper - bollingerBands.lower) / bollingerBands.middle) * 100
      : 0

  // Safe entry zone check
  const isSafeEntryZone =
    (entryZone === "CALL" && safeS1 > 0 && safeCurrentPrice <= safeS1 * 1.005) ||
    (entryZone === "PUT" && safeR1 > 0 && safeCurrentPrice >= safeR1 * 0.995)

  const pivotLevels = [
    { label: "R3", value: safeR3, color: "#ec3b70" },
    { label: "R2", value: safeR2, color: "#ec3b70" },
    { label: "R1", value: safeR1, color: "#ec3b70" },
    { label: "PP", value: safePivot, color: "#ffffff" },
    { label: "S3", value: safeS3, color: "#10b981" },
    { label: "S2", value: safeS2, color: "#10b981" },
    { label: "S1", value: safeS1, color: "#10b981" },
  ]

  // Canvas drawing for the mini chart visualization
  useEffect(() => {
    if (!isExpanded) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const { width, height } = { width: rect.width, height: rect.height }
    const padding = { top: 10, bottom: 10, left: 10, right: 10 }
    const chartWidth = width - padding.left - padding.right
    const chartHeight = height - padding.top - padding.bottom

    const allPrices = [safeR3, safeR2, safeR1, safePivot, safeS1, safeS2, safeS3, safeCurrentPrice].filter((p) => p > 0)
    if (bollingerBands) {
      if (bollingerBands.upper > 0) allPrices.push(bollingerBands.upper)
      if (bollingerBands.lower > 0) allPrices.push(bollingerBands.lower)
    }

    // Fallback if no valid prices
    if (allPrices.length === 0) {
      allPrices.push(100)
    }

    const priceMin = Math.min(...allPrices) * 0.999
    const priceMax = Math.max(...allPrices) * 1.001
    const priceRange = priceMax - priceMin || 1

    const priceToY = (price: number) => {
      return padding.top + chartHeight - ((price - priceMin) / priceRange) * chartHeight
    }

    const animate = () => {
      timeRef.current += 0.02
      ctx.clearRect(0, 0, width, height)

      // Draw BB Cloud if available
      if (bollingerBands && bollingerBands.upper > 0 && bollingerBands.lower > 0) {
        const upperY = priceToY(bollingerBands.upper)
        const lowerY = priceToY(bollingerBands.lower)

        // Animated cloud
        ctx.beginPath()
        ctx.moveTo(padding.left, upperY)
        for (let x = padding.left; x <= width - padding.right; x += 2) {
          const progress = (x - padding.left) / chartWidth
          const wave = Math.sin(progress * Math.PI * 4 + timeRef.current) * 2
          ctx.lineTo(x, upperY + wave)
        }
        for (let x = width - padding.right; x >= padding.left; x -= 2) {
          const progress = (x - padding.left) / chartWidth
          const wave = Math.sin(progress * Math.PI * 4 + timeRef.current) * 2
          ctx.lineTo(x, lowerY + wave)
        }
        ctx.closePath()

        const cloudGradient = ctx.createLinearGradient(0, upperY, 0, lowerY)
        cloudGradient.addColorStop(0, "rgba(139, 92, 246, 0.2)")
        cloudGradient.addColorStop(0.5, "rgba(139, 92, 246, 0.1)")
        cloudGradient.addColorStop(1, "rgba(139, 92, 246, 0.2)")
        ctx.fillStyle = cloudGradient
        ctx.fill()

        // BB Upper line
        ctx.beginPath()
        ctx.setLineDash([3, 3])
        ctx.moveTo(padding.left, upperY)
        ctx.lineTo(width - padding.right, upperY)
        ctx.strokeStyle = "rgba(139, 92, 246, 0.5)"
        ctx.lineWidth = 1
        ctx.stroke()

        // BB Lower line
        ctx.beginPath()
        ctx.moveTo(padding.left, lowerY)
        ctx.lineTo(width - padding.right, lowerY)
        ctx.stroke()
        ctx.setLineDash([])

        // BB labels
        ctx.font = "8px system-ui"
        ctx.fillStyle = "rgba(139, 92, 246, 0.8)"
        ctx.textAlign = "right"
        ctx.fillText("BB↑", width - padding.right - 2, upperY - 2)
        ctx.fillText("BB↓", width - padding.right - 2, lowerY + 10)
      }

      // Draw pivot level lines
      const levelsToDraw = [
        { price: safeR1, color: "rgba(236, 59, 112, 0.3)", dash: [4, 4] },
        { price: safeS1, color: "rgba(16, 185, 129, 0.3)", dash: [4, 4] },
      ].filter((l) => l.price > 0)

      levelsToDraw.forEach(({ price, color, dash }) => {
        const y = priceToY(price)
        ctx.beginPath()
        ctx.setLineDash(dash)
        ctx.moveTo(padding.left, y)
        ctx.lineTo(width - padding.right, y)
        ctx.strokeStyle = color
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.setLineDash([])
      })

      // Draw current price indicator (glowing dot)
      if (safeCurrentPrice > 0) {
        const priceY = priceToY(safeCurrentPrice)
        const priceX = width / 2

        // Glow effect
        const glowSize = 8 + Math.sin(timeRef.current * 3) * 2
        const glowGradient = ctx.createRadialGradient(priceX, priceY, 0, priceX, priceY, glowSize)
        glowGradient.addColorStop(0, entryZone === "CALL" ? "rgba(16, 185, 129, 0.8)" : "rgba(236, 59, 112, 0.8)")
        glowGradient.addColorStop(0.5, entryZone === "CALL" ? "rgba(16, 185, 129, 0.3)" : "rgba(236, 59, 112, 0.3)")
        glowGradient.addColorStop(1, "transparent")
        ctx.beginPath()
        ctx.arc(priceX, priceY, glowSize, 0, Math.PI * 2)
        ctx.fillStyle = glowGradient
        ctx.fill()

        // Core dot
        ctx.beginPath()
        ctx.arc(priceX, priceY, 4, 0, Math.PI * 2)
        ctx.fillStyle = entryZone === "CALL" ? "#10b981" : "#ec3b70"
        ctx.fill()
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [
    isExpanded,
    safeCurrentPrice,
    safeR1,
    safeR2,
    safeR3,
    safeS1,
    safeS2,
    safeS3,
    safePivot,
    bollingerBands,
    entryZone,
  ])

  if (!isExpanded) {
    return (
      <div className="absolute left-0 top-0 bottom-0 z-20 flex items-center" style={{ width: "65px" }}>
        <button
          onClick={() => setIsExpanded(true)}
          className="h-full w-full flex items-center justify-center bg-black/60 backdrop-blur-sm border-r border-white/10 hover:bg-black/70 transition-colors rounded-l-3xl"
        >
          <div className="flex flex-col items-center gap-1.5">
            <ChevronRight className="w-3 h-3 text-white/50" />
            <div className={cn("w-2.5 h-2.5 rounded-full", entryZone === "PUT" ? "bg-[#ec3b70]" : "bg-emerald-400")} />
            <span
              className="text-[9px] font-semibold tracking-tight"
              style={{
                writingMode: "vertical-rl",
                color: entryZone === "PUT" ? "#ec3b70" : "#10b981",
              }}
            >
              {entryZone}
            </span>
            <span
              className="text-[7px] text-white/40 tracking-tight"
              style={{
                writingMode: "vertical-rl",
              }}
            >
              Entry
            </span>
          </div>
        </button>
      </div>
    )
  }

  return (
    <div className="absolute left-0 top-0 bottom-0 z-20 flex" style={{ width: "260px" }}>
      {/* Main panel */}
      <div className="flex-1 bg-black/80 backdrop-blur-md border-r border-white/10 p-3 overflow-hidden rounded-l-3xl">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="text-[9px] uppercase tracking-[0.15em] text-white/40 mb-1">Combined Analysis</p>
            <div
              className={cn(
                "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium",
                entryZone === "PUT"
                  ? "bg-[#ec3b70]/20 text-[#ec3b70] border border-[#ec3b70]/30"
                  : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
              )}
            >
              <div
                className={cn("w-1.5 h-1.5 rounded-full", entryZone === "PUT" ? "bg-[#ec3b70]" : "bg-emerald-400")}
              />
              {entryZone} Entry Zone
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-white tabular-nums">${safeCurrentPrice.toFixed(2)}</p>
            <p
              className={cn(
                "text-[10px]",
                trend === "down" ? "text-[#ec3b70]" : trend === "up" ? "text-emerald-400" : "text-white/50",
              )}
            >
              {trend === "down" ? "Downtrend" : trend === "up" ? "Uptrend" : "Neutral"}
            </p>
          </div>
        </div>

        <p className="text-[9px] text-white/40 mb-2">{entryDescription}</p>

        {/* Chart visualization and levels */}
        <div className="flex gap-2 mb-2">
          {/* Pivot levels list */}
          <div className="flex flex-col justify-between text-[9px] w-[60px]">
            {pivotLevels.map((level) => (
              <div key={level.label} className="flex items-center gap-1">
                <span className="text-white/40 tabular-nums">${(level.value || 0).toFixed(0)}</span>
                <span className="font-medium" style={{ color: level.color }}>
                  {level.label}
                </span>
              </div>
            ))}
          </div>

          {/* Mini chart canvas */}
          <div className="flex-1 relative h-[90px] rounded-lg overflow-hidden border border-white/5">
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full"
              style={{ background: "rgba(0, 0, 0, 0.3)" }}
            />
          </div>

          {/* Legend and action */}
          <div className="flex flex-col justify-between text-[8px] w-[60px]">
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-[#ec3b70]" />
                <span className="text-white/50">Resistance</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                <span className="text-white/50">BB Cloud</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-white/50">Support</span>
              </div>
            </div>

            <div
              className={cn(
                "px-2 py-1.5 rounded-lg text-center border",
                entryZone === "CALL"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-[#ec3b70]/10 border-[#ec3b70]/30 text-[#ec3b70]",
              )}
            >
              <p className="text-[10px] font-semibold">{entryZone === "CALL" ? "CALL" : "PUT"}</p>
              <p className="text-[7px] text-white/40">{entryZone === "CALL" ? "Go Long" : "Go Short"}</p>
            </div>

            <div className="text-[8px] space-y-0.5">
              <p className="text-white/40">
                To S1: <span className="text-emerald-400">-${Math.abs(toS1).toFixed(2)}</span>
              </p>
              <p className="text-white/40">
                To R1: <span className="text-[#ec3b70]">+{toR1Percent.toFixed(2)}%</span>
              </p>
            </div>
          </div>
        </div>

        {/* Footer stats */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <div className="flex items-center gap-3 text-[9px]">
            <span className="text-white/40">
              BB Width: <span className="text-white/70">{bbWidth.toFixed(1)}%</span>
            </span>
            <span className="text-white/40">
              From PP:{" "}
              <span className={fromPP >= 0 ? "text-emerald-400" : "text-[#ec3b70]"}>
                {fromPP >= 0 ? "+" : ""}
                {fromPP.toFixed(2)}%
              </span>
            </span>
          </div>
          <div
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px]",
              isSafeEntryZone ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-white/5 border border-white/10",
            )}
          >
            <div className={cn("w-1.5 h-1.5 rounded-full", isSafeEntryZone ? "bg-emerald-400" : "bg-white/30")} />
            <span className={isSafeEntryZone ? "text-emerald-400" : "text-white/40"}>
              Safe Entry {isSafeEntryZone ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
      </div>

      <button
        onClick={() => setIsExpanded(false)}
        className="w-5 h-full flex items-center justify-center bg-black/40 backdrop-blur-sm border-r border-white/10 hover:bg-black/50 transition-colors"
      >
        <ChevronLeft className="w-3 h-3 text-white/50" />
      </button>
    </div>
  )
}
