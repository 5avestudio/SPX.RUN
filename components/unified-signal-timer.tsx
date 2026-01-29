"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { cn } from "@/lib/utils"
import { ArrowRight, Pause, RotateCcw, TrendingUp, TrendingDown, X, AlertTriangle } from "lucide-react"
import { triggerHaptic } from "@/lib/haptics"

interface SelectedOption {
  type: "CALL" | "PUT"
  strike: number
  moneyness: string
  entryPrice: number
  targetPrice: number
  winRate: number
  targetDuration?: string
}

interface UnifiedSignalTimerProps {
  signal: "BUY" | "SELL" | "HOLD"
  currentPrice: number
  pivotPoint?: number
  s1?: number
  r1?: number
  budget: number
  rsi?: number
  indicators?: Array<{ name: string; signal: string }>
  confidence?: number
  priceChange?: number
  priceChangePercent?: number
  showCombinedView?: boolean
  selectedOption?: SelectedOption | null
  onClearSelectedOption?: () => void
  externalIsRunning?: boolean
  onExternalStart?: () => void
  onTimerEnd?: () => void
  chartSentiment?: "Bullish" | "Bearish" | "Neutral"
  exitWarning?: {
    show: boolean
    message: string
    confidence: number
  }
}

function parseDuration(duration?: string): { minMinutes: number; maxMinutes: number } {
  if (!duration) return { minMinutes: 5, maxMinutes: 15 }
  const match = duration.match(/(\d+)-(\d+)/)
  if (match) {
    return { minMinutes: Number.parseInt(match[1]), maxMinutes: Number.parseInt(match[2]) }
  }
  return { minMinutes: 5, maxMinutes: 15 }
}

