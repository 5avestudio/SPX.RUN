"use client"

import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown, AlertCircle } from "lucide-react"

interface Indicator {
  name: string
  signal: "buy" | "sell" | "hold" | "neutral"
}

interface StarsAlignCardProps {
  indicators: Indicator[]
  overallSignal: "BUY" | "SELL" | "HOLD"
  confidence: number
  className?: string
}

export function StarsAlignCard({ indicators, overallSignal, confidence, className }: StarsAlignCardProps) {
  const buyCount = indicators.filter((i) => i.signal === "buy").length
  const sellCount = indicators.filter((i) => i.signal === "sell").length
  const totalActive = indicators.length

  const alignment = Math.max(buyCount, sellCount) / totalActive
  const starsAligned = alignment >= 0.7

  const signalConfig = {
    BUY: {
      icon: TrendingUp,
      color: "text-emerald-400",
      label: "CALL",
    },
    SELL: {
      icon: TrendingDown,
      color: "text-[#ec3b70]",
      label: "PUT",
    },
    HOLD: {
      icon: AlertCircle,
      color: "text-white/60",
      label: "WAIT",
    },
  }

  const config = signalConfig[overallSignal]
  const SignalIcon = config.icon

  const bingoGlowClass = starsAligned
    ? overallSignal === "BUY"
      ? "stars-align-buy"
      : overallSignal === "SELL"
        ? "stars-align-sell"
        : ""
    : ""

  return (
    <div
      className={cn(
        "relative rounded-3xl glass-frost p-6 overflow-hidden border border-white/10",
        bingoGlowClass,
        className,
      )}
    >
      <div className="relative z-10">
        {/* Header with stars icon */}
        <div className="flex items-center justify-between mb-6">
          <span className="text-xs uppercase tracking-[0.2em] text-white/40">
            {starsAligned ? "Stars Aligned" : "Signal Check"}
          </span>
          <div className="text-xs text-white/40">{Math.round(alignment * 100)}% agree</div>
        </div>

        {/* Main signal display */}
        <div className="text-center mb-6">
          <SignalIcon className={cn("w-12 h-12 mx-auto mb-3", starsAligned ? config.color : "text-white/30")} />
          <p className={cn("text-4xl font-light tracking-tight", starsAligned ? config.color : "text-white/50")}>
            {config.label}
          </p>
          <p className="text-white/40 text-sm mt-1">{confidence.toFixed(0)}% confidence</p>
        </div>

        {/* Indicator dots grid - simplified colors */}
        <div className="grid grid-cols-4 gap-3">
          {indicators.map((indicator) => {
            const dotColor = {
              buy: "bg-emerald-400",
              sell: "bg-[#ec3b70]",
              hold: "bg-white/40",
              neutral: "bg-white/20",
            }[indicator.signal]

            return (
              <div key={indicator.name} className="text-center">
                <div className={cn("w-2.5 h-2.5 rounded-full mx-auto mb-1.5", dotColor)} />
                <span className="text-[10px] text-white/40 uppercase tracking-wider">{indicator.name}</span>
              </div>
            )
          })}
        </div>

        {/* Action hint - only show when aligned */}
        {starsAligned && (
          <div className={cn("mt-6 pt-4 border-t border-white/10 text-center")}>
            <p className={cn("text-sm", config.color)}>
              {overallSignal === "BUY"
                ? "Consider CALL option"
                : overallSignal === "SELL"
                  ? "Consider PUT option"
                  : "Wait for alignment"}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
