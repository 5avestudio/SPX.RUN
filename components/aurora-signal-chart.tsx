"use client"

import type React from "react"
import { useRef, useEffect, useState, useMemo, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Circle, BarChart3, Activity, TrendingUp, ZoomIn, ZoomOut } from "lucide-react"
import { CompactPivotPanel } from "@/components/compact-pivot-panel"

// Zoom levels: fewer candles = more zoomed in, more candles = zoomed out
const ZOOM_LEVELS = [8, 12, 16, 20, 30, 40, 60]
const DEFAULT_ZOOM_INDEX = 3 // Start at 20 candles

interface AuroraSignalChartProps {
  signal: "BUY" | "SELL" | "HOLD"
  confidence: number
  timeframe: string
  budget: number
  superTrendSignals: {
    "1m": "BUY" | "SELL" | "HOLD"
    "5m": "BUY" | "SELL" | "HOLD"
    "15m": "BUY" | "SELL" | "HOLD"
  }
  candles?: Array<{
    timestamp: number
    open: number
    high: number
    low: number
    close: number
    volume: number
  }>
  isTradeActive?: boolean
  pivotLevels?: {
    pivot: number
    r1: number
    r2: number
    r3: number
    s1: number
    s2: number
    s3: number
  }
  bollingerBands?: {
    upper: number
    middle: number
    lower: number
  }
  trend?: "up" | "down" | "neutral"
  // Control layers externally - when true, enables lineWave (constellation) and pivotPanel
  showChartOverlays?: boolean
}

interface ChartLayers {
  aurora: boolean
  candles: boolean
  whiteGlow: boolean
  lineWave: boolean
  pivotPanel: boolean // New layer for pivot panel
}

const formatCandleTime = (timestamp: number, timeframe: string): string => {
  if (!timestamp || isNaN(timestamp) || timestamp <= 0) {
    return "--:--"
  }
  // Handle both milliseconds (13+ digits) and seconds (10 digits) formats
  const isMilliseconds = timestamp > 9999999999
  const date = new Date(isMilliseconds ? timestamp : timestamp * 1000)
  if (isNaN(date.getTime())) {
    return "--:--"
  }

  const hours = date.getHours()
  const minutes = date.getMinutes()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

  // Format based on timeframe
  switch (timeframe) {
    case "D":
    case "W":
      // Daily/Weekly: Show MM/DD format
      return `${month}/${day.toString().padStart(2, "0")}`
    case "M":
      // Monthly: Show abbreviated month name
      return monthNames[date.getMonth()]
    case "1":
    case "5":
    case "15":
    case "30":
    case "60":
    default:
      // Intraday: Show HH:MM format (12-hour)
      const displayHours = hours % 12 || 12
      const displayMinutes = minutes.toString().padStart(2, "0")
      const ampm = hours >= 12 ? "p" : "a"
      return `${displayHours}:${displayMinutes}${ampm}`
  }
}

