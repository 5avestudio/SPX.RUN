"use client"

import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown, AlertCircle, Clock, DollarSign } from "lucide-react"

type SignalType = "BUY" | "SELL" | "HOLD" | "STRONG_BUY" | "STRONG_SELL"

interface IndicatorStatus {
  name: string
  signal: "buy" | "sell" | "hold" | "neutral"
}

interface TradeAnalysisCardProps {
  signal: SignalType
  confidence: number
  reasons: string[]
  indicators: IndicatorStatus[]
  currentPrice: number
  pivotLevels: {
    pivot: number
    r1: number
    r2: number
    s1: number
    s2: number
  }
  rsi: number
  macdHistogram: number
  bollingerPosition: "upper" | "lower" | "middle"
  budget: number
  className?: string
}

export function TradeAnalysisCard({
  signal,
  confidence,
  reasons,
  indicators,
  currentPrice,
  pivotLevels,
  rsi,
  macdHistogram,
  bollingerPosition,
  budget,
  className,
}: TradeAnalysisCardProps) {
  const buySignals = indicators.filter((i) => i.signal === "buy").length
  const sellSignals = indicators.filter((i) => i.signal === "sell").length
  const totalIndicators = indicators.length
  const alignment = Math.max(buySignals, sellSignals) / totalIndicators

  const isBullish = signal === "BUY" || signal === "STRONG_BUY"
  const isBearish = signal === "SELL" || signal === "STRONG_SELL"

  const getEntryStrategy = () => {
    const distanceToS1 = currentPrice - pivotLevels.s1
    const distanceToR1 = pivotLevels.r1 - currentPrice
    const nearSupport = distanceToS1 < distanceToR1 && distanceToS1 < currentPrice * 0.005
    const nearResistance = distanceToR1 < distanceToS1 && distanceToR1 < currentPrice * 0.005

    if (isBullish && nearSupport && rsi < 40) {
      return {
        type: "PERFECT",
        action: "CALL",
        title: "Perfect Entry",
        description: "All stars aligned! Price at support, RSI oversold, bullish momentum confirmed.",
        timing: "Enter now or within 5 minutes",
        risk: "LOW",
        winRate: 78,
      }
    }
    if (isBearish && nearResistance && rsi > 60) {
      return {
        type: "PERFECT",
        action: "PUT",
        title: "Perfect Entry",
        description: "All stars aligned! Price at resistance, RSI overbought, bearish momentum confirmed.",
        timing: "Enter now or within 5 minutes",
        risk: "LOW",
        winRate: 78,
      }
    }
    if (isBullish && rsi < 35) {
      return {
        type: "STRONG",
        action: "CALL",
        title: "Strong Setup",
        description: "RSI deeply oversold with bullish indicators. High probability bounce incoming.",
        timing: "Enter on next green candle",
        risk: "MEDIUM",
        winRate: 68,
      }
    }
    if (isBearish && rsi > 65) {
      return {
        type: "STRONG",
        action: "PUT",
        title: "Strong Setup",
        description: "RSI overbought with bearish pressure. Pullback likely.",
        timing: "Enter on next red candle",
        risk: "MEDIUM",
        winRate: 68,
      }
    }
    if (alignment >= 0.7) {
      return {
        type: "ALIGNED",
        action: isBullish ? "CALL" : "PUT",
        title: "Stars Aligning",
        description: `${Math.round(alignment * 100)}% of indicators agree. Strong directional bias.`,
        timing: "Wait for price confirmation",
        risk: "MEDIUM",
        winRate: 62,
      }
    }
    if (alignment >= 0.5) {
      return {
        type: "POSSIBLE",
        action: isBullish ? "CALL" : isBearish ? "PUT" : "WAIT",
        title: "Developing Setup",
        description: "Mixed signals. Some indicators aligning but not enough for high confidence.",
        timing: "Wait for more confirmation",
        risk: "HIGH",
        winRate: 52,
      }
    }
    return {
      type: "WAIT",
      action: "WAIT",
      title: "No Clear Setup",
      description: "Signals are mixed or neutral. Protect your capital - patience is key!",
      timing: "Check back in 15-30 minutes",
      risk: "AVOID",
      winRate: 0,
    }
  }

  const strategy = getEntryStrategy()

  const calculateReturns = () => {
    const baseMultiplier = strategy.winRate / 100
    const conservative = budget * 0.15 * baseMultiplier
    const moderate = budget * 0.35 * baseMultiplier
    const powerHour = budget * 0.75 * baseMultiplier
    const maxLoss = budget * 0.5 // Assume 50% max loss on options

    return { conservative, moderate, powerHour, maxLoss }
  }

  const returns = calculateReturns()

  const strategyColors = {
    PERFECT: { bg: "bg-emerald-500/20", border: "border-emerald-500/30", text: "text-emerald-400" },
    STRONG: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400" },
    ALIGNED: { bg: "bg-white/10", border: "border-white/20", text: "text-white" },
    POSSIBLE: { bg: "bg-orange-500/10", border: "border-orange-500/20", text: "text-orange-400" },
    WAIT: { bg: "bg-white/5", border: "border-white/10", text: "text-white/50" },
  }[strategy.type]

  const riskColors = {
    LOW: "text-emerald-400 bg-emerald-500/20",
    MEDIUM: "text-white bg-white/20",
    HIGH: "text-orange-400 bg-orange-500/20",
    AVOID: "text-[#ec3b70] bg-[#ec3b70]/20",
  }[strategy.risk]

  return (
    <div className={cn("relative rounded-3xl glass-frost p-5 overflow-hidden border border-white/10", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Detailed Analysis</p>
        <div className={cn("px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider", riskColors)}>
          {strategy.risk === "AVOID" ? "WAIT" : strategy.risk}
        </div>
      </div>

      {/* Main Strategy Card */}
      <div className={cn("p-4 rounded-2xl border mb-4", strategyColors.bg, strategyColors.border)}>
        <div className="flex items-start gap-3 mb-3">
          <div
            className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
              strategy.action === "CALL"
                ? "bg-emerald-500/20"
                : strategy.action === "PUT"
                  ? "bg-[#ec3b70]/20"
                  : "bg-white/10",
            )}
          >
            {strategy.action === "CALL" ? (
              <TrendingUp className="w-6 h-6 text-emerald-400" />
            ) : strategy.action === "PUT" ? (
              <TrendingDown className="w-6 h-6 text-[#ec3b70]" />
            ) : (
              <AlertCircle className="w-6 h-6 text-white/40" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className={cn("text-lg font-medium", strategyColors.text)}>{strategy.title}</p>
              {strategy.winRate > 0 && <span className="text-xs text-white/40">{strategy.winRate}% win rate</span>}
            </div>
            <p className="text-sm text-white/60 leading-relaxed">{strategy.description}</p>
          </div>
        </div>

        {/* Timing Recommendation */}
        <div className="flex items-center gap-2 pt-3 border-t border-white/10">
          <Clock className="w-4 h-4 text-white/40" />
          <span className="text-sm text-white/60">{strategy.timing}</span>
        </div>
      </div>

      {/* Why This Recommendation */}
      <div className="mb-4">
        <p className="text-xs uppercase tracking-wider text-white/40 mb-3">Key Factors</p>
        <div className="space-y-2">
          {reasons.slice(0, 3).map((reason, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <div
                className={cn(
                  "w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0",
                  isBullish ? "bg-emerald-400" : isBearish ? "bg-[#ec3b70]" : "bg-white/40",
                )}
              />
              <p className="text-sm text-white/60 leading-relaxed">{reason}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Indicator Score Bar */}
      <div className="mb-4 p-3 rounded-xl bg-white/5">
        <div className="flex justify-between text-xs text-white/40 mb-2">
          <span>Bearish</span>
          <span>Neutral</span>
          <span>Bullish</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden flex">
          <div
            className="bg-gradient-to-r from-[#ec3b70] to-[#db2760] transition-all"
            style={{ width: `${(sellSignals / totalIndicators) * 100}%` }}
          />
          <div
            className="bg-white/30 transition-all"
            style={{ width: `${((totalIndicators - buySignals - sellSignals) / totalIndicators) * 100}%` }}
          />
          <div
            className="bg-gradient-to-r from-teal-400 to-emerald-400 transition-all"
            style={{ width: `${(buySignals / totalIndicators) * 100}%` }}
          />
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-[#ec3b70] text-sm">{sellSignals}</span>
          <span className="text-white/40 text-sm">{totalIndicators - buySignals - sellSignals}</span>
          <span className="text-emerald-400 text-sm">{buySignals}</span>
        </div>
      </div>

      {/* Simulation Returns - Only show if there's a setup */}
      {strategy.action !== "WAIT" && (
        <div className="p-3 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-white/40" />
              <span className="text-xs uppercase tracking-wider text-white/40">Simulated Returns</span>
            </div>
            <span className="text-[10px] text-white/30">${budget} budget</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 rounded-lg bg-white/5">
              <p className="text-emerald-400 text-sm font-light">+${returns.conservative.toFixed(0)}</p>
              <p className="text-[10px] text-white/30">Safe</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-white/5">
              <p className="text-emerald-400 text-sm font-light">+${returns.moderate.toFixed(0)}</p>
              <p className="text-[10px] text-white/30">Target</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-white/5">
              <p className="text-emerald-400 text-sm font-light">+${returns.powerHour.toFixed(0)}</p>
              <p className="text-[10px] text-white/30">Power Hr</p>
            </div>
          </div>

          <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between">
            <span className="text-[10px] text-white/30">Max Risk</span>
            <span className="text-[#ec3b70] text-xs">-${returns.maxLoss.toFixed(0)}</span>
          </div>
        </div>
      )}

      {/* Entry Checklist - Compact */}
      {strategy.action !== "WAIT" && (
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { check: alignment >= 0.6, label: "60%+ aligned" },
            { check: strategy.risk !== "HIGH" && strategy.risk !== "AVOID", label: "Low risk" },
            { check: rsi < 70 && rsi > 30, label: "RSI OK" },
            { check: Math.abs(macdHistogram) > 0.3, label: "Momentum" },
          ].map((item, idx) => (
            <div
              key={idx}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs",
                item.check ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-white/30",
              )}
            >
              <span>{item.check ? "✓" : "○"}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
