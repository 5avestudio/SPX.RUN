"use client"

import { useState } from "react"
import { Eye, RefreshCcw, ChevronDown, ChevronUp, Layers, Activity, Target } from "lucide-react"
import { cn } from "@/lib/utils"

interface VisualMonitoringData {
  exhaustion?: {
    rsi?: number
    cci?: number
    stochRsi?: number
    fsto?: number
    fastStoch?: number
  }
  dynamicSR?: {
    ema20?: number
    ema50?: number
    sma200?: number
    alligator?: {
      jaw?: number
      teeth?: number
      lips?: number
      trend?: "BULLISH" | "BEARISH" | "NEUTRAL"
    }
  }
  dynamicLevels?: {
    ema20?: number
    ema50?: number
    sma200?: number
    alligator?: {
      jaw?: number
      teeth?: number
      lips?: number
      trend?: "BULLISH" | "BEARISH" | "NEUTRAL"
    }
  }
  volatility?: {
    bbWidth?: number
    bbPosition?: "UPPER_HALF" | "LOWER_HALF" | "ABOVE_UPPER" | "BELOW_LOWER"
    keltnerSqueeze?: boolean
    keltnerBreakout?: "UPPER" | "LOWER" | "NONE"
    ttmSqueeze?: boolean
    ttmMomentum?: "BULLISH" | "BEARISH" | "NEUTRAL"
    stdvPercentile?: number
  }
  keyLevels?: {
    pivotPoint?: number
    pivotPoints?: { pp?: number; r1?: number; r2?: number; s1?: number; s2?: number }
    r1?: number
    r2?: number
    r3?: number
    s1?: number
    s2?: number
    s3?: number
    fibLevels?: { level: string; value?: number; price?: number }[]
    nearestFib?: { level: string; value: number; distance: number }
  }
}

interface VisualMonitoringPanelProps {
  data?: VisualMonitoringData | null
  currentPrice?: number
}

