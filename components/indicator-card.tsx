"use client"

import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card"
import { TrendingUp, TrendingDown } from "lucide-react"

interface IndicatorCardProps {
  title: string
  value: number | string
  status?: "bullish" | "bearish" | "neutral" | "danger"
  subtitle?: string
  trend?: "up" | "down"
}

export function IndicatorCard({ title, value, status = "neutral", subtitle, trend }: IndicatorCardProps) {
  const statusConfig = {
    bullish: { dot: "bg-emerald-400", text: "text-emerald-400", label: "Bullish" },
    bearish: { dot: "bg-rose-400", text: "text-rose-400", label: "Bearish" },
    neutral: { dot: "bg-slate-400", text: "text-slate-400", label: "Neutral" },
    danger: { dot: "bg-white", text: "text-white", label: "Caution" },
  }

  const config = statusConfig[status]

  return (
    <GlassCard className="overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
      <GlassCardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <GlassCardTitle className="text-sm font-normal text-foreground/50 tracking-wide uppercase">
            {title}
          </GlassCardTitle>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${config.dot} animate-pulse-soft`} />
            <span className={`text-xs ${config.text}`}>{config.label}</span>
          </div>
        </div>
      </GlassCardHeader>
      <GlassCardContent className="pt-3">
        <div className="flex items-end gap-3">
          <div className="text-4xl font-light tracking-tight text-foreground/90">
            {typeof value === "number" ? value.toFixed(2) : value}
          </div>
          {trend && (
            <div className={`mb-1 ${trend === "up" ? "text-emerald-400" : "text-rose-400"}`}>
              {trend === "up" ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
            </div>
          )}
        </div>
        {subtitle && <p className="text-xs text-foreground/40 mt-2 font-light">{subtitle}</p>}
      </GlassCardContent>
    </GlassCard>
  )
}
