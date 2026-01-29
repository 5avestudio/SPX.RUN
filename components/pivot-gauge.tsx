"use client"

import { cn } from "@/lib/utils"
import { useEffect, useState, useRef } from "react"

interface CandleData {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
}

interface PivotGaugeProps {
  currentPrice: number
  pivot: number
  r1: number
  r2: number
  r3: number
  s1: number
  s2: number
  s3: number
  className?: string
  combined?: boolean
  compact?: boolean
  bollingerBands?: {
    upper: number
    middle: number
    lower: number
  }
  candleData?: CandleData[]
  signal?: string
  trend?: "up" | "down" | "neutral"
}

export function PivotGauge({
  currentPrice,
  pivot,
  r1,
  r2,
  r3,
  s1,
  s2,
  s3,
  className,
  combined = false,
  compact = false,
  bollingerBands,
  candleData,
  signal,
  trend,
}: PivotGaugeProps) {
  const [animated, setAnimated] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 100)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animationId: number
    let time = 0

    const resize = () => {
      canvas.width = canvas.offsetWidth * 2
      canvas.height = canvas.offsetHeight * 2
      ctx.scale(2, 2)
    }
    resize()
    window.addEventListener("resize", resize)

    const draw = () => {
      const width = canvas.offsetWidth
      const height = canvas.offsetHeight

      ctx.clearRect(0, 0, width, height)

      // Soft aurora gradients
      const gradient1 = ctx.createRadialGradient(
        width * 0.2 + Math.sin(time * 0.5) * 30,
        height * 0.7 + Math.cos(time * 0.3) * 20,
        0,
        width * 0.2,
        height * 0.7,
        height * 0.6,
      )
      gradient1.addColorStop(0, "rgba(52, 211, 153, 0.12)")
      gradient1.addColorStop(0.5, "rgba(52, 211, 153, 0.04)")
      gradient1.addColorStop(1, "transparent")

      const gradient2 = ctx.createRadialGradient(
        width * 0.8 + Math.cos(time * 0.4) * 30,
        height * 0.3 + Math.sin(time * 0.6) * 20,
        0,
        width * 0.8,
        height * 0.3,
        height * 0.5,
      )
      gradient2.addColorStop(0, "rgba(236, 59, 112, 0.10)")
      gradient2.addColorStop(0.5, "rgba(236, 59, 112, 0.03)")
      gradient2.addColorStop(1, "transparent")

      ctx.fillStyle = gradient1
      ctx.fillRect(0, 0, width, height)
      ctx.fillStyle = gradient2
      ctx.fillRect(0, 0, width, height)

      if (combined && bollingerBands) {
        const allValues = [
          s3,
          s2,
          s1,
          pivot,
          r1,
          r2,
          r3,
          currentPrice,
          bollingerBands.upper,
          bollingerBands.lower,
        ].filter(Boolean)
        const min = Math.min(...allValues)
        const max = Math.max(...allValues)
        const range = max - min || 1
        const chartTop = 60
        const chartBottom = height - 40
        const chartHeight = chartBottom - chartTop

        const priceToY = (price: number) => chartBottom - ((price - min) / range) * chartHeight

        const upperY = priceToY(bollingerBands.upper)
        const lowerY = priceToY(bollingerBands.lower)
        const middleY = priceToY(bollingerBands.middle)

        ctx.beginPath()
        ctx.moveTo(0, upperY)
        for (let x = 0; x <= width; x += 3) {
          const wave = Math.sin(x * 0.02 + time) * 4
          ctx.lineTo(x, upperY + wave)
        }
        for (let x = width; x >= 0; x -= 3) {
          const wave = Math.sin(x * 0.02 + time) * 4
          ctx.lineTo(x, lowerY + wave)
        }
        ctx.closePath()

        const bandGradient = ctx.createLinearGradient(0, upperY, 0, lowerY)
        bandGradient.addColorStop(0, "rgba(139, 92, 246, 0.15)")
        bandGradient.addColorStop(0.5, "rgba(139, 92, 246, 0.08)")
        bandGradient.addColorStop(1, "rgba(139, 92, 246, 0.15)")
        ctx.fillStyle = bandGradient
        ctx.fill()

        ctx.beginPath()
        ctx.moveTo(0, middleY)
        ctx.lineTo(width, middleY)
        ctx.strokeStyle = "rgba(139, 92, 246, 0.4)"
        ctx.lineWidth = 1
        ctx.setLineDash([4, 4])
        ctx.stroke()
        ctx.setLineDash([])

        if (candleData && candleData.length > 0) {
          const candles = candleData.slice(-20)
          const candleWidth = (width * 0.6) / candles.length
          const startX = width * 0.2

          candles.forEach((candle, i) => {
            const x = startX + i * candleWidth + candleWidth / 2
            const isGreen = candle.close >= candle.open

            const bodyTop = priceToY(Math.max(candle.open, candle.close))
            const bodyBottom = priceToY(Math.min(candle.open, candle.close))
            const bodyHeight = Math.max(bodyBottom - bodyTop, 1)

            const wickTop = priceToY(candle.high)
            const wickBottom = priceToY(candle.low)

            ctx.beginPath()
            ctx.moveTo(x, wickTop)
            ctx.lineTo(x, wickBottom)
            ctx.strokeStyle = isGreen ? "rgba(16, 185, 129, 0.5)" : "rgba(236, 59, 112, 0.5)"
            ctx.lineWidth = 1
            ctx.stroke()

            ctx.fillStyle = isGreen ? "rgba(16, 185, 129, 0.7)" : "rgba(236, 59, 112, 0.7)"
            ctx.fillRect(x - candleWidth * 0.3, bodyTop, candleWidth * 0.6, bodyHeight)
          })
        }
      }

      time += 0.015
      animationId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener("resize", resize)
    }
  }, [combined, bollingerBands, candleData, s3, s2, s1, pivot, r1, r2, r3, currentPrice])

  const supportLevels = [
    { label: "S3", value: s3 },
    { label: "S2", value: s2 },
    { label: "S1", value: s1 },
  ].filter((l) => l.value && !isNaN(l.value))

  const resistanceLevels = [
    { label: "R1", value: r1 },
    { label: "R2", value: r2 },
    { label: "R3", value: r3 },
  ].filter((l) => l.value && !isNaN(l.value))

  const allLevelsOrdered = [
    { label: "S3", value: s3 },
    { label: "S2", value: s2 },
    { label: "S1", value: s1 },
    { label: "PP", value: pivot },
    { label: "R1", value: r1 },
    { label: "R2", value: r2 },
    { label: "R3", value: r3 },
  ].filter((l) => l.value && !isNaN(l.value))

  const minPrice = s3 || Math.min(...allLevelsOrdered.map((l) => l.value))
  const maxPrice = r3 || Math.max(...allLevelsOrdered.map((l) => l.value))
  const priceRange = maxPrice - minPrice || 1

  const getHorizontalPosition = (value: number) => {
    const clamped = Math.max(minPrice, Math.min(maxPrice, value))
    return ((clamped - minPrice) / priceRange) * 100
  }

  const priceHorizontalPosition = getHorizontalPosition(currentPrice)

  const signalType = currentPrice > pivot ? "bullish" : currentPrice < pivot ? "bearish" : "neutral"

  const pivotPosition = getHorizontalPosition(pivot)
  const priceZone =
    priceHorizontalPosition < pivotPosition - 10
      ? "support"
      : priceHorizontalPosition > pivotPosition + 10
        ? "resistance"
        : "neutral"

  const allLevels = [...supportLevels, { label: "PP", value: pivot }, ...resistanceLevels]
  const nearestLevel = allLevels.reduce(
    (nearest, level) => {
      const distance = Math.abs(currentPrice - level.value)
      if (!nearest || distance < Math.abs(currentPrice - nearest.value)) {
        return level
      }
      return nearest
    },
    null as { label: string; value: number } | null,
  )

  const isNearThreshold = nearestLevel && Math.abs(currentPrice - nearestLevel.value) < priceRange * 0.05

  const nextSupport = supportLevels.filter((l) => l.value < currentPrice).sort((a, b) => b.value - a.value)[0]
  const nextResistance = resistanceLevels.filter((l) => l.value > currentPrice).sort((a, b) => a.value - b.value)[0]
  const distanceToSupport = nextSupport ? currentPrice - nextSupport.value : null
  const distanceToResistance = nextResistance ? nextResistance.value - currentPrice : null

  return (
    <div
      className={cn(
        "relative border border-white/10 overflow-hidden flex flex-col",
        compact ? "p-3" : "p-5",
        className,
      )}
    >
      {/* Aurora background */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.8 }} />

      {/* Glass overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Content */}
      <div className="relative z-10 flex flex-col flex-1">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-xs uppercase tracking-[0.2em] text-white/40">
              {combined ? "Combined View" : "Price Position"}
            </span>
            {combined && <p className="text-[10px] text-white/30 mt-0.5">Pivots + Bollinger + Candles</p>}
          </div>
          <span
            className={cn(
              "text-xs px-2 py-1 rounded-full backdrop-blur-sm",
              signalType === "bullish"
                ? "bg-emerald-500/20 text-emerald-400"
                : signalType === "bearish"
                  ? "bg-[#ec3b70]/20 text-[#ec3b70]"
                  : "bg-white/10 text-white/60",
            )}
          >
            {signalType === "bullish" ? "Above Pivot" : signalType === "bearish" ? "Below Pivot" : "At Pivot"}
          </span>
        </div>

        {/* Aurora gradient zone background - full width flowing effect */}
        <div className={cn("relative", compact ? "py-6" : "py-10")}>
          {/* Aurora gradient mesh background */}
          <div className="absolute inset-0">
            {/* Base gradient - green left, red right */}
            <div
              className="absolute inset-0 rounded-2xl"
              style={{
                background: `linear-gradient(90deg, 
                  rgba(16, 185, 129, 0.25) 0%, 
                  rgba(16, 185, 129, 0.15) 15%,
                  rgba(16, 185, 129, 0.05) 30%,
                  transparent 50%, 
                  rgba(236, 59, 112, 0.05) 70%,
                  rgba(236, 59, 112, 0.15) 85%,
                  rgba(236, 59, 112, 0.25) 100%
                )`,
              }}
            />
            {/* Radial glow on support side */}
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 w-1/3 h-full"
              style={{
                background: `radial-gradient(ellipse at left center, 
                  rgba(52, 211, 153, 0.2) 0%, 
                  transparent 70%
                )`,
              }}
            />
            {/* Radial glow on resistance side */}
            <div
              className="absolute right-0 top-1/2 -translate-y-1/2 w-1/3 h-full"
              style={{
                background: `radial-gradient(ellipse at right center, 
                  rgba(236, 59, 112, 0.2) 0%, 
                  transparent 70%
                )`,
              }}
            />
          </div>

          {/* Distance indicators - floating text only */}
          <div className="absolute top-2 left-3 z-10">
            <p className="text-[10px] uppercase tracking-wider text-emerald-400/70 mb-0.5">
              To {nextSupport?.label || "S1"}
            </p>
            <p
              className="text-lg font-light text-emerald-400"
              style={{ textShadow: "0 0 20px rgba(16, 185, 129, 0.5)" }}
            >
              {distanceToSupport !== null ? `-$${distanceToSupport.toFixed(2)}` : "—"}
            </p>
          </div>

          <div className="absolute top-2 right-3 z-10 text-right">
            <p className="text-[10px] uppercase tracking-wider text-[#ec3b70]/70 mb-0.5">
              To {nextResistance?.label || "R1"}
            </p>
            <p className="text-lg font-light text-[#ec3b70]" style={{ textShadow: "0 0 20px rgba(236, 59, 112, 0.5)" }}>
              {distanceToResistance !== null ? `+$${distanceToResistance.toFixed(2)}` : "—"}
            </p>
          </div>

          {/* Current price - center floating */}
          <div className="absolute left-1/2 top-2 -translate-x-1/2 z-20">
            <div
              className="bg-black/60 backdrop-blur-md rounded-lg px-3 py-1 border border-white/20"
              style={{
                boxShadow:
                  priceZone === "support"
                    ? "0 0 20px rgba(52, 211, 153, 0.3)"
                    : priceZone === "resistance"
                      ? "0 0 20px rgba(236, 59, 112, 0.3)"
                      : "0 0 20px rgba(255, 255, 255, 0.2)",
              }}
            >
              <span className="text-sm text-white font-medium">${currentPrice.toFixed(2)}</span>
            </div>
          </div>

          {/* Track with level markers */}
          <div className={cn("relative mx-2", compact ? "mt-8" : "mt-12")}>
            {/* Track background */}
            <div className="relative h-2 rounded-full bg-white/5 overflow-hidden">
              <div
                className="absolute inset-0 opacity-50"
                style={{
                  background:
                    "linear-gradient(to right, rgba(52, 211, 153, 0.7), rgba(52, 211, 153, 0.3) 35%, rgba(255,255,255,0.2) 50%, rgba(236, 59, 112, 0.3) 65%, rgba(236, 59, 112, 0.7))",
                }}
              />
            </div>

            {/* Level markers - only vertical lines */}
            {allLevelsOrdered.map((level) => {
              const position = getHorizontalPosition(level.value)
              const isSupport = level.label.startsWith("S")
              const isResistance = level.label.startsWith("R")
              const isPivot = level.label === "PP"

              return (
                <div
                  key={level.label}
                  className="absolute"
                  style={{
                    left: `${position}%`,
                    transform: "translateX(-50%)",
                    top: "-4px",
                  }}
                >
                  <div
                    className={cn("w-[2px] rounded-full transition-all duration-300", compact ? "h-5" : "h-7")}
                    style={{
                      backgroundColor: isPivot
                        ? "rgba(255, 255, 255, 0.95)"
                        : isSupport
                          ? "rgba(52, 211, 153, 0.9)"
                          : "rgba(236, 59, 112, 0.9)",
                      boxShadow: isPivot
                        ? "0 0 12px rgba(255, 255, 255, 0.9), 0 0 24px rgba(255, 255, 255, 0.5)"
                        : isSupport
                          ? "0 0 10px rgba(52, 211, 153, 0.8), 0 0 20px rgba(52, 211, 153, 0.4)"
                          : "0 0 10px rgba(236, 59, 112, 0.8), 0 0 20px rgba(236, 59, 112, 0.4)",
                      height: isPivot ? (compact ? "24px" : "36px") : undefined,
                    }}
                  />
                </div>
              )
            })}

            {/* Labels row - evenly spaced below track */}
            <div className={cn("grid grid-cols-7 gap-0", compact ? "mt-2" : "mt-4")}>
              {allLevelsOrdered.map((level) => {
                const isSupport = level.label.startsWith("S")
                const isPivot = level.label === "PP"

                return (
                  <div key={level.label} className="flex flex-col items-center">
                    <span
                      className={cn(
                        "font-bold uppercase tracking-wide",
                        compact ? "text-[10px]" : "text-[12px]"
                      )}
                      style={{
                        color: isPivot
                          ? "rgba(255, 255, 255, 1)"
                          : isSupport
                            ? "rgba(52, 211, 153, 1)"
                            : "rgba(236, 59, 112, 1)",
                        textShadow: isPivot
                          ? "0 0 12px rgba(255, 255, 255, 0.9)"
                          : isSupport
                            ? "0 0 12px rgba(52, 211, 153, 0.8)"
                            : "0 0 12px rgba(236, 59, 112, 0.8)",
                      }}
                    >
                      {level.label}
                    </span>
                    <span className={cn(
                      "font-semibold text-white",
                      compact ? "text-[10px]" : "text-[13px] mt-0.5"
                    )}>
                      ${level.value.toFixed(0)}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Price indicator ball */}
            <div
              className="absolute transition-all duration-1000 ease-out"
              style={{
                left: `${animated ? priceHorizontalPosition : 50}%`,
                transform: "translateX(-50%)",
                top: "-6px",
              }}
            >
              {/* Outer glow */}
              <div
                className="absolute w-10 h-10 -left-3 -top-3 rounded-full blur-xl animate-pulse"
                style={{
                  backgroundColor:
                    priceZone === "support"
                      ? "rgba(52, 211, 153, 0.5)"
                      : priceZone === "resistance"
                        ? "rgba(236, 59, 112, 0.5)"
                        : "rgba(255, 255, 255, 0.4)",
                }}
              />
              {/* Medium glow */}
              <div
                className="absolute w-6 h-6 -left-1 -top-1 rounded-full blur-md"
                style={{
                  backgroundColor:
                    priceZone === "support"
                      ? "rgba(52, 211, 153, 0.6)"
                      : priceZone === "resistance"
                        ? "rgba(236, 59, 112, 0.6)"
                        : "rgba(255, 255, 255, 0.5)",
                }}
              />
              {/* Core ball */}
              <div
                className="relative w-4 h-4 rounded-full"
                style={{
                  backgroundColor:
                    priceZone === "support" ? "#34d399" : priceZone === "resistance" ? "#ec3b70" : "#ffffff",
                  boxShadow:
                    priceZone === "support"
                      ? "0 0 16px rgba(52, 211, 153, 1), 0 0 32px rgba(52, 211, 153, 0.7)"
                      : priceZone === "resistance"
                        ? "0 0 16px rgba(236, 59, 112, 1), 0 0 32px rgba(236, 59, 112, 0.7)"
                        : "0 0 16px rgba(255, 255, 255, 1), 0 0 32px rgba(255, 255, 255, 0.6)",
                }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={cn("border-t border-white/5", compact ? "mt-2 pt-2" : "mt-4 pt-4")}>
          {combined && bollingerBands && !compact && (
            <div className="flex items-center justify-between text-[10px] mb-3 pb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-violet-400/60" />
                <span className="text-violet-400/80">Bollinger Bands</span>
              </div>
              <div className="flex items-center gap-4 text-white/40">
                <span>Upper: ${bollingerBands.upper.toFixed(2)}</span>
                <span>Lower: ${bollingerBands.lower.toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-[10px]">
            <span className="text-white/30 uppercase tracking-wider">Ideal Entry Zone</span>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400/60" />
                <span className="text-emerald-400/60">Call: Near S1-S2</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#ec3b70]/60" />
                <span className="text-[#ec3b70]/60">Put: Near R1-R2</span>
              </div>
            </div>
          </div>

          {!compact && isNearThreshold && nearestLevel && (
            <div
              className={cn(
                "mt-3 p-3 rounded-xl border backdrop-blur-sm text-center",
                nearestLevel.label.startsWith("S")
                  ? "bg-emerald-500/10 border-emerald-500/20"
                  : nearestLevel.label.startsWith("R")
                    ? "bg-[#ec3b70]/10 border-[#ec3b70]/20"
                    : "bg-white/5 border-white/10",
              )}
            >
              <p
                className={cn(
                  "text-xs font-medium",
                  nearestLevel.label.startsWith("S")
                    ? "text-emerald-400"
                    : nearestLevel.label.startsWith("R")
                      ? "text-[#ec3b70]"
                      : "text-white/70",
                )}
              >
                Price approaching {nearestLevel.label} (${nearestLevel.value.toFixed(2)})
              </p>
              <p className="text-[10px] text-white/40 mt-1">
                {nearestLevel.label.startsWith("S")
                  ? "Potential support bounce — watch for CALL entry"
                  : nearestLevel.label.startsWith("R")
                    ? "Potential resistance rejection — watch for PUT entry"
                    : "At pivot point — wait for direction confirmation"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
