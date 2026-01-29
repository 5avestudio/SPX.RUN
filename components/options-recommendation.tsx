"use client"

import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card"
import { ArrowUpCircle, ArrowDownCircle, MinusCircle, TrendingUp, TrendingDown } from "lucide-react"

interface OptionsRecommendationProps {
  signal: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL"
  confidence: number
  currentPrice: number
  rsi: number
  adx: number
  superTrendSignal: "BUY" | "SELL" | "HOLD"
  ewoSignal: "BUY" | "SELL" | "HOLD"
  bbDanger: boolean
  pivotR1: number
  pivotS1: number
}

export function OptionsRecommendation({
  signal,
  confidence,
  currentPrice,
  rsi,
  adx,
  superTrendSignal,
  ewoSignal,
  bbDanger,
  pivotR1,
  pivotS1,
}: OptionsRecommendationProps) {
  const isCall = signal === "STRONG_BUY" || signal === "BUY"
  const isPut = signal === "STRONG_SELL" || signal === "SELL"

  const distanceToR1 = pivotR1 - currentPrice
  const distanceToS1 = currentPrice - pivotS1

  const suggestedCallStrike = Math.ceil(currentPrice / 5) * 5
  const suggestedPutStrike = Math.floor(currentPrice / 5) * 5

  let bullishCount = 0
  let bearishCount = 0

  if (rsi < 40) bullishCount++
  if (rsi > 60) bearishCount++
  if (superTrendSignal === "BUY") bullishCount++
  if (superTrendSignal === "SELL") bearishCount++
  if (ewoSignal === "BUY") bullishCount++
  if (ewoSignal === "SELL") bearishCount++
  if (distanceToS1 < distanceToR1) bullishCount++
  if (distanceToR1 < distanceToS1) bearishCount++

  const optionType = bullishCount > bearishCount ? "CALL" : bearishCount > bullishCount ? "PUT" : "WAIT"

  return (
    <GlassCard
      variant={optionType === "CALL" ? "success" : optionType === "PUT" ? "danger" : "default"}
      className="overflow-hidden"
    >
      <GlassCardHeader>
        <div className="flex items-center justify-between">
          <GlassCardTitle>Options Recommendation</GlassCardTitle>
          <div className="px-4 py-1.5 rounded-full bg-white/10 border border-white/20">
            <span className="text-sm text-foreground/70">{confidence.toFixed(0)}% Confidence</span>
          </div>
        </div>
      </GlassCardHeader>

      <GlassCardContent className="space-y-5">
        {/* Main Recommendation */}
        <div
          className={`
          p-8 rounded-3xl text-center relative overflow-hidden
          ${
            optionType === "CALL"
              ? "bg-gradient-to-br from-emerald-500/15 to-teal-500/10"
              : optionType === "PUT"
                ? "bg-gradient-to-br from-rose-500/15 to-fuchsia-700/10"
                : "bg-white/5"
          }
        `}
        >
          <div className="flex items-center justify-center gap-4">
            {optionType === "CALL" ? (
              <ArrowUpCircle className="h-14 w-14 text-emerald-400" />
            ) : optionType === "PUT" ? (
              <ArrowDownCircle className="h-14 w-14 text-rose-400" />
            ) : (
              <MinusCircle className="h-14 w-14 text-foreground/30" />
            )}
            <div className="text-left">
              <p
                className={`text-4xl font-light tracking-tight ${
                  optionType === "CALL"
                    ? "text-emerald-400"
                    : optionType === "PUT"
                      ? "text-rose-400"
                      : "text-foreground/50"
                }`}
              >
                {optionType === "CALL" ? "BUY CALL" : optionType === "PUT" ? "BUY PUT" : "WAIT"}
              </p>
              <p className="text-foreground/40 font-light mt-1">
                {optionType === "CALL"
                  ? "Bullish — Price expected to rise"
                  : optionType === "PUT"
                    ? "Bearish — Price expected to fall"
                    : "Mixed signals — Stay patient"}
              </p>
            </div>
          </div>
        </div>

        {/* Strike Price Suggestions */}
        {optionType !== "WAIT" && (
          <div className="grid grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-white/5 text-center border border-white/10">
              <p className="text-xs text-foreground/40 uppercase tracking-wider">Suggested Strike</p>
              <p className="text-3xl font-light mt-2 text-foreground/90">
                ${optionType === "CALL" ? suggestedCallStrike : suggestedPutStrike}
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-white/5 text-center border border-white/10">
              <p className="text-xs text-foreground/40 uppercase tracking-wider">Target</p>
              <div className="flex items-center justify-center gap-2 mt-2">
                {optionType === "CALL" ? (
                  <TrendingUp className="h-5 w-5 text-emerald-400" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-rose-400" />
                )}
                <span className="text-3xl font-light text-foreground/90">
                  {(optionType === "CALL" ? pivotR1 : pivotS1).toFixed(0)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Indicator Summary */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "RSI", value: rsi.toFixed(0), bullish: rsi < 40, bearish: rsi > 60 },
            { label: "ADX", value: adx.toFixed(0), bullish: adx > 25, bearish: false },
            {
              label: "SuperTrend",
              value: superTrendSignal,
              bullish: superTrendSignal === "BUY",
              bearish: superTrendSignal === "SELL",
            },
            { label: "EWO", value: ewoSignal, bullish: ewoSignal === "BUY", bearish: ewoSignal === "SELL" },
          ].map((ind) => (
            <div
              key={ind.label}
              className={`p-3 rounded-xl text-center ${
                ind.bullish ? "bg-emerald-500/10" : ind.bearish ? "bg-rose-500/10" : "bg-white/5"
              }`}
            >
              <p className="text-xs text-foreground/40">{ind.label}</p>
              <p
                className={`text-lg font-light mt-1 ${
                  ind.bullish ? "text-emerald-400" : ind.bearish ? "text-rose-400" : "text-foreground/70"
                }`}
              >
                {ind.value}
              </p>
            </div>
          ))}
        </div>

        {/* Danger Warning */}
        {bbDanger && (
          <div className="p-4 bg-white/10 border border-white/20 rounded-2xl text-center">
            <p className="text-sm font-light text-white">Caution: Price near Bollinger Band extremes</p>
          </div>
        )}

        {/* Quick Stats */}
        <div className="flex justify-between text-sm text-foreground/40 pt-3 border-t border-white/10">
          <span>
            Bullish: <span className="text-emerald-400">{bullishCount}</span>
          </span>
          <span>
            Bearish: <span className="text-rose-400">{bearishCount}</span>
          </span>
          <span>
            To R1: <span className="text-foreground/60">{distanceToR1.toFixed(1)}</span>
          </span>
          <span>
            To S1: <span className="text-foreground/60">{distanceToS1.toFixed(1)}</span>
          </span>
        </div>
      </GlassCardContent>
    </GlassCard>
  )
}
