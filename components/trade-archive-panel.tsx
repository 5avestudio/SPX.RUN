"use client"

import { useState, useEffect, useMemo } from "react"
import {
  TrendingUp,
  TrendingDown,
  ChevronRight,
  ChevronDown,
  Activity,
  Calendar,
  Lightbulb,
  CheckCircle,
  XCircle,
  Target,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  getArchivedTrades,
  calculateArchiveStats,
  filterByTimePeriod,
  type ArchivedTrade,
  type TradeArchiveStats,
  type TimePeriodFilter,
} from "@/lib/trade-archive"
import { ArchiveBreakoutChart } from "@/components/archive-breakout-chart"

interface TradeArchivePanelProps {
  className?: string
}

function getTradeGrade(trade: ArchivedTrade): { grade: string; color: string; bgColor: string } {
  let score = 0
  const maxScore = 100

  // ADX scoring (40 points max)
  if (trade.indicators.adx >= 30) score += 40
  else if (trade.indicators.adx >= 25) score += 30
  else if (trade.indicators.adx >= 20) score += 15
  else score += 0

  // ADX Trend (15 points)
  if (trade.indicators.adxTrend === "rising") score += 15
  else if (trade.indicators.adxTrend === "flat") score += 5

  // RVOL scoring (15 points)
  if (trade.indicators.rvol >= 2.0) score += 15
  else if (trade.indicators.rvol >= 1.8) score += 10
  else if (trade.indicators.rvol >= 1.5) score += 5

  // EWO scoring (15 points)
  if (Math.abs(trade.indicators.ewo) >= 5) score += 15
  else if (Math.abs(trade.indicators.ewo) >= 3) score += 8

  // SuperTrend timing (15 points)
  if (trade.superTrend.signalDelay === 0) score += 15
  else if ((trade.superTrend.signalDelay || 0) <= 60) score += 10
  else if ((trade.superTrend.signalDelay || 0) <= 180) score += 5

  // Calculate grade
  const percentage = (score / maxScore) * 100

  if (percentage >= 90) return { grade: "A+", color: "text-emerald-400", bgColor: "bg-emerald-500/20" }
  if (percentage >= 80) return { grade: "A", color: "text-emerald-400", bgColor: "bg-emerald-500/20" }
  if (percentage >= 70) return { grade: "B", color: "text-cyan-400", bgColor: "bg-cyan-500/20" }
  if (percentage >= 60) return { grade: "C", color: "text-yellow-400", bgColor: "bg-yellow-500/20" }
  if (percentage >= 50) return { grade: "D", color: "text-orange-400", bgColor: "bg-orange-500/20" }
  return { grade: "F", color: "text-red-400", bgColor: "bg-red-500/20" }
}

