"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

interface CandleData {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
}

interface CombinedChartProps {
  data: CandleData[]
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
  className?: string
}

export function CombinedChart({
  data,
  currentPrice,
  signal,
  pivotLevels,
  bollingerBands,
  className,
}: CombinedChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const animationRef = useRef<number>(0)
  const timeRef = useRef(0)

  const candles = data.slice(-40)

  const signalType: "buy" | "sell" | "hold" =
    signal === "BUY" || signal === "STRONG_BUY"
      ? "buy"
      : signal === "SELL" || signal === "STRONG_SELL"
        ? "sell"
        : "hold"

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const updateDimensions = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      setDimensions({ width: rect.width, height: rect.height })
    }

    updateDimensions()
    window.addEventListener("resize", updateDimensions)
    return () => window.removeEventListener("resize", updateDimensions)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || dimensions.width === 0 || candles.length === 0) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    ctx.scale(dpr, dpr)

    const { width, height } = dimensions
    const padding = { top: 40, bottom: 40, left: 50, right: 60 }
    const chartWidth = width - padding.left - padding.right
    const chartHeight = height - padding.top - padding.bottom

    const allPrices = [
      ...candles.flatMap((c) => [c.high, c.low]),
      pivotLevels.r3,
      pivotLevels.s3,
      bollingerBands.upper,
      bollingerBands.lower,
    ].filter(Boolean)
    const priceMin = Math.min(...allPrices) * 0.999
    const priceMax = Math.max(...allPrices) * 1.001
    const priceRange = priceMax - priceMin

    const priceToY = (price: number) => {
      return padding.top + chartHeight - ((price - priceMin) / priceRange) * chartHeight
    }

    const candleWidth = chartWidth / candles.length
    const candleBodyWidth = candleWidth * 0.5

    const animate = () => {
      timeRef.current += 0.015
      ctx.clearRect(0, 0, width, height)

      // Dark background
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)"
      ctx.fillRect(0, 0, width, height)

      // Aurora glow
      const auroraGradient = ctx.createRadialGradient(
        width * 0.5 + Math.sin(timeRef.current * 0.3) * 50,
        height * 0.3,
        0,
        width * 0.5,
        height * 0.3,
        height * 0.8,
      )
      if (signalType === "buy") {
        auroraGradient.addColorStop(0, "rgba(16, 185, 129, 0.08)")
        auroraGradient.addColorStop(0.5, "rgba(6, 182, 212, 0.04)")
        auroraGradient.addColorStop(1, "transparent")
      } else if (signalType === "sell") {
        auroraGradient.addColorStop(0, "rgba(236, 59, 112, 0.08)")
        auroraGradient.addColorStop(0.5, "rgba(192, 38, 96, 0.04)")
        auroraGradient.addColorStop(1, "transparent")
      } else {
        auroraGradient.addColorStop(0, "rgba(255, 255, 255, 0.04)")
        auroraGradient.addColorStop(1, "transparent")
      }
      ctx.fillStyle = auroraGradient
      ctx.fillRect(0, 0, width, height)

      // Draw Bollinger Bands cloud
      const bbUpperY = priceToY(bollingerBands.upper)
      const bbLowerY = priceToY(bollingerBands.lower)
      const bbMiddleY = priceToY(bollingerBands.middle)

      // BB Cloud fill
      ctx.beginPath()
      for (let x = padding.left; x <= width - padding.right; x += 2) {
        const progress = (x - padding.left) / chartWidth
        const wave = Math.sin(progress * Math.PI * 4 + timeRef.current) * 3
        const y = bbUpperY + wave
        if (x === padding.left) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      for (let x = width - padding.right; x >= padding.left; x -= 2) {
        const progress = (x - padding.left) / chartWidth
        const wave = Math.sin(progress * Math.PI * 4 + timeRef.current) * 3
        const y = bbLowerY + wave
        ctx.lineTo(x, y)
      }
      ctx.closePath()

      const bbGradient = ctx.createLinearGradient(0, bbUpperY, 0, bbLowerY)
      bbGradient.addColorStop(0, "rgba(99, 102, 241, 0.1)")
      bbGradient.addColorStop(0.5, "rgba(99, 102, 241, 0.15)")
      bbGradient.addColorStop(1, "rgba(99, 102, 241, 0.1)")
      ctx.fillStyle = bbGradient
      ctx.fill()

      // BB middle line
      ctx.beginPath()
      ctx.moveTo(padding.left, bbMiddleY)
      ctx.lineTo(width - padding.right, bbMiddleY)
      ctx.strokeStyle = "rgba(99, 102, 241, 0.4)"
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.stroke()
      ctx.setLineDash([])

      // Draw pivot levels
      const pivotLines = [
        { label: "R3", value: pivotLevels.r3, color: "rgba(236, 59, 112, 0.4)" },
        { label: "R2", value: pivotLevels.r2, color: "rgba(236, 59, 112, 0.3)" },
        { label: "R1", value: pivotLevels.r1, color: "rgba(236, 59, 112, 0.2)" },
        { label: "PP", value: pivotLevels.pivot, color: "rgba(255, 255, 255, 0.25)" },
        { label: "S1", value: pivotLevels.s1, color: "rgba(16, 185, 129, 0.2)" },
        { label: "S2", value: pivotLevels.s2, color: "rgba(16, 185, 129, 0.3)" },
        { label: "S3", value: pivotLevels.s3, color: "rgba(16, 185, 129, 0.4)" },
      ]

      pivotLines.forEach((level) => {
        if (!level.value) return
        const y = priceToY(level.value)
        if (y < padding.top - 10 || y > height - padding.bottom + 10) return

        ctx.beginPath()
        ctx.moveTo(padding.left, y)
        ctx.lineTo(width - padding.right, y)
        ctx.strokeStyle = level.color
        ctx.lineWidth = 1
        ctx.stroke()

        // Left label
        ctx.font = "9px system-ui"
        ctx.fillStyle = level.color.replace(/[\d.]+\)$/, "0.8)")
        ctx.textAlign = "right"
        ctx.fillText(level.label, padding.left - 5, y + 3)
      })

      // Draw candles
      candles.forEach((candle, i) => {
        const x = padding.left + i * candleWidth + candleWidth / 2
        const isGreen = candle.close >= candle.open

        const bodyTop = priceToY(Math.max(candle.open, candle.close))
        const bodyBottom = priceToY(Math.min(candle.open, candle.close))
        const bodyHeight = Math.max(bodyBottom - bodyTop, 1)

        const wickTop = priceToY(candle.high)
        const wickBottom = priceToY(candle.low)

        // Wick
        ctx.beginPath()
        ctx.moveTo(x, wickTop)
        ctx.lineTo(x, wickBottom)
        ctx.strokeStyle = isGreen ? "rgba(16, 185, 129, 0.5)" : "rgba(236, 59, 112, 0.5)"
        ctx.lineWidth = 1
        ctx.stroke()

        // Body
        ctx.fillStyle = isGreen ? "rgba(16, 185, 129, 0.85)" : "rgba(236, 59, 112, 0.85)"
        ctx.fillRect(x - candleBodyWidth / 2, bodyTop, candleBodyWidth, bodyHeight)
      })

      // Current price with glow
      const priceY = priceToY(currentPrice)
      const pulse = Math.sin(timeRef.current * 3) * 0.3 + 0.7

      ctx.beginPath()
      ctx.moveTo(padding.left, priceY)
      ctx.lineTo(width - padding.right, priceY)
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 * pulse})`
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Price ball
      const ballX = width - padding.right
      const glowSize = 12 + Math.sin(timeRef.current * 3) * 3

      const ballGlow = ctx.createRadialGradient(ballX, priceY, 0, ballX, priceY, glowSize)
      ballGlow.addColorStop(0, "rgba(255, 255, 255, 0.9)")
      ballGlow.addColorStop(0.4, "rgba(255, 255, 255, 0.4)")
      ballGlow.addColorStop(1, "transparent")
      ctx.beginPath()
      ctx.arc(ballX, priceY, glowSize, 0, Math.PI * 2)
      ctx.fillStyle = ballGlow
      ctx.fill()

      ctx.beginPath()
      ctx.arc(ballX, priceY, 5, 0, Math.PI * 2)
      ctx.fillStyle = "#fff"
      ctx.fill()

      // Price label
      ctx.font = "bold 11px system-ui"
      ctx.fillStyle = "#fff"
      ctx.textAlign = "right"
      ctx.fillText(`$${currentPrice.toFixed(2)}`, width - padding.right + 55, priceY + 4)

      // Title
      ctx.font = "bold 10px system-ui"
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)"
      ctx.textAlign = "left"
      ctx.fillText("COMBINED VIEW", padding.left, padding.top - 20)

      // Legend
      ctx.font = "9px system-ui"
      ctx.textAlign = "right"
      ctx.fillStyle = "rgba(99, 102, 241, 0.8)"
      ctx.fillText("BB Cloud", width - padding.right, padding.top - 20)
      ctx.fillStyle = "rgba(16, 185, 129, 0.8)"
      ctx.fillText("Support", width - padding.right - 55, padding.top - 20)
      ctx.fillStyle = "rgba(236, 59, 112, 0.8)"
      ctx.fillText("Resistance", width - padding.right - 100, padding.top - 20)

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [dimensions, candles, currentPrice, signalType, pivotLevels, bollingerBands])

  return (
    <div className={cn("glass-frost rounded-3xl p-4", className)}>
      <canvas ref={canvasRef} className="w-full h-72 rounded-2xl" style={{ background: "rgba(0, 0, 0, 0.3)" }} />
    </div>
  )
}
