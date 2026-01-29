"use client"

import { useState, useEffect, useRef } from "react"
import { ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  analyzeIndicators,
  checkADXExitWarning,
  POWER_HOUR_THRESHOLDS,
  type IndicatorState,
  type SignalResult,
} from "@/lib/indicator-analysis"

interface PowerHourIndicator {
  name: string
  shortName: string
  value: number
  min: number
  max: number
  signal: "bullish" | "bearish" | "neutral" | "warning"
  description: string
  detail: string
}

interface PowerHourPanelProps {
  vwapPosition: number
  rsi: number
  rvol: number
  atrSlope: number
  ewo: number
  currentPrice: number
  vwap: number
  adx?: number
  adxPrevious?: number
  adxPeak?: number
  macdHistogram?: number
  isOpen?: boolean
  onToggle?: () => void
  className?: string
}

export function PowerHourPanel({
  vwapPosition = 0,
  rsi = 50,
  rvol = 1,
  atrSlope = 0,
  ewo = 0,
  currentPrice = 0,
  vwap = 0,
  adx = 20,
  adxPrevious = 20,
  adxPeak = 20,
  macdHistogram = 0,
  isOpen: externalIsOpen,
  onToggle: externalOnToggle,
  className,
}: PowerHourPanelProps) {
  const [internalExpanded, setInternalExpanded] = useState(false)
  const [signalResult, setSignalResult] = useState<SignalResult | null>(null)
  const [exitWarning, setExitWarning] = useState<{ shouldExit: boolean; reason: string } | null>(null)

  const isExpanded = externalIsOpen !== undefined ? externalIsOpen : internalExpanded
  const handleToggle = externalOnToggle || (() => setInternalExpanded(!internalExpanded))

  // Track ADX peak
  const adxPeakRef = useRef(adxPeak)
  useEffect(() => {
    if (adx > adxPeakRef.current) {
      adxPeakRef.current = adx
    }
  }, [adx])

  const T = POWER_HOUR_THRESHOLDS

  const indicators: PowerHourIndicator[] = [
    {
      name: "ADX Trend",
      shortName: "ADX",
      value: Math.min(adx, 100),
      min: 0,
      max: 100,
      signal:
        adx >= T.adx.strongTrend ? (ewo > 0 ? "bullish" : "bearish") : adx < T.adx.exitWarning ? "warning" : "neutral",
      description: adx.toFixed(1),
      detail:
        adx >= T.adx.strongTrend
          ? "Strong Trend"
          : adx >= T.adx.entryMin
            ? "Trending"
            : adx < T.adx.exitWarning
              ? "NO TREND"
              : "Weak",
    },
    {
      name: "VWAP Position",
      shortName: "VWAP",
      value: Math.min(Math.max((vwapPosition + 100) / 2, 0), 100),
      min: 0,
      max: 100,
      signal:
        Math.abs(vwapPosition) > T.vwap.deviationThreshold * 10
          ? vwapPosition > 0
            ? "bullish"
            : "bearish"
          : "neutral",
      description:
        vwap > 0 && currentPrice > vwap
          ? `+${(((currentPrice - vwap) / vwap) * 100).toFixed(2)}%`
          : vwap > 0
            ? `${(((currentPrice - vwap) / vwap) * 100).toFixed(2)}%`
            : "N/A",
      detail: currentPrice > vwap ? "Above VWAP" : "Below VWAP",
    },
    {
      name: "RSI",
      shortName: "RSI",
      value: rsi,
      min: 0,
      max: 100,
      signal:
        rsi < T.rsi.oversold
          ? "bullish"
          : rsi > T.rsi.overbought
            ? "bearish"
            : rsi > T.rsi.avoidZone[0] && rsi < T.rsi.avoidZone[1]
              ? "warning"
              : "neutral",
      description: `${rsi.toFixed(0)}`,
      detail:
        rsi < T.rsi.oversold
          ? "Oversold"
          : rsi > T.rsi.overbought
            ? "Overbought"
            : rsi > T.rsi.avoidZone[0] && rsi < T.rsi.avoidZone[1]
              ? "Chop Zone"
              : "Neutral",
    },
    {
      name: "Relative Volume",
      shortName: "RVOL",
      value: Math.min(rvol * 50, 100),
      min: 0,
      max: 100,
      signal:
        rvol >= T.rvol.spikeThreshold
          ? ewo > 0
            ? "bullish"
            : "bearish"
          : rvol < T.rvol.confirmationThreshold
            ? "warning"
            : "neutral",
      description: `${rvol.toFixed(1)}x`,
      detail: rvol >= T.rvol.spikeThreshold ? "SPIKE" : rvol >= T.rvol.confirmationThreshold ? "Elevated" : "Low Vol",
    },
    {
      name: "Elliott Wave",
      shortName: "EWO",
      value: Math.min(Math.max((ewo + 10) * 5, 0), 100),
      min: 0,
      max: 100,
      signal:
        ewo >= T.ewo.bullishEntry
          ? "bullish"
          : ewo <= T.ewo.bearishEntry
            ? "bearish"
            : ewo > T.ewo.neutralZone[0] && ewo < T.ewo.neutralZone[1]
              ? "warning"
              : "neutral",
      description: ewo > 0 ? `+${ewo.toFixed(1)}` : ewo.toFixed(1),
      detail:
        ewo >= T.ewo.bullishEntry
          ? "Strong Bull"
          : ewo <= T.ewo.bearishEntry
            ? "Strong Bear"
            : ewo > T.ewo.neutralZone[0] && ewo < T.ewo.neutralZone[1]
              ? "No Momentum"
              : "Weak",
    },
  ]

  useEffect(() => {
    const state: IndicatorState = {
      adx,
      adxSlope: adx - adxPrevious,
      ewo,
      rvol,
      rsi,
      vwapDeviation: vwapPosition / 10, // Convert to sigma estimate
      macdHistogram,
    }

    const result = analyzeIndicators(state)
    setSignalResult(result)

    // Check for ADX exit warning
    const warning = checkADXExitWarning(adx, adxPrevious, adxPeakRef.current)
    setExitWarning(warning)
  }, [vwapPosition, rsi, rvol, atrSlope, ewo, adx, adxPrevious, macdHistogram])

  const allAligned = signalResult?.signal === "strong_bullish" || signalResult?.signal === "strong_bearish"
  const alignmentDirection =
    signalResult?.signal === "strong_bullish" ? "bullish" : signalResult?.signal === "strong_bearish" ? "bearish" : null
  const hasWarnings = (signalResult?.warnings.length ?? 0) > 0 || exitWarning !== null

  return (
    <>
      {/* Rainbow border glow effect when aligned */}
      {allAligned && (
        <div
          className={cn(
            "fixed inset-0 pointer-events-none z-[100]",
            alignmentDirection === "bullish" ? "screen-border-bullish" : "screen-border-bearish",
          )}
          aria-hidden="true"
        />
      )}

      {/* Main drawer container - adjusted positioning and width to not overlap with options panel */}
      <div
        className={cn(
          "fixed top-0 right-0 z-40 h-screen flex transition-transform duration-300 ease-out",
          isExpanded ? "items-center" : "items-start pt-[calc(57vh+50px)]",
          isExpanded ? "translate-x-0" : "translate-x-[calc(100%-28px)]",
          className,
        )}
      >
        <button
          onClick={handleToggle}
          className={cn(
            "flex items-center justify-center w-7 h-16 rounded-l-2xl",
            "bg-gradient-to-r from-black/80 to-transparent backdrop-blur-sm",
            "transition-all duration-200",
          )}
        >
          <div className="flex flex-col items-center gap-1">
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                exitWarning
                  ? "bg-white animate-pulse shadow-[0_0_6px_rgba(255,255,255,0.8)]"
                  : allAligned && alignmentDirection === "bullish"
                    ? "bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]"
                    : allAligned && alignmentDirection === "bearish"
                      ? "bg-[#ec3b70] animate-pulse shadow-[0_0_6px_rgba(236,59,112,0.8)]"
                      : "bg-emerald-400",
              )}
            />
            {isExpanded ? (
              <ChevronRight className="w-4 h-4 text-white/70" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-white/70" />
            )}
          </div>
        </button>

        <div
          className={cn(
            "bg-gradient-to-l from-black/90 via-black/70 to-transparent backdrop-blur-md",
            "w-[160px] py-4 px-3 rounded-l-2xl",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4 px-1">
            <span className="text-[10px] uppercase tracking-widest text-white/40">Power Hour</span>
            <span
              className={cn(
                "text-[10px] font-medium",
                allAligned
                  ? alignmentDirection === "bullish"
                    ? "text-emerald-400"
                    : "text-[#ec3b70]"
                  : hasWarnings
                    ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]"
                    : "text-white/40",
              )}
            >
              {signalResult?.alignedCount ?? 0}/5
            </span>
          </div>

          {exitWarning && (
            <div className="mb-3 py-2 px-2 rounded-lg bg-white/20 border border-white/30">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] flex-shrink-0" />
                <span className="text-[10px] font-semibold text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] uppercase">
                  EXIT WARNING
                </span>
              </div>
              <p className="text-[9px] text-white/80 mt-1 leading-tight">{exitWarning.reason}</p>
            </div>
          )}

          {/* Indicator gauges */}
          <div className="space-y-3">
            {indicators.map((indicator, idx) => (
              <ExpandedGauge key={indicator.name} indicator={indicator} priority={idx + 1} />
            ))}
          </div>

          {signalResult && signalResult.warnings.length > 0 && !exitWarning && (
            <div className="mt-3 py-2 px-2 rounded-lg bg-white/5 border border-white/10">
              <span className="text-[9px] text-white/40 uppercase">Warnings:</span>
              {signalResult.warnings.slice(0, 2).map((warning, i) => (
                <p key={i} className="text-[9px] text-white/70 mt-0.5 leading-tight">
                  • {warning}
                </p>
              ))}
            </div>
          )}

          {/* Action indicator */}
          {signalResult && (
            <div
              className={cn(
                "mt-4 py-2 px-3 rounded-xl text-center",
                "border transition-all",
                signalResult.signal === "strong_bullish"
                  ? "bg-emerald-500/10 border-emerald-500/30"
                  : signalResult.signal === "strong_bearish"
                    ? "bg-[#ec3b70]/10 border-[#ec3b70]/30"
                    : signalResult.signal === "avoid" || exitWarning
                      ? "bg-white/10 border-white/30"
                      : "bg-white/5 border-white/10",
              )}
            >
              <div
                className={cn(
                  "text-xs font-semibold uppercase tracking-wider",
                  signalResult.signal === "strong_bullish"
                    ? "text-emerald-400"
                    : signalResult.signal === "strong_bearish"
                      ? "text-[#ec3b70]"
                      : signalResult.signal === "avoid" || exitWarning
                        ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]"
                        : "text-white/50",
                )}
              >
                {exitWarning ? "EXIT NOW" : signalResult.recommendation.split(" - ")[0]}
              </div>
              <div className="text-[9px] text-white/40 mt-0.5">{signalResult.confidence}% confidence</div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function ExpandedGauge({
  indicator,
  priority,
}: {
  indicator: PowerHourIndicator
  priority: number
}) {
  const range = indicator.max - indicator.min
  const percentage = range === 0 ? 0 : ((indicator.value - indicator.min) / range) * 100
  const safePercentage = isNaN(percentage) ? 0 : Math.max(0, Math.min(100, percentage))
  const circumference = 2 * Math.PI * 18
  const strokeDashoffset = circumference - (safePercentage / 100) * circumference

  const signalColor = {
    bullish: "text-emerald-400",
    bearish: "text-[#ec3b70]",
    neutral: "text-white/50",
    warning: "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]",
  }[indicator.signal]

  const strokeColor = {
    bullish: "stroke-emerald-400",
    bearish: "stroke-[#ec3b70]",
    neutral: "stroke-white/20",
    warning: "stroke-white",
  }[indicator.signal]

  const bgGlow = {
    bullish: "shadow-[0_0_8px_rgba(16,185,129,0.15)]",
    bearish: "shadow-[0_0_8px_rgba(236,59,112,0.15)]",
    neutral: "",
    warning: "shadow-[0_0_8px_rgba(255,255,255,0.15)]",
  }[indicator.signal]

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-2 rounded-xl",
        "bg-white/5 border border-white/5",
        indicator.signal !== "neutral" && bgGlow,
      )}
    >
      {/* Circular gauge */}
      <div className="relative w-11 h-11 flex-shrink-0">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r="18" fill="none" stroke="currentColor" strokeWidth="3" className="text-white/10" />
          <circle
            cx="22"
            cy="22"
            r="18"
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={cn(strokeColor, "transition-all duration-500")}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("text-sm font-bold", signalColor)}>{priority}</span>
        </div>
      </div>

      {/* Label and values */}
      <div className="flex flex-col min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-white/40 uppercase tracking-wider">{indicator.shortName}</span>
          <span className={cn("text-sm font-semibold tabular-nums", signalColor)}>{indicator.description}</span>
        </div>
        <span className={cn("text-[9px] mt-0.5", indicator.signal === "warning" ? "text-white/70" : "text-white/30")}>
          {indicator.detail}
        </span>
      </div>
    </div>
  )
}