function generateTradeAnalysis(trade: ArchivedTrade): {
  keyLesson: string
  wentRight: string[]
  wentWrong: string[]
  howToImprove: string[]
} {
  const wentRight: string[] = []
  const wentWrong: string[] = []
  const howToImprove: string[] = []
  let keyLesson = ""

  // Analyze ADX
  if (trade.indicators.adx >= 25) {
    wentRight.push(`Strong ADX at ${trade.indicators.adx.toFixed(1)} - good trend confirmation`)
  } else if (trade.indicators.adx >= 20) {
    wentWrong.push(`Weak ADX (${trade.indicators.adx.toFixed(1)}) - entered during consolidation`)
    howToImprove.push("Wait for ADX to cross above 25 before entry")
  } else {
    wentWrong.push(`Very weak ADX (< 20) - no trend = no edge`)
    keyLesson = `ADX below 20 = chop zone. No trend = no edge. Wait for breakouts.`
    howToImprove.push("Wait for ADX to cross above 25 before entry")
  }

  // Analyze ADX trend
  if (trade.indicators.adxTrend === "rising") {
    wentRight.push("ADX rising - strengthening trend")
  } else if (trade.indicators.adxTrend === "falling") {
    wentWrong.push("ADX falling - weakening trend momentum")
    howToImprove.push("Only enter when ADX is rising, not falling")
  }

  // Analyze RVOL
  if (trade.indicators.rvol >= 1.8) {
    wentRight.push(`High RVOL (${trade.indicators.rvol.toFixed(1)}x) - strong conviction`)
  } else {
    wentWrong.push(`Low volume (${trade.indicators.rvol.toFixed(1)}x) - insufficient conviction in the move`)
    howToImprove.push("Only enter when RVOL > 1.8x for conviction")
  }

  // Analyze EWO
  if (Math.abs(trade.indicators.ewo) >= 5) {
    wentRight.push(`Strong EWO (${trade.indicators.ewo.toFixed(1)}) - momentum confirmed`)
  } else {
    wentWrong.push(`EWO near zero (${trade.indicators.ewo.toFixed(1)}) - no momentum confirmation`)
    howToImprove.push("Wait for EWO > 5 or < -5 for momentum confirmation")
  }

  // Analyze SuperTrend timing
  if (trade.superTrend.signal !== "HOLD") {
    if (trade.superTrend.signalDelay === 0) {
      wentRight.push("Quick signal execution (< 30s delay)")
    } else if ((trade.superTrend.signalDelay || 0) > 120) {
      wentWrong.push(`Late entry - ${Math.floor((trade.superTrend.signalDelay || 0) / 60)}min after signal`)
      howToImprove.push("Execute within 60 seconds of SuperTrend flip")
    }
  } else {
    wentWrong.push("No clear SuperTrend signal - choppy conditions")
    howToImprove.push("Wait for clear BUY/SELL signal before entry")
  }

  // Analyze MACD
  if (Math.abs(trade.indicators.macdHistogram) >= 0.2) {
    wentRight.push("Strong MACD histogram - momentum aligned")
  } else {
    wentWrong.push(`Weak MACD histogram (${trade.indicators.macdHistogram.toFixed(2)}) - no momentum`)
  }

  // Generate key lesson if not set
  if (!keyLesson) {
    if (trade.pnlPercent > 0) {
      keyLesson = wentRight[0] || "Good execution on this trade."
    } else {
      keyLesson = wentWrong[0] || "Review entry criteria for improvement."
    }
  }

  // Add general improvements
  if (howToImprove.length === 0) {
    howToImprove.push("Continue following the winning pattern")
  }
  howToImprove.push("Use limit orders 1-2 cents below ask for better fills")

  return { keyLesson, wentRight, wentWrong, howToImprove }
}

