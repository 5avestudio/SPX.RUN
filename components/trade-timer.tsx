"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Play, Pause, RotateCcw, TrendingUp, TrendingDown, Target, CircleDot, Zap, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { TrendReversalWarning } from "@/lib/indicators"
import { SimulatedReturns } from "@/components/simulated-returns"
import { getWinRateFromSignal } from "@/components/signal-check-combined"
import { getSPXTimingWindow, isSPXFinalRush, getFinalRushStrikes } from "@/lib/market-data"
import { triggerHaptic } from "@/lib/haptics"
import { SignalOrb } from "@/components/signal-orb"

interface TradeTimerProps {
  signal: "BUY" | "SELL" | "HOLD"
  currentPrice: number
  budget: number
  className?: string
  reversalWarning?: TrendReversalWarning
  pivotLevels?: {
    pivot: number
    r1: number
    r2: number
    s1: number
    s2: number
  }
  rsi?: number
  indicators?: Array<{ name: string; signal: "buy" | "sell" | "hold" | "neutral" }>
  confidence?: number
  tradingSignal?: string
  autoStart?: boolean
  onTimerStart?: () => void
  onTimerEnd?: () => void
  priceChange?: number
  priceChangePercent?: number
  showCombinedView?: boolean
}

export function TradeTimer({
  signal,
  currentPrice,
  budget,
  className,
  reversalWarning,
  pivotLevels,
  rsi = 50,
  indicators = [],
  confidence = 50,
  tradingSignal = "HOLD",
  autoStart = false,
  onTimerStart,
  onTimerEnd,
  priceChange = 0,
  priceChangePercent = 0,
  showCombinedView = false,
}: TradeTimerProps) {
  // Exit Timer State
  const [isRunning, setIsRunning] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [maxSeconds] = useState(15 * 60) // 15 minutes max for SPX scalps

  // Signal tracking
  const [signalStartTime, setSignalStartTime] = useState<Date | null>(null)
  const previousSignalRef = useRef<"BUY" | "SELL" | "HOLD">(signal)
  const hasAutoStartedRef = useRef(false)

  const [timingWindow, setTimingWindow] = useState(getSPXTimingWindow())
  const [isFinalRush, setIsFinalRush] = useState(isSPXFinalRush())
  const [finalRushStrikes, setFinalRushStrikes] = useState<number[]>([])

  // Update timing window every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setTimingWindow(getSPXTimingWindow())
      setIsFinalRush(isSPXFinalRush())
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  // Update final rush strikes when price or signal changes
  useEffect(() => {
    if (isFinalRush && signal !== "HOLD") {
      const direction = signal === "BUY" ? "CALL" : "PUT"
      setFinalRushStrikes(getFinalRushStrikes(currentPrice, direction))
    }
  }, [isFinalRush, signal, currentPrice])

  useEffect(() => {
    if (signal !== previousSignalRef.current) {
      setSignalStartTime(new Date())
      previousSignalRef.current = signal

      // Auto-start timer on new signal during Final Rush or if autoStart prop is true
      if ((isFinalRush || autoStart) && signal !== "HOLD" && !hasAutoStartedRef.current) {
        setIsRunning(true)
        setElapsedSeconds(0)
        hasAutoStartedRef.current = true
        triggerHaptic("heavy")
        onTimerStart?.()
      }
    } else if (!signalStartTime && signal !== "HOLD") {
      setSignalStartTime(new Date())
    }

    // Reset auto-start flag when signal goes back to HOLD
    if (signal === "HOLD") {
      hasAutoStartedRef.current = false
    }
  }, [signal, signalStartTime, isFinalRush, autoStart, onTimerStart])

  // Exit Timer countdown
  useEffect(() => {
    if (!isRunning) return
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => {
        const newValue = prev + 1
        // Warn at 12 minutes (3 min remaining)
        if (newValue === 12 * 60) {
          triggerHaptic("warning")
        }
        // Alert at 14 minutes (1 min remaining)
        if (newValue === 14 * 60) {
          triggerHaptic("heavy")
        }
        // Stop at 15 minutes
        if (newValue >= maxSeconds) {
          setIsRunning(false)
          onTimerEnd?.()
          triggerHaptic("error")
          return maxSeconds
        }
        return newValue
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [isRunning, maxSeconds, onTimerEnd])

  const formatTime = useCallback((totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }, [])

  const handlePlayPause = () => {
    if (!isRunning) {
      onTimerStart?.()
    }
    setIsRunning(!isRunning)
  }

  const handleReset = () => {
    setIsRunning(false)
    setElapsedSeconds(0)
    hasAutoStartedRef.current = false
  }

  // Progress percentage (inverted - counts down from 15 min)
  const progressPercent = (elapsedSeconds / maxSeconds) * 100
  const timeRemaining = maxSeconds - elapsedSeconds
  const isUrgent = timeRemaining <= 3 * 60 // 3 minutes or less

  // Options calculations
  const getITMStrike = () => {
    if (signal === "BUY") {
      return Math.floor(currentPrice / 5) * 5
    } else if (signal === "SELL") {
      return Math.ceil(currentPrice / 5) * 5
    }
    return Math.round(currentPrice / 5) * 5
  }

  const getOTMStrike = () => {
    if (signal === "BUY") {
      return Math.ceil(currentPrice / 5) * 5 + 5
    } else if (signal === "SELL") {
      return Math.floor(currentPrice / 5) * 5 - 5
    }
    return Math.round(currentPrice / 5) * 5
  }

  const getEstimatedContracts = (isITM: boolean) => {
    const estimatedPremium = isITM ? 3.0 : 1.5
    const contractCost = estimatedPremium * 100
    return Math.floor(budget / contractCost)
  }

  const optionType = signal === "BUY" ? "CALL" : signal === "SELL" ? "PUT" : null
  const itmStrike = getITMStrike()
  const otmStrike = getOTMStrike()

  const signalColor = signal === "BUY" ? "text-emerald-400" : signal === "SELL" ? "text-[#ec3b70]" : "text-white/40"
  const signalBg =
    signal === "BUY"
      ? "bg-emerald-500/10 border-emerald-500/30"
      : signal === "SELL"
        ? "bg-[#ec3b70]/10 border-[#ec3b70]/30"
        : "bg-white/10 border-white/20"

  const isActiveWithTrend = isRunning && !isUrgent && signal !== "HOLD"
  const showGreen = isActiveWithTrend
  const showRed = !isRunning || isUrgent // Default to red, or red when urgent

  if (showCombinedView) {
    return (
      <div className={cn("space-y-4", className)}>
        {/* Aurora Signal Orb with Price */}
        <div className="flex flex-col items-center py-4">
          <SignalOrb signal={tradingSignal} confidence={confidence} />

          <div className="mt-6 text-center">
            <p className="text-5xl font-light tracking-tight">${currentPrice.toFixed(2)}</p>
            <p className={`text-lg mt-2 ${priceChange >= 0 ? "text-emerald-400" : "text-[#ec3b70]"}`}>
              {priceChange >= 0 ? "+" : ""}
              {priceChange.toFixed(2)} ({priceChangePercent.toFixed(2)}%)
            </p>
          </div>
        </div>

        {/* Timing Window Card */}
        {timingWindow.window !== "CLOSED" && (
          <div
            className={cn(
              "rounded-2xl p-4 border",
              timingWindow.action === "SCALP" || timingWindow.action === "ENTER"
                ? "bg-emerald-500/10 border-emerald-500/30"
                : timingWindow.action === "CAUTION"
                  ? "bg-[#ec3b70]/10 border-[#ec3b70]/30"
                  : "bg-white/5 border-white/10",
            )}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-xs uppercase tracking-wider">{timingWindow.label}</p>
                <p className="text-white/80 text-sm mt-1">{timingWindow.description}</p>
              </div>
              {timingWindow.minutesRemaining && (
                <div className="text-right">
                  <p className="text-white/40 text-xs">Until next window</p>
                  <p className="text-white font-medium">{timingWindow.minutesRemaining}m</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Final Rush Alert */}
        {isFinalRush && (
          <div className="apple-intelligence-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
              <span className="text-white font-semibold text-sm uppercase tracking-wider drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]">
                SPX Final Rush Active
              </span>
            </div>
            <p className="text-white/80 text-xs mb-3">
              $3-60 OTM entries 1-5 strikes away. Enter NOW, exit within 15 min!
            </p>
            {finalRushStrikes.length > 0 && signal !== "HOLD" && (
              <div className="flex flex-wrap gap-2">
                {finalRushStrikes.slice(0, 3).map((strike, i) => (
                  <div
                    key={strike}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium",
                      i === 0 ? "bg-white/20 text-white border border-white/30" : "bg-white/10 text-white/70",
                    )}
                  >
                    {optionType} ${strike}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Exit Timer - Integrated */}
        <div className="glass-frost rounded-2xl p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-white/40 text-center mb-6">
            {isFinalRush ? "Exit In" : "Exit Timer"}
          </p>

          {/* Circular Timer */}
          <div className="flex flex-col items-center">
            <div className="relative w-44 h-44 mb-6">
              <svg className="w-full h-full -rotate-90">
                <circle
                  cx="88"
                  cy="88"
                  r="80"
                  fill="none"
                  stroke={showGreen ? "rgba(16,185,129,0.3)" : "rgba(236,59,112,0.3)"}
                  strokeWidth="3"
                />
                <circle
                  cx="88"
                  cy="88"
                  r="80"
                  fill="none"
                  stroke={showGreen ? "#10b981" : "#ec3b70"}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={502}
                  strokeDashoffset={isRunning ? 502 - progressPercent * (502 / 100) : 0}
                  className="transition-all duration-1000"
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                  className={cn(
                    "text-5xl font-light tracking-tight",
                    showGreen ? "text-emerald-400" : "text-[#ec3b70]",
                  )}
                >
                  {isRunning ? formatTime(timeRemaining) : formatTime(elapsedSeconds)}
                </span>
                {isRunning && <span className="text-white/40 text-xs mt-1">remaining</span>}
              </div>
            </div>

            <button
              onClick={handlePlayPause}
              className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center transition-all mb-4",
                isFinalRush && !isRunning
                  ? "apple-intelligence-border"
                  : showGreen
                    ? "bg-emerald-500/20 border border-emerald-500/30 hover:bg-emerald-500/30"
                    : "bg-[#ec3b70]/20 border border-[#ec3b70]/30 hover:bg-[#ec3b70]/30",
              )}
            >
              {isRunning ? (
                <Pause className={cn("w-6 h-6", showGreen ? "text-emerald-400" : "text-[#ec3b70]")} />
              ) : (
                <Play className={cn("w-6 h-6 ml-1", isFinalRush ? "text-white" : "text-[#ec3b70]")} />
              )}
            </button>

            {/* Reset button */}
            {elapsedSeconds > 0 && (
              <button
                onClick={handleReset}
                className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all mb-4"
              >
                <RotateCcw className="w-4 h-4 text-white/50" />
              </button>
            )}

            <div className="flex items-center gap-2">
              {isRunning && isUrgent && <AlertTriangle className="w-4 h-4 text-[#ec3b70] animate-pulse" />}
              <div
                className={cn(
                  "w-2 h-2 rounded-full",
                  isRunning
                    ? showGreen
                      ? "bg-emerald-400 animate-pulse"
                      : "bg-[#ec3b70] animate-pulse"
                    : "bg-[#ec3b70]",
                )}
              />
              <p
                className={cn(
                  "text-xs uppercase tracking-[0.15em]",
                  showGreen ? "text-emerald-400/70" : "text-[#ec3b70]/70",
                )}
              >
                {isRunning ? (isUrgent ? "Exit now!" : "Trade active") : isFinalRush ? "Ready to scalp" : "Start : Run"}
              </p>
            </div>
          </div>
        </div>

        {/* Signal card */}
        <div className={cn("glass-frost rounded-2xl p-4 border", signalBg)}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {signal === "BUY" ? (
                <TrendingUp className={cn("w-4 h-4", signalColor)} />
              ) : signal === "SELL" ? (
                <TrendingDown className={cn("w-4 h-4", signalColor)} />
              ) : (
                <CircleDot className="w-4 h-4 text-white/40" />
              )}
              <p className="text-xs uppercase tracking-wider text-white/40">SuperTrend Signal</p>
            </div>
            {signalStartTime && signal !== "HOLD" && (
              <span className="text-white/40 text-xs">
                {signalStartTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>

          {optionType ? (
            <div className="grid grid-cols-2 gap-2">
              {/* ITM Option */}
              <div className="bg-white/5 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Target className={cn("w-3 h-3", signalColor)} />
                  <span className="text-xs text-white/50">ITM</span>
                </div>
                <p className={cn("text-lg font-medium", signalColor)}>
                  {optionType} ${itmStrike}
                </p>
                <p className="text-white/40 text-xs">~{getEstimatedContracts(true)} contracts</p>
              </div>

              {/* OTM Option */}
              <div className={cn("rounded-xl p-3", isFinalRush ? "bg-white/10 border border-white/20" : "bg-white/5")}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Target className="w-3 h-3 text-white/40" />
                  <span className="text-xs text-white/50">OTM</span>
                  {isFinalRush && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/20 text-white ml-auto">Target</span>
                  )}
                </div>
                <p
                  className={cn(
                    "text-lg font-medium",
                    isFinalRush ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]" : "text-white/70",
                  )}
                >
                  {optionType} ${otmStrike}
                </p>
                <p className="text-white/40 text-xs">~{getEstimatedContracts(false)} contracts</p>
              </div>
            </div>
          ) : (
            <p className="text-white/40 text-sm text-center py-2">Waiting for signal...</p>
          )}
        </div>

        {pivotLevels && (
          <SimulatedReturns
            budget={budget}
            winRate={getWinRateFromSignal(
              tradingSignal as any,
              indicators,
              currentPrice,
              { s1: pivotLevels.s1, r1: pivotLevels.r1 },
              rsi,
            )}
          />
        )}
      </div>
    )
  }

  return (
    <div className={cn("space-y-3", className)}>
      {isFinalRush && (
        <div className="apple-intelligence-border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
            <span className="text-white font-semibold text-sm uppercase tracking-wider drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]">
              SPX Final Rush Active
            </span>
          </div>
          <p className="text-white/80 text-xs mb-3">
            $3-60 OTM entries 1-5 strikes away. Enter NOW, exit within 15 min!
          </p>
          {finalRushStrikes.length > 0 && signal !== "HOLD" && (
            <div className="flex flex-wrap gap-2">
              {finalRushStrikes.slice(0, 3).map((strike, i) => (
                <div
                  key={strike}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium",
                    i === 0 ? "bg-white/20 text-white border border-white/30" : "bg-white/10 text-white/70",
                  )}
                >
                  {optionType} ${strike}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!isFinalRush && timingWindow.window !== "CLOSED" && (
        <div
          className={cn(
            "rounded-2xl p-4 border",
            timingWindow.action === "SCALP" || timingWindow.action === "ENTER"
              ? "bg-emerald-500/10 border-emerald-500/30"
              : timingWindow.action === "CAUTION"
                ? "bg-[#ec3b70]/10 border-[#ec3b70]/30"
                : "bg-white/5 border-white/10",
          )}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-xs uppercase tracking-wider">{timingWindow.label}</p>
              <p className="text-white/80 text-sm mt-1">{timingWindow.description}</p>
            </div>
            {timingWindow.minutesRemaining && (
              <div className="text-right">
                <p className="text-white/40 text-xs">Until next window</p>
                <p className="text-white font-medium">{timingWindow.minutesRemaining}m</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="glass-frost rounded-2xl p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-white/40 text-center mb-6">
          {isFinalRush ? "Exit In" : "Exit Timer"}
        </p>

        {/* Circular Timer */}
        <div className="flex flex-col items-center">
          <div className="relative w-44 h-44 mb-6">
            <svg className="w-full h-full -rotate-90">
              <circle
                cx="88"
                cy="88"
                r="80"
                fill="none"
                stroke={showGreen ? "rgba(16,185,129,0.3)" : "rgba(236,59,112,0.3)"}
                strokeWidth="3"
              />
              <circle
                cx="88"
                cy="88"
                r="80"
                fill="none"
                stroke={showGreen ? "#10b981" : "#ec3b70"}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={502}
                strokeDashoffset={isRunning ? 502 - progressPercent * (502 / 100) : 0}
                className="transition-all duration-1000"
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className={cn("text-5xl font-light tracking-tight", showGreen ? "text-emerald-400" : "text-[#ec3b70]")}
              >
                {isRunning ? formatTime(timeRemaining) : formatTime(elapsedSeconds)}
              </span>
              {isRunning && <span className="text-white/40 text-xs mt-1">remaining</span>}
            </div>
          </div>

          <button
            onClick={handlePlayPause}
            className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center transition-all mb-4",
              isFinalRush && !isRunning
                ? "apple-intelligence-border"
                : showGreen
                  ? "bg-emerald-500/20 border border-emerald-500/30 hover:bg-emerald-500/30"
                  : "bg-[#ec3b70]/20 border border-[#ec3b70]/30 hover:bg-[#ec3b70]/30",
            )}
          >
            {isRunning ? (
              <Pause className={cn("w-6 h-6", showGreen ? "text-emerald-400" : "text-[#ec3b70]")} />
            ) : (
              <Play className={cn("w-6 h-6 ml-1", isFinalRush ? "text-white" : "text-[#ec3b70]")} />
            )}
          </button>

          {/* Reset button */}
          {elapsedSeconds > 0 && (
            <button
              onClick={handleReset}
              className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all mb-4"
            >
              <RotateCcw className="w-4 h-4 text-white/50" />
            </button>
          )}

          <div className="flex items-center gap-2">
            {isRunning && isUrgent && <AlertTriangle className="w-4 h-4 text-[#ec3b70] animate-pulse" />}
            <div
              className={cn(
                "w-2 h-2 rounded-full",
                isRunning
                  ? showGreen
                    ? "bg-emerald-400 animate-pulse"
                    : "bg-[#ec3b70] animate-pulse"
                  : "bg-[#ec3b70]",
              )}
            />
            <p
              className={cn(
                "text-xs uppercase tracking-[0.15em]",
                showGreen ? "text-emerald-400/70" : "text-[#ec3b70]/70",
              )}
            >
              {isRunning ? (isUrgent ? "Exit now!" : "Trade active") : isFinalRush ? "Ready to scalp" : "Start : Run"}
            </p>
          </div>
        </div>
      </div>

      {/* Signal card */}
      <div className={cn("glass-frost rounded-2xl p-4 border", signalBg)}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {signal === "BUY" ? (
              <TrendingUp className={cn("w-4 h-4", signalColor)} />
            ) : signal === "SELL" ? (
              <TrendingDown className={cn("w-4 h-4", signalColor)} />
            ) : (
              <CircleDot className="w-4 h-4 text-white/40" />
            )}
            <p className="text-xs uppercase tracking-wider text-white/40">SuperTrend Signal</p>
          </div>
          {signalStartTime && signal !== "HOLD" && (
            <span className="text-white/40 text-xs">
              {signalStartTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>

        {optionType ? (
          <div className="grid grid-cols-2 gap-2">
            {/* ITM Option */}
            <div className="bg-white/5 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Target className={cn("w-3 h-3", signalColor)} />
                <span className="text-xs text-white/50">ITM</span>
              </div>
              <p className={cn("text-lg font-medium", signalColor)}>
                {optionType} ${itmStrike}
              </p>
              <p className="text-white/40 text-xs">~{getEstimatedContracts(true)} contracts</p>
            </div>

            {/* OTM Option */}
            <div className={cn("rounded-xl p-3", isFinalRush ? "bg-white/10 border border-white/20" : "bg-white/5")}>
              <div className="flex items-center gap-1.5 mb-1">
                <Target className="w-3 h-3 text-white/40" />
                <span className="text-xs text-white/50">OTM</span>
                {isFinalRush && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/20 text-white ml-auto">Target</span>
                )}
              </div>
              <p
                className={cn(
                  "text-lg font-medium",
                  isFinalRush ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]" : "text-white/70",
                )}
              >
                {optionType} ${otmStrike}
              </p>
              <p className="text-white/40 text-xs">~{getEstimatedContracts(false)} contracts</p>
            </div>
          </div>
        ) : (
          <p className="text-white/40 text-sm text-center py-2">Waiting for signal...</p>
        )}
      </div>

      {pivotLevels && (
        <SimulatedReturns
          budget={budget}
          winRate={getWinRateFromSignal(
            tradingSignal as any,
            indicators,
            currentPrice,
            { s1: pivotLevels.s1, r1: pivotLevels.r1 },
            rsi,
          )}
        />
      )}
    </div>
  )
}