function GaugeCard({
  title,
  value,
  min,
  max,
  lowThreshold,
  highThreshold,
  lowLabel = "OVERSOLD",
  highLabel = "OVERBOUGHT",
}: {
  title: string
  value?: number | null
  min: number
  max: number
  lowThreshold: number
  highThreshold: number
  lowLabel?: string
  highLabel?: string
}) {
  const safeValue = value ?? (min + max) / 2
  const percentage = Math.min(100, Math.max(0, ((safeValue - min) / (max - min)) * 100))
  const status = safeValue <= lowThreshold ? "LOW" : safeValue >= highThreshold ? "HIGH" : "NEUTRAL"

  return (
    <div className="bg-black border border-white/10 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-white/50 uppercase tracking-wider">{title}</span>
        <span
          className={cn(
            "text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider font-medium",
            status === "HIGH" && "bg-[#ec3b70]/20 text-[#ec3b70]",
            status === "LOW" && "bg-emerald-400/20 text-emerald-400",
            status === "NEUTRAL" && "bg-white/10 text-white/60",
          )}
        >
          {status === "HIGH" ? highLabel : status === "LOW" ? lowLabel : "NEUTRAL"}
        </span>
      </div>

      <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${percentage}%`,
            background:
              status === "HIGH"
                ? "linear-gradient(90deg, #ec3b70, #ff6b9d)"
                : status === "LOW"
                  ? "linear-gradient(90deg, #34d399, #6ee7b7)"
                  : "linear-gradient(90deg, rgba(255,255,255,0.3), rgba(255,255,255,0.5))",
          }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white shadow-lg"
          style={{ left: `calc(${percentage}% - 3px)` }}
        />
      </div>

      <div className="flex items-center justify-between text-[9px] text-white/30">
        <span>{min}</span>
        <span
          className={cn(
            "text-base font-semibold",
            status === "HIGH" && "text-[#ec3b70]",
            status === "LOW" && "text-emerald-400",
            status === "NEUTRAL" && "text-white",
          )}
        >
          {safeValue.toFixed(1)}
        </span>
        <span>{max}</span>
      </div>
    </div>
  )
}

export function VisualMonitoringPanel({ data, currentPrice = 0 }: VisualMonitoringPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    exhaustion: true,
    dynamic: false,
    volatility: false,
    levels: false,
  })

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  const exhaustion = data?.exhaustion ?? {}
  const dynamicLevels = data?.dynamicLevels ?? data?.dynamicSR ?? {}
  const volatility = data?.volatility ?? {}
  const keyLevels = data?.keyLevels ?? {}

  const rsi = exhaustion.rsi ?? 50
  const cci = exhaustion.cci ?? 0
  const stochRsi = exhaustion.stochRsi ?? 50
  const fastStoch = exhaustion.fastStoch ?? exhaustion.fsto ?? 50

  const safeNumber = (val: unknown, fallback: number): number => {
    if (typeof val === "number" && !isNaN(val)) return val
    if (Array.isArray(val) && val.length > 0) {
      const last = val[val.length - 1]
      if (typeof last === "number" && !isNaN(last)) return last
    }
    return fallback
  }

  const ema20 = safeNumber(dynamicLevels.ema20, currentPrice)
  const ema50 = safeNumber(dynamicLevels.ema50, currentPrice)
  const sma200 = safeNumber(dynamicLevels.sma200, currentPrice)
  const alligator = dynamicLevels.alligator ?? {
    jaw: currentPrice,
    teeth: currentPrice,
    lips: currentPrice,
    trend: "NEUTRAL" as const,
  }

  const bbWidth = volatility.bbWidth ?? 0
  const bbPosition = volatility.bbPosition ?? "LOWER_HALF"
  const keltnerSqueeze = volatility.keltnerSqueeze ?? false
  const ttmSqueeze = volatility.ttmSqueeze ?? false
  const ttmMomentum = volatility.ttmMomentum ?? "NEUTRAL"
  const stdvPercentile = volatility.stdvPercentile ?? 0

  const fibLevels = keyLevels.fibLevels ?? []
  const pivotPoints = keyLevels.pivotPoints ?? {}
  const pivotPoint = keyLevels.pivotPoint ?? pivotPoints.pp ?? currentPrice

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-white/40">
        <Eye className="w-4 h-4" />
        <span className="text-[10px] uppercase tracking-[0.15em]">Visual Monitoring</span>
      </div>

      {/* Exhaustion Indicators */}
      <div className="bg-black border border-white/10 rounded-2xl overflow-hidden">
        <button onClick={() => toggleSection("exhaustion")} className="w-full flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
              <RefreshCcw className="w-4 h-4 text-white/50" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-white">Exhaustion Indicators</p>
              <p className="text-[10px] text-white/40">Overbought/Oversold for late-day</p>
            </div>
          </div>
          {expandedSections.exhaustion ? (
            <ChevronUp className="w-4 h-4 text-white/40" />
          ) : (
            <ChevronDown className="w-4 h-4 text-white/40" />
          )}
        </button>

        {expandedSections.exhaustion && (
          <div className="px-4 pb-4 grid grid-cols-2 gap-2">
            <GaugeCard title="RSI" value={rsi} min={0} max={100} lowThreshold={30} highThreshold={70} />
            <GaugeCard title="CCI" value={cci} min={-200} max={200} lowThreshold={-100} highThreshold={100} />
            <GaugeCard title="Stoch RSI %K" value={stochRsi} min={0} max={100} lowThreshold={20} highThreshold={80} />
            <GaugeCard title="Fast Stoch %K" value={fastStoch} min={0} max={100} lowThreshold={20} highThreshold={80} />
          </div>
        )}
      </div>

      {/* Dynamic Levels */}
      <div className="bg-black border border-white/10 rounded-2xl overflow-hidden">
        <button onClick={() => toggleSection("dynamic")} className="w-full flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
              <Layers className="w-4 h-4 text-white/50" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-white">Dynamic Levels</p>
              <p className="text-[10px] text-white/40">Moving support/resistance</p>
            </div>
          </div>
          {expandedSections.dynamic ? (
            <ChevronUp className="w-4 h-4 text-white/40" />
          ) : (
            <ChevronDown className="w-4 h-4 text-white/40" />
          )}
        </button>

        {expandedSections.dynamic && (
          <div className="px-4 pb-4 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-black/50 border border-white/5 rounded-lg p-2 text-center">
                <p className="text-[9px] text-white/40 uppercase">EMA 20</p>
                <p className={cn("text-sm font-medium", currentPrice > ema20 ? "text-emerald-400" : "text-[#ec3b70]")}>
                  ${ema20.toFixed(2)}
                </p>
              </div>
              <div className="bg-black/50 border border-white/5 rounded-lg p-2 text-center">
                <p className="text-[9px] text-white/40 uppercase">EMA 50</p>
                <p className={cn("text-sm font-medium", currentPrice > ema50 ? "text-emerald-400" : "text-[#ec3b70]")}>
                  ${ema50.toFixed(2)}
                </p>
              </div>
              <div className="bg-black/50 border border-white/5 rounded-lg p-2 text-center">
                <p className="text-[9px] text-white/40 uppercase">SMA 200</p>
                <p className={cn("text-sm font-medium", currentPrice > sma200 ? "text-emerald-400" : "text-[#ec3b70]")}>
                  ${sma200.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="bg-black/50 border border-white/5 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-white/40 uppercase">Alligator</span>
                <span
                  className={cn(
                    "text-[9px] px-1.5 py-0.5 rounded uppercase font-medium",
                    alligator.trend === "BULLISH" && "bg-emerald-400/20 text-emerald-400",
                    alligator.trend === "BEARISH" && "bg-[#ec3b70]/20 text-[#ec3b70]",
                    alligator.trend === "NEUTRAL" && "bg-white/10 text-white/60",
                  )}
                >
                  {alligator.trend}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                <div>
                  <p className="text-white/40">Jaw</p>
                  <p className="text-white font-medium">${(alligator.jaw ?? 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-white/40">Teeth</p>
                  <p className="text-white font-medium">${(alligator.teeth ?? 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-white/40">Lips</p>
                  <p className="text-white font-medium">${(alligator.lips ?? 0).toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Volatility Analysis */}
      <div className="bg-black border border-white/10 rounded-2xl overflow-hidden">
        <button onClick={() => toggleSection("volatility")} className="w-full flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
              <Activity className="w-4 h-4 text-white/50" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-white">Volatility Analysis</p>
              <p className="text-[10px] text-white/40">Squeeze & breakout detection</p>
            </div>
          </div>
          {expandedSections.volatility ? (
            <ChevronUp className="w-4 h-4 text-white/40" />
          ) : (
            <ChevronDown className="w-4 h-4 text-white/40" />
          )}
        </button>

        {expandedSections.volatility && (
          <div className="px-4 pb-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-black/50 border border-white/5 rounded-lg p-3">
                <p className="text-[9px] text-white/40 uppercase mb-1">Bollinger Bands</p>
                <p className="text-lg font-semibold text-white">{(bbWidth * 100).toFixed(2)}%</p>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/60 uppercase">
                  {bbPosition.replace("_", " ")}
                </span>
              </div>
              <div className="bg-black/50 border border-white/5 rounded-lg p-3">
                <p className="text-[9px] text-white/40 uppercase mb-1">Keltner Channels</p>
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "w-2.5 h-2.5 rounded-full",
                      keltnerSqueeze ? "bg-white/70 shadow-[0_0_8px_rgba(255,255,255,0.5)]" : "bg-emerald-400",
                    )}
                  />
                  <span className="text-sm font-medium text-white">{keltnerSqueeze ? "Squeeze ON" : "No Squeeze"}</span>
                </div>
              </div>
            </div>

            <div className="bg-black/50 border border-white/5 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] text-white/40 uppercase">TTM Squeeze</span>
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", ttmSqueeze ? "bg-[#ec3b70]" : "bg-emerald-400")} />
                  <span className="text-[10px] text-white/60 uppercase">{ttmSqueeze ? "Squeeze" : "No Squeeze"}</span>
                </div>
              </div>
              <p className="text-[10px] text-white/40">
                Momentum: <span className="text-white font-medium">{ttmMomentum}</span>
              </p>
            </div>

            <div className="bg-black/50 border border-white/5 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] text-white/40 uppercase">Volatility Percentile</span>
                <span className="text-emerald-400 font-medium">{stdvPercentile.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-[#ec3b70] rounded-full"
                  style={{ width: `${Math.min(100, Math.max(0, stdvPercentile))}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Key Price Levels */}
      <div className="bg-black border border-white/10 rounded-2xl overflow-hidden">
        <button onClick={() => toggleSection("levels")} className="w-full flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
              <Target className="w-4 h-4 text-white/50" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-white">Key Price Levels</p>
              <p className="text-[10px] text-white/40">Fibonacci & pivot points</p>
            </div>
          </div>
          {expandedSections.levels ? (
            <ChevronUp className="w-4 h-4 text-white/40" />
          ) : (
            <ChevronDown className="w-4 h-4 text-white/40" />
          )}
        </button>

        {expandedSections.levels && (
          <div className="px-4 pb-4 space-y-3">
            {fibLevels.length > 0 && (
              <div className="bg-black/50 border border-white/5 rounded-lg p-3">
                <p className="text-[9px] text-white/40 uppercase mb-2">Fibonacci Levels</p>
                <div className="space-y-1">
                  {fibLevels.slice(0, 5).map((fib, i) => (
                    <div key={i} className="flex items-center justify-between text-[10px]">
                      <span className="text-white/50">{fib.level}</span>
                      <span className="text-white font-medium">${(fib.value ?? fib.price ?? 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-black/50 border border-white/5 rounded-lg p-3">
              <p className="text-[9px] text-white/40 uppercase mb-2">Pivot Points</p>
              <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                <div>
                  <p className="text-white/40">S2</p>
                  <p className="text-emerald-400 font-medium">${(keyLevels.s2 ?? pivotPoints.s2 ?? 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-white/40">S1</p>
                  <p className="text-emerald-400 font-medium">${(keyLevels.s1 ?? pivotPoints.s1 ?? 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-white/40">PP</p>
                  <p className="text-white font-medium">${pivotPoint.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-white/40">R1</p>
                  <p className="text-[#ec3b70] font-medium">${(keyLevels.r1 ?? pivotPoints.r1 ?? 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-white/40">R2</p>
                  <p className="text-[#ec3b70] font-medium">${(keyLevels.r2 ?? pivotPoints.r2 ?? 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-white/40">R3</p>
                  <p className="text-[#ec3b70] font-medium">${(keyLevels.r3 ?? 0).toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
