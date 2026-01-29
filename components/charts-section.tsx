"use client"

import type React from "react"

import { useState, useCallback, useEffect, useRef } from "react"
import { PivotGauge } from "@/components/pivot-gauge"
import { BollingerCloud } from "@/components/bollinger-cloud"
import { TeslaChart } from "@/components/tesla-chart"
import { IndicatorPieChart } from "@/components/indicator-pie-chart"
import { VisualMonitoringPanel } from "@/components/visual-monitoring-panel"
import { PivotThresholdPanel } from "@/components/pivot-threshold-panel"
import {
  Layers,
  LayoutGrid,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  GripVertical,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface ChartsSectionProps {
  marketData: Array<{
    timestamp: number
    open: number
    high: number
    low: number
    close: number
    volume?: number
  }>
  currentPrice: number
  signal: string
  pivotLevels: {
    pivot: number
    r1: number
    r2: number
    r3: number
    s1: number
    s2: number
    s3: number
  }
  bollingerBands: {
    upper: number
    middle: number
    lower: number
  }
  trend: "up" | "down" | "neutral"
  priceHistory: number[]
  indicators?: {
    rsi: number
    adx: number
    ewo: number
    macd: number
    superTrendSignal: string
    volume?: { ratio: number; signal: "HIGH" | "LOW" | "NORMAL" }
    goldenCross?: "GOLDEN" | "DEATH" | "NONE"
    getSignal: (name: string) => "buy" | "sell" | "hold" | "neutral"
  }
  visualMonitoringData?: {
    exhaustion: {
      cci: number
      fsto: number
      stochRsi: number
      rsi: number
    }
    dynamicSR: {
      ema20: number
      ema50: number
      sma200: number
      alligator: { jaw: number; teeth: number; lips: number }
    }
    volatility: {
      bbWidth: number
      keltnerSqueeze: boolean
      ttmSqueeze: boolean
      stdvPercentile: number
    }
    keyLevels: {
      fibLevels: { level: string; price: number }[]
      pivotPoints: { pp: number; r1: number; r2: number; s1: number; s2: number }
    }
  } | null
}

interface SectionItem {
  id: string
  title: string
  component: React.ReactNode
  expandedComponent?: React.ReactNode
}

function CollapsibleSection({
  section,
  index,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging,
  isExpanded,
  onToggleExpand,
}: {
  section: SectionItem
  index: number
  onDragStart: (index: number) => void
  onDragOver: (e: React.DragEvent, index: number) => void
  onDrop: (index: number) => void
  isDragging: boolean
  isExpanded: boolean
  onToggleExpand: () => void
}) {
  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-white/30 cursor-grab active:cursor-grabbing" />
          <p className="text-[10px] uppercase tracking-wider text-white/40">{section.title}</p>
        </div>
        {section.expandedComponent && (
          <button
            onClick={onToggleExpand}
            className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/5 text-white/40 text-[10px] hover:bg-white/10 transition-colors"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-3 h-3" />
                <span>Less</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" />
                <span>More</span>
              </>
            )}
          </button>
        )}
      </div>
      {isExpanded && section.expandedComponent ? section.expandedComponent : section.component}
    </>
  )
}

