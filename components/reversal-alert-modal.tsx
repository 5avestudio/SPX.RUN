"use client"

import { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { X, RefreshCw, AlertTriangle } from "lucide-react"
import { triggerHaptic } from "@/lib/haptics"
import type { TrendReversalWarning } from "@/lib/indicators"

interface ReversalAlertModalProps {
  reversalWarning?: TrendReversalWarning
  onDismiss: (warning: TrendReversalWarning) => void
  dataPointsLoaded: number
}

export function ReversalAlertModal({ reversalWarning, onDismiss, dataPointsLoaded }: ReversalAlertModalProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [currentWarning, setCurrentWarning] = useState<TrendReversalWarning | null>(null)
  const [lastDismissedType, setLastDismissedType] = useState<string | null>(null)
  const [dismissedAt, setDismissedAt] = useState<number>(0)
  const isInitialLoad = useRef(true)

  useEffect(() => {
    if (isInitialLoad.current) {
      const timer = setTimeout(() => {
        isInitialLoad.current = false
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    if (
      reversalWarning?.hasWarning &&
      dataPointsLoaded >= 20 &&
      (reversalWarning.severity === "HIGH" || reversalWarning.severity === "CRITICAL") &&
      (reversalWarning.type !== lastDismissedType || Date.now() - dismissedAt > 300000) &&
      !isInitialLoad.current
    ) {
      setCurrentWarning(reversalWarning)
      setTimeout(() => setIsVisible(true), 100)
    }
  }, [reversalWarning, dataPointsLoaded, lastDismissedType, dismissedAt])

  const handleDismiss = () => {
    triggerHaptic("light")
    setIsVisible(false)

    setTimeout(() => {
      if (currentWarning) {
        onDismiss(currentWarning)
        setLastDismissedType(currentWarning.type)
        setDismissedAt(Date.now())
      }
      setCurrentWarning(null)
    }, 300)
  }

  if (!currentWarning) return null

  const isBullish = currentWarning.type === "BULLISH_REVERSAL"

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center px-4",
        "transition-all duration-300",
        isVisible ? "opacity-100" : "opacity-0 pointer-events-none",
      )}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={handleDismiss} />

      {/* Modal container */}
      <div
        className={cn(
          "relative w-full max-w-sm transition-all duration-300 transform",
          isVisible ? "scale-100 translate-y-0" : "scale-95 translate-y-4",
        )}
      >
        <div
          className={cn(
            "relative w-full rounded-2xl overflow-hidden",
            "bg-neutral-800/70 backdrop-blur-2xl",
            "white-pulse-border",
            isBullish ? "dynamic-island-border-green" : "dynamic-island-border-red",
          )}
        >
          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/[0.08] hover:bg-white/[0.12] transition-colors flex items-center justify-center"
          >
            <X className="w-3.5 h-3.5 text-white/50" />
          </button>

          {/* Header */}
          <div className="px-5 pt-5 pb-4">
            <div className="flex items-start gap-3.5">
              <div className="flex-shrink-0 w-11 h-11 rounded-full bg-white/[0.08] flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-white/70" />
              </div>

              <div className="flex-1 pt-0.5">
                <h3 className="text-[17px] font-semibold text-white tracking-tight">
                  {isBullish ? "Bullish Reversal" : "Bearish Reversal"}
                </h3>
                <p
                  className="text-white/80 text-[13px] mt-0.5"
                  style={{
                    textShadow:
                      "0 0 8px rgba(255, 255, 255, 0.8), 0 0 16px rgba(255, 255, 255, 0.5), 0 0 24px rgba(255, 255, 255, 0.3)",
                  }}
                >
                  {currentWarning.severity === "CRITICAL" ? "Critical" : "Moderate"} · {currentWarning.confidence}%
                  confidence
                </p>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="mx-5 h-px bg-white/[0.06]" />

          {/* Signals list */}
          <div className="px-5 py-4">
            {currentWarning.signals.map((signal, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex items-center gap-3 py-2",
                  idx !== currentWarning.signals.length - 1 && "border-b border-white/[0.04]",
                )}
              >
                <AlertTriangle className="flex-shrink-0 w-4 h-4 text-white/40" strokeWidth={1.5} />
                <span className="text-[15px] text-white/70">{signal}</span>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-5 pb-5">
            <p className="text-white/30 text-[13px]">
              {isBullish ? "Consider closing PUT positions" : "Consider closing CALL positions"}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
