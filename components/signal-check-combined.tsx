"use client"

import { useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown, AlertCircle, Clock, Target } from "lucide-react"
import type { TrendReversalWarning } from "@/lib/indicators"
import { calculateReversalPricePoint, type ReversalPricePoint, type OHLCData } from "@/lib/indicators"

interface Indicator {
  name: string
  signal: "buy" | "sell" | "hold" | "neutral"
}

interface SignalCheckCombinedProps {
  indicators: Indicator[]
  overallSignal: "BUY" | "SELL" | "HOLD" | "STRONG_BUY" | "STRONG_SELL"
  confidence: number
  reasons: string[]
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
  candleData: any[]
  signal: string
  trend: "up" | "down" | "neutral"
  rsi?: number
  macdHistogram?: number
  bollingerPosition?: "upper" | "lower" | "middle"
  budget?: number
  className?: string
  reversalWarning?: TrendReversalWarning
}

export function getWinRateFromSignal(
  overallSignal: "BUY" | "SELL" | "HOLD" | "STRONG_BUY" | "STRONG_SELL",
  indicators: { signal: "buy" | "sell" | "hold" | "neutral" }[],
  currentPrice: number,
  s1: number,
  r1: number,
  rsi: number,
): number {
  const buyCount = indicators.filter((i) => i.signal === "buy").length
  const sellCount = indicators.filter((i) => i.signal === "sell").length
  const totalActive = indicators.length
  const alignment = Math.max(buyCount, sellCount) / totalActive

  const isBullish = overallSignal === "BUY" || overallSignal === "STRONG_BUY"
  const isBearish = overallSignal === "SELL" || overallSignal === "STRONG_SELL"

  const distanceToS1 = currentPrice - s1
  const distanceToR1 = r1 - currentPrice
  const nearSupport = distanceToS1 < distanceToR1 && distanceToS1 < currentPrice * 0.005
  const nearResistance = distanceToR1 < distanceToS1 && distanceToR1 < currentPrice * 0.005

  if (isBullish && nearSupport && rsi < 40) return 78
  if (isBearish && nearResistance && rsi > 60) return 78
  if (isBullish && rsi < 35) return 68
  if (isBearish && rsi > 65) return 68
  if (alignment >= 0.7) return 62
  if (alignment >= 0.5) return 52
  return 0
}

