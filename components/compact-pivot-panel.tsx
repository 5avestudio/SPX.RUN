"use client"

import { useState } from "react"
import { ChevronRight, ChevronLeft, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

interface CompactPivotPanelProps {
  currentPrice: number
  pivot: number
  r1: number
  r2: number
  r3?: number
  s1: number
  s2: number
  s3?: number
  bollingerBands?: {
    upper: number
    middle: number
    lower: number
  }
  signal?: "buy" | "sell" | "hold"
  trend?: "up" | "down" | "neutral"
  priceChange?: number
  priceChangePercent?: number
}

export function CompactPivotPanel({
  currentPrice = 0,
  pivot = 0,
  r1 = 0,
  r2 = 0,
  r3 = 0,
  s1 = 0,
  s2 = 0,
  s3 = 0,
  bollingerBands = { upper: 0, middle: 0, lower: 0 },
  signal = "hold",
  priceChange = 0,
  priceChangePercent = 0,
}: CompactPivotPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const handleToggle = () => setIsExpanded(!isExpanded)

  // Calculate trend sentiment based on price position and momentum
  const calculateTrendSentiment = () => {
    const safePivotVal = pivot || 0
    const safeR1Val = r1 || 0
    const safeS1Val = s1 || 0

    const abovePivot = currentPrice > safePivotVal
    const aboveR1 = currentPrice > safeR1Val
    const belowS1 = currentPrice < safeS1Val
    const priceMovingUp = priceChangePercent > 0
    const strongMove = Math.abs(priceChangePercent) > 0.1

    let sentimentScore = 0

    if (abovePivot) sentimentScore += 30
    else sentimentScore -= 30

    if (aboveR1) sentimentScore += 25
    else if (belowS1) sentimentScore -= 25

    if (priceMovingUp) sentimentScore += 25
    else if (priceChangePercent < 0) sentimentScore -= 25

    if (strongMove) {
      sentimentScore += priceMovingUp ? 20 : -20
    }

    sentimentScore = Math.max(-100, Math.min(100, sentimentScore))

    let sentimentLabel: "STRONG BULL" | "BULLISH" | "NEUTRAL" | "BEARISH" | "STRONG BEAR"
    if (sentimentScore >= 60) sentimentLabel = "STRONG BULL"
    else if (sentimentScore >= 20) sentimentLabel = "BULLISH"
    else if (sentimentScore <= -60) sentimentLabel = "STRONG BEAR"
    else if (sentimentScore <= -20) sentimentLabel = "BEARISH"
    else sentimentLabel = "NEUTRAL"

    return { score: sentimentScore, label: sentimentLabel }
  }

  const trendSentiment = calculateTrendSentiment()

  // Safe values with fallbacks
  const safeCurrentPrice = currentPrice || 0
  const safePivot = pivot || 0
  const safeR1 = r1 || 0
  const safeR2 = r2 || 0
  const safeS1 = s1 || 0
  const safeS2 = s2 || 0
  const safeBBUpper = bollingerBands?.upper || 0
  const safeBBLower = bollingerBands?.lower || 0

  const signalType = signal

  const isSafeEntry = signalType !== "hold" && Math.abs(safeCurrentPrice - safePivot) / safePivot < 0.02

  const distanceToS1 = safeS1 > 0 ? safeCurrentPrice - safeS1 : 0
  const distanceToR1 = safeR1 > 0 ? safeR1 - safeCurrentPrice : 0
  const distanceFromPP = safePivot > 0 ? ((safeCurrentPrice - safePivot) / safePivot) * 100 : 0
  const bbWidth = safeBBUpper > 0 && safeBBLower > 0 ? ((safeBBUpper - safeBBLower) / safeCurrentPrice) * 100 : 0

  // Calculate if price is approaching each level (within $3 range)
  const proximityThreshold = 3 // $3 range for highlighting
  const isApproaching = (levelValue: number) => {
    if (levelValue <= 0) return false
    return Math.abs(safeCurrentPrice - levelValue) <= proximityThreshold
  }

  const levels = [
    { label: "R2", value: safeR2, color: "text-red-400", approaching: isApproaching(safeR2) },
    { label: "R1", value: safeR1, color: "text-red-400", approaching: isApproaching(safeR1) },
    { label: "PP", value: safePivot, color: "text-white/60", approaching: isApproaching(safePivot) },
    { label: "S1", value: safeS1, color: "text-emerald-400", approaching: isApproaching(safeS1) },
    { label: "S2", value: safeS2, color: "text-emerald-400", approaching: isApproaching(safeS2) },
  ]

  const allValues = levels.map((l) => l.value).filter((v) => v > 0)
  const minPrice = Math.min(...allValues, safeCurrentPrice)
  const maxPrice = Math.max(...allValues, safeCurrentPrice)
  const priceRange = maxPrice - minPrice || 1
  const pricePosition = ((safeCurrentPrice - minPrice) / priceRange) * 100

  const zoneType = signalType === "sell" ? "PUT" : signalType === "buy" ? "CALL" : "HOLD"
  const zoneColor = signalType === "sell" ? "bg-red-500" : signalType === "buy" ? "bg-emerald-500" : "bg-white/30"
  const zoneBorderColor =
    signalType === "sell" ? "border-red-500/30" : signalType === "buy" ? "border-emerald-500/30" : "border-white/10"

  return (
    <div
      className={cn(
        "absolute left-0 top-0 bottom-0 z-20 flex transition-transform duration-300 ease-out",
        isExpanded ? "translate-x-0" : "translate-x-[calc(-100%+45px)]"
      )}
    >
      {/* Main expanded content */}
      <div
        className={cn(
          "h-full w-[120px] bg-gradient-to-r from-black/70 via-black/50 to-transparent backdrop-blur-md flex flex-col overflow-hidden rounded-r-2xl cursor-pointer transition-opacity duration-300",
          isExpanded ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={handleToggle}
      >
        {/* Header */}
        <div className="p-2 border-b border-white/5">
          <div className="flex items-center justify-between">
            <span className="text-[8px] uppercase tracking-[0.15em] text-white/40">Combined Analysis</span>
            <div className="w-5 h-5 rounded flex items-center justify-center bg-white/5">
              <ChevronLeft className="w-3 h-3 text-white/60" />
            </div>
          </div>

          {/* Zone Badge */}
          <div
            className={cn(
              "mt-1.5 px-2 py-0.5 rounded-full inline-flex items-center gap-1.5 border",
              zoneBorderColor,
              signalType === "sell" ? "bg-red-500/10" : signalType === "buy" ? "bg-emerald-500/10" : "bg-white/5"
            )}
          >
            <div className={cn("w-1.5 h-1.5 rounded-full", zoneColor)} />
            <span
              className={cn(
                "text-[9px] font-medium",
                signalType === "sell" ? "text-red-400" : signalType === "buy" ? "text-emerald-400" : "text-white/50"
              )}
            >
              {zoneType} Entry Zone
            </span>
          </div>

          {/* Trend Sentiment Indicator */}
          <div className="mt-2 w-full">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[7px] text-white/30 uppercase tracking-wider">Sentiment</span>
              <div className="flex items-center gap-1">
                {trendSentiment.score > 20 ? (
                  <TrendingUp className="w-2.5 h-2.5 text-emerald-400" />
                ) : trendSentiment.score < -20 ? (
                  <TrendingDown className="w-2.5 h-2.5 text-red-400" />
                ) : (
                  <Minus className="w-2.5 h-2.5 text-white/40" />
                )}
                <span
                  className={cn(
                    "text-[8px] font-semibold",
                    trendSentiment.score > 20
                      ? "text-emerald-400"
                      : trendSentiment.score < -20
                        ? "text-red-400"
                        : "text-white/50"
                  )}
                >
                  {trendSentiment.label}
                </span>
              </div>
            </div>
            {/* Sentiment Bar */}
            <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden relative">
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20" />
              <div
                className={cn(
                  "absolute top-0 bottom-0 rounded-full transition-all duration-500",
                  trendSentiment.score >= 0 ? "bg-emerald-400" : "bg-red-400"
                )}
                style={{
                  left: trendSentiment.score >= 0 ? "50%" : `${50 + trendSentiment.score / 2}%`,
                  width: `${Math.abs(trendSentiment.score) / 2}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Mini Chart with Levels - reverted to original +13px spacing */}
        <div className="flex-1 px-2 py-2 min-h-[100px]">
          <div className="flex h-full">
            {/* Price Labels - aligned with pivot dashed lines */}
            <div className="flex flex-col justify-between text-[9px] pr-1 h-full">
              {levels.map((level) => (
                <div key={level.label} className="flex items-center gap-0.5 leading-none">
                  <span 
                    className={cn(
                      "tabular-nums w-[38px] text-right font-medium transition-colors duration-300",
                      level.approaching ? "text-white" : "text-white/40"
                    )}
                  >
                    {level.value > 0 ? `$${level.value.toFixed(0)}` : "--"}
                  </span>
                  <span className={cn("font-medium text-[8px]", level.color)}>{level.label}</span>
                </div>
              ))}
            </div>

            <div className="flex-1 relative ml-1">
              {/* Pivot level dashed lines - aligned with price labels using same justify-between */}
              {levels.map((level, i) => {
                const lineY = (i / (levels.length - 1)) * 100
                const isResistance = level.label.startsWith("R")
                const isSupport = level.label.startsWith("S")
                return (
                  <div
                    key={level.label}
                    className="absolute left-0 right-0 flex items-center"
                    style={{ top: `${lineY}%`, transform: "translateY(-50%)" }}
                  >
                    <div
                      className={cn(
                        "w-full h-px border-t",
                        isResistance ? "border-red-400/40" : isSupport ? "border-emerald-400/40" : "border-white/20"
                      )}
                    />
                  </div>
                )
              })}

              {/* BB Cloud area */}
              <div
                className="absolute left-0 right-0 bg-purple-500/10 border-t border-b border-purple-400/30"
                style={{
                  top: `${Math.max(0, Math.min(100, 100 - ((safeBBUpper - minPrice) / priceRange) * 100))}%`,
                  bottom: `${Math.max(0, Math.min(100, ((safeBBLower - minPrice) / priceRange) * 100))}%`,
                }}
              />

              {/* BB Labels */}
              <div className="absolute right-0.5 text-[6px] text-purple-400/60" style={{ top: "5%" }}>
                BB+
              </div>
              <div className="absolute right-0.5 text-[6px] text-purple-400/60" style={{ bottom: "5%" }}>
                BB-
              </div>

              {/* Current price indicator */}
              <div
                className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{ top: `${100 - pricePosition}%` }}
              >
                <div
                  className={cn(
                    "absolute inset-0 rounded-full blur-md animate-pulse",
                    signalType === "buy" ? "bg-emerald-400" : signalType === "sell" ? "bg-red-400" : "bg-white/50"
                  )}
                  style={{ width: 16, height: 16, left: -4, top: -4 }}
                />
                <div
                  className={cn(
                    "w-3 h-3 rounded-full relative z-10",
                    signalType === "buy" ? "bg-emerald-400" : signalType === "sell" ? "bg-red-400" : "bg-white/70"
                  )}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="px-2 py-1 border-t border-white/5">
          <div
            className={cn(
              "w-full py-1.5 rounded text-center text-[10px] font-medium border",
              signalType === "buy"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : signalType === "sell"
                  ? "bg-red-500/10 border-red-500/30 text-red-400"
                  : "bg-white/5 border-white/10 text-white/40"
            )}
          >
            {signalType === "buy" ? "CALL" : signalType === "sell" ? "PUT" : "WAIT"}
          </div>
        </div>

        {/* Footer Stats - positioned at bottom edge */}
        <div className="px-2 py-1 border-t border-white/5 mt-auto">
          {/* To S1 / To R1 distances */}
          <div className="flex justify-between text-[8px] text-white/40 mb-1">
            <span>
              To S1: <span className={cn(
                "font-medium transition-colors duration-300",
                levels.find(l => l.label === "S1")?.approaching ? "text-white" : "text-emerald-400"
              )}>-${Math.abs(distanceToS1).toFixed(2)}</span>
            </span>
            <span>
              To R1: <span className={cn(
                "font-medium transition-colors duration-300",
                levels.find(l => l.label === "R1")?.approaching ? "text-white" : "text-red-400"
              )}>+${Math.abs(distanceToR1).toFixed(2)}</span>
            </span>
          </div>
          {/* BB and PP stats */}
          <div className="flex items-center justify-between text-[8px]">
            <span className="text-white/30">
              BB: <span className="text-emerald-400">{bbWidth.toFixed(1)}%</span>
            </span>
            <span className="text-white/30">
              PP:{" "}
              <span className={distanceFromPP >= 0 ? "text-emerald-400" : "text-red-400"}>
                {distanceFromPP >= 0 ? "+" : ""}
                {distanceFromPP.toFixed(2)}%
              </span>
            </span>
            {isSafeEntry && (
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-400">Safe</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Collapsed panel content - always visible, positioned at the edge */}
      <div
        className={cn(
          "h-full w-[45px] flex items-center cursor-pointer transition-opacity duration-300",
          isExpanded ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
        onClick={handleToggle}
      >
        <div className="h-full bg-gradient-to-r from-black/60 via-black/40 to-transparent backdrop-blur-sm flex flex-col items-center py-3 rounded-r-2xl">
          {/* Trend Sentiment Mini Indicator */}
          <div className="mb-1 flex flex-col items-center">
            {trendSentiment.score > 20 ? (
              <TrendingUp className="w-3 h-3 text-emerald-400" />
            ) : trendSentiment.score < -20 ? (
              <TrendingDown className="w-3 h-3 text-red-400" />
            ) : (
              <Minus className="w-3 h-3 text-white/40" />
            )}
            <span
              className={cn(
                "text-[5px] font-bold mt-0.5",
                trendSentiment.score > 20
                  ? "text-emerald-400"
                  : trendSentiment.score < -20
                    ? "text-red-400"
                    : "text-white/40"
              )}
            >
              {trendSentiment.score > 60
                ? "S.BULL"
                : trendSentiment.score > 20
                  ? "BULL"
                  : trendSentiment.score < -60
                    ? "S.BEAR"
                    : trendSentiment.score < -20
                      ? "BEAR"
                      : "NTRL"}
            </span>
          </div>

          {/* Zone Indicator */}
          <div className={cn("w-2 h-2 rounded-full mb-1", zoneColor)} />

          <div
            className={cn(
              "text-[8px] font-bold tracking-wider",
              signalType === "sell" ? "text-red-400" : signalType === "buy" ? "text-emerald-400" : "text-white/40"
            )}
          >
            {zoneType}
          </div>

          {/* Mini Vertical Chart with dashed lines and price labels */}
          <div className="flex-1 w-[38px] my-2 relative">
            {levels.map((level, i) => (
              <div
                key={level.label}
                className="absolute left-0 right-0 flex items-center"
                style={{ top: `${(i / (levels.length - 1)) * 100}%`, transform: "translateY(-50%)" }}
              >
                {/* Level indicator dot */}
                <div
                  className={cn(
                    "absolute left-0 w-1 h-1 rounded-full",
                    level.label.startsWith("R")
                      ? "bg-red-400/60"
                      : level.label.startsWith("S")
                        ? "bg-emerald-400/60"
                        : "bg-white/30"
                  )}
                />
                {/* Price label - full price without $ sign, 50% larger */}
                <span
                  className={cn(
                    "absolute right-0 text-[7.5px] tabular-nums transition-colors duration-300",
                    level.approaching ? "text-white font-medium" : "text-white/30"
                  )}
                >
                  {level.value > 0 ? level.value.toFixed(0) : "--"}
                </span>
              </div>
            ))}

            {/* Current price indicator - shifted left 5px */}
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ top: `${100 - pricePosition}%`, left: "calc(50% - 5px)" }}
            >
              <div
                className={cn(
                  "absolute rounded-full blur-sm animate-pulse",
                  signalType === "buy" ? "bg-emerald-400" : signalType === "sell" ? "bg-red-400" : "bg-white/50"
                )}
                style={{ width: 8, height: 8, left: -1.5, top: -1.5 }}
              />
              <div
                className={cn(
                  "w-2 h-2 rounded-full relative z-10",
                  signalType === "buy" ? "bg-emerald-400" : signalType === "sell" ? "bg-red-400" : "bg-white/60"
                )}
              />
            </div>
          </div>

          {/* BB Width */}
          <div className="text-[6px] text-white/35 tabular-nums">BB {bbWidth.toFixed(1)}%</div>

          {/* Safe indicator */}
          {isSafeEntry && <div className="mt-1 w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />}
        </div>

        {/* Chevron tab */}
        <div className="flex items-center justify-center w-5 h-12 rounded-r-xl bg-gradient-to-l from-black/50 to-transparent">
          <ChevronRight className="w-3 h-3 text-white/50" />
        </div>
      </div>
    </div>
  )
}
