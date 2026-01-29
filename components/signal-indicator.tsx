"use client"

import { TrendingUp, TrendingDown, Minus } from "lucide-react"

interface SignalIndicatorProps {
  signal: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL"
  confidence: number
  size?: "sm" | "md" | "lg"
}

export function SignalIndicator({ signal, confidence, size = "md" }: SignalIndicatorProps) {
  const getSignalConfig = () => {
    switch (signal) {
      case "STRONG_BUY":
        return {
          gradient: "from-emerald-400 to-teal-500",
          icon: TrendingUp,
          text: "STRONG BUY",
          pulse: true,
        }
      case "BUY":
        return {
          gradient: "from-emerald-400/80 to-teal-500/80",
          icon: TrendingUp,
          text: "BUY",
          pulse: false,
        }
      case "SELL":
        return {
          gradient: "from-[#ec3b70]/80 to-[#db2760]/80",
          icon: TrendingDown,
          text: "SELL",
          pulse: false,
        }
      case "STRONG_SELL":
        return {
          gradient: "from-[#ec3b70] to-[#db2760]",
          icon: TrendingDown,
          text: "STRONG SELL",
          pulse: true,
        }
      default:
        return {
          gradient: "from-slate-400 to-slate-500",
          icon: Minus,
          text: "HOLD",
          pulse: false,
        }
    }
  }

  const config = getSignalConfig()
  const Icon = config.icon

  const sizeClasses = {
    sm: "text-xs py-1.5 px-3",
    md: "text-sm py-2.5 px-5",
    lg: "text-lg py-4 px-8",
  }

  return (
    <div className="flex items-center gap-4">
      <div
        className={`
          bg-gradient-to-r ${config.gradient} 
          ${sizeClasses[size]} 
          rounded-2xl font-semibold text-white
          shadow-lg
          ${config.pulse ? "animate-pulse-soft" : ""}
          flex items-center gap-2
          transition-all duration-300
        `}
        style={{
          boxShadow: config.pulse
            ? `0 0 30px ${signal.includes("BUY") ? "rgba(16, 185, 129, 0.4)" : "rgba(236, 59, 112, 0.4)"}`
            : undefined,
        }}
      >
        <Icon className="h-4 w-4" />
        {config.text}
      </div>
      <span className="text-sm text-foreground/60 font-light">{confidence.toFixed(0)}% confidence</span>
    </div>
  )
}
