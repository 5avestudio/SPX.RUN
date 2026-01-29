"use client"

import { cn } from "@/lib/utils"
import { DollarSign } from "lucide-react"

interface SimulatedReturnsProps {
  budget: number
  winRate: number
  className?: string
}

export function SimulatedReturns({ budget, winRate, className }: SimulatedReturnsProps) {
  const calculateReturns = () => {
    const baseMultiplier = winRate / 100
    const conservative = budget * 0.15 * baseMultiplier
    const moderate = budget * 0.35 * baseMultiplier
    const powerHour = budget * 0.75 * baseMultiplier
    const maxLoss = budget * 0.5

    return { conservative, moderate, powerHour, maxLoss }
  }

  const returns = calculateReturns()

  if (winRate === 0) return null

  return (
    <div className={cn("rounded-3xl glass-frost p-5 border border-white/10", className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-white/40" />
          <span className="text-xs uppercase tracking-[0.2em] text-white/40">Simulated Returns</span>
        </div>
        <span className="text-xs text-white/30">${budget} budget</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-3 rounded-xl bg-white/5">
          <p className="text-emerald-400 text-lg font-light">+${returns.conservative.toFixed(0)}</p>
          <p className="text-[10px] text-white/30 mt-1">Safe</p>
        </div>
        <div className="text-center p-3 rounded-xl bg-white/5">
          <p className="text-emerald-400 text-lg font-light">+${returns.moderate.toFixed(0)}</p>
          <p className="text-[10px] text-white/30 mt-1">Target</p>
        </div>
        <div className="text-center p-3 rounded-xl bg-white/5">
          <p className="text-emerald-400 text-lg font-light">+${returns.powerHour.toFixed(0)}</p>
          <p className="text-[10px] text-white/30 mt-1">Power Hr</p>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
        <span className="text-xs text-white/30">Max Risk</span>
        <span className="text-[#ec3b70] text-sm">-${returns.maxLoss.toFixed(0)}</span>
      </div>

      <div className="mt-3 pt-3 border-t border-white/10">
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/30">Win Rate</span>
          <span className="text-emerald-400 text-sm">{winRate}%</span>
        </div>
      </div>
    </div>
  )
}
