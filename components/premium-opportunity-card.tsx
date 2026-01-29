"use client"

import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card"
import { AlertTriangle, Target, TrendingUp, TrendingDown, Zap, Volume2, Activity, ArrowUpDown } from "lucide-react"
import type { PremiumOpportunity } from "@/lib/indicators"

interface PremiumOpportunityCardProps {
  opportunity: PremiumOpportunity
  currentPrice: number
  pivotR1: number
  pivotS1: number
  pivotR2: number
  pivotS2: number
}

export function PremiumOpportunityCard({ opportunity, currentPrice, pivotR1, pivotS1 }: PremiumOpportunityCardProps) {
  const isHighProbability = opportunity.strength === "HIGH"
  const isMediumProbability = opportunity.strength === "MEDIUM"

  const targetPrice = opportunity.type === "CALL" ? pivotR1 : opportunity.type === "PUT" ? pivotS1 : currentPrice
  const potentialMove = Math.abs(targetPrice - currentPrice)
  const suggestedStrike =
    opportunity.type === "CALL" ? Math.ceil(currentPrice / 5) * 5 : Math.floor(currentPrice / 5) * 5

  return (
    <GlassCard
      variant={opportunity.type === "CALL" ? "success" : opportunity.type === "PUT" ? "danger" : "default"}
      glow={isHighProbability && opportunity.type !== "NONE"}
    >
      <GlassCardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isHighProbability ? "bg-white/20" : "bg-white/10"}`}>
              <Zap className={`h-5 w-5 ${isHighProbability ? "text-white" : "text-foreground/50"}`} />
            </div>
            <GlassCardTitle>Premium Scanner</GlassCardTitle>
          </div>
          <div
            className={`
            px-3 py-1.5 rounded-full text-sm font-light
            ${
              isHighProbability
                ? "bg-white/20 text-white"
                : isMediumProbability
                  ? "bg-white/15 text-white/80"
                  : "bg-white/10 text-foreground/50"
            }
          `}
          >
            {opportunity.entryScore}% Score
          </div>
        </div>
      </GlassCardHeader>

      <GlassCardContent className="space-y-4">
        {opportunity.type !== "NONE" ? (
          <>
            {/* Main Signal */}
            <div
              className={`
              p-6 rounded-2xl text-center
              ${
                opportunity.type === "CALL"
                  ? "bg-gradient-to-br from-emerald-500/15 to-teal-500/10"
                  : "bg-gradient-to-br from-rose-500/15 to-fuchsia-700/10"
              }
            `}
            >
              <div className="flex items-center justify-center gap-3">
                {opportunity.type === "CALL" ? (
                  <TrendingUp className="h-8 w-8 text-emerald-400" />
                ) : (
                  <TrendingDown className="h-8 w-8 text-rose-400" />
                )}
                <span
                  className={`text-3xl font-light ${opportunity.type === "CALL" ? "text-emerald-400" : "text-rose-400"}`}
                >
                  BUY {opportunity.type}
                </span>
              </div>
              <div
                className={`
                inline-block mt-3 px-4 py-1.5 rounded-full text-sm
                ${
                  opportunity.strength === "HIGH"
                    ? "bg-white/20 text-white"
                    : opportunity.strength === "MEDIUM"
                      ? "bg-white/15 text-white/80"
                      : "bg-white/10 text-foreground/50"
                }
              `}
              >
                {opportunity.strength} Probability
              </div>
            </div>

            {/* Entry Details */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Strike", value: `$${suggestedStrike}` },
                { label: "Target", value: `$${targetPrice.toFixed(0)}` },
                { label: "Potential", value: `${potentialMove.toFixed(1)} pts`, highlight: true },
                { label: "Current", value: `$${currentPrice.toFixed(2)}` },
              ].map((item) => (
                <div key={item.label} className="p-4 rounded-xl bg-white/5 text-center">
                  <p className="text-xs text-foreground/40 uppercase tracking-wider">{item.label}</p>
                  <p className={`text-xl font-light mt-1 ${item.highlight ? "text-primary" : "text-foreground/80"}`}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Reason */}
            <div className="p-4 bg-white/5 rounded-xl">
              <p className="text-sm text-foreground/50 font-light">{opportunity.reason}</p>
            </div>

            {/* Conditions */}
            <div className="grid grid-cols-5 gap-2">
              {[
                { icon: Target, label: "Level", active: opportunity.conditions.atKeyLevel },
                { icon: Activity, label: "RSI", active: opportunity.conditions.rsiExtreme },
                { icon: Volume2, label: "Volume", active: opportunity.conditions.volumeSpike },
                { icon: ArrowUpDown, label: "MACD", active: opportunity.conditions.macdCrossing },
                { icon: TrendingUp, label: "Trend", active: opportunity.conditions.trendAligning },
              ].map((cond) => (
                <div
                  key={cond.label}
                  className={`p-2 rounded-xl text-center ${cond.active ? "bg-emerald-500/15" : "bg-white/5"}`}
                >
                  <cond.icon className={`h-4 w-4 mx-auto ${cond.active ? "text-emerald-400" : "text-foreground/30"}`} />
                  <p className="text-xs mt-1 text-foreground/40">{cond.label}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="p-8 text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-white/10 flex items-center justify-center">
              <AlertTriangle className="h-7 w-7 text-white/70" />
            </div>
            <p className="text-lg font-light text-foreground/60">No Clear Opportunity</p>
            <p className="text-sm text-foreground/30 mt-1 font-light">Waiting for better alignment</p>
          </div>
        )}
      </GlassCardContent>
    </GlassCard>
  )
}
