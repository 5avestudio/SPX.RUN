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

interface VerticalCombinedChartProps {
  currentPrice: number
  pivot: number
  r1: number
  r2: number
  r3: number
  s1: number
  s2: number
  s3: number
  bollingerBands: {
    upper: number
    middle: number
    lower: number
  }
  candleData: CandleData[]
  signal: string
  trend: "up" | "down" | "neutral"
  className?: string
}

export function VerticalCombinedChart({
  currentPrice,
  pivot,
  r1,
  r2,
  r3,
  s1,
  s2,
  s3,
  bollingerBands,
  candleData,
  signal,
  trend,
  className,
}: VerticalCombinedChartProps) {
  const [animated, setAnimated] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 100)
    return () => clearTimeout(timer)
  }, [])

  // All price levels for range calculation
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
    ...candleData.slice(-20).flatMap((c) => [c.high, c.low]),
  ].filter((v) => v && !isNaN(v) && isFinite(v)) // Filter out invalid values

  const min = allValues.length > 0 ? Math.min(...allValues) * 0.999 : currentPrice * 0.99
  const max = allValues.length > 0 ? Math.max(...allValues) * 1.001 : currentPrice * 1.01
  const range = max - min || 1

  const getPosition = (value: number) => {
    if (!value || isNaN(value) || !isFinite(value)) return 50 // Return middle if invalid
    return ((value - min) / range) * 100
  }

  // Calculate zones
  const pricePosition = getPosition(currentPrice)
  const pivotPosition = getPosition(pivot)
  const bbUpperPosition = getPosition(bollingerBands.upper)
  const bbLowerPosition = getPosition(bollingerBands.lower)
  const bbMiddlePosition = getPosition(bollingerBands.middle)

  // Calculate if price is approaching each level (within $3 range for highlighting)
  const proximityThreshold = 3
  const isApproaching = (levelValue: number) => {
    if (!levelValue || isNaN(levelValue)) return false
    return Math.abs(currentPrice - levelValue) <= proximityThreshold
  }

  // Define support/resistance levels with proximity detection
  const supportLevels = [
    { label: "S3", value: s3, color: "emerald", approaching: isApproaching(s3) },
    { label: "S2", value: s2, color: "emerald", approaching: isApproaching(s2) },
    { label: "S1", value: s1, color: "emerald", approaching: isApproaching(s1) },
  ].filter((l) => l.value && !isNaN(l.value))

  const resistanceLevels = [
    { label: "R1", value: r1, color: "rose", approaching: isApproaching(r1) },
    { label: "R2", value: r2, color: "rose", approaching: isApproaching(r2) },
    { label: "R3", value: r3, color: "rose", approaching: isApproaching(r3) },
  ].filter((l) => l.value && !isNaN(l.value))

  const pivotApproaching = isApproaching(pivot)

  // Determine safe entry zone
  const isNearSupport = supportLevels.some((l) => Math.abs(currentPrice - l.value) < range * 0.03)
  const isNearResistance = resistanceLevels.some((l) => Math.abs(currentPrice - l.value) < range * 0.03)
  const isInBollingerLow = currentPrice <= bollingerBands.lower * 1.01
  const isInBollingerHigh = currentPrice >= bollingerBands.upper * 0.99

  const safeEntryCall = isNearSupport || isInBollingerLow
  const safeEntryPut = isNearResistance || isInBollingerHigh

  // Analysis text
  const getAnalysis = () => {
    if (safeEntryCall && signal === "BUY") {
      return { text: "CALL Entry Zone", subtext: "Price at support + bullish signal", type: "buy" }
    }
    if (safeEntryPut && signal === "SELL") {
      return { text: "PUT Entry Zone", subtext: "Price at resistance + bearish signal", type: "sell" }
    }
    if (signal === "BUY") {
      return { text: "Wait for Support", subtext: "Bullish trend - enter near S1/S2", type: "wait-buy" }
    }
    if (signal === "SELL") {
      return { text: "Wait for Resistance", subtext: "Bearish trend - enter near R1/R2", type: "wait-sell" }
    }
    return { text: "Hold Position", subtext: "No clear entry - wait for signal", type: "hold" }
  }

  const analysis = getAnalysis()

  // Aurora canvas animation
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

      if (!isFinite(width) || !isFinite(height) || width <= 0 || height <= 0) {
        animationId = requestAnimationFrame(draw)
        return
      }

      ctx.clearRect(0, 0, width, height)

      // Support zone aurora (green, bottom)
      const supportGradient = ctx.createLinearGradient(0, height * 0.7, 0, height)
      supportGradient.addColorStop(0, "transparent")
      supportGradient.addColorStop(0.5, `rgba(52, 211, 153, ${0.05 + Math.sin(time) * 0.02})`)
      supportGradient.addColorStop(1, `rgba(52, 211, 153, ${0.12 + Math.sin(time * 1.2) * 0.04})`)
      ctx.fillStyle = supportGradient
      ctx.fillRect(0, 0, width, height)

      // Resistance zone aurora (red, top)
      const resistanceGradient = ctx.createLinearGradient(0, 0, 0, height * 0.3)
      resistanceGradient.addColorStop(0, `rgba(236, 59, 112, ${0.12 + Math.cos(time * 0.8) * 0.04})`)
      resistanceGradient.addColorStop(0.5, `rgba(236, 59, 112, ${0.05 + Math.cos(time) * 0.02})`)
      resistanceGradient.addColorStop(1, "transparent")
      ctx.fillStyle = resistanceGradient
      ctx.fillRect(0, 0, width, height)

      // Bollinger cloud (purple, middle)
      const bbTop = (1 - (bollingerBands.upper - min) / range) * height
      const bbBottom = (1 - (bollingerBands.lower - min) / range) * height

      if (isFinite(bbTop) && isFinite(bbBottom) && bbTop >= 0 && bbBottom >= 0 && bbTop !== bbBottom) {
        const bbGradient = ctx.createLinearGradient(0, bbTop, 0, bbBottom)
        bbGradient.addColorStop(0, `rgba(139, 92, 246, ${0.08 + Math.sin(time * 0.6) * 0.03})`)
        bbGradient.addColorStop(0.5, `rgba(139, 92, 246, ${0.15 + Math.sin(time * 0.9) * 0.05})`)
        bbGradient.addColorStop(1, `rgba(139, 92, 246, ${0.08 + Math.cos(time * 0.7) * 0.03})`)

        // Wavy edges for cloud
        ctx.beginPath()
        ctx.moveTo(0, bbTop)
        for (let x = 0; x <= width; x += 4) {
          const wave = Math.sin(x * 0.015 + time) * 6
          ctx.lineTo(x, bbTop + wave)
        }
        for (let x = width; x >= 0; x -= 4) {
          const wave = Math.sin(x * 0.015 + time) * 6
          ctx.lineTo(x, bbBottom + wave)
        }
        ctx.closePath()
        ctx.fillStyle = bbGradient
        ctx.fill()
      }

      // Safe entry glow
      if (safeEntryCall || safeEntryPut) {
        const priceY = (1 - (currentPrice - min) / range) * height
        if (isFinite(priceY) && priceY >= 0) {
          const glowGradient = ctx.createRadialGradient(width / 2, priceY, 0, width / 2, priceY, 80)
          glowGradient.addColorStop(0, `rgba(255, 255, 255, ${0.2 + Math.sin(time * 2) * 0.1})`)
          glowGradient.addColorStop(0.5, `rgba(255, 255, 255, ${0.05 + Math.sin(time * 2) * 0.03})`)
          glowGradient.addColorStop(1, "transparent")
          ctx.fillStyle = glowGradient
          ctx.fillRect(0, 0, width, height)
        }
      }

      time += 0.02
      animationId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener("resize", resize)
    }
  }, [bollingerBands, min, range, safeEntryCall, safeEntryPut, currentPrice])

  // Recent candles for mini visualization
  const recentCandles = candleData.slice(-12)

  return (
    <div className={cn("relative rounded-2xl border border-white/10 overflow-hidden flex flex-col", className)}>
      {/* Aurora background */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* Glass overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Content */}
      <div className="relative z-10 flex flex-col flex-1 p-5">
        {/* Header with analysis */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/70 mb-1">Combined Analysis</p>
            <div
              className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border backdrop-blur-sm",
                analysis.type === "buy"
                  ? "bg-emerald-500/20 border-emerald-500/30"
                  : analysis.type === "sell"
                    ? "bg-[#ec3b70]/20 border-[#ec3b70]/30"
                    : analysis.type === "wait-buy"
                      ? "bg-emerald-500/10 border-emerald-500/20"
                      : analysis.type === "wait-sell"
                        ? "bg-[#ec3b70]/10 border-[#ec3b70]/20"
                        : "bg-white/10 border-white/20",
              )}
            >
              <div
                className={cn(
                  "w-2 h-2 rounded-full animate-pulse",
                  analysis.type === "buy" || analysis.type === "wait-buy"
                    ? "bg-emerald-400"
                    : analysis.type === "sell" || analysis.type === "wait-sell"
                      ? "bg-[#ec3b70]"
                      : "bg-white/60",
                )}
              />
              <span
                className={cn(
                  "text-sm font-medium",
                  analysis.type === "buy" || analysis.type === "wait-buy"
                    ? "text-emerald-400"
                    : analysis.type === "sell" || analysis.type === "wait-sell"
                      ? "text-[#ec3b70]"
                      : "text-white/70",
                )}
              >
                {analysis.text}
              </span>
            </div>
            <p className="text-[11px] text-white/80 mt-1.5">{analysis.subtext}</p>
          </div>

          <div className="text-right">
            <p className="text-lg font-light text-white">${currentPrice.toFixed(2)}</p>
            <p
              className={cn(
                "text-[10px]",
                trend === "up" ? "text-emerald-400" : trend === "down" ? "text-[#ec3b70]" : "text-white/40",
              )}
            >
              {trend === "up" ? "Uptrend" : trend === "down" ? "Downtrend" : "Ranging"}
            </p>
          </div>
        </div>

        {/* Main chart area */}
        <div className="flex flex-1 gap-3 min-h-0">
          {/* Left labels - Resistance (with proximity highlighting) */}
          <div className="flex flex-col justify-between py-2 w-24">
            {resistanceLevels
              .slice()
              .reverse()
              .map((level) => (
                <div key={level.label} className="flex items-center gap-2">
                  <span 
                    className={cn(
                      "text-[12px] w-12 text-right font-mono transition-colors duration-300",
                      level.approaching ? "text-white font-medium" : "text-white/40"
                    )}
                  >
                    ${level.value.toFixed(0)}
                  </span>
                  <span className="text-[13px] font-semibold text-[#ec3b70] w-6">{level.label}</span>
                </div>
              ))}
            <div className="flex items-center gap-2">
              <span 
                className={cn(
                  "text-[12px] w-12 text-right font-mono transition-colors duration-300",
                  pivotApproaching ? "text-white font-medium" : "text-white/40"
                )}
              >
                ${pivot.toFixed(0)}
              </span>
              <span className="text-[13px] font-semibold text-white w-6">PP</span>
            </div>
            {supportLevels.map((level) => (
              <div key={level.label} className="flex items-center gap-2">
                <span 
                  className={cn(
                    "text-[12px] w-12 text-right font-mono transition-colors duration-300",
                    level.approaching ? "text-white font-medium" : "text-white/40"
                  )}
                >
                  ${level.value.toFixed(0)}
                </span>
                <span className="text-[13px] font-semibold text-emerald-400 w-6">{level.label}</span>
              </div>
            ))}
          </div>

          {/* Chart area */}
          <div className="flex-1 relative border-l border-r border-white/5">
            {/* Horizontal level lines */}
            {resistanceLevels.map((level) => (
              <div
                key={level.label}
                className="absolute left-0 right-0 border-t border-dashed border-[#ec3b70]/20"
                style={{ bottom: `${getPosition(level.value)}%` }}
              />
            ))}
            <div className="absolute left-0 right-0 border-t border-white/20" style={{ bottom: `${pivotPosition}%` }} />
            {supportLevels.map((level) => (
              <div
                key={level.label}
                className="absolute left-0 right-0 border-t border-dashed border-emerald-400/20"
                style={{ bottom: `${getPosition(level.value)}%` }}
              />
            ))}

            {/* Bollinger band lines */}
            <div
              className="absolute left-0 right-0 border-t border-violet-400/30"
              style={{ bottom: `${bbUpperPosition}%` }}
            >
              <span className="absolute right-1 -top-3 text-[8px] text-violet-400/50">BB↑</span>
            </div>
            <div
              className="absolute left-0 right-0 border-t border-dashed border-violet-400/20"
              style={{ bottom: `${bbMiddlePosition}%` }}
            />
            <div
              className="absolute left-0 right-0 border-t border-violet-400/30"
              style={{ bottom: `${bbLowerPosition}%` }}
            >
              <span className="absolute right-1 top-0.5 text-[8px] text-violet-400/50">BB↓</span>
            </div>

            {/* Mini candles */}
            <div className="absolute inset-x-4 inset-y-2 flex items-end justify-around gap-1">
              {recentCandles.map((candle, i) => {
                const isGreen = candle.close >= candle.open
                const candleTop = getPosition(Math.max(candle.open, candle.close))
                const candleBottom = getPosition(Math.min(candle.open, candle.close))
                const wickTop = getPosition(candle.high)
                const wickBottom = getPosition(candle.low)

                return (
                  <div
                    key={i}
                    className="relative flex-1 h-full"
                    style={{
                      opacity: animated ? 1 : 0,
                      transition: `opacity 0.3s ease ${i * 50}ms`,
                    }}
                  >
                    {/* Wick */}
                    <div
                      className={cn(
                        "absolute left-1/2 -translate-x-1/2 w-[1px]",
                        isGreen ? "bg-emerald-400/40" : "bg-[#ec3b70]/40",
                      )}
                      style={{
                        bottom: `${wickBottom}%`,
                        height: `${wickTop - wickBottom}%`,
                      }}
                    />
                    {/* Body */}
                    <div
                      className={cn(
                        "absolute left-1/2 -translate-x-1/2 w-[3px] rounded-sm",
                        isGreen ? "bg-emerald-400/70" : "bg-[#ec3b70]/70",
                      )}
                      style={{
                        bottom: `${candleBottom}%`,
                        height: `${Math.max(candleTop - candleBottom, 0.5)}%`,
                      }}
                    />
                  </div>
                )
              })}
            </div>

            {/* Current price ball */}
            <div
              className="absolute left-1/2 -translate-x-1/2 z-20 transition-all duration-700"
              style={{ bottom: `${animated ? pricePosition : 50}%` }}
            >
              {/* Outer glow */}
              <div
                className={cn(
                  "absolute -inset-3 rounded-full blur-md animate-pulse",
                  safeEntryCall ? "bg-emerald-400/30" : safeEntryPut ? "bg-[#ec3b70]/30" : "bg-white/20",
                )}
              />
              {/* Inner glow */}
              <div
                className={cn(
                  "absolute -inset-1.5 rounded-full blur-sm",
                  safeEntryCall ? "bg-emerald-400/40" : safeEntryPut ? "bg-[#ec3b70]/40" : "bg-white/30",
                )}
              />
              {/* Ball */}
              <div
                className={cn(
                  "relative w-3 h-3 rounded-full shadow-lg",
                  safeEntryCall
                    ? "bg-emerald-400 shadow-emerald-400/50"
                    : safeEntryPut
                      ? "bg-[#ec3b70] shadow-[#ec3b70]/50"
                      : "bg-white shadow-white/50",
                )}
              />
            </div>

            {/* Safe entry zone indicator */}
            {(safeEntryCall || safeEntryPut) && (
              <div
                className="absolute left-0 right-0 pointer-events-none transition-all duration-500"
                style={{
                  bottom: `${pricePosition - 5}%`,
                  height: "10%",
                }}
              >
                <div
                  className={cn(
                    "w-full h-full rounded-lg border border-dashed",
                    safeEntryCall ? "bg-emerald-400/5 border-emerald-400/30" : "bg-[#ec3b70]/5 border-[#ec3b70]/30",
                  )}
                />
              </div>
            )}
          </div>

          {/* Right side - Analysis panel */}
          <div className="w-24 flex flex-col justify-between py-2 pl-2">
            {/* Zones legend */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#ec3b70]/60" />
                <span className="text-[10px] text-white">Resistance</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-violet-400/60" />
                <span className="text-[10px] text-white">BB Cloud</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400/60" />
                <span className="text-[10px] text-white">Support</span>
              </div>
            </div>

            {/* Entry signal */}
            <div
              className={cn(
                "p-2 rounded-lg border text-center",
                safeEntryCall
                  ? "bg-emerald-500/10 border-emerald-500/20"
                  : safeEntryPut
                    ? "bg-[#ec3b70]/10 border-[#ec3b70]/20"
                    : "bg-white/5 border-white/10",
              )}
            >
              <p
                className={cn(
                  "text-[10px] font-medium",
                  safeEntryCall ? "text-emerald-400" : safeEntryPut ? "text-[#ec3b70]" : "text-white/50",
                )}
              >
                {safeEntryCall ? "CALL" : safeEntryPut ? "PUT" : "WAIT"}
              </p>
              <p className="text-[9px] text-white/70 mt-0.5">
                {safeEntryCall ? "Go Long" : safeEntryPut ? "Go Short" : "No Entry"}
              </p>
            </div>

            {/* Quick stats with proximity highlighting */}
            <div className="space-y-1.5">
              <div className="text-[10px]">
                <span className="text-white/60">To S1: </span>
                <span className={cn(
                  "transition-colors duration-300",
                  supportLevels.find(l => l.label === "S1")?.approaching ? "text-white font-medium" : "text-emerald-400"
                )}>
                  -${Math.abs(currentPrice - s1).toFixed(2)}
                </span>
              </div>
              <div className="text-[10px]">
                <span className="text-white/60">To R1: </span>
                <span className={cn(
                  "transition-colors duration-300",
                  resistanceLevels.find(l => l.label === "R1")?.approaching 
                    ? "text-white font-medium" 
                    : currentPrice > pivot ? "text-emerald-400" : "text-[#ec3b70]"
                )}>
                  {currentPrice > pivot ? "+" : ""}
                  {(((currentPrice - pivot) / pivot) * 100).toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom analysis bar */}
        <div className="mt-4 pt-3 border-t border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-[11px]">
              <div>
                <span className="text-white">BB Width: </span>
                <span className="text-violet-400">
                  {(((bollingerBands.upper - bollingerBands.lower) / bollingerBands.middle) * 100).toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-white">From PP: </span>
                <span className={currentPrice > pivot ? "text-emerald-400" : "text-[#ec3b70]"}>
                  {currentPrice > pivot ? "+" : ""}
                  {(((currentPrice - pivot) / pivot) * 100).toFixed(2)}%
                </span>
              </div>
            </div>

            {(safeEntryCall || safeEntryPut) && (
              <div
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] animate-pulse",
                  safeEntryCall ? "bg-emerald-500/20 text-emerald-400" : "bg-[#ec3b70]/20 text-[#ec3b70]",
                )}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-current" />
                Safe Entry Zone Active
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
