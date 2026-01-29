"use client"

import { cn } from "@/lib/utils"

interface QuickStatPillProps {
  label: string
  value: string | number
  status?: "bullish" | "bearish" | "neutral"
  className?: string
}

export function QuickStatPill({ label, value, status = "neutral", className }: QuickStatPillProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-3 rounded-xl border border-white/10 bg-white/5 min-w-[140px] press-effect",
        className,
      )}
    >
      <span className="text-white/40 text-sm">{label}</span>
      <span
        className={cn(
          "text-sm font-medium",
          status === "bullish" && "text-emerald-400",
          status === "bearish" && "text-rose-400",
          status === "neutral" && "text-white/80",
        )}
      >
        {typeof value === "number" ? value.toFixed(1) : value}
      </span>
    </div>
  )
}