export function AuroraSignalChart({
  signal,
  confidence,
  timeframe,
  budget,
  superTrendSignals,
  candles = [],
  isTradeActive = false,
  pivotLevels,
  bollingerBands,
  trend = "neutral",
  showChartOverlays = false,
}: AuroraSignalChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number>(0)
  const timeRef = useRef(0)
  const [hoveredBar, setHoveredBar] = useState<number | null>(null)
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX)
  const [layers, setLayers] = useState<ChartLayers>({
    aurora: true,
    candles: false,
    whiteGlow: false,
    lineWave: false,
    pivotPanel: false, // Default off
  })
  
  // Respond to external showChartOverlays prop - enables lineWave and pivotPanel
  useEffect(() => {
    if (showChartOverlays) {
      setLayers((prev) => ({
        ...prev,
        lineWave: true,
        pivotPanel: true,
      }))
    }
  }, [showChartOverlays])
  
  const [labelMode, setLabelMode] = useState<"BUYSELL" | "CALLPUT">("BUYSELL")
  const [stableSignal, setStableSignal] = useState<"BUY" | "SELL" | "HOLD" | "IDLE">("IDLE")
  const lastSignalChangeRef = useRef<number>(Date.now())
  const lastPinchDistanceRef = useRef<number | null>(null)
  
  // Horizontal scroll/pan state for candle navigation
  const [scrollOffset, setScrollOffset] = useState(0) // Number of candles to offset from the end
  const isDraggingRef = useRef(false)
  const dragStartXRef = useRef(0)
  const dragStartOffsetRef = useRef(0)

  // Zoom handlers - reset scroll offset when zoom changes to avoid confusion
  const handleZoomIn = useCallback(() => {
    setZoomIndex((prev) => Math.max(0, prev - 1))
    setScrollOffset(0) // Reset to show most recent candles
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoomIndex((prev) => Math.min(ZOOM_LEVELS.length - 1, prev + 1))
    setScrollOffset(0) // Reset to show most recent candles
  }, [])

  // Mouse wheel zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      if (e.deltaY < 0) {
        setZoomIndex((prev) => Math.max(0, prev - 1))
      } else {
        setZoomIndex((prev) => Math.min(ZOOM_LEVELS.length - 1, prev + 1))
      }
    }
  }, [])

  // Calculate max scroll offset based on available candles
  const maxScrollOffset = useMemo(() => {
    const candleCount = ZOOM_LEVELS[zoomIndex]
    return Math.max(0, candles.length - candleCount)
  }, [candles.length, zoomIndex])

  // Pinch-to-zoom for touch devices
  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2) {
      // Two-finger pinch for zoom
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      lastPinchDistanceRef.current = distance
      isDraggingRef.current = false
    } else if (e.touches.length === 1) {
      // Single finger drag for horizontal scroll
      isDraggingRef.current = true
      dragStartXRef.current = e.touches[0].clientX
      dragStartOffsetRef.current = scrollOffset
    }
  }, [scrollOffset])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2 && lastPinchDistanceRef.current !== null) {
      // Pinch zoom
      e.preventDefault()
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      const delta = distance - lastPinchDistanceRef.current
      
      if (Math.abs(delta) > 20) {
        if (delta > 0) {
          setZoomIndex((prev) => Math.max(0, prev - 1))
        } else {
          setZoomIndex((prev) => Math.min(ZOOM_LEVELS.length - 1, prev + 1))
        }
        lastPinchDistanceRef.current = distance
      }
    } else if (e.touches.length === 1 && isDraggingRef.current) {
      // Single finger horizontal scroll
      const deltaX = e.touches[0].clientX - dragStartXRef.current
      const candleWidth = 25 // Approximate pixel width per candle
      const candlesDelta = Math.round(deltaX / candleWidth)
      const newOffset = Math.max(0, Math.min(maxScrollOffset, dragStartOffsetRef.current + candlesDelta))
      setScrollOffset(newOffset)
    }
  }, [maxScrollOffset])

  const handleTouchEnd = useCallback(() => {
    lastPinchDistanceRef.current = null
    isDraggingRef.current = false
  }, [])

  // Mouse drag handlers for desktop
  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (e.button === 0) { // Left mouse button
      isDraggingRef.current = true
      dragStartXRef.current = e.clientX
      dragStartOffsetRef.current = scrollOffset
    }
  }, [scrollOffset])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDraggingRef.current) {
      const deltaX = e.clientX - dragStartXRef.current
      const candleWidth = 25 // Approximate pixel width per candle
      const candlesDelta = Math.round(deltaX / candleWidth)
      const newOffset = Math.max(0, Math.min(maxScrollOffset, dragStartOffsetRef.current + candlesDelta))
      setScrollOffset(newOffset)
    }
  }, [maxScrollOffset])

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false
  }, [])

  // Setup zoom and pan event listeners
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener("wheel", handleWheel, { passive: false })
    container.addEventListener("touchstart", handleTouchStart, { passive: true })
    container.addEventListener("touchmove", handleTouchMove, { passive: false })
    container.addEventListener("touchend", handleTouchEnd, { passive: true })
    container.addEventListener("mousedown", handleMouseDown)
    container.addEventListener("mousemove", handleMouseMove)
    container.addEventListener("mouseup", handleMouseUp)
    container.addEventListener("mouseleave", handleMouseUp)

    return () => {
      container.removeEventListener("wheel", handleWheel)
      container.removeEventListener("touchstart", handleTouchStart)
      container.removeEventListener("touchmove", handleTouchMove)
      container.removeEventListener("touchend", handleTouchEnd)
      container.removeEventListener("mousedown", handleMouseDown)
      container.removeEventListener("mousemove", handleMouseMove)
      container.removeEventListener("mouseup", handleMouseUp)
      container.removeEventListener("mouseleave", handleMouseUp)
    }
  }, [handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd, handleMouseDown, handleMouseMove, handleMouseUp])

  const toggleLayer = useCallback((layer: keyof ChartLayers) => {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }))
  }, [])

  const hasChartOverlay = layers.candles || layers.whiteGlow || layers.lineWave

  const effectiveSignal = useMemo(() => {
    const signals = Object.values(superTrendSignals)
    const buyCount = signals.filter((s) => s === "BUY").length
    const sellCount = signals.filter((s) => s === "SELL").length

    if (buyCount >= 2) return "BUY"
    if (sellCount >= 2) return "SELL"

    if (signal !== "HOLD" && confidence > 0 && superTrendSignals["1m"] === signal) {
      return signal
    }

    if (buyCount >= 1 || sellCount >= 1 || signal === "HOLD") {
      return "HOLD"
    }

    return "IDLE"
  }, [signal, confidence, superTrendSignals])

  useEffect(() => {
    const now = Date.now()
    const timeSinceLastChange = now - lastSignalChangeRef.current

    if (effectiveSignal !== stableSignal) {
      const isStrongerSignal = effectiveSignal === "BUY" || effectiveSignal === "SELL"
      const shouldUpdate = isStrongerSignal || timeSinceLastChange > 10000

      if (shouldUpdate) {
        setStableSignal(effectiveSignal)
        lastSignalChangeRef.current = now
      }
    }
  }, [effectiveSignal, stableSignal])

  const effectiveConfidence = useMemo(() => {
    if (stableSignal === "IDLE") return 0
    if (confidence > 0) return confidence

    const signals = Object.values(superTrendSignals)
    const matchingSignals = signals.filter((s) => s === stableSignal).length
    return Math.round((matchingSignals / 3) * 100)
  }, [stableSignal, confidence, superTrendSignals])

  const displaySignal = effectiveConfidence >= 65 ? stableSignal : "IDLE"

  const getDisplayLabel = (sig: string) => {
    if (sig === "HOLD") return "HOLD"
    if (labelMode === "CALLPUT") {
      return sig === "BUY" ? "CALL" : "PUT"
    }
    return sig
  }

  const confidenceScale = useMemo(() => {
    return 0.7 + (effectiveConfidence / 100) * 0.5
  }, [effectiveConfidence])

  const getOrbColors = () => {
    const brightnessMultiplier = effectiveConfidence / 100

    switch (displaySignal) {
      case "BUY":
        return {
          brightCore: `rgba(220, 255, 120, ${0.95 * brightnessMultiplier})`,
          core: `rgba(120, 240, 200, ${1 * brightnessMultiplier})`,
          inner: `rgba(60, 200, 240, ${0.9 * brightnessMultiplier})`,
          mid: `rgba(40, 120, 200, ${0.7 * brightnessMultiplier})`,
          outer: `rgba(30, 40, 140, ${0.5 * brightnessMultiplier})`,
          glow: `rgba(20, 80, 180, ${0.2 * brightnessMultiplier})`,
          text: "text-cyan-400",
        }
      case "SELL":
        return {
          brightCore: `rgba(255, 150, 180, ${0.9 * brightnessMultiplier})`,
          core: `rgba(236, 80, 130, ${1 * brightnessMultiplier})`,
          inner: `rgba(220, 60, 110, ${0.9 * brightnessMultiplier})`,
          mid: `rgba(180, 40, 80, ${0.6 * brightnessMultiplier})`,
          outer: `rgba(120, 30, 60, ${0.4 * brightnessMultiplier})`,
          glow: `rgba(236, 59, 112, ${0.15 * brightnessMultiplier})`,
          text: "text-[#ec3b70]",
        }
      case "HOLD":
        return {
          brightCore: `rgba(255, 255, 255, ${1 * brightnessMultiplier})`,
          core: `rgba(240, 240, 245, ${1 * brightnessMultiplier})`,
          inner: `rgba(200, 200, 210, ${0.9 * brightnessMultiplier})`,
          mid: `rgba(150, 150, 160, ${0.5 * brightnessMultiplier})`,
          outer: `rgba(100, 100, 110, ${0.3 * brightnessMultiplier})`,
          glow: `rgba(255, 255, 255, ${0.1 * brightnessMultiplier})`,
          text: "text-white",
        }
      default:
        return null
    }
  }

  const getOrganicBorderRadius = (signalType: string, conf: number) => {
    const irregularity = Math.max(0, 1 - conf / 100)

    if (signalType === "HOLD") {
      const baseTop = 45 + irregularity * 8
      const baseBottom = 55 - irregularity * 8
      return {
        layer1: `${48 + irregularity * 4}% ${52 - irregularity * 4}% ${50 + irregularity * 3}% ${50 - irregularity * 3}% / ${baseTop - 3}% ${baseTop + 2}% ${baseBottom + 3}% ${baseBottom - 2}%`,
        layer2: `${49 + irregularity * 3}% ${51 - irregularity * 3}% ${50 + irregularity * 2}% ${50 - irregularity * 2}% / ${baseTop - 2}% ${baseTop + 1}% ${baseBottom + 2}% ${baseBottom - 1}%`,
        layer3: `${50 + irregularity * 2}% ${50 - irregularity * 2}% ${50 + irregularity * 1}% ${50 - irregularity * 1}% / ${baseTop - 1}% ${baseTop}% ${baseBottom + 1}% ${baseBottom}%`,
        layer4: `${50 + irregularity * 1}% ${50 - irregularity * 1}% 50% 50% / ${baseTop}% ${baseTop}% ${baseBottom}% ${baseBottom}%`,
        layer5: `50% 50% 50% 50% / ${baseTop + 1}% ${baseTop + 1}% ${baseBottom - 1}% ${baseBottom - 1}%`,
        layer6: `50% 50% 50% 50% / ${baseTop + 2}% ${baseTop + 2}% ${baseBottom - 2}% ${baseBottom - 2}%`,
      }
    } else if (signalType === "SELL") {
      const wobble = irregularity * 12
      const asymmetry = irregularity * 5
      return {
        layer1: `${44 - wobble}% ${56 + wobble}% ${54 + wobble * 0.9}% ${46 - wobble * 0.9}% / ${46 + asymmetry}% ${52 - asymmetry * 0.5}% ${54 + asymmetry * 0.5}% ${48 - asymmetry}%`,
        layer2: `${46 - wobble * 0.85}% ${54 + wobble * 0.85}% ${53 + wobble * 0.75}% ${47 - wobble * 0.75}% / ${47 + asymmetry * 0.8}% ${51 - asymmetry * 0.4}% ${53 + asymmetry * 0.4}% ${49 - asymmetry * 0.8}%`,
        layer3: `${47 - wobble * 0.7}% ${53 + wobble * 0.7}% ${52 + wobble * 0.6}% ${48 - wobble * 0.6}% / ${48 + asymmetry * 0.6}% ${51 - asymmetry * 0.3}% ${52 + asymmetry * 0.3}% ${49 - asymmetry * 0.6}%`,
        layer4: `${48 - wobble * 0.5}% ${52 + wobble * 0.5}% ${51 + wobble * 0.4}% ${49 - wobble * 0.4}% / ${49 + asymmetry * 0.4}% ${50 - asymmetry * 0.2}% ${51 + asymmetry * 0.2}% ${50 - asymmetry * 0.4}%`,
        layer5: `${49 - wobble * 0.3}% ${51 + wobble * 0.3}% ${51 + wobble * 0.2}% ${49 - wobble * 0.2}% / ${49 + asymmetry * 0.2}% 50% ${51 + asymmetry * 0.1}% ${50 - asymmetry * 0.2}%`,
        layer6: `${50 - wobble * 0.1}% ${50 + wobble * 0.1}% ${50 + wobble * 0.05}% ${50 - wobble * 0.05}% / 50% 50% 50% 50%`,
      }
    } else {
      const wobble = irregularity * 6
      return {
        layer1: `${47 - wobble}% ${53 + wobble}% ${52 + wobble * 0.8}% ${48 - wobble * 0.8}% / ${48 + wobble * 0.5}% ${50 - wobble * 0.3}% ${50 + wobble * 0.3}% ${52 - wobble * 0.5}%`,
        layer2: `${48 - wobble * 0.8}% ${52 + wobble * 0.8}% ${51 + wobble * 0.6}% ${49 - wobble * 0.6}% / ${49 + wobble * 0.4}% ${50 - wobble * 0.2}% ${50 + wobble * 0.2}% ${51 - wobble * 0.4}%`,
        layer3: `${49 - wobble * 0.6}% ${51 + wobble * 0.6}% ${51 + wobble * 0.4}% ${49 - wobble * 0.4}% / ${49 + wobble * 0.3}% ${50 - wobble * 0.1}% ${50 + wobble * 0.1}% ${51 - wobble * 0.3}%`,
        layer4: `${49 - wobble * 0.4}% ${51 + wobble * 0.4}% ${50 + wobble * 0.3}% ${50 - wobble * 0.3}% / ${50 + wobble * 0.2}% 50% 50% ${50 - wobble * 0.2}%`,
        layer5: `${50 - wobble * 0.2}% ${50 + wobble * 0.2}% ${50 + wobble * 0.1}% ${50 - wobble * 0.1}% / 50% 50% 50% 50%`,
        layer6: `50% 50% 50% 50% / 50% 50% 50% 50%`,
      }
    }
  }

  const orbColors = getOrbColors()
  const organicShapes = getOrganicBorderRadius(displaySignal, effectiveConfidence)

  const calculateIchimokuCloud = () => {
    if (candles.length < 26) return null

    const getLast = (arr: number[], period: number) => arr.slice(-period)
    const highs = candles.map((c) => c.high)
    const lows = candles.map((c) => c.low)

    const tenkanHighs = getLast(highs, 9)
    const tenkanLows = getLast(lows, 9)
    const tenkan = (Math.max(...tenkanHighs) + Math.min(...tenkanLows)) / 2

    const kijunHighs = getLast(highs, 26)
    const kijunLows = getLast(lows, 26)
    const kijun = (Math.max(...kijunHighs) + Math.min(...kijunLows)) / 2

    const spanA = (tenkan + kijun) / 2

    const spanBHighs = getLast(highs, Math.min(52, highs.length))
    const spanBLows = getLast(lows, Math.min(52, lows.length))
    const spanB = (Math.max(...spanBHighs) + Math.min(...spanBLows)) / 2

    return { spanA, spanB }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let resizeTimeout: NodeJS.Timeout
    const handleResize = () => {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        const rect = canvas.getBoundingClientRect()
        canvas.width = rect.width * window.devicePixelRatio
        canvas.height = rect.height * window.devicePixelRatio
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
      }, 100)
    }

    handleResize()
    window.addEventListener("resize", handleResize)

    const animate = () => {
      const rect = canvas.getBoundingClientRect()
      const width = rect.width
      const height = rect.height

      timeRef.current += 0.008

      ctx.clearRect(0, 0, width, height)

      const auroraOpacity = 1

      if (layers.aurora && (displaySignal === "IDLE" || hasChartOverlay)) {
        const color1_1 = `rgba(255, 140, 50, ${0.6 * auroraOpacity})`
        const color1_2 = `rgba(180, 80, 20, ${0.3 * auroraOpacity})`
        const color2_1 = `rgba(180, 200, 50, ${0.5 * auroraOpacity})`
        const color2_2 = `rgba(100, 140, 30, ${0.2 * auroraOpacity})`
        const color3_1 = `rgba(220, 120, 40, ${0.4 * auroraOpacity})`
        const color3_2 = `rgba(150, 80, 20, ${0.2 * auroraOpacity})`

        const drawAuroraBlob = (
          x: number,
          y: number,
          radius: number,
          color1: string,
          color2: string,
          phase: number,
        ) => {
          const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
          gradient.addColorStop(0, color1)
          gradient.addColorStop(0.5, color2)
          gradient.addColorStop(1, "transparent")

          ctx.globalAlpha = (0.6 + Math.sin(timeRef.current + phase) * 0.2) * auroraOpacity
          ctx.fillStyle = gradient
          ctx.beginPath()
          ctx.arc(x, y, radius, 0, Math.PI * 2)
          ctx.fill()
        }

        const blob1X = width * 0.3 + Math.sin(timeRef.current * 0.7) * width * 0.15
        const blob1Y = height * 0.25 + Math.cos(timeRef.current * 0.5) * height * 0.1
        drawAuroraBlob(blob1X, blob1Y, width * 0.55, color1_1, color1_2, 0)

        const blob2X = width * 0.65 + Math.cos(timeRef.current * 0.6) * width * 0.12
        const blob2Y = height * 0.7 + Math.sin(timeRef.current * 0.8) * height * 0.15
        drawAuroraBlob(blob2X, blob2Y, width * 0.6, color2_1, color2_2, Math.PI / 3)

        const blob3X = width * 0.5 + Math.sin(timeRef.current * 0.4) * width * 0.2
        const blob3Y = height * 0.45 + Math.cos(timeRef.current * 0.6) * height * 0.2
        drawAuroraBlob(blob3X, blob3Y, width * 0.4, color3_1, color3_2, Math.PI / 2)

        ctx.globalAlpha = 1
      }

      if (!hasChartOverlay) {
        animationRef.current = requestAnimationFrame(animate)
        return
      }

      if (!candles || candles.length === 0) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)"
        ctx.font = "14px system-ui"
        ctx.textAlign = "center"
        ctx.fillText("Loading chart data...", width / 2, height / 2)
        animationRef.current = requestAnimationFrame(animate)
        return
      }

      const candleCount = Math.min(ZOOM_LEVELS[zoomIndex], candles.length)
      // Apply scroll offset - scrollOffset of 0 shows most recent candles
      const endIndex = candles.length - scrollOffset
      const startIndex = Math.max(0, endIndex - candleCount)
      const displayCandles = candles.slice(startIndex, endIndex)

      const timestampHeight = 20
      const topMargin = 5
      const availableHeight = height - timestampHeight - topMargin
      const candleAreaHeight = Math.min(180, Math.max(80, availableHeight * 0.7))
      const chartHeight = candleAreaHeight
      const verticalOffset = topMargin + (availableHeight - candleAreaHeight) / 2

      // Dynamic spacing based on zoom level
      const candleSpacing = Math.max(15, Math.min(40, width / displayCandles.length - 2))
      const candleWidth = Math.max(3, Math.min(8, candleSpacing * 0.3))
      const chartWidth = displayCandles.length * candleSpacing

      const offsetX = width - chartWidth - 10

      const allPrices = displayCandles.flatMap((c) => [c.high, c.low])
      const priceMin = Math.min(...allPrices)
      const priceMax = Math.max(...allPrices)

      const priceRange = priceMax - priceMin
      const effectiveRange = priceRange < 0.5 ? 2 : priceRange
      const midPrice = (priceMax + priceMin) / 2

      const minPrice = priceRange < 0.5 ? midPrice - 1 : priceMin - effectiveRange * 0.05
      const maxPrice = priceRange < 0.5 ? midPrice + 1 : priceMax + effectiveRange * 0.05

      const priceToY = (price: number) => {
        const range = maxPrice - minPrice
        if (range === 0) return verticalOffset + chartHeight / 2
        const normalized = (price - minPrice) / range
        return verticalOffset + chartHeight * (1 - normalized)
      }

      const cloud = calculateIchimokuCloud()
      if (cloud) {
        const spanAY = priceToY(cloud.spanA)
        const spanBY = priceToY(cloud.spanB)

        const cloudGradient = ctx.createLinearGradient(0, Math.min(spanAY, spanBY), 0, Math.max(spanAY, spanBY))
        if (cloud.spanA > cloud.spanB) {
          cloudGradient.addColorStop(0, "rgba(16, 185, 129, 0.12)")
          cloudGradient.addColorStop(0.5, "rgba(16, 185, 129, 0.06)")
          cloudGradient.addColorStop(1, "rgba(16, 185, 129, 0.02)")
        } else {
          cloudGradient.addColorStop(0, "rgba(239, 68, 68, 0.12)")
          cloudGradient.addColorStop(0.5, "rgba(239, 68, 68, 0.06)")
          cloudGradient.addColorStop(1, "rgba(239, 68, 68, 0.02)")
        }

        ctx.fillStyle = cloudGradient
        ctx.fillRect(0, Math.min(spanAY, spanBY), width, Math.abs(spanAY - spanBY))
      }

      ctx.strokeStyle = "rgba(255, 255, 255, 0.04)"
      ctx.lineWidth = 1
      ctx.setLineDash([4, 8])
      for (let i = 1; i <= 5; i++) {
        const y = verticalOffset + (chartHeight / 6) * i
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }
      ctx.setLineDash([])

      if (layers.lineWave) {
        ctx.beginPath()

        displayCandles.forEach((candle, i) => {
          const x = offsetX + i * candleSpacing
          const y = priceToY(candle.close)

          if (i === 0) {
            ctx.moveTo(x, y)
          } else {
            const prevCandle = displayCandles[i - 1]
            const prevX = offsetX + (i - 1) * candleSpacing
            const prevY = priceToY(prevCandle.close)

            const cpX1 = prevX + candleSpacing / 3
            const cpX2 = x - candleSpacing / 3

            ctx.bezierCurveTo(cpX1, prevY, cpX2, y, x, y)
          }
        })

        ctx.strokeStyle = "rgba(255, 255, 255, 0.9)"
        ctx.lineWidth = 1.5
        ctx.shadowBlur = 8
        ctx.shadowColor = "rgba(255, 255, 255, 0.4)"
        ctx.stroke()
        ctx.shadowBlur = 0

        const lastX = offsetX + (displayCandles.length - 1) * candleSpacing
        ctx.lineTo(lastX, verticalOffset + chartHeight)
        ctx.lineTo(offsetX, verticalOffset + chartHeight)
        ctx.closePath()

        const lineGradient = ctx.createLinearGradient(0, verticalOffset, 0, verticalOffset + chartHeight)
        lineGradient.addColorStop(0, "rgba(255, 255, 255, 0.08)")
        lineGradient.addColorStop(1, "rgba(255, 255, 255, 0)")
        ctx.fillStyle = lineGradient
        ctx.fill()

        displayCandles.forEach((candle, i) => {
          const x = offsetX + i * candleSpacing
          const y = priceToY(candle.close)

          ctx.beginPath()
          ctx.arc(x, y, hoveredBar === i ? 8 : 6, 0, Math.PI * 2)
          ctx.fillStyle = "rgba(255, 255, 255, 0.15)"
          ctx.fill()

          ctx.beginPath()
          ctx.arc(x, y, hoveredBar === i ? 5 : 3.5, 0, Math.PI * 2)
          ctx.fillStyle = "rgba(255, 255, 255, 0.3)"
          ctx.fill()

          ctx.shadowBlur = hoveredBar === i ? 15 : 10
          ctx.shadowColor = "rgba(255, 255, 255, 0.8)"
          ctx.beginPath()
          ctx.arc(x, y, hoveredBar === i ? 3 : 2, 0, Math.PI * 2)
          ctx.fillStyle = "rgba(255, 255, 255, 1)"
          ctx.fill()
          ctx.shadowBlur = 0
        })
      }

      if (layers.candles) {
        displayCandles.forEach((candle, i) => {
          const x = offsetX + i * candleSpacing
          const highY = priceToY(candle.high)
          const lowY = priceToY(candle.low)
          const closeY = priceToY(candle.close)
          const openY = priceToY(candle.open)

          const isUp = candle.close >= candle.open
          const bodyColor = isUp ? "rgba(16, 185, 129, 1)" : "rgba(236, 59, 112, 1)"
          const wickColor = isUp ? "rgba(16, 185, 129, 0.8)" : "rgba(236, 59, 112, 0.8)"

          if (hoveredBar === i) {
            ctx.shadowBlur = 18
            ctx.shadowColor = isUp ? "rgba(16, 185, 129, 0.8)" : "rgba(236, 59, 112, 0.8)"
          } else {
            ctx.shadowBlur = 8
            ctx.shadowColor = isUp ? "rgba(16, 185, 129, 0.5)" : "rgba(236, 59, 112, 0.5)"
          }

          ctx.strokeStyle = wickColor
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(x, highY)
          ctx.lineTo(x, lowY)
          ctx.stroke()

          const bodyTop = Math.min(openY, closeY)
          const bodyHeight = Math.max(Math.abs(closeY - openY), 2)
          ctx.fillStyle = bodyColor
          ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight)

          ctx.shadowBlur = 0
        })
      }

      if (layers.whiteGlow) {
        displayCandles.forEach((candle, i) => {
          const x = offsetX + i * candleSpacing
          const highY = priceToY(candle.high)
          const lowY = priceToY(candle.low)
          const closeY = priceToY(candle.close)
          const openY = priceToY(candle.open)

          const isUp = candle.close >= candle.open
          const alpha = hoveredBar === i ? 1 : 0.7

          ctx.shadowBlur = hoveredBar === i ? 20 : 12
          ctx.shadowColor = `rgba(255, 255, 255, ${alpha})`

          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.6})`
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(x, highY)
          ctx.lineTo(x, lowY)
          ctx.stroke()

          const bodyTop = Math.min(openY, closeY)
          const bodyHeight = Math.max(Math.abs(closeY - openY), 2)

          if (isUp) {
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.9})`
          } else {
            ctx.fillStyle = `rgba(200, 200, 200, ${alpha * 0.7})`
          }
          ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight)

          ctx.shadowBlur = 0
        })
      }

      // Draw timestamps - show all when zoomed in, interval when zoomed out
      const fontSize = displayCandles.length <= 12 ? 9 : displayCandles.length <= 20 ? 8 : 7
      ctx.font = `${fontSize}px system-ui`
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)"
      ctx.textAlign = "center"

      // Calculate how many labels can fit based on space available
      const labelWidth = 35
      const maxLabels = Math.floor(chartWidth / labelWidth)
      const timestampInterval = displayCandles.length <= 12 ? 1 : Math.max(1, Math.ceil(displayCandles.length / maxLabels))
      
      displayCandles.forEach((candle, i) => {
        const showLabel = displayCandles.length <= 12 || i % timestampInterval === 0 || i === displayCandles.length - 1
        if (showLabel) {
          const x = offsetX + i * candleSpacing
          const label = formatCandleTime(candle.timestamp, timeframe)
          ctx.fillText(label, x, height - 5)
        }
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      window.removeEventListener("resize", handleResize)
    }
  }, [layers, displaySignal, hasChartOverlay, candles, timeframe, hoveredBar, zoomIndex, scrollOffset])

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!hasChartOverlay || candles.length === 0) return

      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const width = rect.width

      const candleCount = Math.min(ZOOM_LEVELS[zoomIndex], candles.length)
      const endIndex = candles.length - scrollOffset
      const startIndex = Math.max(0, endIndex - candleCount)
      const displayCandles = candles.slice(startIndex, endIndex)
      const candleSpacing = Math.max(15, Math.min(40, width / displayCandles.length - 2))
      const chartWidth = displayCandles.length * candleSpacing
      const offsetX = width - chartWidth - 10

      const candleIndex = Math.floor((x - offsetX) / candleSpacing)
      if (candleIndex >= 0 && candleIndex < displayCandles.length) {
        setHoveredBar(candleIndex === hoveredBar ? null : candleIndex)
      }
    },
    [hasChartOverlay, candles, hoveredBar, zoomIndex, scrollOffset],
  )

  // Get current price from candles for the pivot panel
  const currentPriceFromCandles = candles.length > 0 ? candles[candles.length - 1]?.close || 0 : 0

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[250px] overflow-hidden rounded-3xl touch-none select-none">
      <canvas ref={canvasRef} className={`absolute inset-0 w-full h-full ${hasChartOverlay ? "cursor-grab active:cursor-grabbing" : ""}`} onClick={handleCanvasClick} />

      {/* Zoom Controls - offset from right to not obscure SuperTrend arrows */}
      {hasChartOverlay && (
        <div className="absolute bottom-7 right-[46px] flex items-center gap-1 z-10">
          <button
            onClick={handleZoomIn}
            disabled={zoomIndex === 0}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all bg-black/50 backdrop-blur-sm border border-white/10 ${
              zoomIndex === 0 ? "opacity-30" : "opacity-70 hover:opacity-100 active:scale-95"
            }`}
          >
            <ZoomIn className="w-3.5 h-3.5 text-white" />
          </button>
          <button
            onClick={handleZoomOut}
            disabled={zoomIndex === ZOOM_LEVELS.length - 1}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all bg-black/50 backdrop-blur-sm border border-white/10 ${
              zoomIndex === ZOOM_LEVELS.length - 1 ? "opacity-30" : "opacity-70 hover:opacity-100 active:scale-95"
            }`}
          >
            <ZoomOut className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      )}

      {/* Candle Count Indicator */}
      {hasChartOverlay && (
        <div className="absolute top-[18px] right-12 px-2 py-1 rounded-full bg-black/50 backdrop-blur-sm z-10 flex items-center justify-center gap-1.5">
          <span className="text-[9px] text-white/50 font-medium leading-none">{Math.min(ZOOM_LEVELS[zoomIndex], candles.length)} candles</span>
          {scrollOffset > 0 && (
            <button 
              onClick={() => setScrollOffset(0)}
              className="text-[8px] text-cyan-400 font-medium leading-none hover:text-cyan-300 transition-colors"
              title="Jump to latest"
            >
              LIVE
            </button>
          )}
        </div>
      )}

      {layers.pivotPanel && pivotLevels && (
        <CompactPivotPanel
          currentPrice={currentPriceFromCandles}
          pivot={pivotLevels.pivot}
          r1={pivotLevels.r1}
          r2={pivotLevels.r2}
          r3={pivotLevels.r3}
          s1={pivotLevels.s1}
          s2={pivotLevels.s2}
          s3={pivotLevels.s3}
          bollingerBands={bollingerBands}
          trend={trend}
          signal={signal === "BUY" ? "buy" : signal === "SELL" ? "sell" : "hold"}
        />
      )}

      {displaySignal === "IDLE" && !hasChartOverlay && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-center">
            <motion.h3
              className="text-2xl font-light tracking-[0.2em] text-white/60"
              animate={{ opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            >
              Waiting For Opportunity
            </motion.h3>
            <p className="text-white/30 text-sm mt-2">{Math.round(effectiveConfidence)}% confidence</p>
          </div>
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {layers.aurora && !hasChartOverlay && displaySignal !== "IDLE" && orbColors && (
          <motion.div
            key={`${displaySignal}-${labelMode}`}
            className="absolute inset-0 flex flex-col items-center justify-center scale-[0.8]"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              className="relative"
              style={{
                width: 126 * confidenceScale,
                height: displaySignal === "HOLD" ? 140 * confidenceScale : 126 * confidenceScale,
              }}
              animate={{
                scale: [1, 1.01 + effectiveConfidence / 5000, 1],
              }}
              transition={{
                duration: 4 + (100 - effectiveConfidence) / 50,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }}
            >
              <div
                className="absolute blur-3xl"
                style={{
                  inset: -80 * confidenceScale,
                  borderRadius: organicShapes.layer1,
                  background: `radial-gradient(ellipse at center, ${orbColors.glow}, transparent 70%)`,
                }}
              />
              <div
                className="absolute blur-2xl"
                style={{
                  inset: -40 * confidenceScale,
                  borderRadius: organicShapes.layer2,
                  background: `radial-gradient(ellipse at center, ${orbColors.outer}, transparent 70%)`,
                }}
              />
              <div
                className="absolute blur-xl"
                style={{
                  inset: -15 * confidenceScale,
                  borderRadius: organicShapes.layer3,
                  background: `radial-gradient(ellipse at center, ${orbColors.mid}, transparent 65%)`,
                }}
              />
              <div
                className="absolute blur-lg"
                style={{
                  inset: 10 * confidenceScale,
                  borderRadius: organicShapes.layer4,
                  background: `radial-gradient(ellipse at center, ${orbColors.inner}, ${orbColors.mid} 60%, transparent 85%)`,
                }}
              />
              <div
                className="absolute blur-md"
                style={{
                  inset: 40 * confidenceScale,
                  borderRadius: organicShapes.layer5,
                  background: `radial-gradient(ellipse at center, ${orbColors.core}, ${orbColors.inner} 50%, transparent 80%)`,
                }}
              />
              <div
                className="absolute blur-sm"
                style={{
                  inset: 60 * confidenceScale,
                  borderRadius: organicShapes.layer6,
                  background: `radial-gradient(ellipse at center, ${orbColors.brightCore}, ${orbColors.core} 50%, transparent 75%)`,
                }}
              />
            </motion.div>

            <motion.div
              className="mt-8 text-center cursor-pointer select-none"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              onClick={() => setLabelMode((prev) => (prev === "BUYSELL" ? "CALLPUT" : "BUYSELL"))}
            >
              <h2 className={`text-4xl font-light tracking-[0.3em] ${orbColors.text}`}>{displaySignal}</h2>
              <p className="text-white/50 text-base mt-2">{Math.round(effectiveConfidence)}% confidence</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {layers.aurora && !hasChartOverlay && displaySignal !== "IDLE" && (
        <button
          onClick={() => setLabelMode((prev) => (prev === "BUYSELL" ? "CALLPUT" : "BUYSELL"))}
          className="absolute top-3 left-3 px-2 py-1 text-[9px] text-white/40 uppercase tracking-wider border border-white/10 rounded hover:bg-white/5 transition-colors"
        >
          {labelMode === "BUYSELL" ? "Buy/Sell" : "Call/Put"}
        </button>
      )}

      {hasChartOverlay && (
        <div className="absolute top-4 left-4 flex items-center gap-3">
          <div
            className={`w-2 h-2 rounded-full ${
              signal === "BUY" ? "bg-green-400" : signal === "SELL" ? "bg-red-400" : "bg-gray-400"
            }`}
          />
          <span className="text-white/60 text-sm font-light tracking-wider">{signal}</span>
          <span className="text-white/30 text-xs">{confidence.toFixed(2)}%</span>
        </div>
      )}

      <div className="absolute bottom-3 left-3 flex items-center gap-2 text-[10px] text-white/30 uppercase tracking-wider">
        <span>{timeframe}M</span>
        <span className="w-px h-3 bg-white/20" />
        <span>${budget >= 1000 ? `${(budget / 1000).toFixed(1)}K` : budget}</span>
      </div>

      {/* Supertrend Triangular Indicators - 30m, 1h, 4h */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-2 items-end">
        {(["30m", "1h", "4h"] as const).map((tf) => {
          // Map longer timeframes to available signals or derive from trend
          const sigMap = {
            "30m": superTrendSignals["15m"],
            "1h": superTrendSignals["5m"],
            "4h": superTrendSignals["1m"],
          }
          const sig = sigMap[tf]
          const isUp = sig === "BUY"
          const isDown = sig === "SELL"
          
          return (
            <div key={tf} className="flex items-center gap-1" title={`${tf}: ${sig}`}>
              <span className="text-[7px] text-white/30 font-medium">{tf}</span>
              {/* Triangular indicator */}
              <div
                className={`w-0 h-0 ${
                  isUp
                    ? "border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[6px] border-b-cyan-400"
                    : isDown
                      ? "border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-[#ec3b70]"
                      : "border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[6px] border-b-white/30"
                }`}
              />
            </div>
          )
        })}
      </div>

      <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
        <button
          onClick={() => toggleLayer("aurora")}
          className={`w-7 h-7 rounded-md flex items-center justify-center transition-all ${
            layers.aurora ? "bg-white/20 text-white" : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
          }`}
          title="Aurora Signal (On/Off)"
        >
          <Circle className="w-3.5 h-3.5 fill-current" />
        </button>
        <button
          onClick={() => toggleLayer("candles")}
          className={`w-7 h-7 rounded-md flex items-center justify-center transition-all ${
            layers.candles ? "bg-white/20 text-white" : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
          }`}
          title="Candlestick (On/Off)"
        >
          <BarChart3 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => toggleLayer("whiteGlow")}
          className={`w-7 h-7 rounded-md flex items-center justify-center transition-all ${
            layers.whiteGlow
              ? "bg-white/20 text-white"
              : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
          }`}
          title="White Glow (On/Off)"
        >
          <Circle className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => toggleLayer("lineWave")}
          className={`w-7 h-7 rounded-md flex items-center justify-center transition-all ${
            layers.lineWave
              ? "bg-white/20 text-white"
              : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
          }`}
          title="Line Wave (On/Off)"
        >
          <Activity className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => toggleLayer("pivotPanel")}
          className={`w-7 h-7 rounded-md flex items-center justify-center transition-all ${
            layers.pivotPanel
              ? "bg-white/20 text-white"
              : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
          }`}
          title="Pivot Threshold Panel (On/Off)"
        >
          <TrendingUp className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

export default AuroraSignalChart
