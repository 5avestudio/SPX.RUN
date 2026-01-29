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

interface CandleChartProps {
  data: CandleData[]
  currentPrice: number
  signal: string
  pivotLevels?: {
    pivot: number
    r1: number
    r2: number
    s1: number
    s2: number
  }
  className?: string
}

export function CandleChart({ data, currentPrice, signal, pivotLevels, className }: CandleChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const animationRef = useRef<number>(0)
  const timeRef = useRef(0)

  const candles = data.slice(-30)

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
    const padding = { top: 30, bottom: 50, left: 10, right: 60 }
    const chartWidth = width - padding.left - padding.right
    const chartHeight = height - padding.top - padding.bottom

    const allPrices = candles.flatMap((c) => [c.high, c.low])
    if (pivotLevels) {
      allPrices.push(pivotLevels.r2, pivotLevels.s2)
    }
    const priceMin = Math.min(...allPrices) * 0.9995
    const priceMax = Math.max(...allPrices) * 1.0005
    const priceRange = priceMax - priceMin

    const priceToY = (price: number) => {
      return padding.top + chartHeight - ((price - priceMin) / priceRange) * chartHeight
    }

    const candleWidth = chartWidth / candles.length
    const candleBodyWidth = candleWidth * 0.6

    const animate = () => {
      timeRef.current += 0.02
      ctx.clearRect(0, 0, width, height)

      const bgGradient = ctx.createRadialGradient(
        width * 0.3 + Math.sin(timeRef.current * 0.5) * 30,
        height * 0.5,
        0,
        width * 0.3,
        height * 0.5,
        height,
      )
      if (signalType === "buy") {
        bgGradient.addColorStop(0, "rgba(16, 185, 129, 0.06)")
        bgGradient.addColorStop(0.5, "rgba(6, 182, 212, 0.03)")
        bgGradient.addColorStop(1, "transparent")
      } else if (signalType === "sell") {
        bgGradient.addColorStop(0, "rgba(236, 59, 112, 0.06)")
        bgGradient.addColorStop(0.5, "rgba(192, 38, 96, 0.03)")
        bgGradient.addColorStop(1, "transparent")
      } else {
        bgGradient.addColorStop(0, "rgba(255, 255, 255, 0.03)")
        bgGradient.addColorStop(1, "transparent")
      }
      ctx.fillStyle = bgGradient
      ctx.fillRect(0, 0, width, height)

      if (pivotLevels) {
        const levels = [
          { label: "R2", value: pivotLevels.r2, color: "rgba(236, 59, 112, 0.3)" },
          { label: "R1", value: pivotLevels.r1, color: "rgba(236, 59, 112, 0.2)" },
          { label: "PP", value: pivotLevels.pivot, color: "rgba(255, 255, 255, 0.2)" },
          { label: "S1", value: pivotLevels.s1, color: "rgba(16, 185, 129, 0.2)" },
          { label: "S2", value: pivotLevels.s2, color: "rgba(16, 185, 129, 0.3)" },
        ]

        levels.forEach((level) => {
          if (!level.value) return
          const y = priceToY(level.value)
          if (y < padding.top || y > height - padding.bottom) return

          ctx.beginPath()
          ctx.moveTo(padding.left, y)
          ctx.lineTo(width - padding.right, y)
          ctx.strokeStyle = level.color
          ctx.lineWidth = 1
          ctx.setLineDash([4, 4])
          ctx.stroke()
          ctx.setLineDash([])

          ctx.font = "9px system-ui"
          ctx.fillStyle = level.color.replace("0.2", "0.6").replace("0.3", "0.7")
          ctx.textAlign = "right"
          ctx.fillText(`${level.label} $${level.value.toFixed(0)}`, width - padding.right + 55, y + 3)
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

        ctx.fillStyle = isGreen ? "rgba(16, 185, 129, 0.8)" : "rgba(236, 59, 112, 0.8)"
        ctx.fillRect(x - candleBodyWidth / 2, bodyTop, candleBodyWidth, bodyHeight)

        if (i === candles.length - 1) {
          const glowGradient = ctx.createRadialGradient(
            x,
            (bodyTop + bodyBottom) / 2,
            0,
            x,
            (bodyTop + bodyBottom) / 2,
            20,
          )
          if (isGreen) {
            glowGradient.addColorStop(0, "rgba(16, 185, 129, 0.4)")
            glowGradient.addColorStop(1, "transparent")
          } else {
            glowGradient.addColorStop(0, "rgba(236, 59, 112, 0.4)")
            glowGradient.addColorStop(1, "transparent")
          }
          ctx.beginPath()
          ctx.arc(x, (bodyTop + bodyBottom) / 2, 20, 0, Math.PI * 2)
          ctx.fillStyle = glowGradient
          ctx.fill()
        }
      })

      const priceY = priceToY(currentPrice)
      const pulse = Math.sin(timeRef.current * 3) * 0.3 + 0.7

      ctx.beginPath()
      ctx.moveTo(padding.left, priceY)
      ctx.lineTo(width - padding.right, priceY)
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 * pulse})`
      ctx.lineWidth = 1
      ctx.stroke()

      const ballX = width - padding.right
      const glowSize = 10 + Math.sin(timeRef.current * 3) * 2

      const ballGlow = ctx.createRadialGradient(ballX, priceY, 0, ballX, priceY, glowSize)
      ballGlow.addColorStop(0, "rgba(255, 255, 255, 0.8)")
      ballGlow.addColorStop(0.5, "rgba(255, 255, 255, 0.3)")
      ballGlow.addColorStop(1, "transparent")
      ctx.beginPath()
      ctx.arc(ballX, priceY, glowSize, 0, Math.PI * 2)
      ctx.fillStyle = ballGlow
      ctx.fill()

      ctx.beginPath()
      ctx.arc(ballX, priceY, 4, 0, Math.PI * 2)
      ctx.fillStyle = "#fff"
      ctx.fill()

      ctx.font = "bold 11px system-ui"
      ctx.fillStyle = "#fff"
      ctx.textAlign = "right"
      ctx.fillText(`$${currentPrice.toFixed(2)}`, ballX - 12, priceY - 8)

      const signalLabel = signalType === "buy" ? "BUY ZONE" : signalType === "sell" ? "SELL ZONE" : "HOLD"
      const signalColor =
        signalType === "buy"
          ? "rgba(16, 185, 129, 0.9)"
          : signalType === "sell"
            ? "rgba(236, 59, 112, 0.9)"
            : "rgba(255, 255, 255, 0.6)"

      ctx.font = "bold 10px system-ui"
      ctx.fillStyle = signalColor
      ctx.textAlign = "left"
      ctx.fillText(signalLabel, padding.left + 4, padding.top - 10)

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [dimensions, candles, currentPrice, signalType, pivotLevels])

  const suggestedEntry =
    signalType === "buy" && pivotLevels?.s1
      ? pivotLevels.s1
      : signalType === "sell" && pivotLevels?.r1
        ? pivotLevels.r1
        : currentPrice

  const entryDistance = Math.abs(currentPrice - suggestedEntry)
  const entryDirection = suggestedEntry < currentPrice ? "below" : "above"

  return (
    <div className={cn("glass-frost rounded-3xl p-4 flex flex-col", className)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white/40 text-xs uppercase tracking-wider">Price Action</p>
          <p className="text-white/60 text-xs mt-0.5">30 candles</p>
        </div>
        <div
          className={cn(
            "px-3 py-1 rounded-full text-xs",
            signalType === "buy"
              ? "bg-emerald-500/20 text-emerald-400"
              : signalType === "sell"
                ? "bg-[#ec3b70]/20 text-[#ec3b70]"
                : "bg-white/10 text-white/60",
          )}
        >
          {signalType === "buy" ? "Bullish" : signalType === "sell" ? "Bearish" : "Neutral"}
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full flex-1 min-h-0 rounded-2xl mt-3"
        style={{ background: "rgba(0, 0, 0, 0.3)" }}
      />

      <div className="grid grid-cols-2 gap-3 pt-3">
        <div className="bg-white/5 rounded-xl p-3 border border-white/10">
          <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Suggested Entry</p>
          <p
            className={cn(
              "text-lg font-light",
              signalType === "buy" ? "text-emerald-400" : signalType === "sell" ? "text-[#ec3b70]" : "text-white/70",
            )}
          >
            ${suggestedEntry.toFixed(2)}
          </p>
          <p className="text-white/30 text-xs mt-1">
            ${entryDistance.toFixed(2)} {entryDirection}
          </p>
        </div>
        <div className="bg-white/5 rounded-xl p-3 border border-white/10">
          <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Action</p>
          <p
            className={cn(
              "text-lg font-light",
              signalType === "buy" ? "text-emerald-400" : signalType === "sell" ? "text-[#ec3b70]" : "text-white/70",
            )}
          >
            {signalType === "buy" ? "Wait for S1" : signalType === "sell" ? "Wait for R1" : "Monitor"}
          </p>
          <p className="text-white/30 text-xs mt-1">
            {signalType === "buy" ? "CALL entry" : signalType === "sell" ? "PUT entry" : "No action"}
          </p>
        </div>
      </div>
    </div>
  )
}
