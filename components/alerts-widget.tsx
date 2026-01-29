"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Bell, X, RefreshCw, AlertTriangle } from "lucide-react"
import { triggerHaptic } from "@/lib/haptics"

export interface AlertItem {
  id: string
  type: "BULLISH_REVERSAL" | "BEARISH_REVERSAL" | "INFO" | "SQUEEZE_LONG" | "SQUEEZE_SHORT" | "TRAP_FADE_LONG" | "TRAP_FADE_SHORT"
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
  title: string
  message: string
  signals?: string[]
  timestamp: Date
  dismissed?: boolean
  explanation?: string // Single-line explanation for scalp alerts
  confidence?: number
  shouldPush?: boolean
}

interface AlertsWidgetProps {
  alerts: AlertItem[]
  onClearAll: () => void
  onDismissAlert: (id: string) => void
  className?: string
}

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

export function AlertsWidget({ alerts, onClearAll, onDismissAlert, className }: AlertsWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)

  const activeAlerts = alerts.filter((a) => !a.dismissed)
  const hasActiveAlerts = activeAlerts.length > 0

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => {
          triggerHaptic("light")
          setIsOpen(!isOpen)
        }}
        className="relative p-2 press-effect"
      >
        <Bell className="w-5 h-5 text-white" />
        {hasActiveAlerts && (
          <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-[#ec3b70] text-[10px] font-medium flex items-center justify-center">
            {activeAlerts.length > 9 ? "9+" : activeAlerts.length}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop to close */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          <div
            className={cn(
              "absolute top-full right-0 mt-2 z-50",
              "w-[320px] max-h-[400px] rounded-2xl",
              "bg-black/90 backdrop-blur-xl",
              "animate-in fade-in slide-in-from-top-2 duration-200",
              "overflow-hidden flex flex-col",
            )}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-white/40">Alerts</span>
              {alerts.length > 0 && (
                <button
                  onClick={() => {
                    triggerHaptic("light")
                    onClearAll()
                  }}
                  className="text-[10px] uppercase tracking-wider text-white/30 hover:text-white/50 press-effect"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Alerts list */}
            <div className="flex-1 overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="py-12 text-center">
                  <Bell className="w-8 h-8 text-white/20 mx-auto mb-3" />
                  <p className="text-white/40 text-sm">No alerts yet</p>
                  <p className="text-white/20 text-xs mt-1">Reversal warnings will appear here</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {alerts.map((alert) => (
                    <div key={alert.id} className={cn("px-4 py-3 relative", alert.dismissed && "opacity-40")}>
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5",
                            alert.type === "BULLISH_REVERSAL" || alert.type === "SQUEEZE_LONG" || alert.type === "TRAP_FADE_LONG"
                              ? "bg-emerald-500/20"
                              : alert.type === "BEARISH_REVERSAL" || alert.type === "SQUEEZE_SHORT" || alert.type === "TRAP_FADE_SHORT"
                                ? "bg-[#ec3b70]/20"
                                : "bg-white/10",
                          )}
                        >
                          <RefreshCw
                            className={cn(
                              "w-4 h-4",
                              alert.type === "BULLISH_REVERSAL" || alert.type === "SQUEEZE_LONG" || alert.type === "TRAP_FADE_LONG"
                                ? "text-emerald-400"
                                : alert.type === "BEARISH_REVERSAL" || alert.type === "SQUEEZE_SHORT" || alert.type === "TRAP_FADE_SHORT"
                                  ? "text-[#ec3b70]"
                                  : "text-white/50",
                            )}
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span
                              className={cn(
                                "text-sm font-medium",
                                alert.type === "BULLISH_REVERSAL" || alert.type === "SQUEEZE_LONG" || alert.type === "TRAP_FADE_LONG"
                                  ? "text-emerald-400"
                                  : alert.type === "BEARISH_REVERSAL" || alert.type === "SQUEEZE_SHORT" || alert.type === "TRAP_FADE_SHORT"
                                    ? "text-[#ec3b70]"
                                    : "text-white/70",
                              )}
                            >
                              {alert.title}
                            </span>
                            <span
                              className={cn(
                                "px-1.5 py-0.5 rounded text-[9px] uppercase font-medium",
                                alert.severity === "CRITICAL"
                                  ? "bg-[#ec3b70]/30 text-[#ec3b70]"
                                  : alert.severity === "HIGH"
                                    ? "bg-orange-500/30 text-orange-400"
                                    : "bg-white/10 text-white/40",
                              )}
                            >
                              {alert.severity}
                            </span>
                          </div>

                          <p className="text-xs text-white/50 mb-1">{alert.message}</p>

                          {/* Single-line explanation for scalp alerts */}
                          {alert.explanation && (
                            <p className="text-[10px] text-white/40 font-mono mb-1">{alert.explanation}</p>
                          )}

                          {alert.signals && alert.signals.length > 0 && (
                            <div className="space-y-0.5 mt-2">
                              {alert.signals.slice(0, 2).map((sig, idx) => (
                                <div key={idx} className="flex items-center gap-1.5">
                                  <AlertTriangle className="w-2.5 h-2.5 text-white/30" />
                                  <span className="text-[10px] text-white/40 truncate">{sig}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          <p className="text-[10px] text-white/30 mt-2">{formatRelativeTime(alert.timestamp)}</p>
                        </div>

                        {!alert.dismissed && (
                          <button
                            onClick={() => {
                              triggerHaptic("light")
                              onDismissAlert(alert.id)
                            }}
                            className="p-1 rounded-full hover:bg-white/10 transition-colors press-effect"
                          >
                            <X className="w-3.5 h-3.5 text-white/30" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
