"use client"

import React from "react"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import {
  Clock,
  AlertTriangle,
  Target,
  Activity,
  Zap,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Flame,
  Bell,
  X,
  Trash2,
  RefreshCw,
  Search,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { OptionPlay } from "@/types/option-play" // Import OptionPlay
import { getMarketStatus, getExtendedHoursSession } from "@/lib/market-calendar"
import { calculateReversalPricePoint, type ReversalPricePoint } from "@/lib/indicators"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import { PivotGauge } from "@/components/pivot-gauge"
import { VerticalCombinedChart } from "@/components/vertical-combined-chart"

interface CandleData {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume?: number // Added volume for analysis
}

interface AlertItem {
  id: string
  title: string
  subtitle: string
  type: "danger" | "caution" | "opportunity" | "info"
}

interface SuperTrendSignal {
  direction: "BUY" | "SELL" | "HOLD"
  timeframe: "1m" | "5m" | "15m"
}

interface FloatingStatusBarProps {
  selectedTicker?: string
  onTickerChange?: (ticker: string) => void
  currentPrice: number
  priceChange: number
  priceChangePercent: number
  signal: string
  superTrendDirection?: "BUY" | "SELL" | "HOLD"
  superTrendSignals?: {
    "1m": "BUY" | "SELL" | "HOLD"
    "5m": "BUY" | "SELL" | "HOLD"
    "15m": "BUY" | "SELL" | "HOLD"
  }
  dataSource?: "finnhub" | "mock"
  isConnected?: boolean
  className?: string
  alerts?: AlertItem[]
  onClearAllAlerts?: () => void
  onDismissAlert?: (id: string) => void
  onAlertTap?: (alert: AlertItem) => void // Added for expanding alerts
  tradeBudget?: number
  onBudgetChange?: (budget: number) => void
  chartTimeframe?: string
  onTimeframeChange?: (timeframe: string) => void
  selectedOption?: OptionPlay | null
  isTimerRunning?: boolean
  // Market condition props
  rsi?: number
  adx?: number
  bbPosition?: "upper" | "lower" | "middle"
  volumeSignal?: "BUY" | "SELL" | "NEUTRAL"
  ewoSignal?: "BUY" | "SELL" | "NEUTRAL"
  macdCrossover?: "bullish" | "bearish" | "none"
  reversalWarning?: {
    hasWarning?: boolean
    detected?: boolean
    direction?: "bullish" | "bearish"
    type?: string
    confidence: number
    signals?: string[]
    reasons?: string[]
    severity?: string
  } | null
  // Added props
  marketData?: CandleData[]
  pivotLevels?: {
    pivot: number
    r1: number
    r2: number
    r3?: number
    s1: number
    s2: number
    s3?: number
  }
  onPowerHourToggle?: () => void // Added callback for power hour toggle
  // Signal check indicators
  signalIndicators?: {
    name: string
    signal: "buy" | "sell" | "hold" | "neutral"
  }[]
  overallSignal?: "BUY" | "SELL" | "HOLD" | "STRONG_BUY" | "STRONG_SELL"
  signalConfidence?: number
  macdHistogram?: number
  bollingerBands?: {
    upper: number
    middle: number
    lower: number
  }
  // Volatility Analysis props
  bbWidth?: number
  keltnerSqueeze?: boolean
  ttmSqueeze?: boolean
  ttmMomentum?: "BULLISH" | "BEARISH" | "NEUTRAL"
  volatilityPercentile?: number
  // Settings/Profile callback
  onOpenSettings?: () => void
}

interface MarketWarning {
  type: "danger" | "caution" | "opportunity" | "info"
  title: string
  subtitle: string
  icon: typeof AlertTriangle
}

// Helper function to format trade budget display
const formatBudgetDisplay = (value: number) => {
  if (value >= 1000) {
    return `$${value / 1000}K`
  }
  return `$${value}`
}

// Using log scale: $5 (min) -> $200 (mid) -> $5000 (max)
const budgetToSlider = (budget: number): number => {
  // Map budget ($5-$5000) to slider (0-100) using log scale with $200 at 50
  const minBudget = 5
  const midBudget = 200
  const maxBudget = 5000

  if (budget <= midBudget) {
    // First half: $5-$200 maps to 0-50
    const ratio = (budget - minBudget) / (midBudget - minBudget)
    return ratio * 50
  } else {
    // Second half: $200-$5000 maps to 50-100
    const ratio = (budget - midBudget) / (maxBudget - midBudget)
    return 50 + ratio * 50
  }
}

const sliderToBudget = (slider: number): number => {
  const minBudget = 5
  const midBudget = 200
  const maxBudget = 5000

  if (slider <= 50) {
    // First half: 0-50 maps to $5-$200
    const ratio = slider / 50
    return Math.round(minBudget + ratio * (midBudget - minBudget))
  } else {
    // Second half: 50-100 maps to $200-$5000
    const ratio = (slider - 50) / 50
    return Math.round(midBudget + ratio * (maxBudget - midBudget))
  }
}

export function FloatingStatusBar({
  selectedTicker = "SPX",
  onTickerChange = () => {},
  currentPrice,
  priceChange,
  priceChangePercent,
  signal,
  superTrendDirection = "HOLD",
  superTrendSignals = { "1m": "HOLD", "5m": "HOLD", "15m": "HOLD" },
  dataSource = "mock",
  isConnected = false,
  className,
  alerts = [],
  onClearAllAlerts = () => {},
  onDismissAlert = () => {},
  onAlertTap = () => {}, // Added default handler
  tradeBudget = 200,
  onBudgetChange = () => {},
  chartTimeframe = "1",
  onTimeframeChange = () => {},
  selectedOption,
  isTimerRunning,
  rsi = 50,
  adx = 25,
  bbPosition = "middle",
  volumeSignal = "NEUTRAL",
  ewoSignal = "NEUTRAL",
  macdCrossover = "none",
  reversalWarning = null,
  marketData = [],
  pivotLevels,
  onPowerHourToggle = () => {}, // Added with default no-op
  signalIndicators = [],
  overallSignal = "HOLD",
  signalConfidence = 0,
  macdHistogram = 0,
  bollingerBands,
  // Volatility Analysis
  bbWidth = 0,
  keltnerSqueeze = false,
  ttmSqueeze = false,
  ttmMomentum = "NEUTRAL",
  volatilityPercentile = 0,
  // Settings/Profile callback
  onOpenSettings,
}: FloatingStatusBarProps) {
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [localBudget, setLocalBudget] = useState(tradeBudget) // Local state for budget slider
  const [showAlertPanel, setShowAlertPanel] = useState(false) // Renamed from alertPanelOpen
  const [showPriceActionPanel, setShowPriceActionPanel] = useState(false)
  const [showTrendAnalysisPanel, setShowTrendAnalysisPanel] = useState(false)
  const [showTickerSearch, setShowTickerSearch] = useState(false)
  const [tickerSearchQuery, setTickerSearchQuery] = useState("")
  const tickerSearchRef = useRef<HTMLDivElement>(null)
  const tickerSearchInputRef = useRef<HTMLInputElement>(null)
  const alertPanelRef = useRef<HTMLDivElement>(null)
  const priceActionPanelRef = useRef<HTMLDivElement>(null)
  const trendAnalysisPanelRef = useRef<HTMLDivElement>(null)
  const trendPillButtonRef = useRef<HTMLButtonElement>(null)
  const trendPillButtonRef2 = useRef<HTMLButtonElement>(null)
  const superTrendButtonRef = useRef<HTMLButtonElement>(null)
  const [currentSection, setCurrentSection] = useState<"market" | "analysis" | "charts" | "profile">("market")
  const [showNavMenu, setShowNavMenu] = useState(false)
  const [profilePhoto, setProfilePhoto] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("spx_profile_photo")
    }
    return null
  })
  const navMenuRef = useRef<HTMLDivElement>(null)
  const [optimalCountdown, setOptimalCountdown] = useState({ hours: 0, minutes: 0 })
  const [isOptimalTime, setIsOptimalTime] = useState(false)
  const [optimalElapsed, setOptimalElapsed] = useState({ hours: 0, minutes: 0 })
  const [powerHourCountdown, setPowerHourCountdown] = useState({ hours: 0, minutes: 0 })
  const [powerHourRemaining, setPowerHourRemaining] = useState({ minutes: 0 })
  const [isPowerHour, setIsPowerHour] = useState(false)
  const [isFinalRush, setIsFinalRush] = useState(false)
  const [isAfterHours, setIsAfterHours] = useState(false)
  const [minutesSinceOpen, setMinutesSinceOpen] = useState(0)
  const [isMarketOpen, setIsMarketOpen] = useState(false)
  const [showCandleChart, setShowCandleChart] = useState(false)
  const candleCanvasRef = useRef<HTMLCanvasElement>(null)
  const candleAnimationRef = useRef<number>(0)
  const [marketStatus, setMarketStatus] = useState(() => getMarketStatus())
  const [budgetDropdownOpen, setBudgetDropdownOpen] = useState(false) // Not used in collapsed view, but kept for expanded
  const [timeframeDropdownOpen, setTimeframeDropdownOpen] = useState(false) // Not used in collapsed view, but kept for expanded
  // const [alertPanelOpen, setAlertPanelOpen] = useState(false) // Replaced by showAlertPanel

  const getTimeframeDisplayLabel = (tf: string) => {
    switch (tf) {
      case "1":
        return "1m"
      case "5":
        return "5m"
      case "15":
        return "15m"
      case "30":
        return "30m"
      case "60":
        return "1h"
      case "D":
        return "D"
      case "W":
        return "W"
      case "M":
        return "M"
      default:
        return `${tf}m`
    }
  }

  // Get extended hours session info for display
  const extendedSession = useMemo(() => getExtendedHoursSession(), [marketStatus])

  // Get color class for extended hours session label
  const getSessionColorClass = () => {
    if (isMarketOpen) {
      // During market hours, show price change color or default
      if (currentSection !== "market" && currentPrice > 0) {
        return priceChange >= 0 ? "text-emerald-400" : "text-[#ec3b70]"
      }
      return "text-white/40"
    }
    
    // All non-market hours are grey (user requested)
    return "text-white/40"
  }

  const getDateOrMarketStatus = () => {
    if (!isMarketOpen) {
      // SPX (the index) only trades during regular market hours (9:30am-4pm ET)
      // Show "Market Closed" for SPX during all extended hours
      if (selectedTicker === "SPX") {
        return "Market Closed"
      }
      // Other tickers can trade in extended hours sessions
      return extendedSession.label
    }
    // When scrolled away from market section (section 1), show live price
    if (currentSection !== "market" && currentPrice > 0) {
      const priceStr = currentPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      const changeStr = priceChange >= 0 ? `+${priceChange.toFixed(2)}` : priceChange.toFixed(2)
      return `$${priceStr} (${changeStr})`
    }
    // When in market section, show best entry/exit price based on timeframe
    if (currentSection === "market" && pivotLevels && marketData.length > 0) {
      const latestPrice = marketData[marketData.length - 1]?.close || 0
      const { r1, pivot: pp, s1 } = pivotLevels
      const recentCandles = marketData.slice(-10)
      const bullishCandles = recentCandles.filter((c) => c.close > c.open).length
      const isBullish = bullishCandles >= 6
      const isBearish = bullishCandles <= 4
      
      let entryPrice = pp
      let entryLabel = "Target"
      
      if (isBullish) {
        entryPrice = latestPrice < pp ? s1 : pp
        entryLabel = latestPrice > r1 ? "Exit" : "Entry"
      } else if (isBearish) {
        entryPrice = latestPrice > pp ? r1 : pp
        entryLabel = latestPrice < s1 ? "Exit" : "Entry"
      }
      
      if (entryPrice > 0) {
        return `${entryLabel}: $${entryPrice.toFixed(2)}`
      }
    }
    return getTodayDate()
  }
  
  const scrollToTop = useCallback(() => {
    // Use scrollIntoView like bottom-nav does for consistent behavior
    const element = document.querySelector("#market")
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [])

  const getTodayDate = () => {
    const now = new Date()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const day = String(now.getDate()).padStart(2, "0")
    const year = String(now.getFullYear()).slice(-2)
    return `${month}•${day}•${year}`
  }

  const calculateCountdowns = useCallback(() => {
    const now = new Date()
    const status = getMarketStatus(now)
    setMarketStatus(status)
    setIsMarketOpen(status.isOpen)

    if (!status.isOpen && (status.isWeekend || status.isHoliday)) {
      setOptimalCountdown({
        hours: status.hoursUntilOpen + status.daysUntilOpen * 24,
        minutes: status.minutesUntilOpen % 60,
      })
      setIsOptimalTime(false)
      setIsPowerHour(false)
      setIsFinalRush(false)
      setIsAfterHours(true)

      const totalMinutesUntilOpen = status.minutesUntilOpen
      const powerHourOffset = (15 - 9) * 60 + 30
      const totalMinutesToPowerHour = totalMinutesUntilOpen + powerHourOffset
      setPowerHourCountdown({
        hours: Math.floor(totalMinutesToPowerHour / 60),
        minutes: totalMinutesToPowerHour % 60,
      })
      return
    }

    const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }))
    const hours = et.getHours()
    const minutes = et.getMinutes()
    const currentMinutes = hours * 60 + minutes

    const optimalTime = 13 * 60 // 1pm
    const marketClose = 16 * 60 // 4pm

    const inOptimalWindow = currentMinutes >= optimalTime && currentMinutes < marketClose
    setIsOptimalTime(inOptimalWindow)

    if (inOptimalWindow) {
      const elapsed = currentMinutes - optimalTime
      setOptimalElapsed({
        hours: Math.floor(elapsed / 60),
        minutes: elapsed % 60,
      })
    } else {
      let optimalDiff = optimalTime - currentMinutes
      if (optimalDiff < 0) {
        const nextStatus = getMarketStatus(now)
        if (!nextStatus.isOpen) {
          const totalMinutesUntilOpen = nextStatus.minutesUntilOpen
          const optimalOffset = (13 - 9) * 60 + 30
          optimalDiff = totalMinutesUntilOpen + optimalOffset
        } else {
          optimalDiff += 24 * 60
        }
      }
      setOptimalCountdown({
        hours: Math.floor(optimalDiff / 60),
        minutes: optimalDiff % 60,
      })
    }

    const powerHourStart = 15 * 60
    const powerHourEnd = 16 * 60
    const finalRushStart = 15 * 60 + 45 // 3:45pm
    const marketOpen = 9 * 60 + 30 // 9:30am

    setIsPowerHour(currentMinutes >= powerHourStart && currentMinutes < powerHourEnd)
    setIsFinalRush(currentMinutes >= finalRushStart && currentMinutes < powerHourEnd)

    if (status.isOpen) {
      setMinutesSinceOpen(currentMinutes - marketOpen)
    }

    let powerHourDiff = powerHourStart - currentMinutes
    if (powerHourDiff < 0) {
      const nextStatus = getMarketStatus(now)
      if (!nextStatus.isOpen || currentMinutes >= powerHourEnd) {
        const totalMinutesUntilOpen = nextStatus.minutesUntilOpen
        const powerHourOffset = (15 - 9) * 60 + 30
        powerHourDiff = totalMinutesUntilOpen + powerHourOffset
      } else {
        powerHourDiff += 24 * 60
      }
    }

    setPowerHourCountdown({
      hours: Math.floor(powerHourDiff / 60),
      minutes: Math.floor(powerHourDiff % 60),
    })

    if (currentMinutes >= powerHourStart && currentMinutes < powerHourEnd) {
      const remaining = powerHourEnd - currentMinutes
      setPowerHourRemaining({ minutes: remaining })
    }

    setIsAfterHours(currentMinutes >= powerHourEnd || currentMinutes < marketOpen)
  }, [])

  useEffect(() => {
    calculateCountdowns()
    const interval = setInterval(calculateCountdowns, 60000)
    return () => clearInterval(interval)
  }, [calculateCountdowns])

  useEffect(() => {
    const handleScroll = () => {
      const sections = ["market", "options-simulation", "analysis", "charts"]
      const scrollY = window.scrollY + 100

      for (const sectionId of sections) {
        const el = document.getElementById(sectionId)
        if (el) {
          const { top, bottom } = el.getBoundingClientRect()
          if (top <= 100 && bottom > 100) {
            if (sectionId === "options-simulation") setCurrentSection("analysis")
            else setCurrentSection(sectionId as any)
            break
          }
        }
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Removed auto-collapse on scroll - collapse state is now only controlled by user interaction

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (alertPanelRef.current && !alertPanelRef.current.contains(event.target as Node)) {
        setShowAlertPanel(false)
      }
      if (
        priceActionPanelRef.current &&
        !priceActionPanelRef.current.contains(event.target as Node) &&
        !trendPillButtonRef.current?.contains(event.target as Node) &&
        !trendPillButtonRef2.current?.contains(event.target as Node)
      ) {
        setShowPriceActionPanel(false)
      }
    if (
      trendAnalysisPanelRef.current &&
      !trendAnalysisPanelRef.current.contains(event.target as Node) &&
      !superTrendButtonRef.current?.contains(event.target as Node)
    ) {
      setShowTrendAnalysisPanel(false)
    }
    if (navMenuRef.current && !navMenuRef.current.contains(event.target as Node)) {
      setShowNavMenu(false)
    }
    if (tickerSearchRef.current && !tickerSearchRef.current.contains(event.target as Node)) {
      setShowTickerSearch(false)
      setTickerSearchQuery("")
    }
    }
    
    if (showAlertPanel || showPriceActionPanel || showTrendAnalysisPanel || showNavMenu || showTickerSearch) {
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [showAlertPanel, showPriceActionPanel, showTrendAnalysisPanel, showNavMenu, showTickerSearch])

  // Sync profile photo from localStorage when it changes
  useEffect(() => {
    const handleStorageChange = () => {
      const savedPhoto = localStorage.getItem("spx_profile_photo")
      setProfilePhoto(savedPhoto)
    }
    
    // Check on mount and listen for changes
    handleStorageChange()
    window.addEventListener("storage", handleStorageChange)
    
    // Also poll periodically in case storage event doesn't fire (same tab updates)
    const interval = setInterval(handleStorageChange, 1000)
    
    return () => {
      window.removeEventListener("storage", handleStorageChange)
      clearInterval(interval)
    }
  }, [])
  
  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" })
    }
    setShowNavMenu(false)
  }
  
  const marketWarning = useMemo((): MarketWarning | null => {
    if (isMarketOpen && minutesSinceOpen <= 30) {
      return {
        type: "danger",
        title: "High Risk Period",
        subtitle: "Opening volatility - high risk period",
        icon: AlertTriangle,
      }
    }

    const hasReversalWarning = reversalWarning?.hasWarning || reversalWarning?.detected
    const reversalDirection = reversalWarning?.type === "BULLISH_REVERSAL" ? "bullish" : reversalWarning?.type === "BEARISH_REVERSAL" ? "bearish" : reversalWarning?.direction
    if (hasReversalWarning && reversalWarning && reversalWarning.confidence >= 60) {
      return {
        type: reversalDirection === "bullish" ? "opportunity" : "caution",
        title: `${reversalDirection === "bullish" ? "Bullish" : "Bearish"} Reversal`,
        subtitle: `${reversalWarning.confidence}% confidence reversal detected`,
        icon: Activity,
      }
    }

    if (rsi <= 25) {
      return {
        type: "opportunity",
        title: "Deeply Oversold",
        subtitle: `RSI at ${rsi.toFixed(0)} - potential bounce zone`,
        icon: Target,
      }
    }
    if (rsi >= 75) {
      return {
        type: "caution",
        title: "Heavily Overbought",
        subtitle: `RSI at ${rsi.toFixed(0)} - potential pullback zone`,
        icon: AlertTriangle,
      }
    }

    if (adx >= 40) {
      const isBullish = superTrendDirection === "BUY"
      const isBearish = superTrendDirection === "SELL"
      const trendType = isBullish ? "Bull" : isBearish ? "Bear" : "Strong"
      const trendDir = isBullish ? "Uptrend" : isBearish ? "Downtrend" : "Trend"
      return {
        type: isBullish ? "opportunity" : isBearish ? "caution" : "info",
        title: `${trendType} Run Detected`,
        subtitle: `ADX at ${adx.toFixed(0)} - ${trendDir} momentum strong`,
        icon: Flame,
      }
    }
    if (adx >= 25 && adx < 40) {
      const isBullish = superTrendDirection === "BUY"
      const isBearish = superTrendDirection === "SELL"
      const trendDir = isBullish ? "Uptrend" : isBearish ? "Downtrend" : "Sideways"
      return {
        type: isBullish ? "opportunity" : isBearish ? "caution" : "info",
        title: `${trendDir} Active`,
        subtitle: `ADX at ${adx.toFixed(0)} - moderate trend strength`,
        icon: isBullish ? TrendingUp : isBearish ? TrendingDown : Activity,
      }
    }
    if (adx <= 15) {
      return {
        type: "info",
        title: "ADX Weakening",
        subtitle: "Low trend strength - consolidation phase",
        icon: Activity,
      }
    }

    if (bbPosition === "lower" && volumeSignal === "BUY") {
      return {
        type: "opportunity",
        title: "Squeeze Run Potential",
        subtitle: "Price at lower band with buying pressure",
        icon: Target,
      }
    }
    if (bbPosition === "upper" && volumeSignal === "SELL") {
      return {
        type: "caution",
        title: "Squeeze Run Potential",
        subtitle: "Price at upper band with selling pressure",
        icon: AlertTriangle,
      }
    }

    if (macdCrossover === "bullish") {
      return {
        type: "opportunity",
        title: "Bullish MACD Cross",
        subtitle: "Momentum shifting upward",
        icon: TrendingUp,
      }
    }
    if (macdCrossover === "bearish") {
      return {
        type: "caution",
        title: "Bearish MACD Cross",
        subtitle: "Momentum shifting downward",
        icon: TrendingDown,
      }
    }

    const bullishSignals = [
      rsi < 40,
      superTrendDirection === "BUY",
      ewoSignal === "BUY",
      volumeSignal === "BUY",
    ].filter(Boolean).length

    const bearishSignals = [
      rsi > 60,
      superTrendDirection === "SELL",
      ewoSignal === "SELL",
      volumeSignal === "SELL",
    ].filter(Boolean).length

    if (bullishSignals >= 3) {
      return {
        type: "opportunity",
        title: "Perfect Entry Zone",
        subtitle: "Multiple bullish signals aligned",
        icon: Target,
      }
    }
    if (bearishSignals >= 3) {
      return {
        type: "caution",
        title: "Bearish Confluence",
        subtitle: "Multiple bearish signals aligned",
        icon: AlertTriangle,
      }
    }

    if (isFinalRush) {
      return {
        type: "caution",
        title: "Final Rush",
        subtitle: "Last 15 minutes - increased volatility",
        icon: Zap,
      }
    }
    if (isPowerHour) {
      return {
        type: "info",
        title: "Power Hour Active",
        subtitle: "High volume trading window",
        icon: Zap,
      }
    }

    return null
  }, [
    isMarketOpen,
    minutesSinceOpen,
    reversalWarning,
    rsi,
    adx,
    superTrendDirection,
    bbPosition,
    volumeSignal,
    ewoSignal,
    macdCrossover,
    isPowerHour,
    isFinalRush,
  ])

  const getWarningColors = (type: MarketWarning["type"]) => {
    switch (type) {
      case "danger":
        return {
          text: "text-[#ec3b70]",
          subtext: "text-[#ec3b70]/60",
        }
      case "caution":
        return {
          text: "text-white",
          subtext: "text-white/50",
          glow: "drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]",
        }
      case "opportunity":
        return {
          text: "text-emerald-400",
          subtext: "text-emerald-400/60",
        }
      case "info":
      default:
        return { text: "text-white/70", subtext: "text-white/40" }
    }
  }

  const SignalIcon = superTrendDirection === "BUY" ? TrendingUp : superTrendDirection === "SELL" ? TrendingDown : Clock

  const ActiveTradePill = () => {
    if (!selectedOption || !isTimerRunning) return null

    const isCall = selectedOption.type === "CALL"
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium",
          isCall ? "bg-emerald-500/20 text-emerald-400" : "bg-[#ec3b70]/20 text-[#ec3b70]",
        )}
      >
        {isCall ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        <span className="uppercase tracking-wide">
          {selectedOption.moneyness} {selectedOption.type}
        </span>
        <span className="text-white/50">|</span>
        <span>${selectedOption.strike}</span>
        <span className="text-white/30">→</span>
        <span>${selectedOption.targetPrice}</span>
      </div>
    )
  }

  const MarketWarningBanner = () => {
    if (!marketWarning) return null

    const WarningIcon = marketWarning.icon

    const getBadgeStyle = () => {
      switch (marketWarning.type) {
        case "opportunity":
          return {
            bg: "bg-emerald-500/20",
            border: "border-emerald-500/40",
            iconBg: "bg-emerald-500/30",
            iconColor: "text-emerald-400",
            titleColor: "text-emerald-400",
            subtitleColor: "text-emerald-400/70",
          }
        case "danger":
          return {
            bg: "bg-red-500/20",
            border: "border-red-500/40",
            iconBg: "bg-red-500/30",
            iconColor: "text-red-400",
            titleColor: "text-red-400",
            subtitleColor: "text-red-400/70",
          }
        case "caution":
          return {
            bg: "bg-white/10",
            border: "border-white/30",
            iconBg: "bg-white/20",
            iconColor: "text-white",
            titleColor: "text-white",
            subtitleColor: "text-white/70",
          }
        default:
          return {
            bg: "bg-white/10",
            border: "border-white/20",
            iconBg: "bg-white/20",
            iconColor: "text-white/70",
            titleColor: "text-white/70",
            subtitleColor: "text-white/50",
          }
      }
    }

    const style = getBadgeStyle()

    return (
      <div className="flex items-center gap-2 px-4 py-1.5">
        <WarningIcon className="w-4 h-4 text-white" />
        <span className="text-sm font-semibold text-white">{marketWarning.title}</span>
        <span className="text-xs text-white/50">{marketWarning.subtitle}</span>
      </div>
    )
  }

  const renderMiniCandleChart = useCallback(() => {
    const canvas = candleCanvasRef.current
    if (!canvas || marketData.length === 0) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const width = rect.width
    const height = rect.height
    const padding = { top: 8, bottom: 8, left: 4, right: 40 }
    const chartWidth = width - padding.left - padding.right
    const chartHeight = height - padding.top - padding.bottom

    const candles = marketData.slice(-30)
    if (candles.length === 0) return

    const allPrices = candles.flatMap((c) => [c.high, c.low])
    const priceMin = Math.min(...allPrices) * 0.9998
    const priceMax = Math.max(...allPrices) * 1.0002
    const priceRange = priceMax - priceMin

    const priceToY = (price: number) => {
      return padding.top + chartHeight - ((price - priceMin) / priceRange) * chartHeight
    }

    const candleWidth = chartWidth / candles.length
    const candleBodyWidth = Math.max(candleWidth * 0.6, 2)

    ctx.clearRect(0, 0, width, height)

    ctx.fillStyle = "rgba(0, 0, 0, 0.4)"
    ctx.fillRect(0, 0, width, height)

    if (pivotLevels) {
      const levels = [
        { label: "R1", value: pivotLevels.r1, color: "rgba(236, 59, 112, 0.3)" },
        { label: "PP", value: pivotLevels.pivot, color: "rgba(255, 255, 255, 0.2)" },
        { label: "S1", value: pivotLevels.s1, color: "rgba(16, 185, 129, 0.3)" },
      ]

      levels.forEach((level) => {
        if (!level.value) return
        const y = priceToY(level.value)
        if (y < padding.top || y > height - padding.bottom) return

        ctx.beginPath()
        ctx.moveTo(padding.left, y)
        ctx.lineTo(width - padding.right, y)
        ctx.strokeStyle = level.color
        ctx.lineWidth = 0.5
        ctx.setLineDash([2, 2])
        ctx.stroke()
        ctx.setLineDash([])
      })
    }

    candles.forEach((candle, i) => {
      const x = padding.left + i * candleWidth + candleWidth / 2
      const isGreen = candle.close >= candle.open

      const bodyTop = priceToY(Math.max(candle.open, candle.close))
      const bodyBottom = priceToY(Math.min(candle.open, candle.close))
      const bodyHeight = Math.max(bodyBottom - bodyTop, 1)

      const wickTop = priceToY(candle.high)
      const wickBottom = priceToY(candle.low)

      ctx.beginPath()
      ctx.moveTo(x, wickTop)
      ctx.lineTo(x, wickBottom)
      ctx.strokeStyle = isGreen ? "rgba(16, 185, 129, 0.6)" : "rgba(236, 59, 112, 0.6)"
      ctx.lineWidth = 1
      ctx.stroke()

      ctx.fillStyle = isGreen ? "rgba(16, 185, 129, 0.9)" : "rgba(236, 59, 112, 0.9)"
      ctx.fillRect(x - candleBodyWidth / 2, bodyTop, candleBodyWidth, bodyHeight)
    })

    const priceY = priceToY(currentPrice)
    ctx.beginPath()
    ctx.moveTo(padding.left, priceY)
    ctx.lineTo(width - padding.right, priceY)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)"
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.font = "bold 9px system-ui"
    ctx.fillStyle = "#fff"
    ctx.textAlign = "right"
    ctx.fillText(`$${currentPrice.toFixed(0)}`, width - 4, priceY + 3)

    const signalType = superTrendDirection === "BUY" ? "buy" : superTrendDirection === "SELL" ? "sell" : "hold"
    const signalLabel = signalType === "buy" ? "BUY" : signalType === "sell" ? "SELL" : "HOLD"
    const signalColor =
      signalType === "buy"
        ? "rgba(16, 185, 129, 0.9)"
        : signalType === "sell"
          ? "rgba(236, 59, 112, 0.9)"
          : "rgba(255, 255, 255, 0.6)"

    ctx.font = "bold 8px system-ui"
    ctx.fillStyle = signalColor
    ctx.textAlign = "left"
    ctx.fillText(signalLabel, padding.left + 2, padding.top + 8)
  }, [marketData, currentPrice, pivotLevels, superTrendDirection])

  useEffect(() => {
    if (showCandleChart && marketData.length > 0) {
      const animate = () => {
        renderMiniCandleChart()
        candleAnimationRef.current = requestAnimationFrame(animate)
      }
      animate()
    }
    return () => {
      if (candleAnimationRef.current) {
        cancelAnimationFrame(candleAnimationRef.current)
      }
    }
  }, [showCandleChart, marketData, renderMiniCandleChart])

  const getSuggestedEntry = useCallback(() => {
    if (!pivotLevels || marketData.length === 0) {
      return { price: 0, distance: 0, action: "Wait", entryType: "HOLD" }
    }

    const currentPrice = marketData[marketData.length - 1]?.close || 0
    const { r1, pivot: pp, s1 } = pivotLevels

    const recentCandles = marketData.slice(-10)
    const bullishCandles = recentCandles.filter((c) => c.close > c.open).length
    const isBullish = bullishCandles >= 6
    const isBearish = bullishCandles <= 4

    if (isBullish) {
      const entryPrice = currentPrice < pp ? s1 : pp
      return {
        price: entryPrice,
        distance: currentPrice - entryPrice,
        action: currentPrice > r1 ? "Take Profit" : currentPrice < pp ? "Buy at S1" : "Wait for PP",
        entryType: "CALL",
      }
    } else if (isBearish) {
      const entryPrice = currentPrice > pp ? r1 : pp
      return {
        price: entryPrice,
        distance: entryPrice - currentPrice,
        action: currentPrice < s1 ? "Take Profit" : currentPrice > pp ? "Sell at R1" : "Wait for PP",
        entryType: "PUT",
      }
    }

    return {
      price: pp,
      distance: Math.abs(currentPrice - pp),
      action: "Wait for PP",
      entryType: "HOLD",
    }
  }, [pivotLevels, marketData])

  const suggestedEntry = getSuggestedEntry()

  const getPriceActionSentiment = useCallback(() => {
    if (marketData.length < 10) return "Neutral"
    const recentCandles = marketData.slice(-10)
    const bullishCandles = recentCandles.filter((c) => c.close > c.open).length
    if (bullishCandles >= 7) return "Bullish"
    if (bullishCandles <= 3) return "Bearish"
    return "Neutral"
  }, [marketData])

  const priceActionSentiment = getPriceActionSentiment()

  const getTrendSentiment = useCallback(() => {
    if (marketData.length < 10) {
      return { label: "LOADING", color: "text-white/40", bgColor: "bg-white/10" }
    }

    const recentCandles = marketData.slice(-10)
    const currentCandle = marketData[marketData.length - 1]
    const prevCandle = marketData[marketData.length - 2]
    const bullishCandles = recentCandles.filter((c) => c.close > c.open).length
    const bearishCandles = recentCandles.length - bullishCandles

    // Calculate price momentum
    const priceChange = currentCandle
      ? ((currentCandle.close - recentCandles[0].close) / recentCandles[0].close) * 100
      : 0
    const avgVolatility = recentCandles.reduce((sum, c) => sum + (c.high - c.low), 0) / recentCandles.length
    const currentVolatility = currentCandle ? currentCandle.high - currentCandle.low : 0

    // Check for patterns
    const prices = recentCandles.map((c) => c.close)
    const highs = recentCandles.map((c) => c.high)
    const lows = recentCandles.map((c) => c.low)
    const recentHigh = Math.max(...highs)
    const recentLow = Math.min(...lows)
    const priceRange = recentHigh - recentLow
    const currentPriceForRange = currentCandle?.close || 0 // Use current price for relative range calculation

    // Gap detection
    const hasGapUp = prevCandle && currentCandle && currentCandle.open > prevCandle.high
    const hasGapDown = prevCandle && currentCandle && currentCandle.open < prevCandle.low

    // W pattern detection (double bottom)
    const isWForming =
      lows.length >= 5 && lows[2] < lows[0] && lows[2] < lows[4] && Math.abs(lows[0] - lows[4]) < priceRange * 0.1

    // M pattern detection (double top)
    const isMForming =
      highs.length >= 5 &&
      highs[2] > highs[0] &&
      highs[2] > highs[4] &&
      Math.abs(highs[0] - highs[4]) < priceRange * 0.1

    // Consolidation detection
    const isConsolidating = currentVolatility < avgVolatility * 0.5 && priceRange < currentPriceForRange * 0.005

    // Pivot level interactions
    let pivotInteraction = ""
    if (pivotLevels && currentCandle) {
      const price = currentCandle.close
      const tolerance = priceRange * 0.05

      if (Math.abs(price - pivotLevels.s1) < tolerance || Math.abs(price - pivotLevels.s2) < tolerance) {
        pivotInteraction = bullishCandles > bearishCandles ? "testing_support" : "breaking_support"
      } else if (Math.abs(price - pivotLevels.r1) < tolerance || Math.abs(price - pivotLevels.r2) < tolerance) {
        pivotInteraction = bearishCandles > bullishCandles ? "rejected_resistance" : "breaking_resistance"
      } else if (Math.abs(price - pivotLevels.pivot) < tolerance) {
        pivotInteraction = "at_pivot"
      }
    }

    // Determine sentiment based on all factors
    // Priority order: Gap > Pattern > Pivot > Momentum > Consolidation

    // Gap signals
    if (hasGapUp) {
      return { label: "GAP UP", color: "text-emerald-400", bgColor: "bg-emerald-400/10" }
    }
    if (hasGapDown) {
      return { label: "GAP DOWN", color: "text-[#ec3b70]", bgColor: "bg-[#ec3b70]/10" }
    }

    // Pattern signals
    if (isWForming) {
      return { label: "W FORMING", color: "text-emerald-400", bgColor: "bg-emerald-400/10" }
    }
    if (isMForming) {
      return { label: "DOUBLE M", color: "text-[#ec3b70]", bgColor: "bg-[#ec3b70]/10" }
    }

    // Pivot level signals
    if (pivotInteraction === "testing_support") {
      return { label: "TEST SUPPORT", color: "text-amber-400", bgColor: "bg-amber-400/10" }
    }
    if (pivotInteraction === "breaking_support") {
      return { label: "BREAK SUPPORT", color: "text-[#ec3b70]", bgColor: "bg-[#ec3b70]/10" }
    }
    if (pivotInteraction === "rejected_resistance") {
      return { label: "REJECTED R", color: "text-[#ec3b70]", bgColor: "bg-[#ec3b70]/10" }
    }
    if (pivotInteraction === "breaking_resistance") {
      return { label: "BREAKOUT", color: "text-emerald-400", bgColor: "bg-emerald-400/10" }
    }

    // Strong momentum signals
    if (priceChange > 0.5 && bullishCandles >= 7) {
      return { label: "BULL RUN", color: "text-emerald-400", bgColor: "bg-emerald-400/10" }
    }
    if (priceChange < -0.5 && bearishCandles >= 7) {
      return { label: "FALLING KNIFE", color: "text-[#ec3b70]", bgColor: "bg-[#ec3b70]/10" }
    }

    // RSI-based signals
    if (rsi >= 80) {
      return { label: "OVERBOUGHT", color: "text-[#ec3b70]", bgColor: "bg-[#ec3b70]/10" }
    }
    if (rsi <= 20) {
      return { label: "OVERSOLD", color: "text-emerald-400", bgColor: "bg-emerald-400/10" }
    }

    // MACD signals
    if (macdCrossover === "bullish" && bullishCandles >= 5) {
      return { label: "BULLISH X", color: "text-emerald-400", bgColor: "bg-emerald-400/10" }
    }
    if (macdCrossover === "bearish" && bearishCandles >= 5) {
      return { label: "BEARISH X", color: "text-[#ec3b70]", bgColor: "bg-[#ec3b70]/10" }
    }

    // Consolidation
    if (isConsolidating) {
      return { label: "CONSOLIDATE", color: "text-amber-400", bgColor: "bg-amber-400/10" }
    }

    // General sentiment
    if (bullishCandles >= 7) {
      return { label: "BULLISH", color: "text-emerald-400", bgColor: "bg-emerald-400/10" }
    }
    if (bearishCandles >= 7) {
      return { label: "BEARISH", color: "text-[#ec3b70]", bgColor: "bg-[#ec3b70]/10" }
    }

    return { label: "SIDEWAYS", color: "text-white/60", bgColor: "bg-white/10" }
  }, [marketData, pivotLevels, currentPrice, rsi, macdCrossover])

  const trendSentiment = getTrendSentiment()

  const getPriceActionDetails = useCallback(() => {
    if (marketData.length < 10) return null

    const recentCandles = marketData.slice(-20)
    const currentCandle = marketData[marketData.length - 1]
    const prevCandle = marketData[marketData.length - 2]
    const bullishCandles = recentCandles.filter((c) => c.close > c.open).length
    const bearishCandles = recentCandles.length - bullishCandles

    // Calculate metrics
    const priceChange24 = currentCandle
      ? ((currentCandle.close - recentCandles[0].close) / recentCandles[0].close) * 100
      : 0
    const avgVolume = recentCandles.reduce((sum, c) => sum + (c.volume || 0), 0) / recentCandles.length
    const currentVolume = currentCandle?.volume || 0
    const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1

    // Price levels
    const highs = recentCandles.map((c) => c.high)
    const lows = recentCandles.map((c) => c.low)
    const recentHigh = Math.max(...highs)
    const recentLow = Math.min(...lows)
    const priceRange = recentHigh - recentLow
    const pricePosition = currentCandle ? ((currentCandle.close - recentLow) / priceRange) * 100 : 50

    // Candle patterns
    const isDoji = currentCandle
      ? Math.abs(currentCandle.close - currentCandle.open) < (currentCandle.high - currentCandle.low) * 0.1
      : false
    const isHammer = currentCandle
      ? currentCandle.close > currentCandle.open &&
        currentCandle.open - currentCandle.low > (currentCandle.high - currentCandle.close) * 2
      : false
    const isShootingStar = currentCandle
      ? currentCandle.close < currentCandle.open &&
        currentCandle.high - currentCandle.open > (currentCandle.open - currentCandle.close) * 2
      : false
    const isEngulfingBull =
      currentCandle && prevCandle
        ? prevCandle.close < prevCandle.open &&
          currentCandle.close > currentCandle.open &&
          currentCandle.close > prevCandle.open &&
          currentCandle.open < prevCandle.close
        : false
    const isEngulfingBear =
      currentCandle && prevCandle
        ? prevCandle.close > prevCandle.open &&
          currentCandle.close < currentCandle.open &&
          currentCandle.close < prevCandle.open &&
          currentCandle.open > prevCandle.close
        : false

    // Pivot interactions
    let pivotStatus = "None"
    if (pivotLevels && currentCandle) {
      const price = currentCandle.close
      const tolerance = priceRange * 0.03

      if (Math.abs(price - pivotLevels.r2) < tolerance) pivotStatus = "At R2"
      else if (Math.abs(price - pivotLevels.r1) < tolerance) pivotStatus = "At R1"
      else if (Math.abs(price - pivotLevels.pivot) < tolerance) pivotStatus = "At Pivot"
      else if (Math.abs(price - pivotLevels.s1) < tolerance) pivotStatus = "At S1"
      else if (Math.abs(price - pivotLevels.s2) < tolerance) pivotStatus = "At S2"
      else if (price > pivotLevels.r1) pivotStatus = "Above R1"
      else if (price < pivotLevels.s1) pivotStatus = "Below S1"
      else pivotStatus = "Between Pivot"
    }

    return {
      bullishCandles,
      bearishCandles,
      priceChange24,
      volumeRatio,
      recentHigh,
      recentLow,
      pricePosition,
      isDoji,
      isHammer,
      isShootingStar,
      isEngulfingBull,
      isEngulfingBear,
      pivotStatus,
      currentPrice: currentCandle?.close || 0,
    }
  }, [marketData, pivotLevels])

  const priceActionDetails = getPriceActionDetails()

  // Calculate reversal price point using all indicators
  const reversalPricePoint = useMemo(() => {
    if (marketData.length < 52 || !pivotLevels) return null
    
    // Convert CandleData to OHLCData format
    const ohlcData = marketData.map(d => ({
      time: d.timestamp,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: d.volume || 0
    }))
    
    const fullPivots = {
      pivot: pivotLevels.pivot,
      r1: pivotLevels.r1,
      r2: pivotLevels.r2,
      r3: pivotLevels.r3 || pivotLevels.r2 * 1.005,
      s1: pivotLevels.s1,
      s2: pivotLevels.s2,
      s3: pivotLevels.s3 || pivotLevels.s2 * 0.995
    }
    
    return calculateReversalPricePoint(ohlcData, currentPrice, fullPivots)
  }, [marketData, currentPrice, pivotLevels])

  // Default indicators if none provided
  const defaultIndicators = useMemo(() => [
    { name: "RSI", signal: (rsi < 30 ? "buy" : rsi > 70 ? "sell" : "neutral") as "buy" | "sell" | "hold" | "neutral" },
    { name: "MACD", signal: (macdCrossover === "bullish" ? "buy" : macdCrossover === "bearish" ? "sell" : "neutral") as "buy" | "sell" | "hold" | "neutral" },
    { name: "ADX", signal: (adx >= 25 ? (superTrendDirection === "BUY" ? "buy" : superTrendDirection === "SELL" ? "sell" : "hold") : "neutral") as "buy" | "sell" | "hold" | "neutral" },
    { name: "ST", signal: (superTrendDirection === "BUY" ? "buy" : superTrendDirection === "SELL" ? "sell" : "neutral") as "buy" | "sell" | "hold" | "neutral" },
    { name: "EWO", signal: (ewoSignal === "BUY" ? "buy" : ewoSignal === "SELL" ? "sell" : "neutral") as "buy" | "sell" | "hold" | "neutral" },
    { name: "BB", signal: (bbPosition === "lower" ? "buy" : bbPosition === "upper" ? "sell" : "neutral") as "buy" | "sell" | "hold" | "neutral" },
    { name: "PIVOT", signal: (priceActionDetails?.pivotStatus?.includes("S") ? "buy" : priceActionDetails?.pivotStatus?.includes("R") ? "sell" : "neutral") as "buy" | "sell" | "hold" | "neutral" },
    { name: "TREND", signal: (overallSignal === "BUY" || overallSignal === "STRONG_BUY" ? "buy" : overallSignal === "SELL" || overallSignal === "STRONG_SELL" ? "sell" : "hold") as "buy" | "sell" | "hold" | "neutral" },
  ], [rsi, macdCrossover, adx, superTrendDirection, ewoSignal, bbPosition, priceActionDetails, overallSignal])

  const indicators = signalIndicators.length > 0 ? signalIndicators : defaultIndicators

  // Calculate alignment
  const buyCount = indicators.filter(i => i.signal === "buy").length
  const sellCount = indicators.filter(i => i.signal === "sell").length
  const totalActive = indicators.length
  const alignment = Math.max(buyCount, sellCount) / totalActive

  // Determine signal label
  const getSignalLabel = () => {
    if (alignment >= 0.7) {
      return buyCount > sellCount ? "CALL" : "PUT"
    }
    return "WAIT"
  }

  const signalLabel = getSignalLabel()
  const confidence = signalConfidence > 0 ? signalConfidence : Math.round(alignment * 100)

  // Get strategy/recommendation
  const getStrategy = () => {
    const isBullish = buyCount > sellCount
    const isBearish = sellCount > buyCount

    if (alignment >= 0.7 && rsi < 35 && isBullish) {
      return {
        title: "Strong Setup",
        description: "RSI oversold with bullish indicators. High probability bounce.",
        timing: "Enter on next green candle",
        risk: "MEDIUM" as const,
      }
    }
    if (alignment >= 0.7 && rsi > 65 && isBearish) {
      return {
        title: "Strong Setup",
        description: "RSI overbought with bearish pressure. Pullback likely.",
        timing: "Enter on next red candle",
        risk: "MEDIUM" as const,
      }
    }
    if (alignment >= 0.6) {
      return {
        title: "Stars Aligning",
        description: `${Math.round(alignment * 100)}% of indicators agree. Strong directional bias.`,
        timing: "Wait for price confirmation",
        risk: "MEDIUM" as const,
      }
    }
    if (alignment >= 0.5) {
      return {
        title: "Developing Setup",
        description: "Mixed signals. Some indicators aligning but not enough for high confidence.",
        timing: "Wait for more confirmation",
        risk: "HIGH" as const,
      }
    }
    return {
      title: "No Clear Setup",
      description: "Signals are mixed or neutral. Protect your capital - patience is key!",
      timing: "Check back in 15-30 minutes",
      risk: "AVOID" as const,
    }
  }

  const strategy = getStrategy()

  const SignalCheckPanel = () => {
    // Get win rate based on conditions
    const getWinRate = () => {
      const isBullish = buyCount > sellCount
      const isBearish = sellCount > buyCount

      if (alignment >= 0.7 && rsi < 35 && isBullish) return 78
      if (alignment >= 0.7 && rsi > 65 && isBearish) return 78
      if (alignment >= 0.7 && isBullish && rsi < 40) return 68
      if (alignment >= 0.7 && isBearish && rsi > 60) return 68
      if (alignment >= 0.6) return 62
      if (alignment >= 0.5) return 52
      return 0
    }

    const winRate = getWinRate()
    const panelIsBullish = buyCount > sellCount
    const panelIsBearish = sellCount > buyCount

    // Determine reversal direction based on reversal warning or price point
    const hasActiveReversal = reversalWarning?.hasWarning || reversalWarning?.detected || reversalPricePoint
    const reversalIsBullish = reversalWarning?.type === "BULLISH_REVERSAL" || 
                              reversalWarning?.direction === "bullish" || 
                              reversalPricePoint?.direction === "BULLISH"

    return (
      <div
        ref={priceActionPanelRef}
        className="fixed top-[60px] left-0 right-0 bottom-0 bg-black/95 backdrop-blur-xl overflow-hidden z-50 overflow-y-auto"
      >
        {/* ============================================
            SECTION 1: SIGNAL CHECK (Top) - Condensed
            ============================================ */}
        <div className="px-4 pt-3 pb-3 border-b border-white/10">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] uppercase tracking-[0.15em] text-white/40">Signal Check</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/40">{Math.round(alignment * 100)}% agree</span>
              <button
                onClick={() => setShowPriceActionPanel(false)}
                className="p-0.5 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-3.5 h-3.5 text-white/40" />
              </button>
            </div>
          </div>

          {/* Main signal display - Centered */}
          <div className="flex flex-col items-center mb-3">
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center border-2 mb-2",
              signalLabel === "CALL" 
                ? "border-emerald-400/50 bg-emerald-400/10" 
                : signalLabel === "PUT"
                  ? "border-[#ec3b70]/50 bg-[#ec3b70]/10"
                  : "border-white/20 bg-white/5"
            )}>
              {signalLabel === "CALL" ? (
                <TrendingUp className="w-6 h-6 text-emerald-400" />
              ) : signalLabel === "PUT" ? (
                <TrendingDown className="w-6 h-6 text-[#ec3b70]" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-white/40" />
              )}
            </div>
            <p className={cn(
              "text-2xl font-light tracking-tight",
              signalLabel === "PUT" ? "text-[#ec3b70]" : signalLabel === "CALL" ? "text-emerald-400" : "text-white/50"
            )}>
              {signalLabel}
            </p>
            <p className="text-white/50 text-[11px]">{Math.round(confidence)}% confidence</p>
          </div>

          {/* Indicator dots grid - Tighter */}
          <div className="grid grid-cols-4 gap-2">
            {indicators.map((indicator) => {
              const dotColor = {
                buy: "bg-emerald-400",
                sell: "bg-[#ec3b70]",
                hold: "bg-white/40",
                neutral: "bg-white/20",
              }[indicator.signal]

              return (
                <div key={indicator.name} className="text-center">
                  <div className={cn("w-2 h-2 rounded-full mx-auto mb-1", dotColor)} />
                  <span className="text-[9px] text-white/40 uppercase tracking-wider">{indicator.name}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* ============================================
            SECTION 2: DETAILED ANALYSIS - Condensed
            ============================================ */}
        <div className="px-4 py-3">
          {/* Header with signal level badge */}
          {(() => {
            // Determine signal level based on confidence and alignment
            const getSignalLevel = () => {
              if (strategy.risk === "AVOID" || confidence < 40) return { label: "WAIT", color: "bg-white/20 text-white/60" }
              if (confidence >= 75 && alignment >= 0.6) return { label: "HIGH", color: "bg-[#f97316]/20 text-[#f97316]" }
              if (confidence >= 55 && alignment >= 0.45) return { label: "MEDIUM", color: "bg-amber-500/20 text-amber-400" }
              return { label: "LOW", color: "bg-white/10 text-white/50" }
            }
            const signalLevel = getSignalLevel()
            
            return (
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] uppercase tracking-[0.15em] text-white/40">Detailed Analysis</p>
                <span className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide",
                  signalLevel.color
                )}>
                  {signalLevel.label}
                </span>
              </div>
            )
          })()}

          {/* Strategy Card - Compact */}
          <div className={cn(
            "p-3 rounded-xl mb-3 border",
            signalLabel === "CALL" 
              ? "bg-emerald-500/[0.06] border-emerald-500/10" 
              : signalLabel === "PUT"
                ? "bg-[#ec3b70]/[0.06] border-[#ec3b70]/10"
                : "bg-white/[0.03] border-white/[0.06]"
          )}>
            <div className="flex items-start gap-2.5">
              <div className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
                signalLabel === "CALL" ? "bg-emerald-500/20" : signalLabel === "PUT" ? "bg-[#ec3b70]/20" : "bg-white/10"
              )}>
                {signalLabel === "CALL" ? (
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                ) : signalLabel === "PUT" ? (
                  <TrendingDown className="w-4 h-4 text-[#ec3b70]" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-white/40" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={cn(
                    "text-sm font-medium",
                    signalLabel === "CALL" ? "text-emerald-400" : signalLabel === "PUT" ? "text-[#ec3b70]" : "text-white/60"
                  )}>
                    {strategy.title}
                  </p>
                  {winRate > 0 && <span className="text-[10px] text-white/40">{winRate}% win rate</span>}
                </div>
                <p className="text-[11px] text-white/50 leading-snug mt-0.5">{strategy.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-white/[0.06]">
              <Clock className="w-3 h-3 text-white/40" />
              <span className="text-[11px] text-white/50">{strategy.timing}</span>
            </div>
          </div>

          {/* ============================================
              REVERSAL GAUGE - Compact G-Force Style
              ============================================ */}
          {hasActiveReversal && (() => {
            const pressure = reversalPricePoint?.confidence || reversalWarning?.confidence || 0
            const normalizedPressure = pressure / 100
            const maxRadius = 46
            const indicatorRadius = normalizedPressure * maxRadius
            const directionAngle = reversalIsBullish ? -90 : 90
            const angleRad = (directionAngle * Math.PI) / 180
            const indicatorX = 60 + indicatorRadius * Math.cos(angleRad)
            const indicatorY = 60 + indicatorRadius * Math.sin(angleRad)
            const accentColor = reversalIsBullish ? "#34d399" : "#ec3b70"
            
            // Get top 3 most important indicators for scalping (prioritize BB, Pivot, VWAP)
            const getTop3Indicators = () => {
              if (!reversalPricePoint?.sources) return []
              const priority = ['BB', 'Pivot', 'VWAP', 'Kijun', 'Ichimoku']
              return [...reversalPricePoint.sources]
                .sort((a, b) => {
                  const aIdx = priority.findIndex(p => a.name.includes(p))
                  const bIdx = priority.findIndex(p => b.name.includes(p))
                  return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx)
                })
                .slice(0, 3)
            }
            const top3Indicators = getTop3Indicators()
            
            return (
              <div className="rounded-xl mb-3 bg-black/40 border border-white/[0.06]">
                <div className="p-3">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase tracking-wider text-white/40">Reversal Pressure</span>
                    <span className="text-[10px] font-medium uppercase" style={{ color: accentColor }}>
                      {reversalIsBullish ? "Bullish" : "Bearish"}
                    </span>
                  </div>

                  {/* Centered Gauge with confidence inside */}
                  <div className="flex justify-center mb-3">
                    <div className="relative">
                      <svg width="110" height="110" viewBox="0 0 120 120">
                        {/* Outer glow ring */}
                        <circle cx="60" cy="60" r="54" fill="none" stroke={accentColor} strokeWidth="1" strokeOpacity="0.1" />
                        {/* Main rings */}
                        <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                        <circle cx="60" cy="60" r="38" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                        <circle cx="60" cy="60" r="26" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
                        {/* Crosshairs */}
                        <line x1="60" y1="6" x2="60" y2="18" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                        <line x1="60" y1="102" x2="60" y2="114" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                        <line x1="6" y1="60" x2="18" y2="60" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                        <line x1="102" y1="60" x2="114" y2="60" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                        {/* Direction line */}
                        <line x1="60" y1="60" x2={60 + 48 * Math.cos(angleRad)} y2={60 + 48 * Math.sin(angleRad)} stroke={accentColor} strokeWidth="1" strokeOpacity="0.25" />
                        {/* Pressure indicator */}
                        <circle cx={indicatorX} cy={indicatorY} r="6" fill={accentColor} style={{ filter: `drop-shadow(0 0 8px ${accentColor})`, transition: "cx 0.5s ease-out, cy 0.5s ease-out" }} />
                        <circle cx={indicatorX} cy={indicatorY} r="2.5" fill="white" style={{ transition: "cx 0.5s ease-out, cy 0.5s ease-out" }} />
                        {/* Center */}
                        <circle cx="60" cy="60" r="2" fill="rgba(255,255,255,0.25)" />
                      </svg>
                      {/* Confidence in center */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-light tabular-nums" style={{ color: accentColor }}>{pressure.toFixed(0)}</span>
                        <span className="text-[8px] text-white/40 uppercase tracking-wider -mt-0.5">%</span>
                      </div>
                    </div>
                  </div>

                  {/* Price + Zone Info - Centered below gauge */}
                  {reversalPricePoint && (
                    <div className="text-center mb-3">
                      <p className="text-lg font-semibold text-white">${reversalPricePoint.price.toFixed(2)}</p>
                      <p className="text-[10px] text-white/40">
                        Expected {reversalIsBullish ? "Support" : "Resistance"} ({reversalIsBullish ? "Buy" : "Sell"} Zone)
                      </p>
                    </div>
                  )}

                  {/* Top 3 Contributing Indicators - Inline */}
                  {top3Indicators.length > 0 && (
                    <div className="flex items-center justify-center gap-3 text-[10px] pt-2 border-t border-white/[0.06]">
                      {top3Indicators.map((source, i) => (
                        <span key={i}>
                          <span className="text-white/40">{source.name}:</span>{" "}
                          <span style={{ color: accentColor }}>${source.level.toFixed(2)}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

          {/* Key Factors - One-liner on desktop, stacked on mobile */}
          <div className="mb-3">
            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Key Factors</p>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3">
              <div className="flex items-center gap-1.5">
                <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", adx >= 25 ? "bg-emerald-400" : "bg-[#ec3b70]")} />
                <p className="text-[11px] text-white/60">
                  {adx >= 40 ? "Strong" : adx >= 25 ? "Moderate" : "Weak"} trend (ADX: {adx.toFixed(0)})
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", bbPosition === "lower" ? "bg-emerald-400" : bbPosition === "upper" ? "bg-[#ec3b70]" : "bg-white/40")} />
                <p className="text-[11px] text-white/60">Price at {bbPosition} Bollinger Band</p>
              </div>
              <div className="flex items-center gap-1.5">
                <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", rsi < 30 ? "bg-emerald-400" : rsi > 70 ? "bg-[#ec3b70]" : "bg-white/40")} />
                <p className="text-[11px] text-white/60">
                  RSI at {rsi.toFixed(0)} ({rsi < 30 ? "Oversold" : rsi > 70 ? "Overbought" : "Neutral"})
                </p>
              </div>
            </div>
          </div>

          {/* Indicator Score Bar - Compact */}
          <div className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
            <div className="flex justify-between text-[9px] text-white/40 mb-1">
              <span>Bearish</span>
              <span>Neutral</span>
              <span>Bullish</span>
            </div>
            <div className="h-1 rounded-full overflow-hidden flex bg-white/10">
              <div className="bg-[#ec3b70] transition-all" style={{ width: `${(sellCount / totalActive) * 100}%` }} />
              <div className="bg-white/30 transition-all" style={{ width: `${((totalActive - buyCount - sellCount) / totalActive) * 100}%` }} />
              <div className="bg-emerald-400 transition-all" style={{ width: `${(buyCount / totalActive) * 100}%` }} />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[#ec3b70] text-[11px] font-medium">{sellCount}</span>
              <span className="text-white/40 text-[11px]">{totalActive - buyCount - sellCount}</span>
              <span className="text-emerald-400 text-[11px] font-medium">{buyCount}</span>
            </div>
          </div>

          {/* Entry Checklist */}
          {signalLabel !== "WAIT" && (
            <div className="flex flex-wrap gap-2">
              {[
                { check: alignment >= 0.6, label: "60%+ aligned" },
                { check: strategy.risk !== "HIGH" && strategy.risk !== "AVOID", label: "Low risk" },
                { check: rsi < 70 && rsi > 30, label: "RSI OK" },
                { check: Math.abs(macdHistogram) > 0.3, label: "Momentum" },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs",
                    item.check ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-white/30",
                  )}
                >
                  <span>{item.check ? "✓" : "○"}</span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Trend Analysis Panel component
  const TrendAnalysisPanel = () => {
    if (!showTrendAnalysisPanel) return null
    
    return (
      <>
        {/* Tap-anywhere-to-close overlay */}
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowTrendAnalysisPanel(false)}
        />
        <div
          ref={trendAnalysisPanelRef}
          className="fixed top-[60px] left-0 right-0 bottom-0 bg-black/95 backdrop-blur-xl overflow-hidden z-50 overflow-y-auto"
        >
        {/* Panel Header */}
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between sticky top-0 bg-black/90 backdrop-blur-xl z-10">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.15em] text-white/40">Trend Analysis</span>
            <div className="flex items-center gap-1">
              {(["1m", "5m", "15m"] as const).map((tf) => (
                <span
                  key={tf}
                  className={cn(
                    "text-[9px] px-1.5 py-0.5 rounded",
                    superTrendSignals[tf] === "BUY"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : superTrendSignals[tf] === "SELL"
                        ? "bg-[#ec3b70]/20 text-[#ec3b70]"
                        : "bg-white/10 text-white/40"
                  )}
                >
                  {tf}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={() => setShowTrendAnalysisPanel(false)}
            className="p-1 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-4 h-4 text-white/40" />
          </button>
        </div>

        {/* Content wrapper - stacked naturally */}
        {pivotLevels && (
          <>
            {/* Combined Analysis */}
            <div className="p-2">
              <VerticalCombinedChart
                currentPrice={currentPrice}
                pivot={pivotLevels.pivot}
                r1={pivotLevels.r1}
                r2={pivotLevels.r2}
                r3={pivotLevels.r3 || pivotLevels.r2 + (pivotLevels.r2 - pivotLevels.r1)}
                s1={pivotLevels.s1}
                s2={pivotLevels.s2}
                s3={pivotLevels.s3 || pivotLevels.s2 - (pivotLevels.s1 - pivotLevels.s2)}
                bollingerBands={bollingerBands || { upper: currentPrice * 1.01, middle: currentPrice, lower: currentPrice * 0.99 }}
                candleData={marketData}
                signal={superTrendDirection === "BUY" ? "BUY" : superTrendDirection === "SELL" ? "SELL" : "HOLD"}
                trend={superTrendDirection === "BUY" ? "up" : superTrendDirection === "SELL" ? "down" : "neutral"}
              />
            </div>

            {/* Pivot Points - Compact with prices visible */}
            <div className="px-2 pb-1 border-t border-white/[0.06]">
              <PivotGauge
                currentPrice={currentPrice}
                pivot={pivotLevels.pivot}
                r1={pivotLevels.r1}
                r2={pivotLevels.r2}
                r3={pivotLevels.r3 || pivotLevels.r2 + (pivotLevels.r2 - pivotLevels.r1)}
                s1={pivotLevels.s1}
                s2={pivotLevels.s2}
                s3={pivotLevels.s3 || pivotLevels.s2 - (pivotLevels.s1 - pivotLevels.s2)}
                combined={false}
                signal={superTrendDirection === "BUY" ? "CALL" : superTrendDirection === "SELL" ? "PUT" : "WAIT"}
                trend={superTrendDirection === "BUY" ? "up" : superTrendDirection === "SELL" ? "down" : "neutral"}
                compact
              />
            </div>

            {/* Volatility Analysis - Compact */}
            <div className="px-3 py-2 border-t border-white/[0.06]">
              <p className="text-[9px] text-white/40 uppercase tracking-wider mb-2">Volatility Analysis</p>
              <div className="grid grid-cols-2 gap-2">
                {/* Bollinger Bands */}
                <div className="bg-black/30 border border-white/5 rounded-lg p-2">
                  <p className="text-[8px] text-white/40 uppercase mb-0.5">BB Width</p>
                  <p className="text-sm font-semibold text-white">{(bbWidth * 100).toFixed(2)}%</p>
                  <span className="text-[8px] px-1 py-0.5 rounded bg-white/10 text-white/60 uppercase">
                    {bbPosition === "upper" ? "Upper" : bbPosition === "lower" ? "Lower" : "Middle"}
                  </span>
                </div>
                {/* Keltner Squeeze */}
                <div className="bg-black/30 border border-white/5 rounded-lg p-2">
                  <p className="text-[8px] text-white/40 uppercase mb-0.5">Keltner</p>
                  <div className="flex items-center gap-1.5">
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full",
                        keltnerSqueeze ? "bg-white/70 shadow-[0_0_6px_rgba(255,255,255,0.5)]" : "bg-emerald-400",
                      )}
                    />
                    <span className="text-xs font-medium text-white">{keltnerSqueeze ? "Squeeze" : "No Squeeze"}</span>
                  </div>
                </div>
              </div>
              {/* TTM Squeeze & Volatility Percentile */}
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="bg-black/30 border border-white/5 rounded-lg p-2">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[8px] text-white/40 uppercase">TTM Squeeze</span>
                    <div className="flex items-center gap-1">
                      <div className={cn("w-1.5 h-1.5 rounded-full", ttmSqueeze ? "bg-[#ec3b70]" : "bg-emerald-400")} />
                      <span className="text-[8px] text-white/60 uppercase">{ttmSqueeze ? "ON" : "OFF"}</span>
                    </div>
                  </div>
                  <p className="text-[9px] text-white/50">
                    Mom: <span className={cn(
                      "font-medium",
                      ttmMomentum === "BULLISH" ? "text-emerald-400" : ttmMomentum === "BEARISH" ? "text-[#ec3b70]" : "text-white"
                    )}>{ttmMomentum}</span>
                  </p>
                </div>
                <div className="bg-black/30 border border-white/5 rounded-lg p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[8px] text-white/40 uppercase">Vol %</span>
                    <span className="text-emerald-400 text-xs font-medium">{volatilityPercentile.toFixed(0)}%</span>
                  </div>
                  <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-400 to-[#ec3b70] rounded-full"
                      style={{ width: `${Math.min(100, Math.max(0, volatilityPercentile))}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      </>
    )
  }

  if (isCollapsed) {
    return (
      <div className={cn("fixed top-0 left-0 right-0 z-50 transition-all duration-300", className)}>
        <div className="bg-black/70 backdrop-blur-xl border-b border-white/5 px-4 pt-2 pb-1.5">
          {/* Row 1: $SPX on left, Countdown pill centered, dots + bell on right */}
          <div className="flex items-center justify-between relative">
            {/* Ticker scroll-to-top button on left with search */}
            <div className="flex items-center gap-1.5">
              <div 
                onClick={scrollToTop}
                className="flex flex-col text-left min-w-[50px] cursor-pointer"
              >
                <span className="text-white font-semibold text-sm leading-tight">${selectedTicker}</span>
<span className={cn(
  "text-[10px] leading-tight",
  getSessionColorClass()
)}>{getDateOrMarketStatus()}</span>
  </div>
  
  {/* Ticker Search Icon */}
              <div className="relative" ref={tickerSearchRef}>
                <button
                  onClick={() => {
                    setShowTickerSearch(!showTickerSearch)
                    setTimeout(() => tickerSearchInputRef.current?.focus(), 100)
                  }}
                  className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
                  aria-label="Search ticker"
                >
                  <Search className="w-4 h-4 text-white/60" />
                </button>
                
                {/* Ticker Search Dropdown */}
                {showTickerSearch && (
                  <div className="absolute left-0 top-full mt-2 w-48 bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                    <div className="p-2">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                        <input
                          ref={tickerSearchInputRef}
                          type="text"
                          value={tickerSearchQuery}
                          onChange={(e) => setTickerSearchQuery(e.target.value.toUpperCase())}
                          placeholder="Search ticker..."
                          className="w-full pl-8 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
                        />
                      </div>
                    </div>
                    <div className="px-2 pb-2">
                      <p className="text-[9px] text-white/30 uppercase tracking-wider mb-1.5 px-1">Popular</p>
                      <div className="space-y-0.5">
                        {["SPX", "SPY", "QQQ", "AAPL", "GOOGL", "TSLA", "NVDA"].map((ticker) => (
                          <button
                            key={ticker}
                            onClick={() => {
                              onTickerChange(ticker)
                              setTickerSearchQuery("")
                              setShowTickerSearch(false)
                            }}
                            className={cn(
                              "w-full px-2 py-1.5 text-left text-xs rounded-md transition-colors flex items-center justify-between",
                              ticker === selectedTicker 
                                ? "bg-white/10 text-white" 
                                : "text-white/70 hover:bg-white/10"
                            )}
                          >
                            <span>${ticker}</span>
                            {ticker === selectedTicker && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Centered Countdown/Trade Alert Pill */}
            <button
              onClick={() => setIsCollapsed(false)}
              className={cn(
                "absolute left-1/2 -translate-x-1/2",
                "flex items-center gap-2 px-4 py-2 rounded-full",
                "bg-black/80 backdrop-blur-xl border border-white/10",
                "transition-all duration-300 hover:bg-black/90",
              )}
            >
              {selectedOption && isTimerRunning ? (
                // Active Trade Mode - Show vital alerts
                <>
                  <div className={cn(
                    "w-2 h-2 rounded-full animate-pulse",
                    reversalWarning === "CRITICAL" ? "bg-[#ec3b70]" :
                    reversalWarning === "HIGH" ? "bg-amber-400" :
                    adx < 20 ? "bg-amber-400" : 
                    superTrendDirection === "BUY" ? "bg-emerald-400" : "bg-[#ec3b70]"
                  )} />
                  <span className="text-xs font-medium text-white/70">
                    {reversalWarning === "CRITICAL" ? "EXIT NOW" :
                     reversalWarning === "HIGH" ? "Reversal Warning" :
                     adx < 20 ? "ADX Weak - Exit Soon" :
                     adx < 25 ? "ADX Weakening" :
                     superTrendDirection !== (selectedOption.type === "CALL" ? "BUY" : "SELL") ? "Trend Flip - Exit" :
                     `${selectedOption.type} Active`}
                  </span>
                </>
              ) : (
                // Normal Mode - Show optimal entry time (1PM ET)
                <>
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    isOptimalTime ? "bg-emerald-400 animate-pulse" : "bg-white/40"
                  )} />
                  <span className="text-xs font-medium text-white/70">
                    {isOptimalTime
                      ? `${optimalElapsed.hours}h ${optimalElapsed.minutes}m`
                      : `${optimalCountdown.hours}h ${optimalCountdown.minutes}m`}
                  </span>
                </>
              )}
              <ChevronDown className="w-3 h-3 text-white/40" />
            </button>

            <div className="flex items-center gap-2">
              {/* Alert Bell */}
              <div className="relative" ref={alertPanelRef}>
                <button
                  onClick={() => setShowAlertPanel(!showAlertPanel)}
                  className="relative p-1.5 rounded-full hover:bg-white/10 transition-colors"
                >
                  <Bell
                    className={cn("w-4 h-4 transition-colors", alerts.length > 0 ? "text-white" : "text-white/50")}
                  />
                  {alerts.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-[#ec3b70] rounded-full flex items-center justify-center text-[9px] font-bold text-white">
                      {alerts.length > 9 ? "9+" : alerts.length}
                    </span>
                  )}
                </button>

                {/* Alert Panel Dropdown */}
                {showAlertPanel && ( // Use showAlertPanel
                  <div className="absolute right-0 top-full mt-2 w-72 bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                      <span className="text-xs font-semibold text-white">Alerts</span>
                      {alerts.length > 0 && (
                        <button
                          onClick={() => {
                            onClearAllAlerts()
                            setShowAlertPanel(false) // Use setShowAlertPanel
                          }}
                          className="flex items-center gap-1 text-[10px] text-white/50 hover:text-white transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                          Clear all
                        </button>
                      )}
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {alerts.length === 0 ? (
                        <div className="px-3 py-6 text-center">
                          <Bell className="w-8 h-8 text-white/20 mx-auto mb-2" />
                          <p className="text-xs text-white/40">No alerts yet</p>
                        </div>
                      ) : (
                        alerts.map((alert) => (
                          <div
                            key={alert.id}
                            className={cn(
                              "px-3 py-2.5 border-b border-white/5 last:border-0 flex items-start gap-2",
                              alert.type === "danger" && "bg-red-500/5",
                              alert.type === "caution" && "bg-amber-500/5",
                              alert.type === "opportunity" && "bg-emerald-500/5",
                              alert.type === "info" && "bg-blue-500/5",
                            )}
                          >
                            <div
                              className={cn(
                                "w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0",
                                alert.type === "danger" && "bg-[#ec3b70]",
                                alert.type === "caution" && "bg-amber-500",
                                alert.type === "opportunity" && "bg-emerald-400",
                                alert.type === "info" && "bg-blue-400",
                              )}
                            />
                            <div className="flex-1 min-w-0">
                              <p
                                className={cn(
                                  "text-xs font-medium truncate",
                                  alert.type === "danger" && "text-[#ec3b70]",
                                  alert.type === "caution" && "text-amber-400",
                                  alert.type === "opportunity" && "text-emerald-400",
                                  alert.type === "info" && "text-blue-400",
                                )}
                                onClick={() => onAlertTap(alert)} // Use onAlertTap
                              >
                                {alert.title}
                              </p>
                              <p className="text-[10px] text-white/50 truncate">{alert.subtitle}</p>
                            </div>
                            <button
                              onClick={() => onDismissAlert(alert.id)}
                              className="p-0.5 rounded hover:bg-white/10 transition-colors flex-shrink-0"
                            >
                              <X className="w-3 h-3 text-white/30 hover:text-white/60" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Profile Photo - aligned with alert icon */}
              <button
                onClick={() => {
                  scrollToSection("settings")
                  onOpenSettings?.()
                }}
                className="relative w-7 h-7 rounded-full overflow-hidden transition-opacity hover:opacity-80"
              >
                {profilePhoto ? (
                  <img src={profilePhoto || "/placeholder.svg"} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-white/20 flex items-center justify-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/60">
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                )}
              </button>

              {/* Expand Chevron */}
              <button onClick={() => setIsCollapsed(false)} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                <ChevronDown className="w-4 h-4 text-white/50" />
              </button>
            </div>
          </div>

          {/* Row 2: Market warning + Nav Menu */}
          <div className="mt-1 flex items-center justify-between">
            {marketWarning ? (
              <div className="flex items-center gap-2">
                <marketWarning.icon className={cn("w-4 h-4", getWarningColors(marketWarning.type).text)} />
                <span className={cn("text-xs font-medium", getWarningColors(marketWarning.type).text)}>
                  {marketWarning.title}
                </span>
                <span className={cn("text-[10px]", getWarningColors(marketWarning.type).subtext)}>
                  {marketWarning.subtitle}
                </span>
              </div>
            ) : (
              <div />
            )}
            
            {/* Nav Menu Icon - Far Right */}
            <div className="relative" ref={navMenuRef}>
              <button
                onClick={() => setShowNavMenu(!showNavMenu)}
                className="p-1 rounded-full hover:bg-white/10 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24">
                  <path d="M12 2l-9 4 9 4 9-4-9-4z" fill="white" />
                  <path d="M12 10l-9 4 9 4 9-4-9-4z" fill="rgba(255,255,255,0.5)" />
                  <path d="M12 18l-9 4 9 4 9-4-9-4z" fill="rgba(255,255,255,0.25)" />
                </svg>
              </button>

              {/* Nav Menu Dropdown */}
              {showNavMenu && (
                <div className="absolute right-0 top-full mt-1 w-36 bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="py-1">
                    {[
                      { id: "market", label: "Market" },
                      { id: "analysis", label: "Analysis" },
                      { id: "options-simulation", label: "Simulator" },
                      { id: "settings", label: "Profile" },
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          scrollToSection(item.id)
                          if (item.id === "settings") {
                            onOpenSettings?.()
                          }
                          setShowNavMenu(false)
                        }}
                        className={cn(
                          "w-full px-4 py-2.5 text-left hover:bg-white/10 transition-colors",
                          currentSection === item.id && "bg-white/5"
                        )}
                      >
                        <span className={cn("text-sm", currentSection === item.id ? "text-white font-medium" : "text-white/70")}>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Row 3: HOLD + Power Hour on left, Trend Pill center, $200 + 1m toggles on right */}
          <div className="flex items-center pt-1 pb-0.5 overflow-x-auto scrollbar-hide">
            {/* Left section */}
            <div className="flex items-center gap-1.5 flex-shrink-0 flex-1">
              {/* SuperTrend Indicators - Clickable for Trend Analysis Panel */}
              <button
                onClick={() => setShowTrendAnalysisPanel(!showTrendAnalysisPanel)}
                className="flex items-center gap-0.5 px-0 py-0.5 rounded-lg transition-all hover:bg-white/5 active:scale-95 focus:outline-none focus:ring-0"
              >
                {/* 1m SuperTrend */}
                <div className="flex items-center gap-px">
                  {superTrendSignals["1m"] === "BUY" ? (
                    <svg width="8" height="8" viewBox="0 0 10 10" className="text-emerald-400">
                      <polygon points="5,1 9,9 1,9" fill="currentColor" />
                    </svg>
                  ) : superTrendSignals["1m"] === "SELL" ? (
                    <svg width="8" height="8" viewBox="0 0 10 10" className="text-[#ec3b70]">
                      <polygon points="1,1 9,1 5,9" fill="currentColor" />
                    </svg>
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-white/30" />
                  )}
                  <span
                    className={cn(
                      "text-[9px] font-medium",
                      superTrendSignals["1m"] === "BUY"
                        ? "text-emerald-400"
                        : superTrendSignals["1m"] === "SELL"
                          ? "text-[#ec3b70]"
                          : "text-white/40",
                    )}
                  >
                    1m
                  </span>
                </div>

                {/* 5m SuperTrend */}
                <div className="flex items-center gap-px">
                  {superTrendSignals["5m"] === "BUY" ? (
                    <svg width="8" height="8" viewBox="0 0 10 10" className="text-emerald-400">
                      <polygon points="5,1 9,9 1,9" fill="currentColor" />
                    </svg>
                  ) : superTrendSignals["5m"] === "SELL" ? (
                    <svg width="8" height="8" viewBox="0 0 10 10" className="text-[#ec3b70]">
                      <polygon points="1,1 9,1 5,9" fill="currentColor" />
                    </svg>
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-white/30" />
                  )}
                  <span
                    className={cn(
                      "text-[9px] font-medium",
                      superTrendSignals["5m"] === "BUY"
                        ? "text-emerald-400"
                        : superTrendSignals["5m"] === "SELL"
                          ? "text-[#ec3b70]"
                          : "text-white/40",
                    )}
                  >
                    5m
                  </span>
                </div>

                {/* 15m SuperTrend */}
                <div className="flex items-center gap-px">
                  {superTrendSignals["15m"] === "BUY" ? (
                    <svg width="8" height="8" viewBox="0 0 10 10" className="text-emerald-400">
                      <polygon points="5,1 9,9 1,9" fill="currentColor" />
                    </svg>
                  ) : superTrendSignals["15m"] === "SELL" ? (
                    <svg width="8" height="8" viewBox="0 0 10 10" className="text-[#ec3b70]">
                      <polygon points="1,1 9,1 5,9" fill="currentColor" />
                    </svg>
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-white/30" />
                  )}
                  <span
                    className={cn(
                      "text-[9px] font-medium",
                      superTrendSignals["15m"] === "BUY"
                        ? "text-emerald-400"
                        : superTrendSignals["15m"] === "SELL"
                          ? "text-[#ec3b70]"
                          : "text-white/40",
                    )}
                  >
                    15m
                  </span>
                </div>
              </button>

              <div className="w-px h-3 bg-white/10" />

              {selectedOption && isTimerRunning ? (
                <ActiveTradePill />
              ) : (
                <button
                  onClick={onPowerHourToggle}
                  className="flex items-center gap-1 hover:opacity-80 transition-opacity cursor-pointer"
                >
                  <Zap className={cn("w-2.5 h-2.5", isPowerHour ? "text-emerald-400" : "text-[#ec3b70]")} />
                  <span className={cn("text-[9px]", isPowerHour ? "text-emerald-400" : "text-[#ec3b70]")}>
                    {isPowerHour
                      ? `${powerHourRemaining.minutes}m left`
                      : `Power Hour ${powerHourCountdown.hours}h ${powerHourCountdown.minutes}m`}
                  </span>
                </button>
              )}
            </div>

            {/* Center: Trend Sentiment Pill */}
            <div className="flex items-center justify-center flex-shrink-0">
              <button
                ref={trendPillButtonRef}
                onClick={() => setShowPriceActionPanel(!showPriceActionPanel)}
                className={cn(
                  "flex items-center gap-1 h-7 px-2.5 rounded-full text-[10px] font-semibold uppercase tracking-wide transition-all active:scale-95",
                  trendSentiment.bgColor,
                  trendSentiment.color,
                )}
              >
                {trendSentiment.label}
                <ChevronDown className={cn("w-3 h-3 transition-transform", showPriceActionPanel && "rotate-180")} />
              </button>
            </div>

            {/* Right: Budget and Timeframe Toggles */}
            <div className="flex items-center gap-1.5 flex-shrink-0 flex-1 justify-end">

              {/* Budget Toggle Popover - Collapsed Nav */}
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-1.5 h-7 px-3 bg-white/10 rounded-full text-[11px] text-white/80 hover:bg-white/15 transition-colors">
                    <span>{formatBudgetDisplay(tradeBudget)}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[236px] p-5 bg-black/85 backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-2xl"
                  align="end"
                  sideOffset={8}
                >
                  <div className="space-y-4">
                    <div className="text-center">
                      <p className="text-[9px] text-white/40 uppercase tracking-[0.12em] mb-1">Trade Budget</p>
                      <p className="text-[24px] font-light text-white tracking-tight">${tradeBudget}</p>
                    </div>

                    <div className="space-y-2 pt-1">
                      <div className="relative">
                        <Slider
                          value={[budgetToSlider(tradeBudget)]} // Use budgetToSlider
                          onValueChange={(val) => onBudgetChange(sliderToBudget(val[0]))} // Use sliderToBudget
                          min={0} // Slider min is 0
                          max={100} // Slider max is 100
                          step={0.5}
                          className="w-full [&_[data-slot=slider-track]]:h-[5px] [&_[data-slot=slider-track]]:bg-white/10 [&_[data-slot=slider-range]]:bg-gradient-to-r [&_[data-slot=slider-range]]:from-cyan-400 [&_[data-slot=slider-range]]:to-cyan-300 [&_[data-slot=slider-thumb]]:w-[15px] [&_[data-slot=slider-thumb]]:h-[15px] [&_[data-slot=slider-thumb]]:bg-white [&_[data-slot=slider-thumb]]:border-0 [&_[data-slot=slider-thumb]]:shadow-[0_0_8px_rgba(255,255,255,0.6),0_0_16px_rgba(34,211,238,0.4)]"
                        />
                      </div>
                      <div className="flex justify-between text-[9px] text-white/40 px-0.5">
                        <span>$5</span>
                        <span>$5K</span>
                      </div>
                    </div>

                    <div className="h-px bg-white/[0.08]" />

                    <div>
                      <p className="text-[9px] text-white/40 uppercase tracking-[0.12em] mb-2.5">Presets</p>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { value: 5, label: "$5" },
                          { value: 50, label: "$50" },
                          { value: 100, label: "$100" },
                          { value: 200, label: "$200" },
                          { value: 500, label: "$500" },
                          { value: 1000, label: "$1K" },
                          { value: 2000, label: "$2K" },
                          { value: 5000, label: "$5K" },
                        ].map((preset) => (
                          <button
                            key={preset.value}
                            onClick={() => onBudgetChange(preset.value)}
                            className={cn(
                              "py-1.5 px-1.5 rounded-xl text-[10px] font-medium transition-all",
                              tradeBudget === preset.value
                                ? "bg-white text-black shadow-sm"
                                : "bg-white/[0.08] text-white/60 hover:bg-white/12 hover:text-white/80",
                            )}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Timeframe Toggle Popover - Collapsed Nav */}
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-1.5 h-7 px-3 bg-white/10 rounded-full text-[11px] text-white/80 hover:bg-white/15 transition-colors">
                    <span>{getTimeframeDisplayLabel(chartTimeframe)}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[144px] p-3 bg-black/85 backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-2xl"
                  align="end"
                  sideOffset={8}
                >
                  <div className="space-y-2.5">
                    <div>
                      <p className="text-[9px] text-white/50 uppercase tracking-[0.15em] mb-2">Intraday</p>
                      <div className="space-y-1.5">
                        <div className="grid grid-cols-3 gap-1">
                          {[
                            { value: "1", label: "1m" },
                            { value: "5", label: "5m" },
                            { value: "15", label: "15m" },
                          ].map((tf) => (
                            <button
                              key={tf.value}
                              onClick={() => onTimeframeChange(tf.value)}
                              className={cn(
                                "py-1.5 px-1.5 rounded-lg text-[10px] font-medium transition-all",
                                chartTimeframe === tf.value
                                  ? "bg-[#1a1a1a] text-white"
                                  : "bg-white/[0.08] text-white/60 hover:bg-white/12 hover:text-white/80",
                              )}
                            >
                              {tf.label}
                            </button>
                          ))}
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          {[
                            { value: "30", label: "30m" },
                            { value: "60", label: "1h" },
                            { value: "240", label: "4h" },
                          ].map((tf) => (
                            <button
                              key={tf.value}
                              onClick={() => onTimeframeChange(tf.value)}
                              className={cn(
                                "py-1.5 px-1.5 rounded-lg text-[10px] font-medium transition-all",
                                chartTimeframe === tf.value
                                  ? "bg-[#1a1a1a] text-white"
                                  : "bg-white/[0.08] text-white/60 hover:bg-white/12 hover:text-white/80",
                              )}
                            >
                              {tf.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="h-px bg-white/10" />

                    <div>
                      <p className="text-[9px] text-white/50 uppercase tracking-[0.15em] mb-2">Historical</p>
                      <div className="grid grid-cols-3 gap-1">
                        {[
                          { value: "D", label: "D" },
                          { value: "W", label: "W" },
                          { value: "M", label: "M" },
                        ].map((tf) => (
                          <button
                            key={tf.value}
                            onClick={() => onTimeframeChange(tf.value)}
                            className={cn(
                              "py-1.5 px-1.5 rounded-lg text-[10px] font-medium transition-all",
                              chartTimeframe === tf.value
                                ? "bg-[#1a1a1a] text-white"
                                : "bg-white/[0.08] text-white/60 hover:bg-white/12 hover:text-white/80",
                            )}
                          >
                            {tf.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
        
        {/* Signal Check Panel - Collapsed View */}
        {showPriceActionPanel && <SignalCheckPanel />}
        
        {/* Trend Analysis Panel - Collapsed View */}
        {showTrendAnalysisPanel && <TrendAnalysisPanel />}
      </div>
    )
  }

  return (
    <div className={cn("fixed top-0 left-0 right-0 z-50 transition-all duration-300", className)}>
      <div className="bg-black/70 backdrop-blur-xl border-b border-white/5 px-4 pt-2 pb-1.5">
        {/* Row 1: Ticker info, countdown, dots, bell, collapse chevron */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="flex items-center gap-1.5">
              <div 
                onClick={scrollToTop}
                className="flex flex-col text-left cursor-pointer"
              >
                <span className="text-white font-semibold text-sm leading-tight">${selectedTicker}</span>
<span className={cn(
  "text-[10px] leading-tight",
  getSessionColorClass()
)}>{getDateOrMarketStatus()}</span>
  </div>
  
  {/* Ticker Search Icon - Expanded View */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowTickerSearch(!showTickerSearch)
                    setTimeout(() => tickerSearchInputRef.current?.focus(), 100)
                  }}
                  className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
                  aria-label="Search ticker"
                >
                  <Search className="w-4 h-4 text-white/60" />
                </button>
                
                {/* Ticker Search Dropdown - Expanded View */}
                {showTickerSearch && (
                  <div className="absolute left-0 top-full mt-2 w-48 bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                    <div className="p-2">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                        <input
                          ref={tickerSearchInputRef}
                          type="text"
                          value={tickerSearchQuery}
                          onChange={(e) => setTickerSearchQuery(e.target.value.toUpperCase())}
                          placeholder="Search ticker..."
                          className="w-full pl-8 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
                        />
                      </div>
                    </div>
                    <div className="px-2 pb-2">
                      <p className="text-[9px] text-white/30 uppercase tracking-wider mb-1.5 px-1">Popular</p>
                      <div className="space-y-0.5">
                        {["SPX", "SPY", "QQQ", "AAPL", "GOOGL", "TSLA", "NVDA"].map((ticker) => (
                          <button
                            key={ticker}
                            onClick={() => {
                              onTickerChange(ticker)
                              setTickerSearchQuery("")
                              setShowTickerSearch(false)
                            }}
                            className={cn(
                              "w-full px-2 py-1.5 text-left text-xs rounded-md transition-colors flex items-center justify-between",
                              ticker === selectedTicker 
                                ? "bg-white/10 text-white" 
                                : "text-white/70 hover:bg-white/10"
                            )}
                          >
                            <span>${ticker}</span>
                            {ticker === selectedTicker && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="w-px h-7 bg-white/20 mx-3" />

            <div className="w-7 h-7 rounded-full flex items-center justify-center border border-white/30">
              <Clock className="w-3.5 h-3.5 text-white/70" />
            </div>

            <div className="flex flex-col ml-2">
              <span className="text-base font-light text-white leading-tight">
                {isOptimalTime
                  ? `${optimalElapsed.hours}h ${optimalElapsed.minutes}m`
                  : `${optimalCountdown.hours}h ${optimalCountdown.minutes}m`}
              </span>
              <span className="text-[10px] text-white/40 uppercase tracking-wide leading-tight">
                {isOptimalTime ? "In Optimal Window" : "UNTIL OPTIMAL (1PM ET)"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Alert Bell */}
            <div className="relative" ref={alertPanelRef}>
              <button
                onClick={() => setShowAlertPanel(!showAlertPanel)}
                className="relative p-1.5 rounded-full hover:bg-white/10 transition-colors"
              >
                <Bell className={cn("w-4 h-4 transition-colors", alerts.length > 0 ? "text-white" : "text-white/50")} />
                {alerts.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-[#ec3b70] rounded-full flex items-center justify-center text-[9px] font-bold text-white">
                    {alerts.length > 9 ? "9+" : alerts.length}
                  </span>
                )}
              </button>

              {/* Alert Panel Dropdown */}
              {showAlertPanel && ( // Use showAlertPanel
                <div className="absolute right-0 top-full mt-2 w-72 bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                    <span className="text-xs font-semibold text-white">Alerts</span>
                    {alerts.length > 0 && (
                      <button
                        onClick={() => {
                          onClearAllAlerts()
                          setShowAlertPanel(false) // Use setShowAlertPanel
                        }}
                        className="flex items-center gap-1 text-[10px] text-white/50 hover:text-white transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        Clear all
                      </button>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {alerts.length === 0 ? (
                      <div className="px-3 py-6 text-center">
                        <Bell className="w-8 h-8 text-white/20 mx-auto mb-2" />
                        <p className="text-xs text-white/40">No alerts yet</p>
                      </div>
                    ) : (
                      alerts.map((alert) => (
                        <div
                          key={alert.id}
                          className={cn(
                            "px-3 py-2.5 border-b border-white/5 last:border-0 flex items-start gap-2",
                            alert.type === "danger" && "bg-red-500/5",
                            alert.type === "caution" && "bg-amber-500/5",
                            alert.type === "opportunity" && "bg-emerald-500/5",
                            alert.type === "info" && "bg-blue-500/5",
                          )}
                        >
                          <div
                            className={cn(
                              "w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0",
                              alert.type === "danger" && "bg-[#ec3b70]",
                              alert.type === "caution" && "bg-amber-500",
                              alert.type === "opportunity" && "bg-emerald-400",
                              alert.type === "info" && "bg-blue-400",
                            )}
                          />
                          <div className="flex-1 min-w-0">
                            <p
                              className={cn(
                                "text-xs font-medium truncate",
                                alert.type === "danger" && "text-[#ec3b70]",
                                alert.type === "caution" && "text-amber-400",
                                alert.type === "opportunity" && "text-emerald-400",
                                alert.type === "info" && "text-blue-400",
                              )}
                              onClick={() => onAlertTap(alert)} // Use onAlertTap
                            >
                              {alert.title}
                            </p>
                            <p className="text-[10px] text-white/50 truncate">{alert.subtitle}</p>
                          </div>
                          <button
                            onClick={() => onDismissAlert(alert.id)}
                            className="p-0.5 rounded hover:bg-white/10 transition-colors flex-shrink-0"
                          >
                            <X className="w-3 h-3 text-white/30 hover:text-white/60" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Hamburger Menu */}
            <div className="relative" ref={navMenuRef}>
              <button
                onClick={() => setShowNavMenu(!showNavMenu)}
                className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
              >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-white">
                <path d="M12 2l-9 4 9 4 9-4-9-4z" opacity="1" />
                <path d="M12 10l-9 4 9 4 9-4-9-4z" opacity="0.5" />
                <path d="M12 18l-9 4 9 4 9-4-9-4z" opacity="0.25" />
              </svg>
              </button>

              {/* Nav Menu Dropdown */}
              {showNavMenu && (
                <div className="absolute right-0 top-full mt-2 w-36 bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="py-1">
                    {[
                      { id: "market", label: "Market" },
                      { id: "analysis", label: "Analysis" },
                      { id: "options-simulation", label: "Simulator" },
                      { id: "settings", label: "Profile" },
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          scrollToSection(item.id)
                          if (item.id === "settings") {
                            onOpenSettings?.()
                          }
                          setShowNavMenu(false)
                        }}
                        className={cn(
                          "w-full px-4 py-2.5 text-left hover:bg-white/10 transition-colors",
                          currentSection === item.id && "bg-white/5"
                        )}
                      >
                        <span className={cn("text-sm", currentSection === item.id ? "text-white font-medium" : "text-white/70")}>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Photo */}
            <button
              onClick={() => {
                scrollToSection("settings")
                onOpenSettings?.()
              }}
              className="relative w-7 h-7 rounded-full overflow-hidden transition-opacity hover:opacity-80"
            >
              {profilePhoto ? (
                <img src={profilePhoto || "/placeholder.svg"} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-white/20 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/60">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
              )}
            </button>

            <button
              onClick={() => setIsCollapsed(true)}
              className="p-1 rounded-full hover:bg-white/10 transition-colors"
            >
              <ChevronUp className="w-5 h-5 text-white/50" />
            </button>
          </div>
        </div>

        {/* Row 2: Market warning */}
        {marketWarning && (
          <div className="flex items-center gap-2 mt-1.5">
            <marketWarning.icon className="w-3.5 h-3.5 text-white/80" />
            <span className="text-xs font-semibold text-white">{marketWarning.title}</span>
            <span className="text-[11px] text-white/50">{marketWarning.subtitle}</span>
          </div>
        )}

        {/* Row 3: SuperTrend + Power Hour + Sentiment + Budget + Timeframe */}
        <div className="flex items-center justify-between overflow-x-auto pb-1 scrollbar-hide">
            {/* SuperTrend Indicators - Clickable for Trend Analysis Panel */}
              <button
                ref={superTrendButtonRef}
                onClick={() => setShowTrendAnalysisPanel(!showTrendAnalysisPanel)}
                className="flex items-center gap-0.5 px-0.5 py-1 rounded-lg transition-all hover:bg-white/5 active:scale-95 focus:outline-none focus:ring-0"
              >
            {/* 1m SuperTrend */}
            <div className="flex items-center gap-0.5">
              {superTrendSignals["1m"] === "BUY" ? (
                <svg width="8" height="8" viewBox="0 0 10 10" className="text-emerald-400">
                  <polygon points="5,1 9,9 1,9" fill="currentColor" />
                </svg>
              ) : superTrendSignals["1m"] === "SELL" ? (
                <svg width="8" height="8" viewBox="0 0 10 10" className="text-[#ec3b70]">
                  <polygon points="1,1 9,1 5,9" fill="currentColor" />
                </svg>
              ) : (
                <div className="w-2 h-2 rounded-full bg-white/30" />
              )}
              <span
                className={cn(
                  "text-[8px] font-medium",
                  superTrendSignals["1m"] === "BUY"
                    ? "text-emerald-400"
                    : superTrendSignals["1m"] === "SELL"
                      ? "text-[#ec3b70]"
                      : "text-white/40",
                )}
              >
                1m
              </span>
            </div>

            {/* 5m SuperTrend */}
            <div className="flex items-center gap-px">
              {superTrendSignals["5m"] === "BUY" ? (
                <svg width="8" height="8" viewBox="0 0 10 10" className="text-emerald-400">
                  <polygon points="5,1 9,9 1,9" fill="currentColor" />
                </svg>
              ) : superTrendSignals["5m"] === "SELL" ? (
                <svg width="8" height="8" viewBox="0 0 10 10" className="text-[#ec3b70]">
                  <polygon points="1,1 9,1 5,9" fill="currentColor" />
                </svg>
              ) : (
                <div className="w-2 h-2 rounded-full bg-white/30" />
              )}
              <span
                className={cn(
                  "text-[8px] font-medium",
                  superTrendSignals["5m"] === "BUY"
                    ? "text-emerald-400"
                    : superTrendSignals["5m"] === "SELL"
                      ? "text-[#ec3b70]"
                      : "text-white/40",
                )}
              >
                5m
              </span>
            </div>

            {/* 15m SuperTrend */}
            <div className="flex items-center gap-px">
              {superTrendSignals["15m"] === "BUY" ? (
                <svg width="8" height="8" viewBox="0 0 10 10" className="text-emerald-400">
                  <polygon points="5,1 9,9 1,9" fill="currentColor" />
                </svg>
              ) : superTrendSignals["15m"] === "SELL" ? (
                <svg width="8" height="8" viewBox="0 0 10 10" className="text-[#ec3b70]">
                  <polygon points="1,1 9,1 5,9" fill="currentColor" />
                </svg>
              ) : (
                <div className="w-2 h-2 rounded-full bg-white/30" />
              )}
              <span
                className={cn(
                  "text-[8px] font-medium",
                  superTrendSignals["15m"] === "BUY"
                    ? "text-emerald-400"
                    : superTrendSignals["15m"] === "SELL"
                      ? "text-[#ec3b70]"
                      : "text-white/40",
                )}
              >
                15m
              </span>
            </div>
          </button>

          <div className="w-px h-3 bg-white/20" />

          {selectedOption && isTimerRunning ? (
            <ActiveTradePill />
          ) : (
            <button
              onClick={onPowerHourToggle}
              className="flex items-center gap-1 hover:opacity-80 transition-opacity cursor-pointer"
            >
              <Zap className="w-2.5 h-2.5 text-[#ec3b70]" />
              <span className="text-[9px] text-[#ec3b70] font-medium">
                {isPowerHour
                  ? `${powerHourRemaining.minutes}m left`
                  : `Power Hour ${powerHourCountdown.hours}h ${powerHourCountdown.minutes}m`}
              </span>
            </button>
          )}

          {/* Center: Trend Sentiment Pill */}
          <button
            ref={trendPillButtonRef2}
            onClick={() => setShowPriceActionPanel(!showPriceActionPanel)}
            className={cn(
              "flex items-center gap-1 h-7 px-2.5 rounded-full text-[10px] font-semibold uppercase tracking-wide transition-all active:scale-95 flex-shrink-0",
              trendSentiment.bgColor,
              trendSentiment.color,
            )}
          >
            {trendSentiment.label}
            <ChevronDown className={cn("w-3 h-3 transition-transform", showPriceActionPanel && "rotate-180")} />
          </button>

          {/* Right: Budget Toggle Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1.5 h-7 px-3 bg-white/10 rounded-full text-[11px] text-white/80 hover:bg-white/15 transition-colors">
                <span>{formatBudgetDisplay(tradeBudget)}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[236px] p-5 bg-black/85 backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-2xl"
              align="end"
              sideOffset={8}
            >
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-[9px] text-white/40 uppercase tracking-[0.12em] mb-1">Trade Budget</p>
                  <p className="text-[24px] font-light text-white tracking-tight">${tradeBudget}</p>
                </div>

                <div className="space-y-2 pt-1">
                  <div className="relative">
                    <Slider
                      value={[budgetToSlider(tradeBudget)]} // Use budgetToSlider
                      onValueChange={(val) => onBudgetChange(sliderToBudget(val[0]))} // Use sliderToBudget
                      min={0} // Slider min is 0
                      max={100} // Slider max is 100
                      step={0.5}
                      className="w-full [&_[data-slot=slider-track]]:h-[5px] [&_[data-slot=slider-track]]:bg-white/10 [&_[data-slot=slider-range]]:bg-gradient-to-r [&_[data-slot=slider-range]]:from-cyan-400 [&_[data-slot=slider-range]]:to-cyan-300 [&_[data-slot=slider-thumb]]:w-[15px] [&_[data-slot=slider-thumb]]:h-[15px] [&_[data-slot=slider-thumb]]:bg-white [&_[data-slot=slider-thumb]]:border-0 [&_[data-slot=slider-thumb]]:shadow-[0_0_8px_rgba(255,255,255,0.6),0_0_16px_rgba(34,211,238,0.4)]"
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-white/40 px-0.5">
                    <span>$5</span>
                    <span>$5K</span>
                  </div>
                </div>

                <div className="h-px bg-white/[0.08]" />

                <div>
                  <p className="text-[9px] text-white/40 uppercase tracking-[0.12em] mb-2.5">Presets</p>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { value: 5, label: "$5" },
                      { value: 50, label: "$50" },
                      { value: 100, label: "$100" },
                      { value: 200, label: "$200" },
                      { value: 500, label: "$500" },
                      { value: 1000, label: "$1K" },
                      { value: 2000, label: "$2K" },
                      { value: 5000, label: "$5K" },
                    ].map((preset) => (
                      <button
                        key={preset.value}
                        onClick={() => onBudgetChange(preset.value)}
                        className={cn(
                          "py-1.5 px-1.5 rounded-xl text-[10px] font-medium transition-all",
                          tradeBudget === preset.value
                            ? "bg-white text-black shadow-sm"
                            : "bg-white/[0.08] text-white/60 hover:bg-white/12 hover:text-white/80",
                        )}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Timeframe Toggle Popover - Collapsed Nav */}
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1.5 h-7 px-3 bg-white/10 rounded-full text-[11px] text-white/80 hover:bg-white/15 transition-colors">
                <span>{getTimeframeDisplayLabel(chartTimeframe)}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[144px] p-3 bg-black/85 backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-2xl"
              align="end"
              sideOffset={8}
            >
              <div className="space-y-2.5">
                <div>
                  <p className="text-[9px] text-white/50 uppercase tracking-[0.15em] mb-2">Intraday</p>
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { value: "1", label: "1m" },
                        { value: "5", label: "5m" },
                        { value: "15", label: "15m" },
                      ].map((tf) => (
                        <button
                          key={tf.value}
                          onClick={() => onTimeframeChange(tf.value)}
                          className={cn(
                            "py-1.5 px-1.5 rounded-lg text-[10px] font-medium transition-all",
                            chartTimeframe === tf.value
                              ? "bg-[#1a1a1a] text-white"
                              : "bg-white/[0.08] text-white/60 hover:bg-white/12 hover:text-white/80",
                          )}
                        >
                          {tf.label}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { value: "30", label: "30m" },
                        { value: "60", label: "1h" },
                        { value: "240", label: "4h" },
                      ].map((tf) => (
                        <button
                          key={tf.value}
                          onClick={() => onTimeframeChange(tf.value)}
                          className={cn(
                            "py-1.5 px-1.5 rounded-lg text-[10px] font-medium transition-all",
                            chartTimeframe === tf.value
                              ? "bg-[#1a1a1a] text-white"
                              : "bg-white/[0.08] text-white/60 hover:bg-white/12 hover:text-white/80",
                          )}
                        >
                          {tf.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="h-px bg-white/10" />

                <div>
                  <p className="text-[9px] text-white/50 uppercase tracking-[0.15em] mb-2">Historical</p>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { value: "D", label: "D" },
                      { value: "W", label: "W" },
                      { value: "M", label: "M" },
                    ].map((tf) => (
                      <button
                        key={tf.value}
                        onClick={() => onTimeframeChange(tf.value)}
                        className={cn(
                          "py-1.5 px-1.5 rounded-lg text-[10px] font-medium transition-all",
                          chartTimeframe === tf.value
                            ? "bg-[#1a1a1a] text-white"
                            : "bg-white/[0.08] text-white/60 hover:bg-white/12 hover:text-white/80",
                        )}
                      >
                        {tf.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Mini candle chart section - keep as is */}
        {showCandleChart && marketData.length > 0 && (
          <div className="mt-2 rounded-xl overflow-hidden border border-white/10 bg-black/30">
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
              <div>
                <p className="text-[9px] text-white/50 uppercase tracking-wider mb-1">Price Action</p>
                <p className="text-xs text-white/70">{Math.min(marketData.length, 30)} candles</p>
              </div>
              <span
                className={cn(
                  "px-2.5 py-1 rounded-full text-[10px] font-medium",
                  priceActionSentiment === "Bullish"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : priceActionSentiment === "Bearish"
                      ? "bg-[#ec3b70]/20 text-[#ec3b70]"
                      : "bg-white/10 text-white/60",
                )}
              >
                {priceActionSentiment}
              </span>
            </div>

            <div className="h-[60px] relative">
              <canvas ref={candleCanvasRef} className="w-full h-full" style={{ background: "transparent" }} />
            </div>

            <div className="grid grid-cols-2 gap-2 p-2">
              <div className="bg-white/5 rounded-lg p-2.5">
                <p className="text-[9px] text-white/40 uppercase tracking-wider mb-1">Suggested Entry</p>
                <p
                  className={cn(
                    "text-sm font-medium",
                    suggestedEntry.entryType === "CALL"
                      ? "text-emerald-400"
                      : suggestedEntry.entryType === "PUT"
                        ? "text-[#ec3b70]"
                        : "text-white/60",
                  )}
                >
                  ${suggestedEntry.price.toFixed(2)}
                </p>
                <p className="text-[9px] text-white/40">
                  ${suggestedEntry.distance.toFixed(2)} {suggestedEntry.distance >= 0 ? "above" : "below"}
                </p>
              </div>
              <div className="bg-white/5 rounded-lg p-2.5">
                <p className="text-[9px] text-white/40 uppercase tracking-wider mb-1">Action</p>
                <p
                  className={cn(
                    "text-sm font-medium",
                    suggestedEntry.entryType === "CALL"
                      ? "text-emerald-400"
                      : suggestedEntry.entryType === "PUT"
                        ? "text-[#ec3b70]"
                        : "text-white/60",
                  )}
                >
                  {suggestedEntry.action}
                </p>
                <p className="text-[9px] text-white/40">{suggestedEntry.entryType} entry</p>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Render Price Action Panel */}
      {showPriceActionPanel && <SignalCheckPanel />}
      {/* Render Trend Analysis Panel */}
      <TrendAnalysisPanel />
    </div>
  )
}
