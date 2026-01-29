"use client"

import { useMemo } from "react"

interface IndicatorPieChartProps {
  name: string
  value: number
  min: number
  max: number
  buyThreshold?: number
  sellThreshold?: number
  signal: "buy" | "sell" | "hold" | "neutral"
  className?: string
  compact?: boolean
}

export function IndicatorPieChart({
  name,
  value,
  min,
  max,
  buyThreshold,
  sellThreshold,
  signal,
  compact = false,
}: IndicatorPieChartProps) {
  const { percentage, rotation, signalColor, signalText, trendText } = useMemo(() => {
    const range = max - min
    const normalizedValue = Math.max(min, Math.min(max, value))
    const pct = ((normalizedValue - min) / range) * 100
    const rot = (pct / 100) * 360

    let color = "text-white/60"
    let text = "HOLD"
    let trend = "Neutral"

    if (signal === "buy") {
      color = "text-emerald-400"
      text = "BUY"
      trend = "Uptrend"
    } else if (signal === "sell") {
      color = "text-[#ec3b70]"
      text = "SELL"
      trend = "Downtrend"
    }

    return {
      percentage: pct,
      rotation: rot,
      signalColor: color,
      signalText: text,
      trendText: trend,
    }
  }, [value, min, max, signal])

  // Calculate threshold positions for the ring
  const buyThresholdAngle = buyThreshold !== undefined ? ((buyThreshold - min) / (max - min)) * 360 : null
  const sellThresholdAngle = sellThreshold !== undefined ? ((sellThreshold - min) / (max - min)) * 360 : null

  const ringSize = compact ? "w-10 h-10" : "w-16 h-16"
  const padding = compact ? "p-2" : "p-3"
  const nameSize = compact ? "text-[8px]" : "text-[10px]"
  const valueSize = compact ? "text-xs" : "text-sm"
  const signalSize = compact ? "text-[8px]" : "text-[10px]"
  const trendSize = compact ? "text-[7px]" : "text-[9px]"
  const minMaxSize = compact ? "text-[6px]" : "text-[8px]"
  const marginTop = compact ? "mt-1" : "mt-2"
  const marginBottom = compact ? "mb-1" : "mb-2"

  return (
    <div
      className={`flex flex-col items-center justify-center ${padding} rounded-2xl glass-frost border border-white/10`}
    >
      <span className={`${nameSize} uppercase tracking-wider text-white/40 ${marginBottom}`}>{name}</span>

      <div className={`relative ${ringSize}`}>
        {/* Background ring */}
        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
          {/* Gray background track */}
          <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />

          {/* Threshold markers */}
          {sellThresholdAngle !== null && (
            <circle
              cx="18"
              cy="18"
              r="14"
              fill="none"
              stroke="rgba(236,59,112,0.3)"
              strokeWidth="3"
              strokeDasharray={`${(sellThresholdAngle / 360) * 88} 88`}
            />
          )}
          {buyThresholdAngle !== null && (
            <circle
              cx="18"
              cy="18"
              r="14"
              fill="none"
              stroke="rgba(52,211,153,0.3)"
              strokeWidth="3"
              strokeDasharray={`${((360 - buyThresholdAngle) / 360) * 88} 88`}
              strokeDashoffset={`${-(buyThresholdAngle / 360) * 88}`}
            />
          )}

          {/* Value arc */}
          <circle
            cx="18"
            cy="18"
            r="14"
            fill="none"
            stroke={signal === "buy" ? "#34d399" : signal === "sell" ? "#ec3b70" : "rgba(255,255,255,0.6)"}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${(percentage / 100) * 88} 88`}
            className="transition-all duration-500"
          />

          {/* Threshold tick marks */}
          {sellThreshold !== undefined && (
            <line
              x1="18"
              y1="4"
              x2="18"
              y2="7"
              stroke="#ec3b70"
              strokeWidth="1.5"
              transform={`rotate(${((sellThreshold - min) / (max - min)) * 360}, 18, 18)`}
            />
          )}
          {buyThreshold !== undefined && (
            <line
              x1="18"
              y1="4"
              x2="18"
              y2="7"
              stroke="#34d399"
              strokeWidth="1.5"
              transform={`rotate(${((buyThreshold - min) / (max - min)) * 360}, 18, 18)`}
            />
          )}
        </svg>

        {/* Center value */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`${valueSize} font-bold ${signalColor}`}>{value.toFixed(1)}</span>
        </div>
      </div>

      {/* Signal and trend */}
      <div className={`flex flex-col items-center ${marginTop} gap-0`}>
        <span className={`${signalSize} font-semibold ${signalColor}`}>{signalText}</span>
        <span className={`${trendSize} text-white/30`}>{trendText}</span>
      </div>

      {/* Threshold labels */}
      <div className="flex justify-between w-full mt-0.5 px-1">
        <span className={`${minMaxSize} text-white/30`}>{min}</span>
        <span className={`${minMaxSize} text-white/30`}>{max}</span>
      </div>
    </div>
  )
}
