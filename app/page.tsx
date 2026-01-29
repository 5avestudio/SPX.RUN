"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { motion } from "framer-motion" // New import for motion
import { AuroraBackground } from "@/components/aurora-background" // New import
import { AuroraSignalChart } from "@/components/aurora-signal-chart" // New import
import { Navbar } from "@/components/navbar"
import { type OHLCData, generateMockSPXData, fetchCandles, fetchQuote } from "@/lib/market-data"
import {
  calculateRSI,
  calculateADX,
  calculateEWO,
  calculateMACD,
  getRelativeVolumeForChart,
  getBollingerBands,
  getPivotPoints,
  calculateATR,
  detectRunAlert,
  getVisualMonitoringData,
  type RunAlert,
  type VisualMonitoringData,
  calculateSuperTrend,
  generateTradingSignal,
  calculateGoldenCross,
  detectTrendReversal,
} from "@/lib/indicators"
import { OptionPlaySimulator, type OptionPlay } from "@/components/option-play-simulator"
import { UnifiedSignalTimer } from "@/components/unified-signal-timer"
import { SignalCheckCombined } from "@/components/signal-check-combined"
import { BottomNav } from "@/components/bottom-nav"
import { PowerHourPanel } from "@/components/power-hour-panel" // Added import
import { FloatingStatusBar } from "@/components/floating-status-bar"
import type { TimeframeKey } from "@/components/timeframe-widget"
import { FadeSection } from "@/components/fade-section"
import { ChevronRight } from "@/components/icons"
import { ChartsSection } from "@/components/charts-section"
import { SplashScreen } from "@/components/splash-screen" // New import
import { SettingsPanel } from "@/components/settings-panel" // New import
import { RunAlertWidget } from "@/components/run-alert-widget"
import { ReversalAlertModal } from "@/components/reversal-alert-modal" // New import
import { OptionsMonitorPanel } from "@/components/options-monitor-panel" // Added import for options monitor panel
import { VerticalCombinedChart } from "@/components/vertical-combined-chart" // Added import for vertical combined chart
import type { AlertItem } from "@/types/alert" // Declare AlertItem type
import { generateMockData } from "@/lib/market-data" // New import for generateMockData
import {
  generateScalpAlert,
  type DirectorResult,
  type TrapModeResult,
  type AlertCooldownState,
  type ScalpAlert,
  SCALP_CONFIG,
} from "@/lib/scalp-signal-engine"