export function TradeArchivePanel({ className }: TradeArchivePanelProps) {
  const [trades, setTrades] = useState<ArchivedTrade[]>([])
  const [stats, setStats] = useState<TradeArchiveStats | null>(null)
  const [selectedTrade, setSelectedTrade] = useState<ArchivedTrade | null>(null)
  const [filterTimeframe, setFilterTimeframe] = useState<"all" | "1m" | "5m" | "15m">("all")
  const [timePeriod, setTimePeriod] = useState<TimePeriodFilter>("all")
  const [typeFilter, setTypeFilter] = useState<"all" | "CALL" | "PUT">("all")

  useEffect(() => {
    const archived = getArchivedTrades()
    setTrades(archived)
    setStats(calculateArchiveStats(archived))
  }, [])

  const filteredTrades = useMemo(() => {
    return trades
      .filter((t) => {
        const periodFiltered = filterByTimePeriod([t], timePeriod)
        return periodFiltered.length > 0
      })
      .filter((t) => {
        if (typeFilter === "all") return true
        return t.type === typeFilter
      })
      .filter((t) => {
        if (filterTimeframe === "all") return true
        return t.superTrend.timeframe === filterTimeframe
      })
  }, [trades, timePeriod, typeFilter, filterTimeframe])

  useEffect(() => {
    setStats(calculateArchiveStats(filteredTrades))
  }, [filteredTrades])

  if (selectedTrade) {
    return (
      <div className={cn("space-y-4", className)}>
        <button
          onClick={() => setSelectedTrade(null)}
          className="flex items-center gap-2 text-white/50 hover:text-white transition-colors min-h-[44px]"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
          <span className="text-sm">Back to Performance</span>
        </button>
        <ArchiveBreakoutChart trade={selectedTrade} />
      </div>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header Stats */}
      <div className="p-4 rounded-2xl bg-black/40">
        <p className="text-[10px] text-white/40 uppercase tracking-wider mb-3">Performance History</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background:
                  "linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(6, 182, 212, 0.2) 50%, rgba(59, 130, 246, 0.2) 100%)",
              }}
            >
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-lg font-semibold text-white">{stats?.totalTrades || 0} Trades</p>
              <p className="text-xs text-white/40">Reference data from Webull</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="px-2 py-1 rounded-lg bg-emerald-500/20">
              <span className="text-[10px] text-emerald-400 font-medium">{stats?.callCount || 0} CALL</span>
            </div>
            <div className="px-2 py-1 rounded-lg bg-[#ec3b70]/20">
              <span className="text-[10px] text-[#ec3b70] font-medium">{stats?.putCount || 0} PUT</span>
            </div>
          </div>
        </div>
      </div>

      {/* ... existing filter sections ... */}
      <div className="p-3 rounded-2xl bg-black/40">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="w-3 h-3 text-white/40" />
          <p className="text-[10px] text-white/40 uppercase tracking-wider">Time Period</p>
        </div>
        <div className="flex gap-2">
          {(["today", "week", "month", "year", "all"] as const).map((period) => (
            <button
              key={period}
              onClick={() => setTimePeriod(period)}
              className={cn(
                "flex-1 px-2 py-2 rounded-xl text-[10px] uppercase transition-all min-h-[44px]",
                timePeriod === period ? "bg-white text-black font-medium" : "bg-white/5 text-white/60 hover:text-white",
              )}
            >
              {period === "today" ? "Day" : period}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 rounded-2xl bg-black/40">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-3 h-3 text-white/40" />
          <p className="text-[10px] text-white/40 uppercase tracking-wider">Trade Type</p>
        </div>
        <div className="flex gap-2">
          {(["all", "CALL", "PUT"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={cn(
                "flex-1 px-3 py-2 rounded-xl text-xs uppercase transition-all min-h-[44px] font-medium",
                typeFilter === type
                  ? type === "CALL"
                    ? "text-black"
                    : type === "PUT"
                      ? "text-black"
                      : "bg-white text-black"
                  : "bg-white/5 text-white/60 hover:text-white",
              )}
              style={
                typeFilter === type && type === "CALL"
                  ? { background: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)" }
                  : typeFilter === type && type === "PUT"
                    ? { background: "linear-gradient(135deg, #ec3b70 0%, #ef4444 100%)" }
                    : typeFilter === type && type === "all"
                      ? { background: "#ffffff" }
                      : undefined
              }
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-3">
          <div
            className="p-4 rounded-2xl"
            style={{
              background:
                "linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(6, 182, 212, 0.1) 50%, rgba(59, 130, 246, 0.05) 100%)",
            }}
          >
            <p
              className="text-[10px] uppercase tracking-wider"
              style={{
                background: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Average P&L
            </p>
            <p className="text-2xl font-semibold mt-1 text-emerald-400">+{stats.avgPnlPercent.toFixed(0)}%</p>
          </div>
          <div className="p-4 rounded-2xl bg-black/40">
            <p className="text-[10px] text-white/40 uppercase tracking-wider">Avg ADX Entry</p>
            <p className="text-2xl font-semibold text-white mt-1">{stats.avgAdxAtEntry.toFixed(1)}</p>
          </div>
        </div>
      )}

      {/* SuperTrend Timeframe Filter */}
      <div className="p-3 rounded-2xl bg-black/40">
        <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Filter by SuperTrend</p>
        <div className="flex gap-2">
          {(["all", "1m", "5m", "15m"] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setFilterTimeframe(tf)}
              className={cn(
                "flex-1 px-3 py-2 rounded-xl text-xs uppercase transition-all min-h-[44px]",
                filterTimeframe === tf
                  ? "bg-white text-black font-medium"
                  : "bg-white/5 text-white/60 hover:text-white",
              )}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Trade List */}
      <div className="space-y-2">
        <p className="text-[10px] text-white/40 uppercase tracking-wider px-1">
          Tap to view analysis ({filteredTrades.length} trades)
        </p>
        {filteredTrades.length === 0 ? (
          <div className="p-6 rounded-2xl bg-black/40 text-center">
            <p className="text-white/40 text-sm">No trades match current filters</p>
          </div>
        ) : (
          filteredTrades.map((trade) => (
            <TradeListItem key={trade.id} trade={trade} onSelect={() => setSelectedTrade(trade)} />
          ))
        )}
      </div>

      {/* Pattern Summary */}
      <div className="p-4 rounded-2xl bg-black/40">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-white/40" />
          <p className="text-[10px] text-white/40 uppercase tracking-wider">Winning Pattern</p>
        </div>
        <div className="space-y-2">
          <PatternRow label="ADX Entry" value="> 25 & Rising" highlight />
          <PatternRow label="EWO Threshold" value="> 5 or < -5" highlight />
          <PatternRow label="RVOL Minimum" value="> 1.8x" />
          <PatternRow label="Best Timeframe" value="1-5m SuperTrend" />
          <PatternRow label="MACD Histogram" value="> 0.20 (PUTs)" />
          <PatternRow label="Avoid" value="ADX < 20" warning />
        </div>
      </div>
    </div>
  )
}

function TradeListItem({
  trade,
  onSelect,
}: {
  trade: ArchivedTrade
  onSelect: () => void
}) {
  const [showAnalysis, setShowAnalysis] = useState(false)
  const isPut = trade.type === "PUT"
  const isWeakADX = trade.indicators.adx < 25
  const isLoss = trade.pnlPercent < 0
  const { grade, color, bgColor } = getTradeGrade(trade)
  const analysis = generateTradeAnalysis(trade)

  return (
    <div
      className="rounded-2xl transition-all overflow-hidden"
      style={
        isPut
          ? {
              background:
                "linear-gradient(135deg, rgba(236, 59, 112, 0.15) 0%, rgba(239, 68, 68, 0.1) 50%, rgba(251, 113, 133, 0.05) 100%)",
            }
          : {
              background:
                "linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(6, 182, 212, 0.1) 50%, rgba(59, 130, 246, 0.05) 100%)",
            }
      }
    >
      <button onClick={onSelect} className="w-full p-4 text-left min-h-[80px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={
                isPut
                  ? { background: "linear-gradient(135deg, rgba(236, 59, 112, 0.3) 0%, rgba(239, 68, 68, 0.2) 100%)" }
                  : { background: "linear-gradient(135deg, rgba(16, 185, 129, 0.3) 0%, rgba(6, 182, 212, 0.2) 100%)" }
              }
            >
              {isPut ? (
                <TrendingDown className="w-5 h-5 text-[#ec3b70]" />
              ) : (
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-white">
                  {trade.type} ${trade.strike}
                </p>
                <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold", bgColor, color)}>
                  Grade: {grade}
                </span>
                {isWeakADX && (
                  <span className="px-1.5 py-0.5 rounded text-[8px] bg-white/20 text-white border border-white/30 font-medium drop-shadow-[0_0_6px_rgba(255,255,255,0.6)]">
                    WEAK ADX
                  </span>
                )}
              </div>
              <p className="text-[11px] text-white/40">
                {trade.date} · {trade.time}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className={cn("text-lg font-bold", isLoss ? "text-red-400" : "text-emerald-400")}>
                {isLoss ? "" : "+"}
                {trade.pnlPercent.toFixed(0)}%
              </p>
              <p className="text-[10px] text-white/40">
                ${trade.entry.toFixed(2)} → ${trade.exit.toFixed(2)}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-white/30" />
          </div>
        </div>

        {/* Quick indicator dots */}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/5">
          <IndicatorDot label="ADX" active={trade.indicators.adx >= 25} value={trade.indicators.adx.toFixed(0)} />
          <IndicatorDot label="EWO" active={Math.abs(trade.indicators.ewo) >= 5} />
          <IndicatorDot label="RVOL" active={trade.indicators.rvol >= 1.8} />
          <IndicatorDot label="ST" active={trade.superTrend.signal !== "HOLD"} />
          <span className="text-[9px] text-white/30 ml-auto">{trade.superTrend.timeframe}</span>
        </div>
      </button>

      <div className="px-4 pb-2">
        <button
          onClick={(e) => {
            e.stopPropagation()
            setShowAnalysis(!showAnalysis)
          }}
          className="flex items-center gap-2 text-[10px] text-white/50 hover:text-white/70 transition-colors py-2 min-h-[44px]"
        >
          <Lightbulb className="w-3 h-3" />
          <span>{showAnalysis ? "Hide Analysis" : "Show Analysis"}</span>
          <ChevronDown className={cn("w-3 h-3 transition-transform", showAnalysis && "rotate-180")} />
        </button>
      </div>

      {showAnalysis && (
        <div className="px-4 pb-4 space-y-3">
          {/* Key Lesson */}
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Lightbulb className="w-3 h-3 text-amber-400" />
              </div>
              <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Key Lesson</span>
            </div>
            <p className="text-xs text-white/80">{analysis.keyLesson}</p>
          </div>

          {/* What Went Right */}
          {analysis.wentRight.length > 0 && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
                  What Went Right
                </span>
              </div>
              <div className="space-y-1">
                {analysis.wentRight.map((item, i) => (
                  <p key={i} className="text-xs text-white/70 flex items-start gap-2">
                    <span className="text-emerald-400">+</span>
                    {item}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* What Went Wrong */}
          {analysis.wentWrong.length > 0 && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="w-4 h-4 text-red-400" />
                <span className="text-[10px] font-semibold text-red-400 uppercase tracking-wider">What Went Wrong</span>
              </div>
              <div className="space-y-1">
                {analysis.wentWrong.map((item, i) => (
                  <p key={i} className="text-xs text-white/70 flex items-start gap-2">
                    <span className="text-red-400">-</span>
                    {item}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* How To Improve */}
          <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-orange-400" />
              <span className="text-[10px] font-semibold text-orange-400 uppercase tracking-wider">How To Improve</span>
            </div>
            <div className="space-y-1">
              {analysis.howToImprove.map((item, i) => (
                <p key={i} className="text-xs text-white/70 flex items-start gap-2">
                  <span className="text-orange-400">{i + 1}.</span>
                  {item}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function IndicatorDot({ label, active, value }: { label: string; active: boolean; value?: string }) {
  return (
    <div className="flex items-center gap-1">
      <div
        className="w-1.5 h-1.5 rounded-full"
        style={
          active
            ? { background: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)" }
            : { background: "rgba(255, 255, 255, 0.2)" }
        }
      />
      <span className="text-[9px] text-white/40 uppercase">{label}</span>
      {value && <span className="text-[8px] text-white/30">({value})</span>}
    </div>
  )
}

function PatternRow({
  label,
  value,
  highlight,
  warning,
}: {
  label: string
  value: string
  highlight?: boolean
  warning?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-white/50">{label}</span>
      <span
        className={cn(
          "text-xs font-medium",
          !highlight && !warning && "text-white",
          warning && "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]",
        )}
        style={
          highlight
            ? {
                background: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }
            : undefined
        }
      >
        {value}
      </span>
    </div>
  )
}
