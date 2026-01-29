"use client"

import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card"
import { TrendingUp, TrendingDown } from "lucide-react"

interface MACDIndicatorProps {
  macd: number
  signal: number
  histogram: number
  crossover: string
}

export function MACDIndicator({ macd, signal, histogram, crossover }: MACDIndicatorProps) {
  const isBullish = histogram > 0
  const crossoverSignal = crossover === "BUY" || crossover === "SELL"

  return (
    <GlassCard variant={crossoverSignal ? (crossover === "BUY" ? "success" : "danger") : "default"}>
      <GlassCardHeader>
        <div className="flex items-center justify-between">
          <GlassCardTitle className="text-base">MACD (12,26,9)</GlassCardTitle>
          {crossoverSignal && (
            <div
              className={`
              px-3 py-1 rounded-full text-xs font-medium
              ${crossover === "BUY" ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}
            `}
            >
              {crossover === "BUY" ? "Bullish Cross" : "Bearish Cross"}
            </div>
          )}
        </div>
      </GlassCardHeader>
      <GlassCardContent>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-foreground/40 uppercase tracking-wider">MACD</p>
            <p className={`text-2xl font-light mt-1 ${macd > 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {macd.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-foreground/40 uppercase tracking-wider">Signal</p>
            <p className="text-2xl font-light mt-1 text-foreground/70">{signal.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-foreground/40 uppercase tracking-wider">Histogram</p>
            <div className="flex items-center justify-center gap-1 mt-1">
              {isBullish ? (
                <TrendingUp className="h-4 w-4 text-emerald-400" />
              ) : (
                <TrendingDown className="h-4 w-4 text-rose-400" />
              )}
              <p className={`text-2xl font-light ${isBullish ? "text-emerald-400" : "text-rose-400"}`}>
                {histogram.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </GlassCardContent>
    </GlassCard>
  )
}
