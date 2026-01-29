"use client"

import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card"
import { ChevronUp, ChevronDown } from "lucide-react"

interface PivotPointsDisplayProps {
  pivot: number
  r1: number
  r2: number
  r3: number
  s1: number
  s2: number
  s3: number
  currentPrice: number
}

export function PivotPointsDisplay({ pivot, r1, r2, r3, s1, s2, s3, currentPrice }: PivotPointsDisplayProps) {
  const formatValue = (value: number | undefined | null) => {
    if (value === undefined || value === null || isNaN(value)) return "—"
    return value.toFixed(2)
  }

  const isNearLevel = (level: number | undefined | null, threshold = 5) => {
    if (level === undefined || level === null || isNaN(level)) return false
    return Math.abs(currentPrice - level) <= threshold
  }

  const getLevelStyle = (level: number | undefined | null, isResistance: boolean) => {
    if (level === undefined || level === null || isNaN(level)) return "text-foreground/30"
    if (isNearLevel(level, 3)) return "text-white font-medium"
    if (isNearLevel(level, 10)) return "text-white/70"
    return isResistance ? "text-rose-400/50" : "text-emerald-400/50"
  }

  return (
    <GlassCard>
      <GlassCardHeader>
        <GlassCardTitle className="flex items-center gap-2">
          Pivot Points
          {(isNearLevel(r1) || isNearLevel(s1)) && <span className="w-2 h-2 rounded-full bg-white animate-pulse" />}
        </GlassCardTitle>
      </GlassCardHeader>
      <GlassCardContent>
        <div className="space-y-2">
          {/* Resistance levels */}
          {[
            { label: "R3", value: r3 },
            { label: "R2", value: r2 },
            { label: "R1", value: r1 },
          ].map((level) => (
            <div key={level.label} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <ChevronUp className="h-3 w-3 text-rose-400/50" />
                <span className={getLevelStyle(level.value, true)}>{level.label}</span>
                {isNearLevel(level.value) && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <span className={`font-mono ${getLevelStyle(level.value, true)}`}>{formatValue(level.value)}</span>
            </div>
          ))}

          {/* Pivot */}
          <div className="flex items-center justify-between py-3 my-2 border-y border-white/10">
            <span className="text-foreground/80 font-medium">Pivot</span>
            <span className="font-mono text-foreground/80">{formatValue(pivot)}</span>
          </div>

          {/* Support levels */}
          {[
            { label: "S1", value: s1 },
            { label: "S2", value: s2 },
            { label: "S3", value: s3 },
          ].map((level) => (
            <div key={level.label} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <ChevronDown className="h-3 w-3 text-emerald-400/50" />
                <span className={getLevelStyle(level.value, false)}>{level.label}</span>
                {isNearLevel(level.value) && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <span className={`font-mono ${getLevelStyle(level.value, false)}`}>{formatValue(level.value)}</span>
            </div>
          ))}

          {/* Current price */}
          <div className="flex items-center justify-between pt-4 mt-4 border-t border-white/10">
            <span className="text-foreground/50 font-light">Current</span>
            <span className="text-2xl font-light text-foreground/90">{formatValue(currentPrice)}</span>
          </div>
        </div>
      </GlassCardContent>
    </GlassCard>
  )
}