export default function Home() {
  const [marketData, setMarketData] = useState<OHLCData[]>([])
  const [currentPrice, setCurrentPrice] = useState(0)
  const [priceChange, setPriceChange] = useState(0)
  const [priceChangePercent, setPriceChangePercent] = useState(0)
  const [selectedTicker, setSelectedTicker] = useState("SPX")
  const [lastPriceUpdate, setLastPriceUpdate] = useState<number>(Date.now())
  const lastPriceRef = useRef<number>(0)
  const stalePriceCountRef = useRef<number>(0)
  const [isLive, setIsLive] = useState(true)
  const [isConnected, setIsConnected] = useState(false)
  const [dataSource, setDataSource] = useState<"tradier" | "mock">("mock")
  const [timeToOptimal, setTimeToOptimal] = useState({ hours: 0, minutes: 0, isOptimalTime: false })
  const [activeTab, setActiveTab] = useState<"market" | "analysis" | "timer" | "profile">("market")
  const [showSettings, setShowSettings] = useState(false) // New state
  const [showPowerHourPanel, setShowPowerHourPanel] = useState(false)
  const [showOptionsMonitor, setShowOptionsMonitor] = useState(false)
  const [tradeBudget, setTradeBudget] = useState(200)
  const [chartTimeframe, setChartTimeframe] = useState("1")
  const [showChartOverlays, setShowChartOverlays] = useState(false) // Enables constellation chart + pivot panel
  const [selectedOption, setSelectedOption] = useState<OptionPlay | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [chartSentiment, setChartSentiment] = useState<"Bullish" | "Bearish" | "Neutral">("Neutral") // New state
  const previousPivotAlert = useRef<string | null>(null)
  const prevRunAlertIdRef = useRef<string | null>(null)
  const prevMonitoringRef = useRef<{ superTrend: string | null; vwap: string | null; atr: number }>({
    superTrend: null,
    vwap: null,
    atr: 0,
  })
  const [showSplash, setShowSplash] = useState(true)
  const [showReversalAlert, setShowReversalAlert] = useState(false) // New state
  const [selectedHistoryAlert, setSelectedHistoryAlert] = useState<RunAlert | null>(null) // Added state

  const [timeframeSentiments, setTimeframeSentiments] = useState<Record<TimeframeKey, string>>({
    "1m": "HOLD",
    "5m": "HOLD",
    "15m": "HOLD",
  })

  const marketData5mRef = useRef<OHLCData[]>([])
  const marketData15mRef = useRef<OHLCData[]>([])
  const marketData2mRef = useRef<OHLCData[]>([])

  // Scalp signal engine state refs
  const scalpDirectorRef = useRef<DirectorResult | undefined>(undefined)
  const scalpTrapRef = useRef<TrapModeResult | undefined>(undefined)
  const scalpCooldownRef = useRef<AlertCooldownState>({
    lastAlertDirection: null,
    lastAlertTimestamp: 0,
    vwapRetestSinceLastAlert: false,
    sameDirectionBlocked: false,
  })
  const scalpCandleIndexRef = useRef(0)

  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [runAlert, setRunAlert] = useState<RunAlert | null>(null)
  const [visualMonitoringData, setVisualMonitoringData] = useState<VisualMonitoringData | null>(null)

  const [powerHourData, setPowerHourData] = useState({
    vwapPosition: 0,
    vwap: 0,
    rvol: 1,
    atrSlope: 0,
  })

  const dataPointsLoaded = marketData?.length || 0

  const handlePowerHourToggle = useCallback(() => {
    setShowPowerHourPanel((prev) => !prev)
    setShowOptionsMonitor((prev) => !prev)
  }, [])

  const handlePowerHourPanelToggle = useCallback(() => {
    setShowPowerHourPanel((prev) => !prev)
  }, [])

  const handleOptionsMonitorToggle = useCallback(() => {
    setShowOptionsMonitor((prev) => !prev)
  }, [])

  const loadMarketData = useCallback(async () => {
    const candles = await fetchCandles(chartTimeframe, selectedTicker)

    if (candles.length > 0) {
      setMarketData(candles)
      const latestPrice = candles[candles.length - 1].close
      const dayOpen = candles[0].open // First candle's open is the day's open
      setCurrentPrice(latestPrice)
      setPriceChange(latestPrice - dayOpen)
      setPriceChangePercent(((latestPrice - dayOpen) / dayOpen) * 100)
      setDataSource("tradier")
      setIsConnected(true)
    } else {
      const mockData = generateMockSPXData()
      setMarketData(mockData)
      const latestPrice = mockData[mockData.length - 1].close
      const dayOpen = mockData[0].open
      setCurrentPrice(latestPrice)
      setPriceChange(latestPrice - dayOpen)
      setPriceChangePercent(((latestPrice - dayOpen) / dayOpen) * 100)
      setDataSource("mock")
      setIsConnected(false)
    }

    const candles2m = await fetchCandles("2", selectedTicker)
    const candles5m = await fetchCandles("5", selectedTicker)
    const candles15m = await fetchCandles("15", selectedTicker)

    if (candles2m.length > 0) {
      marketData2mRef.current = candles2m
    } else {
      // Generate mock 2m data by aggregating mock 1m data
      marketData2mRef.current = generateMockSPXData()
    }

    if (candles5m.length > 0) {
      marketData5mRef.current = candles5m
    } else {
      marketData5mRef.current = generateMockSPXData()
    }

    if (candles15m.length > 0) {
      marketData15mRef.current = candles15m
    } else {
      marketData15mRef.current = generateMockSPXData()
    }
  }, [chartTimeframe, selectedTicker])

  useEffect(() => {
    loadMarketData()
  }, [loadMarketData])

  useEffect(() => {
    const updateTime = () => {
      setTimeToOptimal({ hours: 0, minutes: 0, isOptimalTime: false }) // Placeholder for actual logic
    }
    updateTime()
    const interval = setInterval(updateTime, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!isLive) return

    // FAST: Real-time price updates every 2 seconds using quotes (reduced from 1s to avoid rate limits)
    const priceInterval = setInterval(async () => {
      if (dataSource === "tradier") {
        try {
          const quote = await fetchQuote(selectedTicker)

          if (quote) {
            if (Math.abs(quote.c - lastPriceRef.current) < 0.01) {
              stalePriceCountRef.current += 1
              if (stalePriceCountRef.current >= 3) {
                const delaySeconds = Math.floor((Date.now() - lastPriceUpdate) / 1000)
                console.warn(
                  `[v0] ⚠️ STALE DATA: Price ${quote.c} unchanged for ${delaySeconds}s (${stalePriceCountRef.current} consecutive fetches)`,
                )
              }
            } else {
              // Price changed - data is fresh
              stalePriceCountRef.current = 0
              setLastPriceUpdate(Date.now())
              console.log(`[v0] ✅ FRESH DATA: Price update ${lastPriceRef.current} → ${quote.c}`)
            }

            lastPriceRef.current = quote.c

            // Update price immediately from quote
            setCurrentPrice(quote.c)

            // Use Tradier's daily change values (accurate)
            setPriceChange(quote.d)
            setPriceChangePercent(quote.dp)

            console.log("[v0] Price update:", quote.c, "change:", quote.d)
          }
        } catch (error) {
          console.error("[v0] Failed to fetch quote:", error)
        }
      }
    }, 2000) // Changed from 3000ms to 2000ms (2 seconds) to reduce API rate limit issues

    // SLOW: Indicator updates every 15 seconds using candles (reduced from 30s for better responsiveness)
    const candleInterval = setInterval(async () => {
      if (dataSource === "tradier") {
        try {
          const freshCandles = await fetchCandles(chartTimeframe, selectedTicker)

          if (freshCandles && freshCandles.length > 0) {
            setMarketData(freshCandles)
            console.log("[v0] Indicators refreshed with", freshCandles.length, "candles")
          }
        } catch (error) {
          console.error("[v0] Failed to fetch candles for indicators:", error)
        }
      } else {
        // Mock data path - use selected ticker
        const lastData = marketData[marketData.length - 1]
        const mockData = generateMockData(selectedTicker)
        const newData = mockData[mockData.length - 1]

        setMarketData((prev) => {
          const updated = [...prev, newData]
          if (updated.length > 200) return updated.slice(-200)
          return updated
        })

        setCurrentPrice(newData.close)
        setPriceChange(newData.close - lastData.close)
        setPriceChangePercent(((newData.close - lastData.close) / lastData.close) * 100)
      }
    }, 15000) // Changed from 30000ms to 15000ms (15 seconds) for faster indicator updates

    return () => {
      clearInterval(priceInterval)
      clearInterval(candleInterval)
    }
  }, [isLive, dataSource, chartTimeframe, selectedTicker])

  useEffect(() => {
    if (marketData.length >= 50) {
      // NEW: Use scalp signal engine with Director/Validator/Trigger architecture
      const data1m = marketData
      const data2m = marketData2mRef.current
      const data5m = marketData5mRef.current

      if (data1m.length >= 30 && data2m.length >= 20 && data5m.length >= 52) {
        scalpCandleIndexRef.current += 1

        const scalpResult = generateScalpAlert(
          data1m,
          data2m,
          data5m,
          scalpDirectorRef.current,
          scalpTrapRef.current,
          scalpCooldownRef.current,
          scalpCandleIndexRef.current
        )

        // Update refs
        scalpDirectorRef.current = scalpResult.director
        scalpTrapRef.current = scalpResult.trap
        scalpCooldownRef.current = scalpResult.updatedCooldown

        // If we have a new scalp alert, convert it to RunAlert format
        if (scalpResult.alert) {
          const scalpAlert = scalpResult.alert
          const newAlertId = scalpAlert.id

          if (newAlertId !== prevRunAlertIdRef.current) {
            prevRunAlertIdRef.current = newAlertId

            // Convert ScalpAlert to RunAlert format for compatibility
            const runAlertFromScalp: RunAlert = {
              id: scalpAlert.id,
              type: scalpAlert.type as RunAlert["type"],
              confidence: scalpAlert.confidence >= 72 ? "HIGH" : scalpAlert.confidence >= 50 ? "MEDIUM" : "LOW",
              timestamp: scalpAlert.timestamp,
              indicators: [
                { name: "Director", value: scalpAlert.director, weight: 30, contributing: true },
                { name: "Validator", value: scalpAlert.validator, weight: 20, contributing: scalpAlert.validator !== "NEUTRAL" },
                { name: "Confidence", value: `${scalpAlert.confidence}%`, weight: 0, contributing: scalpAlert.shouldPush },
              ],
              conditions: {
                priceSlope: 0,
                vwapPosition: scalpAlert.triggerReason.includes("VWAP hold") ? "ABOVE_VWAP" : "BELOW_VWAP",
                volumeSpike: scalpAlert.triggerReason.includes("RVOL"),
                atrExpanding: true,
              },
              muted: false,
              notes: [scalpAlert.triggerReason],
              entryPrice: scalpAlert.entryPrice,
              targetPrice: scalpAlert.targetPrice,
              stopLoss: scalpAlert.stopLoss,
              expectedGain: `+$${Math.abs(scalpAlert.targetPrice - scalpAlert.entryPrice).toFixed(2)}`,
              expectedHoldTime: scalpAlert.holdTime,
              superTrendConfirmed: true,
              trendStrength: scalpAlert.confidence >= 72 ? "STRONG" : "MODERATE",
              // New scalp alert fields
              explanation: scalpAlert.explanation,
              director: scalpAlert.director,
              validator: scalpAlert.validator,
            }

            setRunAlert(runAlertFromScalp)
          }
        }
      } else {
        // Fallback to legacy detection if we don't have all timeframes
        const detectedAlert = detectRunAlert(marketData, undefined, currentPrice)

        const newAlertId = detectedAlert?.id ?? null
        if (newAlertId !== prevRunAlertIdRef.current) {
          prevRunAlertIdRef.current = newAlertId
          if (detectedAlert && !detectedAlert.muted) {
            setRunAlert(detectedAlert)
          }
        }
      }

      const monitoringData = getVisualMonitoringData(marketData)
      const newSuperTrend = monitoringData.superTrend?.signal ?? null
      const newVwap = monitoringData.vwap?.pricePosition ?? null
      const newAtr = Math.round(monitoringData.atr?.expansionRate ?? 0)

      if (
        prevMonitoringRef.current.superTrend !== newSuperTrend ||
        prevMonitoringRef.current.vwap !== newVwap ||
        prevMonitoringRef.current.atr !== newAtr
      ) {
        prevMonitoringRef.current = { superTrend: newSuperTrend, vwap: newVwap, atr: newAtr }
        setVisualMonitoringData(monitoringData)
      }
    }
  }, [marketData])

  const handleRunAlertDismiss = useCallback(() => {
    if (runAlert) {
      handleSaveRunAlertToHistory(runAlert)
    }
    setRunAlert(null)
  }, [])

  const handleSaveRunAlertToHistory = useCallback((alert: RunAlert) => {
    // Determine alert title based on type
    const getAlertTitle = () => {
      switch (alert.type) {
        case "SQUEEZE_LONG":
          return "SQUEEZE LONG (5-15m)"
        case "SQUEEZE_SHORT":
          return "SQUEEZE SHORT (5-15m)"
        case "TRAP_FADE_LONG":
          return "LIQUIDITY TRAP FADE (LONG)"
        case "TRAP_FADE_SHORT":
          return "LIQUIDITY TRAP FADE (SHORT)"
        case "UPWARD_RUN":
          return "Upward Run Confirmed"
        case "DOWNWARD_RUN":
          return "Downward Run Confirmed"
        default:
          return "Alert"
      }
    }

    // Determine if bullish or bearish
    const isBullish = alert.type === "UPWARD_RUN" || alert.type === "SQUEEZE_LONG" || alert.type === "TRAP_FADE_LONG"

    const newAlert: AlertItem = {
      id: `run-${alert.id}-${Date.now()}`,
      type: isBullish ? "opportunity" : "danger",
      severity: alert.confidence === "HIGH" ? "high" : alert.confidence === "MEDIUM" ? "medium" : "low",
      title: getAlertTitle(),
      message: `Entry: $${alert.entryPrice?.toFixed(2)} | Target: $${alert.targetPrice?.toFixed(2)} | Stop: $${alert.stopLoss?.toFixed(2)}`,
      subtitle: `${alert.confidence} confidence • ${alert.trendStrength?.replace("_", " ")}`,
      timestamp: new Date(),
      fullAlert: alert,
      // Add explanation for scalp alerts
      explanation: alert.explanation,
    }
    setAlerts((prev) => [newAlert, ...prev].slice(0, 50))
  }, [])

  const handleReversalDismiss = useCallback((warning: any) => {
    if (!warning?.hasWarning) return

    const newAlert: AlertItem = {
      id: `${warning.type}-${Date.now()}`,
      type: warning.type as "BULLISH_REVERSAL" | "BEARISH_REVERSAL",
      severity: warning.severity,
      title: warning.type === "BULLISH_REVERSAL" ? "Bullish Reversal" : "Bearish Reversal",
      message: `${warning.confidence}% confidence reversal detected`,
      signals: warning.signals,
      timestamp: new Date(),
    }

    setAlerts((prev) => [newAlert, ...prev].slice(0, 50))
  }, [])

  const handleClearAllAlerts = useCallback(() => {
    setAlerts([])
  }, [])

  const handleDismissAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const handleAlertTap = useCallback((alertItem: AlertItem) => {
    if (alertItem.fullAlert) {
      setSelectedHistoryAlert(alertItem.fullAlert)
    }
  }, [])

  const handleSelectedHistoryAlertDismiss = useCallback(() => {
    setSelectedHistoryAlert(null)
  }, [])

  const handleTabChange = (tab: string) => {
    if (tab === "profile") {
      setShowSettings(true)
    } else {
      setShowSettings(false)
    }
    setActiveTab(tab as typeof activeTab)
  }

  const handleStartTimerWithOption = useCallback((option: OptionPlay) => {
    setSelectedOption(option)
    setIsRunning(true)
    // Placeholder for haptic feedback logic

    // Scroll to top of page (market section)
    const marketSection = document.getElementById("market")
    if (marketSection) {
      marketSection.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [])

  const handleClearSelectedOption = useCallback(() => {
    setSelectedOption(null)
  }, [])

  const handleTimerEnd = useCallback(() => {
    setIsRunning(false)
  }, [])

  const ttmSqueeze = useMemo(() => {
    if (marketData.length < 20) return undefined
    // Import is already at top via indicators
    const bb = getBollingerBands(marketData, 20, 2)

    // Simple squeeze detection
    const squeeze: boolean[] = []
    const momentum: number[] = []

    for (let i = 0; i < bb.upper.length; i++) {
      const bbWidth = bb.upper[i] - bb.lower[i]
      const avgWidth = ((bb.upper[i] + bb.lower[i]) / 2) * 0.04 // 4% as KC proxy
      squeeze.push(bbWidth < avgWidth)

      const midline = (bb.upper[i] + bb.lower[i]) / 2
      const dataIdx = marketData.length - bb.upper.length + i
      momentum.push((marketData[dataIdx]?.close || 0) - midline)
    }

    return {
      squeeze,
      momentum,
      squeezeOn: squeeze[squeeze.length - 1] || false,
    }
  }, [marketData])

  useEffect(() => {
    const superTrend = calculateSuperTrend(marketData, 10, 3)
    const stSignal = superTrend.signal[superTrend.signal.length - 1]

    const st1m: "BUY" | "SELL" | "HOLD" = stSignal
    let st5m: "BUY" | "SELL" | "HOLD" = "HOLD"
    let st15m: "BUY" | "SELL" | "HOLD" = "HOLD"

    if (marketData5mRef.current.length > 0) {
      const superTrend5m = calculateSuperTrend(marketData5mRef.current, 10, 3)
      st5m = superTrend5m.signal[superTrend5m.signal.length - 1]
    }

    if (marketData15mRef.current.length > 0) {
      const superTrend15m = calculateSuperTrend(marketData15mRef.current, 10, 3)
      st15m = superTrend15m.signal[superTrend15m.signal.length - 1]
    }

    setTimeframeSentiments({
      "1m": st1m,
      "5m": st5m,
      "15m": st15m,
    })
  }, [marketData])

  const rsi = calculateRSI(marketData, 14)
  const currentRSI = rsi[rsi.length - 1] || 50
  const adx = calculateADX(marketData, 14)
  const currentADX = adx[adx.length - 1] || 0
  const ewo = calculateEWO(marketData, 5, 35)
  const currentEWO = ewo.ewo[ewo.ewo.length - 1] || 0
  const ewoSignal = ewo.signal[ewo.signal.length - 1]
  const bb = getBollingerBands(marketData, 20, 2)
  const lastBBIdx = bb.upper.length - 1
  const pivots =
    marketData.length > 0
      ? getPivotPoints(marketData[marketData.length - 1])
      : {
          pivot: currentPrice,
          r1: currentPrice * 1.01,
          r2: currentPrice * 1.02,
          r3: currentPrice * 1.03,
          s1: currentPrice * 0.99,
          s2: currentPrice * 0.98,
          s3: currentPrice * 0.97,
        }
  const tradingSignal = generateTradingSignal(marketData, currentPrice)

  const volumeAnalysis = getRelativeVolumeForChart(marketData, 20)
  const goldenCross = calculateGoldenCross(marketData, 50, 200)
  const currentGoldenCross = goldenCross.signal[goldenCross.signal.length - 1] || "NONE"

  const macd = calculateMACD(marketData, 12, 26, 9)
  const atr = calculateATR(marketData, 14)

  const reversalWarning = detectTrendReversal(marketData, rsi, macd.histogram, adx, currentPrice, {
    pivot: pivots.pivot,
    r1: pivots.r1,
    r2: pivots.r2,
    r3: pivots.r3 || pivots.r2 * 1.01,
    s1: pivots.s1,
    s2: pivots.s2,
  })

  const bbTrend: "up" | "down" | "neutral" =
    tradingSignal.signal === "BUY" || tradingSignal.signal === "STRONG_BUY"
      ? "up"
      : tradingSignal.signal === "SELL" || tradingSignal.signal === "STRONG_SELL"
        ? "down"
        : "neutral"

  const priceHistory = marketData.slice(-50).map((d) => d.close)

  const getBollingerPosition = (): "upper" | "lower" | "middle" => {
    const upper = bb.upper[lastBBIdx]
    const lower = bb.lower[lastBBIdx]
    if (!upper || !lower) return "middle"
    const range = upper - lower
    const positionInBand = (currentPrice - lower) / range
    if (positionInBand > 0.8) return "upper"
    if (positionInBand < 0.2) return "lower"
    return "middle"
  }

  const getIndicatorSignal = (name: string): "buy" | "sell" | "hold" | "neutral" => {
    switch (name) {
      case "RSI":
        if (currentRSI < 30) return "buy"
        if (currentRSI > 70) return "sell"
        return "neutral"
      case "ADX":
        if (currentADX > 25)
          return tradingSignal.signal === "BUY" ? "buy" : tradingSignal.signal === "SELL" ? "sell" : "hold"
        return "neutral"
      case "SuperTrend":
        if (timeframeSentiments["1m"] === "BUY") return "buy"
        if (timeframeSentiments["1m"] === "SELL") return "sell"
        return "neutral"
      case "EWO":
        if (ewoSignal === "BUY") return "buy"
        if (ewoSignal === "SELL") return "sell"
        return "neutral"
      case "MACD":
        if (tradingSignal.macd.crossover === "bullish") return "buy"
        if (tradingSignal.macd.crossover === "bearish") return "sell"
        if (tradingSignal.macd.histogram > 0) return "buy"
        if (tradingSignal.macd.histogram < 0) return "sell"
        return "neutral"
      case "BB":
        if (bb.lower[lastBBIdx] && currentPrice <= bb.lower[lastBBIdx]) return "buy"
        if (bb.upper[lastBBIdx] && currentPrice >= bb.upper[lastBBIdx]) return "sell"
        return "neutral"
      case "Pivot":
        if (pivots.s1 && currentPrice <= pivots.s1) return "buy"
        if (pivots.r1 && currentPrice >= pivots.r1) return "sell"
        return "neutral"
      case "Trend":
        return tradingSignal.signal === "BUY" ? "buy" : tradingSignal.signal === "SELL" ? "sell" : "hold"
      case "Volume":
        return volumeAnalysis.signal === "BUY" ? "buy" : volumeAnalysis.signal === "SELL" ? "sell" : "neutral"
      case "GoldenCross":
        return currentGoldenCross === "BUY" ? "buy" : currentGoldenCross === "SELL" ? "sell" : "neutral"
      default:
        return "neutral"
    }
  }

  const signalCheckIndicators = useMemo(
    () => [
      { name: "RSI", signal: getIndicatorSignal("RSI") },
      { name: "MACD", signal: getIndicatorSignal("MACD") },
      { name: "ADX", signal: getIndicatorSignal("ADX") },
      { name: "ST", signal: getIndicatorSignal("SuperTrend") },
      { name: "EWO", signal: getIndicatorSignal("EWO") },
      { name: "BB", signal: getIndicatorSignal("BB") },
      { name: "PIVOT", signal: getIndicatorSignal("Pivot") },
      { name: "TREND", signal: getIndicatorSignal("Trend") },
    ],
    [currentRSI, tradingSignal, timeframeSentiments, ewoSignal, bb, pivots, currentPrice, currentADX],
  )

  const exitWarningData = useMemo(() => {
    // Calculate indicators inside useMemo to ensure fresh values
    const indicatorsList = [
      { name: "RSI", signal: getIndicatorSignal("RSI") },
      { name: "MACD", signal: getIndicatorSignal("MACD") },
      { name: "ADX", signal: getIndicatorSignal("ADX") },
      { name: "ST", signal: getIndicatorSignal("SuperTrend") },
      { name: "EWO", signal: getIndicatorSignal("EWO") },
    ]

    // Count sell signals from indicators
    const sellSignals = indicatorsList.filter((ind) => ind.signal === "sell").length
    const totalSignals = indicatorsList.length

    // Calculate exit confidence: higher when more indicators say sell
    // Also factor in RSI overbought/oversold conditions
    let exitConfidence = (sellSignals / totalSignals) * 100

    // RSI extremes add to exit confidence
    if (currentRSI > 70) {
      exitConfidence += 15 // Overbought - should exit longs
    } else if (currentRSI < 30) {
      exitConfidence += 15 // Oversold - should exit shorts
    }

    // ADX dropping below 20 indicates trend exhaustion
    const adxValue = Number.parseFloat(String(adx)) || 0
    if (adxValue < 20 && adxValue > 0) {
      exitConfidence += 10
    }

    // Cap at 100
    exitConfidence = Math.min(exitConfidence, 100)

    // Generate warning message
    let message = ""
    if (sellSignals >= 3) {
      message = `${sellSignals} indicators signaling exit`
    } else if (currentRSI > 80) {
      message = "RSI extremely overbought"
    } else if (currentRSI < 20) {
      message = "RSI extremely oversold"
    } else if (adxValue < 20 && adxValue > 0) {
      message = "Trend strength weakening"
    } else if (sellSignals >= 2) {
      message = "Multiple indicators weakening"
    }

    return {
      show: exitConfidence >= 40,
      message,
      confidence: Math.round(exitConfidence),
    }
  }, [currentRSI, adx, tradingSignal, rsi])

  const today = new Date()
  const month = String(today.getMonth() + 1).padStart(2, "0")
  const day = String(today.getDate()).padStart(2, "0")
  const year = String(today.getFullYear()).slice(-2)
  const dateString = `${month} • ${day} • ${year}`

  const handleTimeframeChange = (timeframe: string) => {
    setChartTimeframe(timeframe)
  }

  const handleBudgetChange = (budget: number) => {
    setTradeBudget(budget)
  }

  return (
    <div className="relative min-h-screen flex flex-col overflow-x-hidden">
      {showSplash && <SplashScreen />}
      <AuroraBackground>
        <Navbar />
        <SettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />
        <main className="min-h-screen bg-transparent text-white pb-32 relative pt-[100px]">
          {showReversalAlert && (
            <ReversalAlertModal
              reversalWarning={reversalWarning}
              onDismiss={handleReversalDismiss}
              dataPointsLoaded={dataPointsLoaded}
            />
          )}

          <FloatingStatusBar
            selectedTicker={selectedTicker}
            onTickerChange={setSelectedTicker}
            currentPrice={currentPrice}
            priceChange={priceChange}
            priceChangePercent={priceChangePercent}
            signal={tradingSignal.signal}
            superTrendDirection={timeframeSentiments["1m"] as "BUY" | "SELL" | "HOLD"}
            superTrendSignals={{
              "1m": timeframeSentiments["1m"] as "BUY" | "SELL" | "HOLD",
              "5m": timeframeSentiments["5m"] as "BUY" | "SELL" | "HOLD",
              "15m": timeframeSentiments["15m"] as "BUY" | "SELL" | "HOLD",
            }}
            dataSource={dataSource}
            isConnected={isConnected}
            alerts={alerts.filter((a) => !a.dismissed)}
            onClearAllAlerts={handleClearAllAlerts}
            onDismissAlert={handleDismissAlert}
            onAlertTap={handleAlertTap} // Added onAlertTap callback
            tradeBudget={tradeBudget}
            onBudgetChange={setTradeBudget}
            chartTimeframe={chartTimeframe}
            onTimeframeChange={(tf) => {
              setChartTimeframe(tf)
              setShowChartOverlays(true) // Enable constellation chart + pivot panel when timeframe changes
            }}
            selectedOption={selectedOption}
            isTimerRunning={isRunning}
            rsi={currentRSI}
            adx={currentADX}
            bbPosition={getBollingerPosition()}
            volumeSignal={volumeAnalysis.signal}
            ewoSignal={ewoSignal}
            macdCrossover={tradingSignal.macd.crossover}
            reversalWarning={reversalWarning}
            marketData={marketData}
            pivotLevels={{
              pivot: pivots.pivot,
              r1: pivots.r1,
              r2: pivots.r2,
              r3: pivots.r3 || pivots.r2 * 1.01,
              s1: pivots.s1,
              s2: pivots.s2,
            }}
            onPowerHourToggle={handlePowerHourToggle} // Added toggle handler
            signalIndicators={signalCheckIndicators}
            overallSignal={tradingSignal.signal}
            signalConfidence={tradingSignal.confidence}
            macdHistogram={tradingSignal.macd.histogram}
            // Volatility Analysis props
            bbWidth={bb.middle[lastBBIdx] > 0 ? (bb.upper[lastBBIdx] - bb.lower[lastBBIdx]) / bb.middle[lastBBIdx] : 0}
            keltnerSqueeze={ttmSqueeze?.squeezeOn || false}
            ttmSqueeze={ttmSqueeze?.squeezeOn || false}
            ttmMomentum={
              ttmSqueeze?.momentum && ttmSqueeze.momentum.length > 0
                ? ttmSqueeze.momentum[ttmSqueeze.momentum.length - 1] > 0 
                  ? "BULLISH" 
                  : ttmSqueeze.momentum[ttmSqueeze.momentum.length - 1] < 0 
                    ? "BEARISH" 
                    : "NEUTRAL"
                : "NEUTRAL"
            }
            volatilityPercentile={Math.min(100, Math.max(0, ((bb.upper[lastBBIdx] - bb.lower[lastBBIdx]) / (bb.middle[lastBBIdx] || 1)) * 1000))}
            bollingerBands={{
              upper: bb.upper[lastBBIdx] || currentPrice * 1.02,
              middle: bb.middle[lastBBIdx] || currentPrice,
              lower: bb.lower[lastBBIdx] || currentPrice * 0.98,
            }}
            onOpenSettings={() => setShowSettings(true)}
          />

          <div className="snap-scroll-container">
            <FadeSection delay={0} className="snap-section">
              <motion.section
                id="market"
                className="scroll-mt-32 pb-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                style={{
                  marginTop: "env(safe-area-inset-top)",
                }}
              >
                <div id="price-card" className="relative rounded-2xl mx-0 overflow-hidden">
                  {/* Aurora animated background - shared across price and chart */}
                  <div className="absolute inset-0 bg-black overflow-hidden">
                    {/* Animated aurora blobs */}
                    <motion.div
                      className="absolute rounded-full blur-[80px] opacity-60"
                      style={{
                        background: "radial-gradient(circle, #8B7355 0%, #6B5344 50%, transparent 70%)",
                        width: "70%",
                        height: "60%",
                        left: "-10%",
                        top: "10%",
                      }}
                      animate={{
                        x: [0, 30, 0],
                        y: [0, -20, 0],
                        scale: [1, 1.1, 1],
                      }}
                      transition={{
                        duration: 8,
                        repeat: Number.POSITIVE_INFINITY,
                        ease: "easeInOut",
                      }}
                    />
                    <motion.div
                      className="absolute rounded-full blur-[70px] opacity-50"
                      style={{
                        background: "radial-gradient(circle, #7A8B55 0%, #5A6B44 50%, transparent 70%)",
                        width: "50%",
                        height: "50%",
                        right: "-5%",
                        top: "20%",
                      }}
                      animate={{
                        x: [0, -20, 0],
                        y: [0, 25, 0],
                        scale: [1, 1.15, 1],
                      }}
                      transition={{
                        duration: 10,
                        repeat: Number.POSITIVE_INFINITY,
                        ease: "easeInOut",
                        delay: 1,
                      }}
                    />
                    <motion.div
                      className="absolute rounded-full blur-[60px] opacity-40"
                      style={{
                        background: "radial-gradient(circle, #9B8B65 0%, #7B6B55 50%, transparent 70%)",
                        width: "45%",
                        height: "45%",
                        left: "30%",
                        top: "5%",
                      }}
                      animate={{
                        x: [0, -15, 0],
                        y: [0, 15, 0],
                        scale: [1, 1.08, 1],
                      }}
                      transition={{
                        duration: 12,
                        repeat: Number.POSITIVE_INFINITY,
                        ease: "easeInOut",
                        delay: 2,
                      }}
                    />
                  </div>

                  <div className="relative z-10">
                    <div className="relative pt-6 pb-2 px-4">
                      {/* Semi-transparent background that fades out */}
                      <p className="relative text-4xl font-light text-white text-center tracking-tight drop-shadow-lg">
                        ${currentPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p
                        className={`relative text-sm text-center mt-1 drop-shadow-md ${priceChange >= 0 ? "text-emerald-400" : "text-[#ec3b70]"}`}
                      >
                        {priceChange >= 0 ? "+" : ""}
                        {priceChange.toFixed(2)} ({priceChangePercent >= 0 ? "+" : ""}
                        {priceChangePercent.toFixed(2)}%)
                      </p>
                    </div>
                  </div>

                  {/* Chart section - aurora shows through */}
                  <div className="relative h-[250px]">
                    <AuroraSignalChart
                      signal={tradingSignal.signal as "BUY" | "SELL" | "HOLD"}
                      confidence={tradingSignal.confidence}
                      timeframe={chartTimeframe}
                      budget={tradeBudget}
                      superTrendSignals={timeframeSentiments}
                      candles={marketData}
                      isTradeActive={isRunning}
                      pivotLevels={{
                        pivot: pivots.pivot,
                        r1: pivots.r1,
                        r2: pivots.r2,
                        r3: pivots.r3 || pivots.r2 * 1.01,
                        s1: pivots.s1,
                        s2: pivots.s2,
                        s3: pivots.s3 || pivots.s2 * 0.99,
                      }}
                      bollingerBands={{
                        upper: bb.upper[lastBBIdx] || currentPrice * 1.02,
                        middle: bb.middle[lastBBIdx] || currentPrice,
                        lower: bb.lower[lastBBIdx] || currentPrice * 0.98,
                      }}
                      trend={bbTrend}
                      showChartOverlays={showChartOverlays}
                    />
                  </div>

                  <div className="relative z-10 flex items-center justify-between px-4 py-3 text-[11px] uppercase tracking-wider text-white/50 border-t border-white/5">
                    <div>
                      <span>
                        {(() => {
                          const now = new Date()
                          const hour = now.getHours()
                          if (hour < 9 || (hour === 9 && now.getMinutes() < 30)) return "PRE-MARKET"
                          if (hour >= 16) return "CLOSED"
                          if (hour >= 15 && now.getMinutes() >= 45) return "FINAL-RUSH"
                          if (hour >= 15) return "POWER-HOUR"
                          if (hour >= 12) return "MID-DAY"
                          return "MORNING"
                        })()}
                      </span>
                      <span className="ml-2 text-white/70">
                        {Math.max(0, 16 * 60 - (new Date().getHours() * 60 + new Date().getMinutes()))}M
                      </span>
                    </div>
                    <div>ST: {timeframeSentiments["1m"]?.toUpperCase() || "HOLD"}</div>
                  </div>
                </div>

                <div className="relative w-full h-0">
                  <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-1">
                    <div className="text-left">
                      <span className="text-[10px] uppercase tracking-wider text-white/40">Entry</span>
                      <p className="text-sm font-medium text-emerald-400">${pivots.pivot.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase tracking-wider text-white/40">Exit</span>
                      <p className="text-sm font-medium text-[#ec3b70]">${pivots.s1.toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                <div id="timer-section" className="w-full">
                  <UnifiedSignalTimer
                    signal={timeframeSentiments["1m"]}
                    currentPrice={currentPrice}
                    budget={tradeBudget}
                    pivotPoint={pivots.pivot}
                    r1={pivots.r1}
                    s1={pivots.s1}
                    rsi={currentRSI}
                    indicators={[]}
                    confidence={tradingSignal.confidence}
                    priceChange={priceChange}
                    priceChangePercent={priceChangePercent}
                    showCombinedView={true}
                    selectedOption={selectedOption}
                    onClearSelectedOption={handleClearSelectedOption}
                    externalIsRunning={isRunning}
                    onExternalStart={() => setIsRunning(true)}
                    onTimerEnd={handleTimerEnd}
                    chartSentiment={chartSentiment}
                    exitWarning={exitWarningData} // Pass exit warning data to timer
                  />
                </div>

                <FadeSection delay={150} className="snap-section">
                  <section id="options-simulation" className="flex-1 scroll-mt-4">
                    <OptionPlaySimulator
                      budget={tradeBudget}
                      onBudgetChange={setTradeBudget}
                      currentPrice={currentPrice}
                      signal={tradingSignal.signal}
                      confidence={tradingSignal.confidence}
                      pivotLevels={{
                        pivot: pivots.pivot,
                        r1: pivots.r1,
                        r2: pivots.r2,
                        r3: pivots.r3 || pivots.r2 * 1.01,
                        s1: pivots.s1,
                        s2: pivots.s2,
                      }}
                      rsi={currentRSI}
                      indicators={[]}
                      onStartTimer={handleStartTimerWithOption}
                    />
                  </section>
                </FadeSection>

                <FadeSection delay={300} className="snap-section">
                  <section id="analysis" className="flex-1 scroll-mt-4">
                    <div className="flex items-center justify-between mb-4 px-5">
                      <p className="text-xs uppercase tracking-[0.2em] text-white/40">Signal Check</p>
                      <div className="flex items-center gap-2">
                        <a
                          href="#analysis"
                          className="w-2 h-2 rounded-full bg-[#ec3b70] transition-all hover:scale-125"
                          aria-label="Signal Check"
                        />
                        <a
                          href="#options-simulation"
                          className="w-2 h-2 rounded-full bg-white/20 transition-all hover:bg-white/40 hover:scale-125"
                          aria-label="Options Simulation"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
                      <SignalCheckCombined
                        indicators={signalCheckIndicators}
                        overallSignal={tradingSignal.signal}
                        confidence={tradingSignal.confidence}
                        reasons={tradingSignal.reasons}
                        currentPrice={currentPrice}
                        pivot={pivots.pivot}
                        r1={pivots.r1}
                        r2={pivots.r2}
                        r3={pivots.r3 || pivots.r2 * 1.01}
                        s1={pivots.s1}
                        s2={pivots.s2}
                        s3={pivots.s3 || pivots.s2 * 0.99}
                        bollingerBands={{
                          upper: bb.upper[lastBBIdx],
                          middle: bb.middle[lastBBIdx],
                          lower: bb.lower[lastBBIdx],
                        }}
                        candleData={marketData}
                        signal={tradingSignal.signal}
                        trend={bbTrend}
                        rsi={currentRSI}
                        macdHistogram={tradingSignal.macd.histogram}
                        reversalWarning={reversalWarning}
                        className="h-full"
                      />
                      <VerticalCombinedChart
                        currentPrice={currentPrice}
                        pivot={pivots.pivot}
                        r1={pivots.r1}
                        r2={pivots.r2}
                        r3={pivots.r3 || pivots.r2 * 1.01}
                        s1={pivots.s1}
                        s2={pivots.s2}
                        s3={pivots.s3 || pivots.s2 * 0.99}
                        bollingerBands={{
                          upper: bb.upper[lastBBIdx] || currentPrice * 1.02,
                          middle: bb.middle[lastBBIdx] || currentPrice,
                          lower: bb.lower[lastBBIdx] || currentPrice * 0.98,
                        }}
                        candleData={marketData}
                        signal={tradingSignal.signal}
                        trend={bbTrend}
                        className="h-full"
                      />
                    </div>

                    {/* Pivot Points - Below Signal Check */}
                    <div className="mt-0">
                      <ChartsSection
                        marketData={marketData}
                        currentPrice={currentPrice}
                        signal={tradingSignal.signal}
                        pivotLevels={{
                          pivot: pivots.pivot,
                          r1: pivots.r1,
                          r2: pivots.r2,
                          r3: pivots.r3 || pivots.r2 * 1.01,
                          s1: pivots.s1,
                          s2: pivots.s2,
                        }}
                        bollingerBands={{
                          upper: bb.upper[lastBBIdx] || currentPrice * 1.02,
                          middle: bb.middle[lastBBIdx] || currentPrice,
                          lower: bb.lower[lastBBIdx] || currentPrice * 0.98,
                        }}
                        trend={bbTrend}
                        priceHistory={priceHistory}
                        indicators={{
                          rsi: currentRSI,
                          adx: currentADX,
                          ewo: currentEWO,
                          macd: tradingSignal.macd.histogram,
                          superTrendSignal: timeframeSentiments["1m"],
                          volume: {
                            ratio: volumeAnalysis.volumeRatio,
                            signal: volumeAnalysis.signal,
                          },
                          goldenCross: "",
                          getSignal: getIndicatorSignal,
                        }}
                        visualMonitoringData={visualMonitoringData}
                      />
                    </div>
                  </section>
                </FadeSection>

                <FadeSection delay={450} className="snap-section">
                  <section id="settings" className="px-5 flex-1 scroll-mt-4">
                    <button
                      onClick={() => setShowSettings(!showSettings)}
                      className="w-full flex items-center justify-between py-4 press-effect"
                    >
                      <span className="text-xs uppercase tracking-[0.2em] text-white/40">Settings</span>
                      <ChevronRight
                        className={`w-4 h-4 text-white/40 transition-transform ${showSettings ? "rotate-90" : ""}`}
                      />
                    </button>
                  </section>
                </FadeSection>
              </motion.section>
            </FadeSection>
          </div>
        </main>
        <BottomNav activeTab={activeTab} onTabChange={handleTabChange} onCloseSettings={() => setShowSettings(false)} />
      </AuroraBackground>

      {activeTab === "market" && marketData.length > 0 && (
        <PowerHourPanel
          vwapPosition={powerHourData.vwapPosition}
          rsi={currentRSI}
          rvol={volumeAnalysis?.volumeRatio ?? 1}
          atrSlope={powerHourData.atrSlope}
          ewo={currentEWO}
          currentPrice={currentPrice}
          vwap={powerHourData.vwap}
          adx={currentADX}
          adxPrevious={currentADX}
          adxPeak={currentADX}
          macdHistogram={macd.histogram[macd.histogram.length - 1] ?? 0}
          isOpen={showPowerHourPanel}
          onToggle={handlePowerHourPanelToggle}
        />
      )}

      {activeTab === "market" && (
        <OptionsMonitorPanel
          currentPrice={currentPrice}
          impliedVolatility={30}
          volume={volumeAnalysis?.currentVolume ?? 3310000}
          priceChange={priceChangePercent}
          isOpen={showOptionsMonitor}
          onToggle={handleOptionsMonitorToggle}
        />
      )}

      {runAlert && (
        <RunAlertWidget
          alert={runAlert}
          onDismiss={handleRunAlertDismiss}
          onSaveToHistory={handleSaveRunAlertToHistory}
        />
      )}

      {selectedHistoryAlert && !runAlert && (
        <RunAlertWidget alert={selectedHistoryAlert} onDismiss={handleSelectedHistoryAlertDismiss} />
      )}
    </div>
  )
}
