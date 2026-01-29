"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"
import { triggerHaptic } from "@/lib/haptics"

interface TimeframeWidgetProps {
  value: string
  onChange: (timeframe: string) => void
  className?: string
}

const TIMEFRAMES = [
  { label: "1m", value: "1", group: "intraday" },
  { label: "5m", value: "5", group: "intraday" },
  { label: "15m", value: "15", group: "intraday" },
  { label: "30m", value: "30", group: "intraday" },
  { label: "1h", value: "60", group: "intraday" },
  { label: "D", value: "D", group: "historical" },
  { label: "W", value: "W", group: "historical" },
  { label: "M", value: "M", group: "historical" },
]

export function TimeframeWidget({ value, onChange, className }: TimeframeWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)

  const currentTf = TIMEFRAMES.find((tf) => tf.value === value)
  const displayLabel = currentTf?.label || "1m"

  return (
    <div className={cn("relative", className)}>
      {/* Trigger button */}
      <button
        onClick={() => {
          triggerHaptic("light")
          setIsOpen(!isOpen)
        }}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-full",
          "bg-white/10 border border-white/10 backdrop-blur-sm",
          "text-xs font-medium text-white/70 tracking-wider",
          "transition-all press-effect",
          isOpen && "bg-white/20 border-white/20",
        )}
      >
        <span>{displayLabel}</span>
        <ChevronDown className={cn("w-3 h-3 transition-transform", isOpen && "rotate-180")} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop to close */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          {/* Dropdown menu */}
          <div
            className={cn(
              "absolute top-full right-0 mt-2 z-50",
              "min-w-[140px] p-2 rounded-2xl",
              "bg-black/90 border border-white/10 backdrop-blur-xl",
              "animate-in fade-in slide-in-from-top-2 duration-200",
            )}
          >
            {/* Intraday section */}
            <p className="text-[10px] uppercase tracking-wider text-white/30 px-2 py-1">Intraday</p>
            <div className="grid grid-cols-3 gap-1 mb-2">
              {TIMEFRAMES.filter((tf) => tf.group === "intraday").map((tf) => (
                <button
                  key={tf.value}
                  onClick={() => {
                    triggerHaptic("light")
                    onChange(tf.value)
                    setIsOpen(false)
                  }}
                  className={cn(
                    "py-1.5 rounded-lg text-xs transition-all",
                    value === tf.value
                      ? "bg-white/20 text-white"
                      : "text-white/50 hover:bg-white/10 hover:text-white/70",
                  )}
                >
                  {tf.label}
                </button>
              ))}
            </div>

            {/* Historical section */}
            <div className="border-t border-white/10 pt-2">
              <p className="text-[10px] uppercase tracking-wider text-white/30 px-2 py-1">Historical</p>
              <div className="grid grid-cols-3 gap-1">
                {TIMEFRAMES.filter((tf) => tf.group === "historical").map((tf) => (
                  <button
                    key={tf.value}
                    onClick={() => {
                      triggerHaptic("light")
                      onChange(tf.value)
                      setIsOpen(false)
                    }}
                    className={cn(
                      "py-1.5 rounded-lg text-xs transition-all",
                      value === tf.value
                        ? "bg-white/20 text-white"
                        : "text-white/50 hover:bg-white/10 hover:text-white/70",
                    )}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
