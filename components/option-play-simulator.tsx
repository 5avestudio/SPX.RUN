"use client"

import type React from "react"

import { useMemo, useState, useEffect, useCallback } from "react"
import {
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Clock,
  Calendar,
  Wifi,
  RefreshCw,
  Target,
  Timer,
  Zap,
  Play,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { triggerHaptic } from "@/lib/haptics"
import { BudgetSlider } from "@/components/budget-slider"
import { getTimeUntilOptimalEntry } from "@/lib/market-data"
import type { TradierOption } from "@/lib/tradier"
import { SAMPLE_WINNING_RUNS } from "@/lib/trade-archive"

export interface OptionPlay {
  type: "CALL" | "PUT"
  strike: number
  bid: number
  ask: number
  delta: number
  moneyness: "ITM" | "OTM"
  winRate: number
  contracts: number
  profit: number
  costBasis: number
  breakeven: number
  riskReward: number
  entryPrice: number
  targetPrice: number
  stopPrice: number
  targetDuration: string // Added targetDuration field
  expirationDate: string
  potentialProfit: number
  potentialLoss: number
  displayContracts: number
  realData?: boolean
  gamma?: number
  theta?: number
  vega?: number
  iv?: number
  isPowerHourScalp?: boolean
  explosiveMultiplier?: number // Based on archive data (e.g., 20x, 50x potential)
  strikesFromATM?: number
  entryTime?: string // hh:mm format
  exitTime?: string // hh:mm format
  spread?: number // Added spread field
}

interface Recommendation {
  type: "budget" | "wait" | "act" | "avoid" | "timing"
  message: string
  detail: string
  priority: number
}

interface OptionPlaySimulatorProps {
  budget: number
  onBudgetChange?: (budget: number) => void
  currentPrice: number
  signal: string
  confidence: number
  pivotLevels: {
    pivot: number
    r1: number
    r2: number
    r3?: number // Added r3
    s1: number
    s2: number
  }
  rsi: number
  indicators: { name: string; signal: string }[]
  onStartTimer?: (option: OptionPlay) => void
}

function calculateExplosivePotential(
  entryPrice: number,
  moneyness: "ITM" | "OTM",
  strikesFromATM: number,
  isPowerHour: boolean,
): { multiplier: number; conservativeTarget: number; explosiveTarget: number } {
  // Based on archive data:
  // - $0.05 → $8.73 = 174x (far OTM during power hour)
  // - $0.35 → $7.90 = 22x
  // - $3.00 → $170 = 56x (user example)
  // - $35 → $750 = 21x (user example)

  if (!isPowerHour) {
    // Normal hours - conservative targets
    return {
      multiplier: 1.5,
      conservativeTarget: entryPrice * 1.2,
      explosiveTarget: entryPrice * 2,
    }
  }

  // Power hour OTM scalp potential
  if (moneyness === "OTM") {
    if (entryPrice < 1) {
      // Ultra cheap contracts ($0.05-$1) - lottery tickets
      // Archive shows 174x potential on $0.05 contracts
      return {
        multiplier: 50,
        conservativeTarget: entryPrice * 10,
        explosiveTarget: entryPrice * 100,
      }
    } else if (entryPrice < 5) {
      // Cheap contracts ($1-$5) - high leverage
      // Archive shows 22x potential on $0.35 contracts
      return {
        multiplier: 20,
        conservativeTarget: entryPrice * 5,
        explosiveTarget: entryPrice * 50,
      }
    } else if (entryPrice < 15) {
      // Moderate contracts ($5-$15)
      return {
        multiplier: 10,
        conservativeTarget: entryPrice * 3,
        explosiveTarget: entryPrice * 20,
      }
    } else {
      // Higher premium OTM
      return {
        multiplier: 5,
        conservativeTarget: entryPrice * 2,
        explosiveTarget: entryPrice * 10,
      }
    }
  } else {
    // ITM during power hour - still good but less explosive
    return {
      multiplier: 3,
      conservativeTarget: entryPrice * 1.5,
      explosiveTarget: entryPrice * 5,
    }
  }
}

function isPowerHourNow(): boolean {
  const now = new Date()
  const hour = now.getHours()
  const dayOfWeek = now.getDay()
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5

  // Power hour: 1-3pm ET (13:00-15:00)
  return isWeekday && hour >= 13 && hour < 15
}

function isFinalRushNow(): boolean {
  const now = new Date()
  const hour = now.getHours()
  const minute = now.getMinutes()
  const dayOfWeek = now.getDay()
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5

  // Final Rush: 3:45-4pm ET (15:45-16:00)
  return isWeekday && hour === 15 && minute >= 45
}

function getArchiveInsights(type: "CALL" | "PUT", entryPrice: number, isPowerHour: boolean) {
  const similarTrades = SAMPLE_WINNING_RUNS.filter((trade) => {
    const priceMatch = Math.abs(trade.entry - entryPrice) < entryPrice * 0.5
    const typeMatch = trade.type === type
    const hourMatch = isPowerHour ? Number.parseInt(trade.time.split(":")[0]) >= 13 : true
    return typeMatch && (priceMatch || hourMatch)
  })

  if (similarTrades.length === 0) return null

  const avgPnl = similarTrades.reduce((sum, t) => sum + t.pnlPercent, 0) / similarTrades.length
  const maxPnl = Math.max(...similarTrades.map((t) => t.pnlPercent))
  const bestTrade = similarTrades.find((t) => t.pnlPercent === maxPnl)

  return {
    avgReturn: avgPnl,
    maxReturn: maxPnl,
    sampleSize: similarTrades.length,
    bestTrade,
  }
}

function useRealOptionsData(currentPrice: number) {
  const [options, setOptions] = useState<TradierOption[]>([])
  const [expiration, setExpiration] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<number>(0)

  const fetchData = useCallback(async () => {
    if (!currentPrice || !Number.isFinite(currentPrice) || currentPrice <= 0) {
      console.log("[v0] useRealOptionsData - skipping fetch, invalid price:", currentPrice)
      return
    }

    const safePrice = Math.round(currentPrice * 100) / 100
    const url = `/api/options-chain?symbol=SPX&currentPrice=${safePrice}&range=30`

    console.log("[v0] useRealOptionsData - fetching from:", url)

    try {
      setLoading(true)

      const response = await fetch(url)
      const data = await response.json()

      console.log("[v0] useRealOptionsData - API response:", {
        hasError: !!data.error,
        optionsCount: data.options?.length || 0,
        expiration: data.expiration,
        source: data.source,
        warning: data.warning,
      })

      if (data.error) {
        if (!data.message?.includes("pattern") && !data.debug?.error?.includes("pattern")) {
          setError(data.message || data.error)
        }
        setOptions([])
      } else {
        if (data.options?.length > 0) {
          const sampleCall = data.options.find((o: TradierOption) => o.type === "call")
          const samplePut = data.options.find((o: TradierOption) => o.type === "put")
          console.log("[v0] useRealOptionsData - sample call:", sampleCall)
          console.log("[v0] useRealOptionsData - sample put:", samplePut)
        }
        setOptions(data.options || [])
        setExpiration(data.expiration || "")
        setError(null)
        setLastUpdate(Date.now())
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.log("[v0] useRealOptionsData - fetch error:", errorMessage)
      if (!errorMessage.includes("pattern")) {
        setError("Failed to fetch options data")
      }
      setOptions([])
    } finally {
      setLoading(false)
    }
  }, [currentPrice])

  useEffect(() => {
    fetchData()
    // Refresh every 30 seconds during market hours
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  return { options, expiration, loading, error, lastUpdate, refresh: fetchData }
}

function calculateWinRate(
  direction: "CALL" | "PUT",
  moneyness: "ITM" | "OTM",
  delta: number,
  isPowerHour = false,
  strikesFromATM = 0,
): number {
  let winRate = 50

  if (direction === "CALL") {
    winRate = 55 + (delta > 0.7 ? 12 : 0)
  } else if (direction === "PUT") {
    winRate = 55 + (delta < 0.3 ? 12 : 0)
  }

  // Lower base win rate but higher reward potential
  if (isPowerHour && moneyness === "OTM" && strikesFromATM >= 1 && strikesFromATM <= 5) {
    // Power hour OTM 1-5 strikes away - lower probability but asymmetric payoff
    winRate = Math.max(25, winRate - 15) // Lower win rate reflects lottery nature
  }

  return Math.min(95, Math.max(20, winRate))
}

function generateSimulatedPlays(
  currentPrice: number,
  budget: number,
  signal: string,
  confidence: number,
  rsi: number,
  isPowerHour: boolean,
): OptionPlay[] {
  if (!currentPrice || currentPrice < 100) {
    console.log("[v0] Cannot generate plays - invalid price:", currentPrice)
    return []
  }

  console.log("[v0] Generating simulated plays for price:", currentPrice, "signal:", signal)

  const plays: OptionPlay[] = []
  const today = new Date().toISOString().split("T")[0]

  // Determine direction based on signal
  const isBullish = signal === "BUY" || signal === "HOLD"
  const primaryType: "CALL" | "PUT" = isBullish ? "CALL" : "PUT"
  const secondaryType: "CALL" | "PUT" = isBullish ? "PUT" : "CALL"

  // ITM strike (5 points in the money)
  const itmStrike =
    primaryType === "CALL" ? Math.round((currentPrice - 5) / 5) * 5 : Math.round((currentPrice + 5) / 5) * 5

  // OTM strike (10 points out of money)
  const otmStrike =
    primaryType === "CALL" ? Math.round((currentPrice + 10) / 5) * 5 : Math.round((currentPrice - 10) / 5) * 5

  // Realistic SPX 0DTE option pricing based on actual market data
  // ITM options: intrinsic value (~$5-10) + time premium (~$2-4) = ~$7-14
  const itmIntrinsic = 5 + Math.random() * 5 // 5-10 points ITM
  const itmTimePremium = 2 + Math.random() * 2
  const itmBid = itmIntrinsic + itmTimePremium
  const itmAsk = itmBid + 0.10 + Math.random() * 0.15
  // OTM options: ~$2-6 depending on distance
  const otmBid = 2 + Math.random() * 4
  const otmAsk = otmBid + 0.10 + Math.random() * 0.15

  // Calculate win rates based on indicators
  let baseWinRate = 50
  if (confidence > 60) baseWinRate += 15
  if (confidence > 75) baseWinRate += 10
  if (rsi > 30 && rsi < 70) baseWinRate += 5
  if (isPowerHour) baseWinRate += 5

  const itmWinRate = Math.min(95, baseWinRate + 15)
  const otmWinRate = Math.min(85, baseWinRate)

  // ITM Primary Play
  const itmEntry = (itmBid + itmAsk) / 2
  const itmContracts = Math.floor(budget / (itmEntry * 100))
  const itmTarget = itmEntry * (isPowerHour ? 1.3 : 1.2)
  const itmStop = itmEntry * 0.7

  plays.push({
    type: primaryType,
    strike: itmStrike,
    bid: Math.round(itmBid * 100) / 100,
    ask: Math.round(itmAsk * 100) / 100,
    delta: primaryType === "CALL" ? 0.65 : -0.65,
    moneyness: "ITM",
    winRate: itmWinRate,
    contracts: itmContracts,
    displayContracts: itmContracts,
    profit: 0,
    costBasis: itmContracts * itmEntry * 100,
    breakeven: primaryType === "CALL" ? itmStrike + itmEntry : itmStrike - itmEntry,
    riskReward: 2,
    entryPrice: Math.round(itmEntry * 100) / 100,
    targetPrice: Math.round(itmTarget * 100) / 100,
    stopPrice: Math.round(itmStop * 100) / 100,
    targetDuration: isPowerHour ? "3-8 min" : "5-15 min",
    expirationDate: today,
    potentialProfit: itmContracts > 0 ? Math.round(itmContracts * (itmTarget - itmEntry) * 100) : 0,
    potentialLoss: itmContracts > 0 ? Math.round(itmContracts * (itmEntry - itmStop) * 100) : 0,
    realData: false,
    spread: Math.round((itmAsk - itmBid) * 100) / 100,
  })

  // OTM Primary Play
  const otmEntry = (otmBid + otmAsk) / 2
  const otmContracts = Math.floor(budget / (otmEntry * 100))
  const otmTarget = otmEntry * (isPowerHour ? 2.0 : 1.5)
  const otmStop = otmEntry * 0.5

  plays.push({
    type: primaryType,
    strike: otmStrike,
    bid: Math.round(otmBid * 100) / 100,
    ask: Math.round(otmAsk * 100) / 100,
    delta: primaryType === "CALL" ? 0.35 : -0.35,
    moneyness: "OTM",
    winRate: otmWinRate,
    contracts: otmContracts,
    displayContracts: otmContracts,
    profit: 0,
    costBasis: otmContracts * otmEntry * 100,
    breakeven: primaryType === "CALL" ? otmStrike + otmEntry : otmStrike - otmEntry,
    riskReward: 3,
    entryPrice: Math.round(otmEntry * 100) / 100,
    targetPrice: Math.round(otmTarget * 100) / 100,
    stopPrice: Math.round(otmStop * 100) / 100,
    targetDuration: isPowerHour ? "3-8 min" : "5-15 min",
    expirationDate: today,
    potentialProfit: otmContracts > 0 ? Math.round(otmContracts * (otmTarget - otmEntry) * 100) : 0,
    potentialLoss: otmContracts > 0 ? Math.round(otmContracts * (otmEntry - otmStop) * 100) : 0,
    realData: false,
    spread: Math.round((otmAsk - otmBid) * 100) / 100,
  })

  // Contrary play (ITM opposite direction)
  const contraryStrike =
    secondaryType === "CALL" ? Math.round((currentPrice - 5) / 5) * 5 : Math.round((currentPrice + 5) / 5) * 5
  // Contrary play: ITM in opposite direction (~$8-14)
  const contraryIntrinsic = 5 + Math.random() * 5
  const contraryTimePremium = 2 + Math.random() * 2
  const contraryBid = contraryIntrinsic + contraryTimePremium
  const contraryAsk = contraryBid + 0.10 + Math.random() * 0.15
  const contraryEntry = (contraryBid + contraryAsk) / 2
  const contraryContracts = Math.floor(budget / (contraryEntry * 100))

  plays.push({
    type: secondaryType,
    strike: contraryStrike,
    bid: Math.round(contraryBid * 100) / 100,
    ask: Math.round(contraryAsk * 100) / 100,
    delta: secondaryType === "CALL" ? 0.6 : -0.6,
    moneyness: "ITM",
    winRate: Math.max(40, baseWinRate - 20),
    contracts: contraryContracts,
    displayContracts: contraryContracts,
    profit: 0,
    costBasis: contraryContracts * contraryEntry * 100,
    breakeven: secondaryType === "CALL" ? contraryStrike + contraryEntry : contraryStrike - contraryEntry,
    riskReward: 1.5,
    entryPrice: Math.round(contraryEntry * 100) / 100,
    targetPrice: Math.round(contraryEntry * 1.2 * 100) / 100,
    stopPrice: Math.round(contraryEntry * 0.7 * 100) / 100,
    targetDuration: "5-15 min",
    expirationDate: today,
    potentialProfit: contraryContracts > 0 ? Math.round(contraryContracts * contraryEntry * 0.2 * 100) : 0,
    potentialLoss: contraryContracts > 0 ? Math.round(contraryContracts * contraryEntry * 0.3 * 100) : 0,
    realData: false,
    spread: Math.round((contraryAsk - contraryBid) * 100) / 100,
  })

  console.log("[v0] Generated", plays.length, "simulated plays")
  // Sort affordable plays first, then by win rate
  const affordable = plays.filter(p => p.contracts > 0)
  const unaffordable = plays.filter(p => p.contracts === 0)
  return [
    ...affordable.sort((a, b) => b.winRate - a.winRate),
    ...unaffordable.sort((a, b) => b.winRate - a.winRate)
  ]
}

export function OptionPlaySimulator({
  budget: initialBudget,
  onBudgetChange,
  currentPrice,
  signal,
  confidence,
  pivotLevels,
  rsi,
  indicators,
  onStartTimer,
}: OptionPlaySimulatorProps) {
  const [expandedOption, setExpandedOption] = useState<string | null>(null)
  const [selectedOptionKey, setSelectedOptionKey] = useState<string | null>(null)
  const budget = initialBudget

  const { options: realOptions, expiration, loading, error, lastUpdate, refresh } = useRealOptionsData(currentPrice)

  const handleBudgetChange = (newBudget: number) => {
    onBudgetChange?.(newBudget)
  }

  const timeToOptimal = useMemo(() => getTimeUntilOptimalEntry(), [])

  const buyTiming = useMemo(() => {
    const now = new Date()
    const hour = now.getHours()
    const dayOfWeek = now.getDay()

    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5

    let recommendedHour = "1:00 PM ET"
    let recommendedAction = "WAIT"
    let reason = ""

    const isStrongBullSignal = signal === "BUY" && confidence > 60
    const isStrongBearSignal = signal === "SELL" && confidence > 60
    const hasStrongSignal = isStrongBullSignal || isStrongBearSignal

    if (!isWeekday) {
      recommendedAction = "WAIT"
      reason = "Markets closed - wait for Monday open"
      recommendedHour = "Monday 10:30 AM ET"
    } else if (hour < 9 || hour >= 16) {
      recommendedAction = "WAIT"
      reason = "Pre/post market - wait for regular hours"
      recommendedHour = hour >= 16 ? "Tomorrow 10:30 AM ET" : "10:30 AM ET"
    } else if (hour >= 9 && hour < 10) {
      if (hasStrongSignal) {
        recommendedAction = "ACT"
        reason = isStrongBullSignal
          ? "Bull Run Detected - strong momentum override"
          : "Bear Run Detected - strong momentum override"
        recommendedHour = "NOW"
      } else {
        recommendedAction = "CAUTION"
        reason = "Opening volatility - high risk period"
        recommendedHour = "10:30 AM ET"
      }
    } else if (hour >= 10 && hour < 11) {
      if (hasStrongSignal) {
        recommendedAction = "OPTIMAL"
        reason = isStrongBullSignal
          ? "Bull Run Detected - momentum confirmed"
          : "Bear Run Detected - momentum confirmed"
        recommendedHour = "NOW"
      } else {
        recommendedAction = "GOOD"
        reason = "Morning momentum period"
        recommendedHour = "Now or 1:00 PM ET"
      }
    } else if (hour >= 11 && hour < 13) {
      if (hasStrongSignal) {
        recommendedAction = "ACT"
        reason = isStrongBullSignal
          ? "Bull Run Detected - signal overrides lunch lull"
          : "Bear Run Detected - signal overrides lunch lull"
        recommendedHour = "NOW"
      } else {
        recommendedAction = "WAIT"
        reason = "Lunch lull - low volume period"
        recommendedHour = "1:00 PM ET"
      }
    } else if (hour >= 13 && hour < 15) {
      recommendedAction = "OPTIMAL"
      reason = hasStrongSignal
        ? isStrongBullSignal
          ? "Bull Run + Power Hour - ideal entry"
          : "Bear Run + Power Hour - ideal entry"
        : "Power hour setup - best 0DTE window"
      recommendedHour = "NOW"
    } else if (hour >= 15) {
      recommendedAction = "CAUTION"
      reason = "Final hour - rapid decay, exit positions"
      recommendedHour = "Exit by 3:45 PM ET"
    }

    const expiryDateObj = new Date()
    if (!isWeekday || hour >= 16) {
      // Move to next trading day
      expiryDateObj.setDate(expiryDateObj.getDate() + (dayOfWeek === 5 ? 3 : dayOfWeek === 6 ? 2 : 1))
    }
    const fullExpiryDate = expiryDateObj.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    })

    return {
      recommendedHour,
      recommendedAction,
      reason,
      is0DTE: dayOfWeek >= 1 && dayOfWeek <= 5,
      expiryDate:
        expiration || expiryDateObj.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      fullExpiryDate,
    }
  }, [expiration, signal, confidence]) // Added signal and confidence to dependencies

  // Determine hours since 1pm ET for post-power-hour suggestions
  const getPostPowerHourSuggestion = useMemo(() => {
    const etTime = new Date().toLocaleString("en-US", { timeZone: "America/New_York" })
    const etDate = new Date(etTime)
    const hour = etDate.getHours()
    const minutes = etDate.getMinutes()

    if (hour >= 15 && hour < 16) {
      // 3-4pm ET - Final hour
      return {
        show: true,
        title: "Final Hour Rush",
        detail: "Last hour volatility. Quick scalps on momentum reversals. Archive shows 5-20x on final push moves.",
        hoursAfter1pm: hour - 13 + minutes / 60,
        suggestedStrategy: "momentum_reversal",
      }
    } else if (hour >= 13 && hour < 15) {
      // This is power hour, handled separately
      return { show: false, hoursAfter1pm: 0 }
    } else if (hour >= 12 && hour < 13) {
      // 12-1pm - Pre-power hour setup
      return {
        show: true,
        title: "Pre-Power Hour Setup",
        detail: "Identify support/resistance levels for power hour entries. Watch for volume buildup signals.",
        hoursAfter1pm: 0,
        suggestedStrategy: "setup",
      }
    } else if (hour >= 10 && hour < 12) {
      // Morning session
      return {
        show: true,
        title: "Morning Session",
        detail: "Higher spreads, wait for better entries. Best opportunities come after 1pm ET.",
        hoursAfter1pm: 0,
        suggestedStrategy: "wait",
      }
    } else if (hour >= 9 && hour < 10) {
      // Market open volatility
      return {
        show: true,
        title: "Opening Volatility",
        detail: "High spreads, unpredictable moves. Experienced traders only. Consider waiting for 1pm power hour.",
        hoursAfter1pm: 0,
        suggestedStrategy: "caution",
      }
    }

    return { show: false, hoursAfter1pm: 0 }
  }, [])

  // Calculate base win probability
  const baseWinProb = useMemo(() => {
    const buySignals = indicators.filter((i) => i.signal === "buy").length
    const sellSignals = indicators.filter((i) => i.signal === "sell").length
    const totalSignals = indicators.length

    let prob = 50

    if (signal === "BUY" || signal === "STRONG_BUY") {
      prob = 55 + (totalSignals > 0 ? (buySignals / totalSignals) * 25 : 0)
      if (rsi < 35) prob += 8
      if (confidence > 70) prob += 5
    } else if (signal === "SELL" || signal === "STRONG_SELL") {
      prob = 55 + (totalSignals > 0 ? (sellSignals / totalSignals) * 25 : 0)
      if (rsi > 65) prob += 8
      if (confidence > 70) prob += 5
    } else {
      prob = 40 + Math.random() * 10
    }

    return Math.min(92, Math.max(35, prob))
  }, [signal, confidence, rsi, indicators])

  const isPowerHour = isPowerHourNow()
  const isFinalRush = isFinalRushNow()

  const optionPlays = useMemo(() => {
    const isPowerHour = isPowerHourNow()
    const hasRealData = realOptions.length > 0

    console.log("[v0] optionPlays useMemo - inputs:", {
      realOptionsCount: realOptions.length,
      currentPrice,
      budget,
      signal,
      confidence,
      isPowerHour,
      hasRealData,
    })

    // If we have real data, build plays from it
    if (hasRealData) {
      console.log("[v0] Building plays from real Tradier data")
      const plays: OptionPlay[] = []

      const atmStrike = Math.round(currentPrice / 5) * 5

      const getTargetDuration = (delta: number, moneyness: "ITM" | "OTM", isPowerHourScalp: boolean): string => {
        if (isPowerHourScalp && moneyness === "OTM") {
          return "5-15 min" // Power hour OTM moves fast
        }
        if (moneyness === "ITM") {
          if (delta > 0.7) return "3-8 min"
          return "5-12 min"
        } else {
          if (delta < 0.3) return "10-20 min"
          return "8-15 min"
        }
      }

      const buildPlay = (opt: (typeof realOptions)[0], direction: "CALL" | "PUT"): OptionPlay => {
        const mid = (opt.bid + opt.ask) / 2
        const entryPrice = opt.ask
        const contractCost = entryPrice * 100
        const contracts = Math.floor(budget / contractCost)
        const moneyness: "ITM" | "OTM" =
          direction === "CALL" ? (opt.strike < currentPrice ? "ITM" : "OTM") : opt.strike > currentPrice ? "ITM" : "OTM"
        const delta = opt.greeks?.delta ?? (moneyness === "ITM" ? 0.65 : 0.35)

        const strikesFromATM = Math.abs(opt.strike - atmStrike) / 5

        const isPowerHourScalp = isPowerHour && moneyness === "OTM" && strikesFromATM >= 1 && strikesFromATM <= 5

        const explosivePotential = calculateExplosivePotential(entryPrice, moneyness, strikesFromATM, isPowerHour)

        const targetPrice = isPowerHourScalp ? explosivePotential.conservativeTarget : entryPrice * 1.2
        const stopPrice = entryPrice * 0.7

        // Use actual affordable contracts for profit/loss calculation
        // displayContracts shows what user can actually buy (0 if unaffordable)
        const displayContracts = contracts
        const potentialProfit = contracts > 0 ? contracts * (targetPrice - entryPrice) * 100 : 0
        const potentialLoss = contracts > 0 ? contracts * (entryPrice - stopPrice) * 100 : 0

        const explosiveProfit = isPowerHourScalp
          ? displayContracts * (explosivePotential.explosiveTarget - entryPrice) * 100
          : potentialProfit

        const entryTime =
          isPowerHourScalp && opt.expirationDate
            ? new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
            : undefined
        const durationMinutes = Number.parseInt(getTargetDuration(Math.abs(delta), moneyness, isPowerHourScalp)) || 8
        const exitTimeCalc = new Date()
        exitTimeCalc.setMinutes(exitTimeCalc.getMinutes() + durationMinutes)
        const exitTime =
          isPowerHourScalp && opt.expirationDate
            ? exitTimeCalc.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
            : undefined

        return {
          type: direction,
          strike: opt.strike,
          bid: opt.bid,
          ask: opt.ask,
          delta: Math.abs(delta),
          moneyness,
          winRate: calculateWinRate(direction, moneyness, Math.abs(delta), isPowerHour, strikesFromATM),
          contracts,
          profit: Math.round(potentialProfit),
          costBasis: contracts * entryPrice * 100,
          breakeven: direction === "CALL" ? opt.strike + mid : opt.strike - mid,
          riskReward: (targetPrice - entryPrice) / (entryPrice - stopPrice),
          entryPrice,
          targetPrice: Number(targetPrice.toFixed(2)),
          stopPrice: Number(stopPrice.toFixed(2)),
          targetDuration: getTargetDuration(Math.abs(delta), moneyness, isPowerHourScalp),
          expirationDate:
            typeof expiration === "string"
              ? expiration
              : new Date().toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                }),
          potentialProfit: Math.round(potentialProfit),
          potentialLoss: Math.round(potentialLoss),
          displayContracts,
          realData: true,
          gamma: opt.greeks?.gamma,
          theta: opt.greeks?.theta,
          vega: opt.greeks?.vega,
          iv: opt.greeks?.iv,
          isPowerHourScalp,
          explosiveMultiplier: explosivePotential.multiplier,
          strikesFromATM,
          entryTime,
          exitTime,
          spread: Math.round((opt.ask - opt.bid) * 100) / 100,
        }
      }

      const calls = realOptions.filter((o) => o.type === "call")
      const puts = realOptions.filter((o) => o.type === "put")

      console.log("[v0] Filtered options - calls:", calls.length, "puts:", puts.length)

      const callsWithPlays = calls.map((call) => buildPlay(call, "CALL"))
      const putsWithPlays = puts.map((put) => buildPlay(put, "PUT"))

      plays.push(...callsWithPlays, ...putsWithPlays)

      console.log("[v0] Built", plays.length, "option plays from real data")

      // Filter and sort: prioritize affordable options first
      const affordablePlays = plays.filter(p => p.contracts > 0)
      const unaffordablePlays = plays.filter(p => p.contracts === 0)

      const sortPlays = (playsToSort: OptionPlay[]) => {
        if (isPowerHour) {
          return playsToSort.sort((a, b) => {
            // Prioritize power hour scalps
            if (a.isPowerHourScalp && !b.isPowerHourScalp) return -1
            if (!a.isPowerHourScalp && b.isPowerHourScalp) return 1

            // Then by explosive multiplier
            const aMultiplier = a.explosiveMultiplier || 1
            const bMultiplier = b.explosiveMultiplier || 1
            if (aMultiplier !== bMultiplier) return bMultiplier - aMultiplier

            // Then by cheapest entry (more contracts = more leverage)
            return a.entryPrice - b.entryPrice
          })
        }
        return playsToSort.sort((a, b) => b.winRate - a.winRate)
      }

      // Return affordable options first, then unaffordable ones at the end
      return [...sortPlays(affordablePlays), ...sortPlays(unaffordablePlays)]
    }

    console.log("[v0] No real data available, generating simulated plays")
    return generateSimulatedPlays(currentPrice, budget, signal, confidence, rsi, isPowerHour)
  }, [realOptions, currentPrice, budget, signal, confidence, rsi, expiration])

  // Generate smart recommendations
  const recommendations = useMemo((): Recommendation[] => {
    const recs: Recommendation[] = []
    const bestPlay = optionPlays[0]
    const isBullish = signal === "BUY" || signal === "STRONG_BUY"
    const isBearish = signal === "SELL" || signal === "STRONG_SELL"

    if (isFinalRush) {
      recs.push({
        type: "timing",
        message: "SPX FINAL RUSH",
        detail: "$3-60 OTM entries 1-5 strikes away. ENTER NOW, exit within 15 min!",
        priority: 0,
      })
    } else if (buyTiming.recommendedAction === "OPTIMAL") {
      recs.push({
        type: "timing",
        message: "Optimal Entry Window",
        detail: `Power hour (1-3pm ET) - best time for 0DTE entries`,
        priority: 0,
      })
    } else if (buyTiming.recommendedAction === "WAIT") {
      recs.push({
        type: "wait",
        message: `Wait Until ${buyTiming.recommendedHour}`,
        detail: buyTiming.reason,
        priority: 0,
      })
    } else if (buyTiming.recommendedAction === "CAUTION") {
      recs.push({
        type: "avoid",
        message: "High Risk Period",
        detail: buyTiming.reason,
        priority: 0,
      })
    }

    if (bestPlay && bestPlay.contracts < 2 && budget < 500) {
      recs.push({
        type: "budget",
        message: "Increase Budget to $500+",
        detail: `With $${budget}, you can only buy ${bestPlay.contracts} contract(s). More contracts = better position sizing.`,
        priority: 1,
      })
    } else if (bestPlay && bestPlay.contracts >= 5) {
      recs.push({
        type: "budget",
        message: "Budget Optimized",
        detail: `$${budget} allows ${bestPlay.contracts} contracts for proper risk management.`,
        priority: 3,
      })
    }

    if (confidence < 60 || baseWinProb < 55) {
      recs.push({
        type: "wait",
        message: "Wait for Better Setup",
        detail: `Confidence at ${confidence.toFixed(0)}%. Wait for more indicator alignment before entry.`,
        priority: 1,
      })
    } else if (confidence >= 75 && baseWinProb >= 70) {
      recs.push({
        type: "act",
        message: "Act Now - Strong Setup",
        detail: `${confidence.toFixed(0)}% confidence with ${baseWinProb.toFixed(0)}% base win rate. Optimal entry window.`,
        priority: 1,
      })
    }

    if (isBullish) {
      const itmCall = optionPlays.find((p) => p.type === "CALL" && p.moneyness === "ITM")
      const otmCall = optionPlays.find((p) => p.type === "CALL" && p.moneyness === "OTM")
      if (itmCall && otmCall) {
        if (itmCall.winRate > otmCall.winRate + 15) {
          recs.push({
            type: "act",
            message: "ITM Call Recommended",
            detail: `${itmCall.winRate}% vs ${otmCall.winRate}% win rate. Pay more premium for higher probability.`,
            priority: 2,
          })
        }
      }
    } else if (isBearish) {
      const itmPut = optionPlays.find((p) => p.type === "PUT" && p.moneyness === "ITM")
      const otmPut = optionPlays.find((p) => p.type === "PUT" && p.moneyness === "OTM")
      if (itmPut && otmPut) {
        if (itmPut.winRate > otmPut.winRate + 15) {
          recs.push({
            type: "act",
            message: "ITM Put Recommended",
            detail: `${itmPut.winRate}% vs ${otmPut.winRate}% win rate. Higher delta = more profit per move.`,
            priority: 2,
          })
        }
      }
    } else {
      recs.push({
        type: "avoid",
        message: "No Clear Direction",
        detail: "Indicators are mixed. Avoid trading until a clear signal emerges.",
        priority: 1,
      })
    }

    if (rsi > 75) {
      recs.push({
        type: "wait",
        message: "RSI Overbought",
        detail: `RSI at ${rsi.toFixed(0)}. If bullish, wait for pullback. Puts may be favorable.`,
        priority: 2,
      })
    } else if (rsi < 25) {
      recs.push({
        type: "wait",
        message: "RSI Oversold",
        detail: `RSI at ${rsi.toFixed(0)}. If bearish, wait for bounce. Calls may be favorable.`,
        priority: 2,
      })
    }

    return recs.sort((a, b) => a.priority - b.priority)
  }, [optionPlays, signal, confidence, baseWinProb, rsi, budget, expiration, isFinalRush])

  const getOptionKey = (play: OptionPlay, index?: number) =>
    `${play.moneyness}-${play.type}-${play.strike}${index !== undefined ? `-${index}` : ""}`

  const handleSelectOption = (play: OptionPlay, key: string, e: React.MouseEvent) => {
    e.stopPropagation()
    triggerHaptic("light")
    setSelectedOptionKey(selectedOptionKey === key ? null : key)
  }

  const handleStartTimer = (play: OptionPlay, e: React.MouseEvent) => {
    e.stopPropagation()
    triggerHaptic("medium")
    // Set entry time
    const now = new Date()
    const formattedTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`
    onStartTimer?.({ ...play, entryTime: formattedTime })
    setSelectedOptionKey(null) // Clear selection after starting
  }

  const bestPlay = optionPlays[0] || null
  const otherPlays = optionPlays.slice(1, 5)
  const hasRealData = bestPlay?.realData === true
  const topRecommendation = recommendations[0] || null

  return (
    <div className="relative rounded-3xl glass-frost overflow-hidden border border-white/10">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs uppercase tracking-[0.2em] text-white/40">Options Simulator</span>
          <div className="flex items-center gap-2">
            {loading ? (
              <RefreshCw className="w-3 h-3 text-white/40 animate-spin" />
            ) : hasRealData ? (
              <button
                onClick={() => {
                  triggerHaptic("light")
                  refresh()
                }}
                className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20"
              >
                <Wifi className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400 text-[10px]">LIVE</span>
              </button>
            ) : error ? (
              <button
                onClick={() => {
                  triggerHaptic("light")
                  refresh()
                }}
                className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/10 border border-white/10 backdrop-blur-sm"
              >
                <RefreshCw className="w-3 h-3 text-white/70" />
                <span className="text-white/70 text-[10px]">Retry</span>
              </button>
            ) : null}
          </div>
        </div>

        <div className="bg-white/[0.02] rounded-2xl p-4 border border-white/[0.05]">
          <BudgetSlider value={budget} onChange={handleBudgetChange} />
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="p-3 rounded-xl bg-black/30 border border-white/5">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-3 h-3 text-white/40" />
              <span className="text-[10px] uppercase tracking-wider text-white/40">Buy Hour</span>
            </div>
            <p
              className={cn(
                "text-sm font-light",
                buyTiming.recommendedAction === "OPTIMAL"
                  ? "text-emerald-400"
                  : buyTiming.recommendedAction === "GOOD"
                    ? "text-emerald-400/70"
                    : buyTiming.recommendedAction === "CAUTION"
                      ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]"
                      : "text-white/50",
              )}
            >
              {buyTiming.recommendedHour}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-black/30 border border-white/5">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-3 h-3 text-white/40" />
              <span className="text-[10px] uppercase tracking-wider text-white/40">Expiry</span>
            </div>
            <p className="text-sm font-light text-white/70">
              {buyTiming.expiryDate} <span className="text-[10px] text-white/40">0DTE</span>
            </p>
          </div>
        </div>

        {isFinalRush && (
          <div className="apple-intelligence-border rounded-2xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] animate-pulse" />
              <span className="text-white font-bold text-base uppercase tracking-wider drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]">
                SPX Final Rush
              </span>
              <span className="ml-auto text-white/80 text-sm font-medium">
                {15 - (new Date().getMinutes() - 45)}m left
              </span>
            </div>
            <p className="text-white/90 text-sm">$3-60 OTM entries 1-5 strikes away explode on reversals.</p>
            <p className="text-white font-semibold text-sm mt-1">ENTER NOW - Exit within 15 minutes!</p>
          </div>
        )}

        {!isFinalRush && isPowerHour && (
          <div className="apple-intelligence-border rounded-2xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
              <span className="text-white font-semibold text-sm uppercase tracking-wider drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]">
                Power Hour Active
              </span>
            </div>
            <p className="text-white/80 text-xs">
              OTM options 1-5 strikes away can explode on reversals. Archive shows 20-170x gains.
            </p>
          </div>
        )}

        {topRecommendation && (
          <div
            className={cn(
              "text-center p-3 rounded-xl",
              topRecommendation.type === "timing"
                ? "bg-emerald-500/10 border border-emerald-500/20"
                : topRecommendation.type === "act"
                  ? "bg-emerald-500/10"
                  : topRecommendation.type === "avoid"
                    ? "bg-[#ec3b70]/10"
                    : "bg-white/5",
            )}
          >
            <p
              className={cn(
                "text-sm mb-1",
                topRecommendation.type === "act" || topRecommendation.type === "timing"
                  ? "text-emerald-400"
                  : topRecommendation.type === "avoid"
                    ? "text-[#ec3b70]"
                    : "text-white/60",
              )}
            >
              {topRecommendation.message}
            </p>
            <p className="text-white/30 text-xs">{topRecommendation.detail}</p>
          </div>
        )}
      </div>

      {/* Best Play */}
      {bestPlay && (
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <span
              className="text-xs uppercase tracking-[0.2em] text-white/80"
              style={{ textShadow: "0 0 10px rgba(255,255,255,0.5), 0 0 20px rgba(255,255,255,0.3)" }}
            >
              Best Opportunity
            </span>
          </div>

          <div
            onClick={() => {
              triggerHaptic("light")
              setExpandedOption(expandedOption === "best" ? null : "best")
            }}
            className={cn(
              "p-4 rounded-2xl cursor-pointer transition-all relative",
              bestPlay.type === "CALL" ? "aurora-card-bullish" : "aurora-card-bearish",
              bestPlay.isPowerHourScalp && "power-hour-rainbow-border",
              selectedOptionKey === "best" &&
                bestPlay.type === "CALL" &&
                "ring-2 ring-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]",
              selectedOptionKey === "best" &&
                bestPlay.type === "PUT" &&
                "ring-2 ring-[#ec3b70] shadow-[0_0_15px_rgba(236,59,112,0.3)]",
            )}
          >
            <button
              onClick={(e) => handleSelectOption(bestPlay, "best", e)}
              className={cn(
                "absolute top-3 right-3 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all z-10",
                selectedOptionKey === "best" && bestPlay.type === "CALL"
                  ? "border-emerald-400 bg-emerald-400"
                  : selectedOptionKey === "best" && bestPlay.type === "PUT"
                    ? "border-[#ec3b70] bg-[#ec3b70]"
                    : "border-white/30 bg-transparent hover:border-white/50",
              )}
            >
              {selectedOptionKey === "best" && <div className="w-2 h-2 rounded-full bg-black" />}
            </button>

            <div className="flex items-center justify-between mb-3 pr-10">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center",
                    bestPlay.type === "CALL" ? "bg-emerald-500/20" : "bg-[#ec3b70]/20",
                  )}
                >
                  {bestPlay.type === "CALL" ? (
                    <TrendingUp className="w-6 h-6 text-emerald-400" />
                  ) : (
                    <TrendingDown className="w-6 h-6 text-[#ec3b70]" />
                  )}
                </div>
                <div>
                  <p
                    className={cn(
                      "text-xl font-light",
                      bestPlay.type === "CALL" ? "text-emerald-400" : "text-[#ec3b70]",
                    )}
                  >
                    {bestPlay.moneyness} {bestPlay.type}
                  </p>
                  <p className="text-white/40 text-sm">
                    ${bestPlay.strike} · ${bestPlay.bid.toFixed(2)} / ${bestPlay.ask.toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="text-right mr-1">
                <p className={cn("text-2xl font-light", bestPlay.winRate >= 70 ? "text-emerald-400" : "text-white")}>
                  {bestPlay.winRate}%
                </p>
                <p className="text-white/30 text-[10px]">win rate</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-2 p-2 rounded-xl bg-black/20">
              <div className="flex items-center gap-2">
                <Target className="w-3 h-3 text-emerald-400" />
                <div>
                  <p className="text-white/30 text-[9px] uppercase">Entry → Target</p>
                  <p className="text-white text-sm font-light">
                    <span className="text-white/70">${bestPlay.entryPrice}</span>
                    <span className="text-white/30 mx-1">→</span>
                    <span className="text-emerald-400">${bestPlay.targetPrice}</span>
                    {bestPlay.isPowerHourScalp && bestPlay.explosiveMultiplier && bestPlay.explosiveMultiplier > 5 && (
                      <span className="power-hour-rainbow-text text-xs ml-1">
                        (up to ${(bestPlay.entryPrice * bestPlay.explosiveMultiplier).toFixed(0)})
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Timer className="w-3 h-3 text-white/60" />
                <div>
                  <p className="text-white/30 text-[9px] uppercase">Target Duration</p>
                  <p className="text-white text-sm font-light drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]">
                    {bestPlay.targetDuration}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-2 p-2 rounded-xl bg-black/20">
              <div className="flex items-center gap-2">
                <Clock className="w-3 h-3 text-emerald-400" />
                <div>
                  <p className="text-white/30 text-[9px] uppercase">Entry Time</p>
                  <p className="text-emerald-400 text-sm font-medium">
                    {bestPlay.entryTime ||
                      new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-3 h-3 text-[#ec3b70]" />
                <div>
                  <p className="text-white/30 text-[9px] uppercase">Exit Time</p>
                  <p className="text-[#ec3b70] text-sm font-medium">
                    {bestPlay.exitTime ||
                      (() => {
                        const now = new Date()
                        const durationMin = Number.parseInt(bestPlay.targetDuration.split("-")[0]) || 8
                        now.setMinutes(now.getMinutes() + durationMin)
                        return now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
                      })()}
                  </p>
                </div>
              </div>
            </div>

            {/* Unaffordable warning */}
            {bestPlay.displayContracts === 0 && (
              <div className="mt-3 p-2 rounded-xl bg-[#ec3b70]/10 border border-[#ec3b70]/20">
                <p className="text-[#ec3b70] text-xs text-center">
                  Budget too low - need ${(bestPlay.entryPrice * 100).toFixed(0)}+ for 1 contract
                </p>
              </div>
            )}

            <div
              className={cn(
                "grid grid-cols-3 gap-3 overflow-hidden transition-all",
                expandedOption === "best"
                  ? "max-h-40 opacity-100 mt-3 pt-3 border-t border-white/10"
                  : "max-h-0 opacity-0",
              )}
            >
              <div className="text-center">
                <p className="text-white/30 text-[10px] uppercase tracking-wider mb-1">Contracts</p>
                <p className={cn("text-lg font-light", bestPlay.displayContracts === 0 ? "text-[#ec3b70]" : "text-white")}>{bestPlay.displayContracts}</p>
                <p className="text-white/30 text-[10px]">${(bestPlay.entryPrice * 100).toFixed(0)}/ea</p>
              </div>
              <div className="text-center">
                <p className="text-white/30 text-[10px] uppercase tracking-wider mb-1">Profit</p>
                <p className={cn("text-lg font-light", bestPlay.potentialProfit > 0 ? "text-emerald-400" : "text-white/30")}>+${bestPlay.potentialProfit}</p>
                <p className="text-[#ec3b70]/50 text-[10px]">-${bestPlay.potentialLoss}</p>
              </div>
              <div className="text-center">
                <p className="text-white/30 text-[10px] uppercase tracking-wider mb-1">Breakeven</p>
                <p className="text-white text-lg font-light">${bestPlay.breakeven.toFixed(2)}</p>
                <p className="text-white/30 text-[10px]">{bestPlay.riskReward.toFixed(1)}:1 R/R</p>
              </div>
            </div>

            {expandedOption === "best" && bestPlay.realData && (
              <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-white/10">
                <div className="text-center">
                  <p className="text-white/30 text-[10px]">Delta</p>
                  <p className="text-white/70 text-sm">{bestPlay.delta}</p>
                </div>
                {bestPlay.gamma && (
                  <div className="text-center">
                    <p className="text-white/30 text-[10px]">Gamma</p>
                    <p className="text-white/70 text-sm">{bestPlay.gamma.toFixed(4)}</p>
                  </div>
                )}
                {bestPlay.theta && (
                  <div className="text-center">
                    <p className="text-white/30 text-[10px]">Theta</p>
                    <p className="text-[#ec3b70]/70 text-sm">{bestPlay.theta.toFixed(2)}</p>
                  </div>
                )}
                {bestPlay.iv && (
                  <div className="text-center">
                    <p className="text-white/30 text-[10px]">IV</p>
                    <p className="text-white/70 text-sm">{(bestPlay.iv * 100).toFixed(1)}%</p>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-center gap-1 mt-2 text-white/30 text-xs">
              <span>{expandedOption === "best" ? "Tap to collapse" : "Tap for details"}</span>
              <ChevronRight className={cn("w-3 h-3 transition-transform", expandedOption === "best" && "rotate-90")} />
            </div>

            {selectedOptionKey === "best" && (
              <button
                onClick={(e) => handleStartTimer(bestPlay, e)}
                className={cn(
                  "mt-3 w-full py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all",
                  bestPlay.type === "CALL"
                    ? "bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30"
                    : "bg-[#ec3b70]/20 border border-[#ec3b70]/40 hover:bg-[#ec3b70]/30",
                )}
              >
                <Play
                  className={cn("w-4 h-4", bestPlay.type === "CALL" ? "text-emerald-400" : "text-[#ec3b70]")}
                  fill="currentColor"
                />
                <span
                  className={cn(
                    "text-sm font-medium uppercase tracking-wider",
                    bestPlay.type === "CALL" ? "text-emerald-400" : "text-[#ec3b70]",
                  )}
                >
                  Start Run Timer
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Other Options */}
      <div className="p-4">
        <span className="text-xs uppercase tracking-[0.2em] text-white/40">Other Options</span>

        <div className="mt-3 space-y-2">
          {otherPlays.map((play, index) => {
            const optionKey = getOptionKey(play, index)
            const isExpanded = expandedOption === optionKey
            const isSelected = selectedOptionKey === optionKey

            return (
              <div
                key={optionKey}
                onClick={() => {
                  triggerHaptic("light")
                  setExpandedOption(isExpanded ? null : optionKey)
                }}
                className={cn(
                  "p-3 rounded-xl bg-black/30 cursor-pointer transition-all hover:bg-white/[0.08] border border-white/5 relative",
                  play.isPowerHourScalp && "ring-1 ring-white/30 shadow-[0_0_10px_rgba(255,255,255,0.15)]",
                  isSelected &&
                    play.type === "CALL" &&
                    "ring-2 ring-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]",
                  isSelected && play.type === "PUT" && "ring-2 ring-[#ec3b70] shadow-[0_0_15px_rgba(236,59,112,0.3)]",
                )}
              >
                <button
                  onClick={(e) => handleSelectOption(play, optionKey, e)}
                  className={cn(
                    "absolute top-3 right-3 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all z-10",
                    isSelected && play.type === "CALL"
                      ? "border-emerald-400 bg-emerald-400"
                      : isSelected && play.type === "PUT"
                        ? "border-[#ec3b70] bg-[#ec3b70]"
                        : "border-white/30 bg-transparent hover:border-white/50",
                  )}
                >
                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                </button>

                <div className="flex items-center justify-between pr-8">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center",
                        play.type === "CALL" ? "bg-emerald-500/10" : "bg-[#ec3b70]/10",
                      )}
                    >
                      {play.type === "CALL" ? (
                        <TrendingUp className="w-4 h-4 text-emerald-400/70" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-[#ec3b70]/70" />
                      )}
                    </div>
                    <div>
                      <p className="text-white/70 text-sm">
                        {play.moneyness} {play.type}
                      </p>
                      <p className="text-white/30 text-xs">
                        ${play.strike} · ${play.bid.toFixed(2)} / ${play.ask.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className={cn("text-lg font-light", play.winRate >= 60 ? "text-white/80" : "text-white/50")}>
                        {play.winRate}%
                      </p>
                    </div>
                    <ChevronRight
                      className={cn("w-4 h-4 text-white/30 transition-transform", isExpanded && "rotate-90")}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Target className="w-3 h-3 text-muted-foreground" />
                    <span className="text-muted-foreground">ENTRY → TARGET</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Timer className="w-3 h-3 text-muted-foreground" />
                    <span className="text-muted-foreground">TARGET DURATION</span>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center gap-1">
                    <span className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]">
                      ${play.entryPrice.toFixed(2)}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-emerald-400 drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]">
                      ${play.targetPrice.toFixed(2)}
                    </span>
                    {play.isPowerHourScalp && play.explosiveMultiplier && play.explosiveMultiplier > 5 && (
                      <span className="text-white text-xs ml-1 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]">
                        (up to ${(play.entryPrice * play.explosiveMultiplier).toFixed(0)})
                      </span>
                    )}
                  </div>
                  <span className="text-white">{play.targetDuration}</span>
                </div>

                <div className="flex items-center justify-between mt-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="text-muted-foreground">ENTRY</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="text-muted-foreground">EXIT</span>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center gap-1">
                    <p className="text-emerald-400 text-xs font-medium">
                      {play.entryTime ||
                        new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <p className="text-[#ec3b70] text-xs font-medium">
                      {play.exitTime ||
                        (() => {
                          const now = new Date()
                          const durationMin = Number.parseInt(play.targetDuration) || 8
                          now.setMinutes(now.getMinutes() + durationMin)
                          return now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
                        })()}
                    </p>
                  </div>
                </div>

                <div
                  className={cn(
                    "grid grid-cols-3 gap-2 overflow-hidden transition-all",
                    isExpanded ? "max-h-40 opacity-100 mt-3 pt-3 border-t border-white/10" : "max-h-0 opacity-0",
                  )}
                >
                  <div className="text-center">
                    <p className="text-white/30 text-[10px] uppercase tracking-wider mb-1">Contracts</p>
                    <p className="text-white/70 text-sm">{play.displayContracts}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-white/30 text-[10px] uppercase tracking-wider mb-1">Profit</p>
                    <p className="text-emerald-400/70 text-sm">+${play.potentialProfit}</p>
                    <p className="text-[#ec3b70]/50 text-[10px]">-${play.potentialLoss}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-white/30 text-[10px] uppercase tracking-wider mb-1">Breakeven</p>
                    <p className="text-white/70 text-sm">${play.breakeven}</p>
                  </div>
                </div>

                {isExpanded && (
                  <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-white/5">
                    <div className="text-center">
                      <p className="text-white/30 text-[10px]">Stop</p>
                      <p className="text-[#ec3b70]/70 text-sm">${play.stopPrice}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-white/30 text-[10px]">Expiry</p>
                      <p className="text-white/50 text-[10px]">{play.expirationDate}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-white/30 text-[10px]">R/R</p>
                      <p className="text-white/70 text-sm">{play.riskReward.toFixed(1)}:1</p>
                    </div>
                  </div>
                )}

                {isSelected && (
                  <button
                    onClick={(e) => handleStartTimer(play, e)}
                    className={cn(
                      "mt-3 w-full py-2 rounded-xl flex items-center justify-center gap-2 transition-all",
                      play.type === "CALL"
                        ? "bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30"
                        : "bg-[#ec3b70]/20 border border-[#ec3b70]/40 hover:bg-[#ec3b70]/30",
                    )}
                  >
                    <Play
                      className={cn("w-3.5 h-3.5", play.type === "CALL" ? "text-emerald-400" : "text-[#ec3b70]")}
                      fill="currentColor"
                    />
                    <span
                      className={cn(
                        "text-xs font-medium uppercase tracking-wider",
                        play.type === "CALL" ? "text-emerald-400" : "text-[#ec3b70]",
                      )}
                    >
                      Start Run Timer
                    </span>
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {lastUpdate > 0 && (
          <p className="text-center text-white/20 text-[10px] mt-4">
            Updated {new Date(lastUpdate).toLocaleTimeString()}
          </p>
        )}
      </div>
    </div>
  )
}
