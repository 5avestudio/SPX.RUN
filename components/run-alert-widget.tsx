"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { cn } from "@/lib/utils"
import {
  TrendingUp,
  TrendingDown,
  X,
  Activity,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Zap,
  Play,
  Target,
  ShieldAlert,
  Clock,
  Pause,
  RotateCcw,
  Gauge,
  RotateCw,
} from "lucide-react"
import { triggerHaptic } from "@/lib/haptics"
import type { RunAlert } from "@/lib/indicators"

interface RunAlertWidgetProps {
  alert: RunAlert | null
  onDismiss: () => void
  onSaveToHistory?: (alert: RunAlert) => void
  className?: string
}

function playAlarmSound(type: "start" | "stop") {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    if (type === "start") {
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime)
      oscillator.frequency.linearRampToValueAtTime(900, audioContext.currentTime + 0.15)
      oscillator.frequency.linearRampToValueAtTime(1200, audioContext.currentTime + 0.3)
    } else {
      oscillator.frequency.setValueAtTime(1200, audioContext.currentTime)
      oscillator.frequency.linearRampToValueAtTime(800, audioContext.currentTime + 0.2)
      oscillator.frequency.linearRampToValueAtTime(400, audioContext.currentTime + 0.4)
    }

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.5)
  } catch (e) {
    // Audio not available
  }
}