export function ChartsSection({
  marketData,
  currentPrice,
  signal,
  pivotLevels,
  bollingerBands,
  trend,
  priceHistory,
  indicators,
  visualMonitoringData,
}: ChartsSectionProps) {
  const [viewMode, setViewMode] = useState<"separate" | "combined" | "indicators">("separate")
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [sectionOrder, setSectionOrder] = useState<string[]>([])
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    pivot: false,
    bollinger: false,
    candle: false,
  })

  const containerRef = useRef<HTMLDivElement>(null)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)

  const compactHeight = "h-[220px]"
  const expandedHeight = "h-[320px]"
  const bollingerCompactHeight = "h-[200px]"
  const bollingerExpandedHeight = "h-[280px]"

  const minSwipeDistance = 50

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    if (isLeftSwipe) {
      if (viewMode === "separate") setViewMode("combined")
      else if (viewMode === "combined") setViewMode("indicators")
    } else if (isRightSwipe) {
      if (viewMode === "indicators") setViewMode("combined")
      else if (viewMode === "combined") setViewMode("separate")
    }
  }

  const getSuperTrendIcon = () => {
    if (!indicators) return Minus
    const signal = indicators.getSignal("SuperTrend")
    if (signal === "buy") return TrendingUp
    if (signal === "sell") return TrendingDown
    return Minus
  }

  const getSuperTrendColor = () => {
    if (!indicators) return "text-white/40"
    const signal = indicators.getSignal("SuperTrend")
    if (signal === "buy") return "text-emerald-400"
    if (signal === "sell") return "text-[#ec3b70]"
    return "text-white/60"
  }

  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault()
  }, [])

  const handleDrop = useCallback(
    (dropIndex: number) => {
      if (draggedIndex === null || draggedIndex === dropIndex) {
        setDraggedIndex(null)
        return
      }

      setSectionOrder((prev) => {
        const newOrder = [...prev]
        const [removed] = newOrder.splice(draggedIndex, 1)
        newOrder.splice(dropIndex, 0, removed)
        return newOrder
      })
      setDraggedIndex(null)
    },
    [draggedIndex],
  )

  const toggleExpand = (sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }))
  }

  const SuperTrendIcon = getSuperTrendIcon()

  const separateSections: SectionItem[] = [
    {
      id: "pivot",
      title: "Pivot Points",
      component: (
        <div className={cn("w-full", compactHeight)}>
          <PivotGauge
            currentPrice={currentPrice}
            pivot={pivotLevels.pivot}
            r1={pivotLevels.r1}
            r2={pivotLevels.r2}
            r3={pivotLevels.r3}
            s1={pivotLevels.s1}
            s2={pivotLevels.s2}
            s3={pivotLevels.s3}
            className="h-full"
            compact
          />
        </div>
      ),
      expandedComponent: (
        <div className={cn("w-full", expandedHeight)}>
          <PivotGauge
            currentPrice={currentPrice}
            pivot={pivotLevels.pivot}
            r1={pivotLevels.r1}
            r2={pivotLevels.r2}
            r3={pivotLevels.r3}
            s1={pivotLevels.s1}
            s2={pivotLevels.s2}
            s3={pivotLevels.s3}
            className="h-full"
          />
        </div>
      ),
    },
    {
      id: "bollinger",
      title: "Bollinger Cloud",
      component: (
        <div className={cn("w-full", bollingerCompactHeight)}>
          <BollingerCloud
            currentPrice={currentPrice}
            upper={bollingerBands.upper}
            middle={bollingerBands.middle}
            lower={bollingerBands.lower}
            priceHistory={priceHistory}
            trend={trend}
            className="h-full"
          />
        </div>
      ),
      expandedComponent: (
        <div className={cn("w-full", bollingerExpandedHeight)}>
          <BollingerCloud
            currentPrice={currentPrice}
            upper={bollingerBands.upper}
            middle={bollingerBands.middle}
            lower={bollingerBands.lower}
            priceHistory={priceHistory}
            trend={trend}
            className="h-full"
          />
        </div>
      ),
    },
    {
      id: "candle",
      title: "Candlestick",
      component: (
        <div className={cn("w-full relative", compactHeight)}>
          <TeslaChart
            data={marketData}
            currentPrice={currentPrice}
            signal={signal}
            pivotLevels={{
              pivot: pivotLevels.pivot,
              r1: pivotLevels.r1,
              r2: pivotLevels.r2,
              s1: pivotLevels.s1,
              s2: pivotLevels.s2,
            }}
            className="h-full"
          />
          <PivotThresholdPanel
            currentPrice={currentPrice}
            pivot={pivotLevels.pivot}
            r1={pivotLevels.r1}
            r2={pivotLevels.r2}
            r3={pivotLevels.r3}
            s1={pivotLevels.s1}
            s2={pivotLevels.s2}
            s3={pivotLevels.s3}
            bollingerBands={bollingerBands}
            trend={trend}
          />
        </div>
      ),
      expandedComponent: (
        <div className={cn("w-full relative", expandedHeight)}>
          <TeslaChart
            data={marketData}
            currentPrice={currentPrice}
            signal={signal}
            pivotLevels={{
              pivot: pivotLevels.pivot,
              r1: pivotLevels.r1,
              r2: pivotLevels.r2,
              s1: pivotLevels.s1,
              s2: pivotLevels.s2,
            }}
            className="h-full"
          />
          <PivotThresholdPanel
            currentPrice={currentPrice}
            pivot={pivotLevels.pivot}
            r1={pivotLevels.r1}
            r2={pivotLevels.r2}
            r3={pivotLevels.r3}
            s1={pivotLevels.s1}
            s2={pivotLevels.s2}
            s3={pivotLevels.s3}
            bollingerBands={bollingerBands}
            trend={trend}
          />
        </div>
      ),
    },
  ]

  useEffect(() => {
    if (sectionOrder.length === 0) {
      setSectionOrder(separateSections.map((s) => s.id))
    }
  }, [])

  const orderedSeparateSections =
    sectionOrder.length > 0
      ? (sectionOrder.map((id) => separateSections.find((s) => s.id === id)).filter(Boolean) as SectionItem[])
      : separateSections

  return (
    <div className="space-y-0">
      <div className="flex items-center gap-2 pt-3 px-4">
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Pivot Points</p>
      </div>

      <div className={cn("w-full", expandedHeight)}>
        <PivotGauge
          currentPrice={currentPrice}
          pivot={pivotLevels.pivot}
          r1={pivotLevels.r1}
          r2={pivotLevels.r2}
          r3={pivotLevels.r3}
          s1={pivotLevels.s1}
          s2={pivotLevels.s2}
          s3={pivotLevels.s3}
          className="h-full"
        />
      </div>
    </div>
  )
}