export function SignalCheckCombined({
  indicators,
  overallSignal,
  confidence,
  reasons,
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
  rsi = 50,
  macdHistogram = 0,
  bollingerPosition = "middle",
  budget = 200,
  className,
  reversalWarning,
}: SignalCheckCombinedProps) {
  const [dismissedWarning, setDismissedWarning] = useState(false)

  const buyCount = indicators.filter((i) => i.signal === "buy").length
  const sellCount = indicators.filter((i) => i.signal === "sell").length
  const totalActive = indicators.length

  const alignment = Math.max(buyCount, sellCount) / totalActive
  const allBuy = buyCount === totalActive
  const allSell = sellCount === totalActive
  const starsAligned = alignment >= 0.7

  // Determine if we have "bingo" - all indicators agree
  const hasBingo = allBuy || allSell

  const signalConfig = {
    BUY: { icon: TrendingUp, color: "text-emerald-400", label: "CALL" },
    SELL: { icon: TrendingDown, color: "text-[#ec3b70]", label: "PUT" },
    HOLD: { icon: AlertCircle, color: "text-white/60", label: "WAIT" },
    STRONG_BUY: { icon: TrendingUp, color: "text-emerald-400", label: "CALL" },
    STRONG_SELL: { icon: TrendingDown, color: "text-[#ec3b70]", label: "PUT" },
  }

  const config = signalConfig[overallSignal]
  const SignalIcon = config.icon

  const isBullish = overallSignal === "BUY" || overallSignal === "STRONG_BUY"
  const isBearish = overallSignal === "SELL" || overallSignal === "STRONG_SELL"

  const getEntryStrategy = () => {
    const distanceToS1 = currentPrice - s1
    const distanceToR1 = r1 - currentPrice
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

  // Calculate reversal price point using all available indicators
  const reversalPricePoint = useMemo(() => {
    if (!candleData || candleData.length < 52) return null
    
    // Convert candleData to OHLCData format if needed
    const ohlcData: OHLCData[] = candleData.map((candle: any) => ({
      time: candle.time || candle.timestamp || Date.now(),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume || 0,
    }))

    const fullPivots = {
      pivot,
      r1,
      r2,
      r3: r3 || r2 * 1.005,
      s1,
      s2,
      s3: s3 || s2 * 0.995,
    }

    return calculateReversalPricePoint(ohlcData, currentPrice, fullPivots)
  }, [candleData, currentPrice, pivot, r1, r2, r3, s1, s2, s3])

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

  // Determine glow class based on bingo state
  const bingoGlowClass = hasBingo
    ? allBuy
      ? "siri-glow-buy"
      : "siri-glow-sell"
    : starsAligned
      ? isBullish
        ? "stars-align-buy"
        : isBearish
          ? "stars-align-sell"
          : ""
      : ""

  return (
    <div
      className={cn(
        "relative rounded-3xl glass-frost overflow-hidden border border-white/10",
        bingoGlowClass,
        className,
      )}
    >
      {/* ============================================
          SECTION 1: SIGNAL CHECK (Top)
          ============================================ */}
      <div className="p-6 border-b border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <span className="text-xs uppercase tracking-[0.2em] text-white/40">
            {hasBingo ? "BINGO!" : starsAligned ? "Stars Aligned" : "Signal Check"}
          </span>
          <div className="text-xs text-white/40">{Math.round(alignment * 100)}% agree</div>
        </div>

        {/* Main signal display */}
        <div className="text-center mb-6">
          <SignalIcon className={cn("w-12 h-12 mx-auto mb-3", config.color)} />
          <p
            className={cn(
              "text-4xl font-light tracking-tight",
              config.label === "PUT"
                ? "text-[#ec3b70]"
                : config.label === "CALL"
                  ? "text-emerald-400"
                  : "text-white/50",
            )}
          >
            {config.label}
          </p>
          <p
            className="text-white/80 text-sm mt-1 font-light"
            style={{ textShadow: "0 0 10px rgba(255,255,255,0.5), 0 0 20px rgba(255,255,255,0.3)" }}
          >
            {confidence.toFixed(0)}% confidence
          </p>
        </div>

        {/* Indicator dots grid */}
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
      </div>

      {/* ============================================
          SECTION 2: DETAILED ANALYSIS (Bottom)
          ============================================ */}
      <div className="p-5">
        {/* Header with risk badge */}
        <div className="flex items-center justify-between mb-4">
          <p
            className="text-xs uppercase tracking-[0.2em] text-white/80"
            style={{ textShadow: "0 0 10px rgba(255,255,255,0.5), 0 0 20px rgba(255,255,255,0.3)" }}
          >
            Detailed Analysis
          </p>
          <div className={cn("px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider", riskColors)}>
            {strategy.risk === "AVOID" ? "WAIT" : strategy.risk}
          </div>
        </div>

        {/* Main Strategy Card - aurora colored based on action */}
        <div
          className={cn(
            "p-4 rounded-2xl mb-4",
            strategy.action === "CALL"
              ? "aurora-card-bullish"
              : strategy.action === "PUT"
                ? "aurora-card-bearish"
                : strategyColors.bg + " " + strategyColors.border + " border",
          )}
        >
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
                <p
                  className={cn(
                    "text-lg font-medium",
                    strategy.action === "CALL"
                      ? "text-emerald-400"
                      : strategy.action === "PUT"
                        ? "text-[#ec3b70]"
                        : strategyColors.text,
                  )}
                >
                  {strategy.title}
                </p>
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

        {/* Reversal Price Point - Warm Aurora Background with Apple Glow */}
        {reversalPricePoint && (
          <div
            className={cn(
              "mb-4 rounded-2xl overflow-hidden warm-aurora-bg",
              reversalPricePoint.direction === "BULLISH" ? "apple-glow-bullish" : "apple-glow-bearish",
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "p-2 rounded-xl",
                    reversalPricePoint.direction === "BULLISH" ? "bg-emerald-500/20" : "bg-[#ec3b70]/20",
                  )}
                >
                  <Target
                    className={cn(
                      "w-5 h-5",
                      reversalPricePoint.direction === "BULLISH" ? "text-emerald-400" : "text-[#ec3b70]",
                    )}
                  />
                </div>
                <span className="text-sm font-medium text-white/80">Reversal Scanner</span>
              </div>
              <div
                className={cn(
                  "text-xl font-light leading-tight text-right",
                  reversalPricePoint.confidence >= 70
                    ? "text-white"
                    : reversalPricePoint.confidence >= 50
                      ? "text-white/80"
                      : "text-white/50",
                )}
              >
                <div>{reversalPricePoint.confidence.toFixed(0)}%</div>
                <div className="text-sm text-white/60">Score</div>
              </div>
            </div>

            {/* Main Signal */}
            <div className="px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {reversalPricePoint.direction === "BULLISH" ? (
                    <TrendingUp className="w-6 h-6 text-emerald-400" />
                  ) : (
                    <TrendingDown className="w-6 h-6 text-[#ec3b70]" />
                  )}
                  <span className="text-2xl font-light text-white">
                    ${reversalPricePoint.price.toFixed(2)}
                  </span>
                </div>
                <span
                  className={cn(
                    "text-sm font-medium text-right",
                    reversalPricePoint.direction === "BULLISH" ? "text-emerald-400" : "text-[#ec3b70]",
                  )}
                >
                  {reversalPricePoint.direction === "BULLISH" ? "Support Zone" : "Resistance Zone"}
                </span>
              </div>
            </div>

            {/* Entry Details Grid */}
            <div className="px-4 pb-3 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Direction", value: reversalPricePoint.direction === "BULLISH" ? "CALL" : "PUT" },
                  { label: "Distance", value: `$${Math.abs(currentPrice - reversalPricePoint.price).toFixed(2)}` },
                  { label: "Current", value: `$${currentPrice.toFixed(0)}` },
                ].map((item) => (
                  <div key={item.label} className="p-2 rounded-xl text-center">
                    <p className="text-[9px] text-white/40 uppercase tracking-wider">{item.label}</p>
                    <p
                      className={cn(
                        "text-sm font-light mt-1",
                        item.label === "Direction"
                          ? reversalPricePoint.direction === "BULLISH"
                            ? "text-emerald-400"
                            : "text-[#ec3b70]"
                          : "text-white/80",
                      )}
                    >
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Contributing Indicators as Condition Badges */}
              <div className="grid grid-cols-4 gap-2">
                {reversalPricePoint.sources.slice(0, 4).map((source, i) => (
                  <div
                    key={i}
                    className={cn(
                      "p-2 rounded-xl text-center",
                      reversalPricePoint.direction === "BULLISH" ? "bg-emerald-500/15" : "bg-[#ec3b70]/15",
                    )}
                  >
                    <p
                      className={cn(
                        "text-xs font-medium",
                        reversalPricePoint.direction === "BULLISH" ? "text-emerald-400" : "text-[#ec3b70]",
                      )}
                    >
                      ${source.level.toFixed(0)}
                    </p>
                    <p className="text-[8px] mt-0.5 text-white/40">{source.name}</p>
                  </div>
                ))}
              </div>

              {/* Reasoning */}
              {reversalPricePoint.reasoning && reversalPricePoint.reasoning.length > 0 && (
                <div className="p-2 bg-white/5 rounded-xl">
                  <p className="text-xs text-white/50 font-light leading-relaxed text-center">
                    {reversalPricePoint.reasoning[0]}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Key Factors */}
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
        <div className="mb-4 p-3 rounded-xl bg-black">
          <div className="flex justify-between text-xs text-white/40 mb-2">
            <span>Bearish</span>
            <span>Neutral</span>
            <span>Bullish</span>
          </div>
          <div className="h-1 rounded-full overflow-hidden flex bg-white/20 shadow-[0_0_8px_rgba(255,255,255,0.3)]">
            <div
              className="aurora-bar-bearish transition-all"
              style={{ width: `${(sellCount / totalActive) * 100}%` }}
            />
            <div
              className="bg-white/40 transition-all"
              style={{ width: `${((totalActive - buyCount - sellCount) / totalActive) * 100}%` }}
            />
            <div
              className="aurora-bar-bullish transition-all"
              style={{ width: `${(buyCount / totalActive) * 100}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-[#ec3b70] text-sm">{sellCount}</span>
            <span className="text-white/40 text-sm">{totalActive - buyCount - sellCount}</span>
            <span className="text-emerald-400 text-sm">{buyCount}</span>
          </div>
        </div>

        {/* Entry Checklist */}
        {strategy.action !== "WAIT" && (
          <div className="flex flex-wrap gap-2">
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
    </div>
  )
}
