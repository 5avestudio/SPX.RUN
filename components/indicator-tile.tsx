"use client"

import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

type SignalType = "buy" | "sell" | "hold" | "neutral"

interface IndicatorTileProps {
  name: string
  value: number | string
  signal: SignalType
  threshold?: { low: number; high: number }
  className?: string
}

export function IndicatorTile({ name, value, signal, threshold, className }: IndicatorTileProps) {
  const numValue = typeof value === "number" ? value : Number.parseFloat(value)

  const getThresholdProgress = () => {
    if (!threshold || isNaN(numValue)) return 50
    const range = threshold.high - threshold.low
    const progress = ((numValue - threshold.low) / range) * 100
    return Math.max(0, Math.min(100, progress))
  }

  const signalColor = {
    buy: "text-emerald-400",
    sell: "text-[#ec3b70]",
    hold: "text-white/60",
    neutral: "text-white/40",
  }[signal]

  const SignalIcon = signal === "buy" ? TrendingUp : signal === "sell" ? TrendingDown : Minus

  const progress = getThresholdProgress()

  return (
    <div
      className={cn(
        "relative rounded-2xl glass-frost p-4 min-w-[140px] press-effect overflow-hidden border border-white/10",
        className,
      )}
    >
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs uppercase tracking-wider text-white/40">{name}</span>
          <SignalIcon className={cn("w-4 h-4", signalColor)} />
        </div>

        {/* Value */}
        <div className={cn("text-2xl font-light mb-3", signalColor)}>
          {typeof value === "number" ? value.toFixed(1) : value}
        </div>

        {/* Threshold bar - simplified, minimal */}
        {threshold && (
          <div className="space-y-1">
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-500", "bg-white/40")}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-white/30">
              <span>{threshold.low}</span>
              <span>{threshold.high}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