function UnifiedSignalTimer({
  signal,
  currentPrice,
  pivotPoint = 0,
  s1 = 0,
  r1 = 0,
  budget,
  rsi = 50,
  indicators,
  confidence = 0,
  priceChange = 0,
  priceChangePercent = 0,
  selectedOption,
  onClearSelectedOption,
  externalIsRunning,
  onExternalStart,
  onTimerEnd,
  chartSentiment = "Neutral",
  exitWarning,
}: UnifiedSignalTimerProps) {
  const { minMinutes, maxMinutes } = useMemo(
    () => parseDuration(selectedOption?.targetDuration),
    [selectedOption?.targetDuration],
  )

  const maxSeconds = maxMinutes * 60
  const minSeconds = minMinutes * 60

  const [isRunning, setIsRunning] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(maxSeconds)
  const [currentPhase, setCurrentPhase] = useState<"HOLD" | "SELL" | "EXIT">("HOLD")

  const [isBlinking, setIsBlinking] = useState(false)
  const [blinkCount, setBlinkCount] = useState(0)
  const [isPulsing, setIsPulsing] = useState(false)
  const [pulseSpeed, setPulseSpeed] = useState<"normal" | "fast">("normal")
  const [showExitMessage, setShowExitMessage] = useState(false)
  const timerCompletedRef = useRef(false)
  const blinkIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const pulseIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const isInExitPhase = useMemo(() => {
    const elapsed = maxSeconds - timeRemaining
    const holdDuration = minSeconds // Hold phase is the minimum duration
    return elapsed > holdDuration
  }, [timeRemaining, maxSeconds, minSeconds])

  useEffect(() => {
    setTimeRemaining(maxSeconds)
  }, [maxSeconds])

  // Sync with external running state
  useEffect(() => {
    if (externalIsRunning !== undefined) {
      setIsRunning(externalIsRunning)
    }
  }, [externalIsRunning])

  const progressInfo = useMemo(() => {
    const elapsed = maxSeconds - timeRemaining
    const holdDuration = minSeconds // Hold phase is the minimum duration
    const exitDuration = maxSeconds - minSeconds // Exit phase is max - min

    // Progress is based on elapsed time within the exit phase
    if (elapsed <= holdDuration) {
      // Still in hold phase
      return { percent: 0, phase: "HOLD" as const, inExitPhase: false }
    } else {
      // In exit phase - calculate percentage of exit duration
      const exitElapsed = elapsed - holdDuration
      const percent = Math.min((exitElapsed / exitDuration) * 100, 100)
      return { percent, phase: percent >= 99 ? ("EXIT" as const) : ("SELL" as const), inExitPhase: true }
    }
  }, [timeRemaining, maxSeconds, minSeconds])

  useEffect(() => {
    if (!isRunning) {
      // Clear all effects when not running
      setIsPulsing(false)
      setIsBlinking(false)
      setBlinkCount(0)
      setPulseSpeed("normal")
      setShowExitMessage(false)
      if (blinkIntervalRef.current) clearInterval(blinkIntervalRef.current)
      if (pulseIntervalRef.current) clearInterval(pulseIntervalRef.current)
      return
    }

    const { percent, inExitPhase } = progressInfo

    // Phase effects based on percentage
    if (inExitPhase) {
      // Start pulsing when entering exit phase (0%)
      if (!isPulsing) {
        setIsPulsing(true)
        setPulseSpeed("normal")
      }

      // 50% - Double speed pulsation
      if (percent >= 50 && pulseSpeed !== "fast") {
        setPulseSpeed("fast")
      }

      // 75% - Start blinking (single blink)
      if (percent >= 75 && percent < 90) {
        if (blinkIntervalRef.current) clearInterval(blinkIntervalRef.current)
        blinkIntervalRef.current = setInterval(() => {
          setBlinkCount(1)
          setIsBlinking(true)
          triggerHaptic("medium")
          setTimeout(() => setIsBlinking(false), 150)
        }, 1000)
      }

      // 90% - Double blink every second
      if (percent >= 90 && percent < 95) {
        if (blinkIntervalRef.current) clearInterval(blinkIntervalRef.current)
        blinkIntervalRef.current = setInterval(() => {
          setBlinkCount(2)
          // First blink
          setIsBlinking(true)
          triggerHaptic("heavy")
          setTimeout(() => {
            setIsBlinking(false)
            // Second blink
            setTimeout(() => {
              setIsBlinking(true)
              triggerHaptic("heavy")
              setTimeout(() => setIsBlinking(false), 150)
            }, 200)
          }, 150)
        }, 1000)
      }

      // 95% - Triple blink
      if (percent >= 95 && percent < 99) {
        if (blinkIntervalRef.current) clearInterval(blinkIntervalRef.current)
        blinkIntervalRef.current = setInterval(() => {
          setBlinkCount(3)
          const doBlink = (count: number) => {
            if (count <= 0) return
            setIsBlinking(true)
            triggerHaptic("heavy")
            setTimeout(() => {
              setIsBlinking(false)
              setTimeout(() => doBlink(count - 1), 150)
            }, 150)
          }
          doBlink(3)
        }, 1000)
      }

      // 99% - Show exit message
      if (percent >= 99) {
        setShowExitMessage(true)
        if (blinkIntervalRef.current) clearInterval(blinkIntervalRef.current)
        // Continuous rapid blinking
        blinkIntervalRef.current = setInterval(() => {
          setIsBlinking(true)
          triggerHaptic("heavy")
          setTimeout(() => setIsBlinking(false), 100)
        }, 250)
      }
    } else {
      // Clear effects if not in exit phase
      setIsPulsing(false)
      setIsBlinking(false)
      setPulseSpeed("normal")
    }

    return () => {
      if (blinkIntervalRef.current) clearInterval(blinkIntervalRef.current)
    }
  }, [isRunning, progressInfo, isPulsing, pulseSpeed])

  useEffect(() => {
    if (timerCompletedRef.current && timeRemaining === 0 && !isRunning) {
      timerCompletedRef.current = false
      onTimerEnd?.()
    }
  }, [timeRemaining, isRunning, onTimerEnd])

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    if (isRunning && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            timerCompletedRef.current = true
            setIsRunning(false)
            triggerHaptic("heavy")
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isRunning, timeRemaining])

  // Update phase based on progress
  useEffect(() => {
    setCurrentPhase(progressInfo.phase)
  }, [progressInfo.phase])

  const handlePlayPause = useCallback(() => {
    triggerHaptic("medium")
    if (!isRunning) {
      onExternalStart?.()
      setTimeRemaining(maxSeconds) // Reset to max duration when starting
    }
    setIsRunning(!isRunning)
  }, [isRunning, onExternalStart, maxSeconds])

  const handleReset = useCallback(() => {
    triggerHaptic("light")
    setIsRunning(false)
    setTimeRemaining(maxSeconds)
    setCurrentPhase("HOLD")
    setIsPulsing(false)
    setIsBlinking(false)
    setShowExitMessage(false)
    timerCompletedRef.current = false
    if (blinkIntervalRef.current) clearInterval(blinkIntervalRef.current)
  }, [maxSeconds])

  // Timer display
  const displayMinutes = Math.floor(timeRemaining / 60)
  const displaySeconds = timeRemaining % 60

  // Progress calculation for ring
  const ringProgress = ((maxSeconds - timeRemaining) / maxSeconds) * 100

  // Timer colors based on phase - Always red ring, never green
  const timerRingColor = "#ec3b70"
  const timerTextColor = "#ec3b70"

  // Orb colors - Always red orb, never green
  const orbColors = useMemo(() => {
    if (!isRunning) return { primary: "#ec3b70", secondary: "#ec3b70" }
    if (isInExitPhase) return { primary: "#ec3b70", secondary: "#dc2626" }
    return { primary: "#ec3b70", secondary: "#ec3b70" }
  }, [isRunning, isInExitPhase])

  // Get SuperTrend direction
  const superTrendDirection = indicators?.find((ind) => ind.name === "ST")?.signal?.toUpperCase() || signal

  // Calculate entry/exit info
  const entryInfo = useMemo(() => {
    const pp = pivotPoint
    const distanceFromPP = currentPrice - pp
    const entryType = distanceFromPP > 0 ? "PUT" : distanceFromPP < 0 ? "CALL" : "HOLD"

    let targetPrice = pp
    let action = "Wait for PP"

    if (entryType === "CALL") {
      targetPrice = r1
      action = distanceFromPP < -5 ? "Strong Buy" : "Buy Near PP"
    } else if (entryType === "PUT") {
      targetPrice = s1
      action = distanceFromPP > 5 ? "Strong Sell" : "Sell Near PP"
    }

    const exitPrice = entryType === "CALL" ? s1 : r1
    const exitDistance = currentPrice - exitPrice

    return {
      price: pp,
      distance: Math.abs(distanceFromPP),
      distanceText: `$${Math.abs(distanceFromPP).toFixed(2)} ${distanceFromPP >= 0 ? "above" : "below"}`,
      exitPrice,
      exitDistance: Math.abs(exitDistance),
      exitDistanceText: `$${Math.abs(exitDistance).toFixed(2)} ${exitDistance >= 0 ? "above" : "below"}`,
      entryType,
      action,
    }
  }, [currentPrice, pivotPoint, s1, r1])

  // Display sentiment from chart
  const displaySentiment = chartSentiment

  const pulseClass = isPulsing
    ? pulseSpeed === "fast"
      ? "animate-[pulse_0.5s_ease-in-out_infinite]"
      : "animate-[pulse_1s_ease-in-out_infinite]"
    : ""

  const shouldShowExitNow = useMemo(() => {
    return exitWarning?.show && exitWarning.confidence >= 65
  }, [exitWarning])

  const shouldShowExitWarning = useMemo(() => {
    return exitWarning?.show && exitWarning.confidence >= 40 && exitWarning.confidence < 65
  }, [exitWarning])

  return (
    <div className="flex flex-col items-center w-full">
      {/* Selected option banner when running */}
      {isRunning && selectedOption && (
        <div className="mb-2 px-2.5 py-1.5 rounded-full bg-black/60 border border-white/10 backdrop-blur-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <div
            className={cn(
              "w-5 h-5 rounded-lg flex items-center justify-center",
              selectedOption.type === "CALL" ? "bg-emerald-500/20" : "bg-[#ec3b70]/20",
            )}
          >
            {selectedOption.type === "CALL" ? (
              <TrendingUp className="w-3 h-3 text-emerald-400" />
            ) : (
              <TrendingDown className="w-3 h-3 text-[#ec3b70]" />
            )}
          </div>
          <div className="text-left">
            <p
              className={cn(
                "text-[11px] font-medium",
                selectedOption.type === "CALL" ? "text-emerald-400" : "text-[#ec3b70]",
              )}
            >
              {selectedOption.moneyness} {selectedOption.type} ${selectedOption.strike}
            </p>
            <p className="text-[9px] text-white/50">
              Entry ${selectedOption.entryPrice} → Target ${selectedOption.targetPrice}
            </p>
          </div>
          <div className="text-[9px] text-white/40 px-1.5">
            {minMinutes}-{maxMinutes}m
          </div>
          <div
            className={cn(
              "px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider",
              isInExitPhase ? "bg-[#ec3b70]/20 text-[#ec3b70]" : "bg-emerald-500/20 text-emerald-400",
            )}
          >
            {currentPhase}
          </div>
          <button
            onClick={() => {
              triggerHaptic("light")
              onClearSelectedOption?.()
            }}
            className="ml-1 p-1 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-3 h-3 text-white/40" />
          </button>
        </div>
      )}

      {showExitMessage && isRunning && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="bg-red-500/90 text-white px-6 py-3 rounded-xl animate-bounce shadow-[0_0_30px_rgba(239,68,68,0.8)]">
            <p className="text-lg font-bold uppercase tracking-wider">EXIT NOW!</p>
          </div>
        </div>
      )}

      <div className="relative flex flex-col items-center mt-2.5">
        {/* Reset button positioned top-right of timer */}
        <button
          onClick={handleReset}
          className="absolute -top-1 right-4 p-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors z-10"
        >
          <RotateCcw className="w-4 h-4 text-white/50" />
        </button>

        {/* Timer ring - larger size matching reference */}
        <div
          className={cn("relative w-64 h-64 transition-all", isBlinking && "opacity-20")}
          style={{
            boxShadow: isPulsing ? `0 0 ${pulseSpeed === "fast" ? "40px" : "25px"} rgba(236,59,112,0.5)` : "none",
            borderRadius: "50%",
          }}
        >
          <svg className="w-full h-full -rotate-90" viewBox="0 0 256 256">
            {/* Background ring */}
            <circle cx="128" cy="128" r="115" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
            {/* Progress ring */}
            <circle
              cx="128"
              cy="128"
              r="115"
              fill="none"
              stroke={timerRingColor}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={723}
              strokeDashoffset={isRunning ? 723 - ringProgress * (723 / 100) : 723}
              className="transition-all duration-1000"
              style={{
                filter: `drop-shadow(0 0 ${isPulsing ? "15px" : "10px"} ${timerRingColor})`,
              }}
            />
          </svg>

          {/* Timer content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <div
              className={cn("relative w-12 h-12 mb-2 mx-auto transition-all", pulseClass)}
              style={{
                background: `radial-gradient(circle, ${orbColors.primary} 0%, ${orbColors.secondary} 50%, transparent 70%)`,
                filter: `blur(${isPulsing ? "10px" : "8px"})`,
                opacity: isPulsing ? 0.9 : 0.7,
                transform: isPulsing ? `scale(${pulseSpeed === "fast" ? 1.3 : 1.15})` : "scale(1)",
              }}
            >
              <div
                className="absolute inset-3 rounded-full"
                style={{
                  background: `radial-gradient(circle, white 0%, ${orbColors.primary} 60%, transparent 80%)`,
                  filter: "blur(4px)",
                }}
              />
            </div>

            {/* Time display */}
            <p
              className={cn(
                "text-5xl tracking-tight mb-1 text-center mx-auto transition-all",
                isBlinking && "opacity-20",
              )}
              style={{
                color: timerTextColor,
                fontFamily: "system-ui, -apple-system, sans-serif",
                fontWeight: 200,
              }}
            >
              {String(displayMinutes).padStart(2, "0")}:{String(displaySeconds).padStart(2, "0")}
            </p>

            <div className="flex flex-col items-center text-center relative">
              {/* EXIT NOW overlay - appears when indicator confidence >= 65% */}
              {shouldShowExitNow && isRunning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10 animate-pulse">
                  <div className="flex items-center gap-1.5 text-[#ec3b70]">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="uppercase font-semibold text-lg tracking-wider">EXIT NOW</span>
                  </div>
                  <p className="text-[10px] text-[#ec3b70]/80 mt-0.5">{exitWarning?.confidence}% confidence</p>
                </div>
              )}

              {/* EXIT WARNING overlay - appears when indicator confidence is 40-64% */}
              {shouldShowExitWarning && isRunning && !shouldShowExitNow && (
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10 text-center">
                  <AlertTriangle className="w-4 h-4 text-white mb-1" />
                  <span className="uppercase font-medium text-xs tracking-wider text-white">EXIT</span>
                  <span className="uppercase font-medium text-xs tracking-wider text-white">WARNING</span>
                  <p className="text-[9px] text-white/70 mt-0.5 max-w-[140px] text-center leading-tight">
                    {exitWarning?.message || "Indicators weakening"}
                  </p>
                </div>
              )}

              {/* Original phase label - hidden when exit warnings are showing */}
              <div
                className={cn(
                  "uppercase font-light text-xl tracking-[0.15em] transition-opacity",
                  isBlinking && "opacity-20",
                  (shouldShowExitNow || shouldShowExitWarning) && isRunning ? "opacity-0" : "opacity-100",
                )}
                style={{
                  color: isRunning ? (currentPhase === "HOLD" ? "#ffffff" : "#ec3b70") : "white",
                }}
              >
                {isRunning ? currentPhase : "START"}
              </div>

              <p
                className={cn(
                  "text-[11px] text-white/40 mt-1 text-center transition-opacity",
                  (shouldShowExitNow || shouldShowExitWarning) && isRunning ? "opacity-0" : "opacity-100",
                )}
              >
                {isRunning && isInExitPhase
                  ? `${Math.round(progressInfo.percent)}% - ${progressInfo.percent >= 75 ? "EXIT SOON" : "WATCH"}`
                  : `${Math.round(confidence)}% confidence`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Reduced margin from mt-4 (16px) to mt-1.5 (6px) to bring pill up ~10px */}
      <div className="flex flex-col items-center gap-3 mx-auto mt-1.5 w-72 pb-6">
        {isRunning ? (
          <button
            onClick={handlePlayPause}
            className={cn(
              "w-full h-12 rounded-full flex items-center justify-center gap-2 transition-all bg-transparent border-2 hover:bg-white/5",
              isBlinking && "opacity-20",
              shouldShowExitNow && "animate-pulse",
            )}
            style={{
              borderColor: shouldShowExitNow ? "#ec3b70" : "#ec3b70",
              boxShadow: shouldShowExitNow ? "0 0 20px rgba(236,59,112,0.5)" : "none",
            }}
          >
            <div
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                isPulsing
                  ? pulseSpeed === "fast"
                    ? "animate-[ping_0.5s_ease-in-out_infinite]"
                    : "animate-pulse"
                  : "animate-pulse",
              )}
              style={{
                backgroundColor: "#ec3b70",
              }}
            />
            <span className="text-sm uppercase tracking-[0.2em] font-medium" style={{ color: "#ec3b70" }}>
              {shouldShowExitNow
                ? "EXIT NOW!"
                : showExitMessage
                  ? "EXIT NOW!"
                  : isInExitPhase
                    ? "Time to Exit"
                    : "Trade Active"}
            </span>
            <Pause className="w-4 h-4 ml-1" fill="#ec3b70" stroke="none" />
          </button>
        ) : (
          <button
            onClick={handlePlayPause}
            className="w-full h-12 rounded-full flex items-center justify-center gap-2 transition-all bg-white/80 hover:bg-white/90 border-0 backdrop-blur-sm"
          >
            <div
              className="w-1.5 h-1.5 rounded-full bg-[#ec3b70] animate-pulse"
              style={{
                boxShadow: "0 0 6px rgba(236,59,112,0.8)",
              }}
            />
            <span className="text-sm text-black uppercase tracking-[0.2em] font-medium">START : RUN</span>
            <ArrowRight className="w-4 h-4 text-black/70 ml-1" strokeWidth={1.5} />
          </button>
        )}
      </div>
    </div>
  )
}

export { UnifiedSignalTimer }