export function RunAlertWidget({ alert, onDismiss, onSaveToHistory, className }: RunAlertWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const playedSoundForId = useRef<string | null>(null)

  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [runStartTime, setRunStartTime] = useState<Date | null>(null)

  const alertId = alert?.id ?? null
  const alertMuted = alert?.muted ?? false

  useEffect(() => {
    if (alertId && alertId !== playedSoundForId.current && !alertMuted) {
      playedSoundForId.current = alertId
      setIsVisible(true)
      setIsExpanded(true)
      triggerHaptic("medium")
      playAlarmSound("start")
    }
  }, [alertId, alertMuted])

  useEffect(() => {
    if (!isTimerRunning) return
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [isTimerRunning])

  const handleDismiss = useCallback(() => {
    triggerHaptic("light")
    if (isTimerRunning) {
      playAlarmSound("stop")
    }
    if (alert && onSaveToHistory) {
      onSaveToHistory(alert)
    }
    setIsVisible(false)
    setIsTimerRunning(false)
    playedSoundForId.current = null
    setTimeout(onDismiss, 300)
  }, [alert, onDismiss, onSaveToHistory, isTimerRunning])

  const handleStartTimer = () => {
    setIsTimerRunning(true)
    setRunStartTime(new Date())
    setElapsedSeconds(0)
    triggerHaptic("medium")
    playAlarmSound("start")
  }

  const handleStopTimer = () => {
    setIsTimerRunning(false)
    triggerHaptic("light")
    playAlarmSound("stop")
  }

  const handleResetTimer = () => {
    setElapsedSeconds(0)
    setRunStartTime(null)
    setIsTimerRunning(false)
    triggerHaptic("light")
  }

  const formatTime = useCallback((totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }, [])

  if (!alert || !isVisible) return null

  const isUpward = alert.type === "UPWARD_RUN" || alert.type === "SQUEEZE_LONG" || alert.type === "TRAP_FADE_LONG"
  const Icon = isUpward ? TrendingUp : TrendingDown

  // Determine alert title based on type
  const getAlertTitle = () => {
    switch (alert.type) {
      case "SQUEEZE_LONG":
        return "SQUEEZE LONG (5-15m)"
      case "SQUEEZE_SHORT":
        return "SQUEEZE SHORT (5-15m)"
      case "TRAP_FADE_LONG":
        return "LIQUIDITY TRAP FADE (LONG)"
      case "TRAP_FADE_SHORT":
        return "LIQUIDITY TRAP FADE (SHORT)"
      case "UPWARD_RUN":
        return "Upward Run Confirmed"
      case "DOWNWARD_RUN":
        return "Downward Run Confirmed"
      default:
        return isUpward ? "Upward Run Confirmed" : "Downward Run Confirmed"
    }
  }

  const confidenceColors = {
    HIGH: "bg-white/20 text-white border-white/30 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]",
    MEDIUM: "bg-white/20 text-white/80 border-white/30",
    LOW: "bg-white/10 text-white/60 border-white/20",
  }

  const trendStrengthColors = {
    VERY_STRONG: "text-emerald-400",
    STRONG: "text-emerald-400/80",
    MODERATE: "text-white/70",
    WEAK: "text-white/40",
  }

  const reversalColors = {
    CRITICAL: "bg-[#ec3b70]/20 text-[#ec3b70] border-[#ec3b70]/30",
    HIGH: "bg-white/20 text-white border-white/30 drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]",
    MEDIUM: "bg-white/10 text-white/60 border-white/20",
    LOW: "bg-white/5 text-white/40 border-white/10",
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={handleDismiss} aria-label="Tap to dismiss alert" />

      <div
        className={cn(
          "fixed top-20 left-4 right-4 z-50",
          "transition-all duration-300 transform",
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={cn(
            "rounded-2xl overflow-hidden",
            "bg-black/90 backdrop-blur-xl border",
            isUpward ? "border-emerald-500/30" : "border-[#ec3b70]/30",
            alertMuted && "opacity-60",
          )}
        >
          {/* Header */}
          <div className="p-4">
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                  isUpward ? "bg-emerald-500/20" : "bg-[#ec3b70]/20",
                )}
              >
                <Icon className={cn("w-5 h-5", isUpward ? "text-emerald-400" : "text-[#ec3b70]")} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn("text-base font-semibold", isUpward ? "text-emerald-400" : "text-[#ec3b70]")}>
                    {getAlertTitle()}
                  </span>
                  <button
                    onClick={handleDismiss}
                    className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] uppercase font-medium border cursor-pointer hover:opacity-80 transition-opacity",
                      confidenceColors[alert.confidence],
                    )}
                  >
                    {alert.confidence}
                  </button>
                </div>

                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {/* Show ADX Direction indicator first if available */}
                  {alert.indicators.find(i => i.name === "ADX Direction") && (
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] uppercase font-medium",
                        isUpward ? "bg-emerald-500/30 text-emerald-300" : "bg-[#ec3b70]/30 text-[#ec3b70]",
                      )}
                    >
                      {alert.indicators.find(i => i.name === "ADX Direction")?.value}
                    </span>
                  )}
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] uppercase font-medium border",
                      isUpward ? "border-emerald-500/30 text-emerald-300" : "border-[#ec3b70]/30 text-[#ec3b70]",
                    )}
                  >
                    ST: {isUpward ? "BUY" : "SELL"}
                  </span>
                  {alert.trendStrength && (
                    <span className={cn("text-[10px] uppercase font-medium", trendStrengthColors[alert.trendStrength])}>
                      <Gauge className="w-3 h-3 inline mr-1" />
                      {alert.trendStrength.replace("_", " ")}
                    </span>
                  )}
                </div>

                {/* Quick Stats */}
                <div className="flex items-center gap-4 text-xs text-white/50">
                  <div className="flex items-center gap-1">
                    <Activity className="w-3 h-3" />
                    <span>Slope: {alert.conditions.priceSlope.toFixed(2)}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {alert.conditions.volumeSpike ? (
                      <Volume2 className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <VolumeX className="w-3 h-3" />
                    )}
                    <span>{alert.conditions.volumeSpike ? "Vol Spike" : "Normal Vol"}</span>
                  </div>
                </div>

                {/* Single-line explanation for scalp alerts */}
                {alert.explanation && (
                  <div className="mt-2 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-[10px] text-white/50 font-mono">{alert.explanation}</p>
                  </div>
                )}

                {/* Muted Warning */}
                {alertMuted && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-white/60">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Muted: {alert.muteReason}</span>
                  </div>
                )}
              </div>

              {/* Close Button */}
              <button
                onClick={handleDismiss}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                <X className="w-4 h-4 text-white/50" />
              </button>
            </div>

            {alert.reversalProbability !== undefined && alert.reversalProbability >= 30 && (
              <div
                className={cn(
                  "mt-3 px-3 py-2 rounded-xl border flex items-center gap-2",
                  reversalColors[alert.reversalLevel || "LOW"],
                )}
              >
                <RotateCw className="w-4 h-4" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">Reversal Risk: {alert.reversalLevel}</span>
                    <span className="text-sm font-semibold">{alert.reversalProbability}%</span>
                  </div>
                  {alert.reversalFactors && alert.reversalFactors.length > 0 && (
                    <p className="text-[10px] opacity-70 mt-0.5">{alert.reversalFactors.slice(0, 2).join(" • ")}</p>
                  )}
                </div>
              </div>
            )}

            {/* Entry/Target/Stop Grid */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div
                className={cn(
                  "rounded-xl p-3 border",
                  isUpward ? "bg-emerald-500/10 border-emerald-500/20" : "bg-[#ec3b70]/10 border-[#ec3b70]/20",
                )}
              >
                <div className="flex items-center gap-1 mb-1">
                  <Target className="w-3 h-3 text-white/50" />
                  <span className="text-[10px] uppercase text-white/50">Entry</span>
                </div>
                <p className={cn("text-lg font-semibold", isUpward ? "text-emerald-400" : "text-[#ec3b70]")}>
                  ${alert.entryPrice?.toFixed(2) || "—"}
                </p>
              </div>

              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <div className="flex items-center gap-1 mb-1">
                  <TrendingUp className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px] uppercase text-white/50">Target</span>
                </div>
                <p className="text-lg font-semibold text-emerald-400">${alert.targetPrice?.toFixed(2) || "—"}</p>
                <p className="text-[10px] text-emerald-400/70">{alert.expectedGain}</p>
              </div>

              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <div className="flex items-center gap-1 mb-1">
                  <ShieldAlert className="w-3 h-3 text-[#ec3b70]" />
                  <span className="text-[10px] uppercase text-white/50">Stop</span>
                </div>
                <p className="text-lg font-semibold text-[#ec3b70]">${alert.stopLoss?.toFixed(2) || "—"}</p>
              </div>
            </div>

            {/* Timer Section */}
            <div className="mt-4 bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock className={cn("w-4 h-4", isTimerRunning ? "text-[#ec3b70] animate-pulse" : "text-white/40")} />
                  <span className="text-xs uppercase text-white/50">Trade Timer</span>
                </div>
                <span className="text-xs text-white/40">{alert.expectedHoldTime} expected</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "text-3xl font-light tracking-tight",
                      isTimerRunning ? "text-[#ec3b70]" : "text-white/60",
                    )}
                  >
                    {formatTime(elapsedSeconds)}
                  </span>

                  {runStartTime && (
                    <div className="text-xs text-white/40">
                      <p>
                        Started:{" "}
                        {runStartTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {!isTimerRunning ? (
                    <button
                      onClick={handleStartTimer}
                      className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center transition-all",
                        isUpward
                          ? "bg-emerald-500/20 border border-emerald-500/30 hover:bg-emerald-500/30"
                          : "bg-[#ec3b70]/20 border border-[#ec3b70]/30 hover:bg-[#ec3b70]/30",
                      )}
                    >
                      <Play className={cn("w-5 h-5 ml-0.5", isUpward ? "text-emerald-400" : "text-[#ec3b70]")} />
                    </button>
                  ) : (
                    <button
                      onClick={handleStopTimer}
                      className="w-12 h-12 rounded-full bg-[#ec3b70]/20 border border-[#ec3b70]/30 flex items-center justify-center hover:bg-[#ec3b70]/30 transition-all"
                    >
                      <Pause className="w-5 h-5 text-[#ec3b70]" />
                    </button>
                  )}

                  {elapsedSeconds > 0 && (
                    <button
                      onClick={handleResetTimer}
                      className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all"
                    >
                      <RotateCcw className="w-4 h-4 text-white/50" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Expand Toggle */}
            <button
              onClick={() => {
                triggerHaptic("light")
                setIsExpanded(!isExpanded)
              }}
              className="mt-3 flex items-center gap-1 text-xs text-white/40 hover:text-white/60 transition-colors"
            >
              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              <span>{isExpanded ? "Less Details" : "More Details"}</span>
            </button>
          </div>

          {/* Expanded Content */}
          {isExpanded && (
            <div className="px-4 pb-4 border-t border-white/10">
              {/* Indicators Grid */}
              <div className="mt-3">
                <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Contributing Indicators</p>
                <div className="grid grid-cols-2 gap-2">
                  {alert.indicators.map((ind, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "px-3 py-2 rounded-lg border",
                        ind.contributing
                          ? isUpward
                            ? "bg-emerald-500/10 border-emerald-500/20"
                            : "bg-[#ec3b70]/10 border-[#ec3b70]/20"
                          : "bg-white/5 border-white/10",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/60">{ind.name}</span>
                        {ind.contributing && <Zap className="w-3 h-3 text-white/70" />}
                      </div>
                      <p
                        className={cn(
                          "text-sm font-medium mt-0.5",
                          ind.contributing ? (isUpward ? "text-emerald-400" : "text-[#ec3b70]") : "text-white/40",
                        )}
                      >
                        {ind.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              {alert.notes.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Analysis Notes</p>
                  <div className="space-y-1">
                    {alert.notes.map((note, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <div
                          className={cn(
                            "w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0",
                            isUpward ? "bg-emerald-400" : "bg-[#ec3b70]",
                          )}
                        />
                        <span className="text-xs text-white/60">{note}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Conditions Summary */}
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  { check: alert.conditions.atrExpanding, label: "ATR Expanding" },
                  { check: alert.conditions.volumeSpike, label: "Volume Spike" },
                  {
                    check: isUpward
                      ? alert.conditions.vwapPosition.includes("ABOVE")
                      : alert.conditions.vwapPosition.includes("BELOW"),
                    label: `VWAP ${alert.conditions.vwapPosition}`,
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs",
                      item.check
                        ? isUpward
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-[#ec3b70]/20 text-[#ec3b70]"
                        : "bg-white/5 text-white/30",
                    )}
                  >
                    <span>{item.check ? "✓" : "○"}</span>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
