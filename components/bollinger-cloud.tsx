"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

interface BollingerCloudProps {
  currentPrice: number
  upper: number
  middle: number
  lower: number
  priceHistory?: number[]
  trend: "up" | "down" | "neutral"
  className?: string
}

export function BollingerCloud({
  currentPrice,
  upper,
  middle,
  lower,
  priceHistory = [],
  trend,
  className,
}: BollingerCloudProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const animationRef = useRef<number>(0)
  const timeRef = useRef(0)

  console.log("[v0] BollingerCloud render - currentPrice:", currentPrice, "upper:", upper, "lower:", lower)

  const validUpper = upper && !isNaN(upper) && upper > 0 ? upper : currentPrice * 1.02
  const validMiddle = middle && !isNaN(middle) && middle > 0 ? middle : currentPrice
  const validLower = lower && !isNaN(lower) && lower > 0 ? lower : currentPrice * 0.98

  const finalUpper = Math.max(validUpper, validLower + 0.01)
  const finalLower = Math.min(validLower, validUpper - 0.01)
  const finalMiddle = validMiddle

  const history =
    priceHistory.length > 10
      ? priceHistory.slice(-50)
      : Array.from({ length: 50 }, (_, i) => {
          const progress = i / 49
          const noise = Math.sin(i * 0.3) * (finalUpper - finalLower) * 0.1
          return finalMiddle + (currentPrice - finalMiddle) * progress + noise
        })

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) {
      console.log("[v0] BollingerCloud - missing refs", { container: !!container, canvas: !!canvas })
      return
    }

    const updateDimensions = () => {
      const rect = container.getBoundingClientRect()
      console.log("[v0] BollingerCloud container rect:", rect.width, rect.height)

      if (rect.width === 0 || rect.height === 0) {
        console.log("[v0] BollingerCloud - zero dimensions, retrying...")
        return
      }

      const dpr = window.devicePixelRatio || 1
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      setDimensions({ width: rect.width, height: rect.height })
      console.log("[v0] BollingerCloud dimensions set:", rect.width, rect.height)
    }

    // Initial update
    updateDimensions()

    // Retry after delays to handle late layout
    const t1 = setTimeout(updateDimensions, 50)
    const t2 = setTimeout(updateDimensions, 150)
    const t3 = setTimeout(updateDimensions, 300)

    window.addEventListener("resize", updateDimensions)
    return () => {
      window.removeEventListener("resize", updateDimensions)
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || dimensions.width === 0 || dimensions.height === 0) {
      console.log("[v0] BollingerCloud - skipping draw, dimensions:", dimensions)
      return
    }

    const ctx = canvas.getContext("2d")
    if (!ctx) {
      console.log("[v0] BollingerCloud - no canvas context")
      return
    }

    console.log("[v0] BollingerCloud - starting animation with dimensions:", dimensions)

    const dpr = window.devicePixelRatio || 1
    ctx.scale(dpr, dpr)

    const { width, height } = dimensions
    const padding = { top: 30, bottom: 40, left: 10, right: 10 }
    const chartWidth = width - padding.left - padding.right
    const chartHeight = height - padding.top - padding.bottom

    const priceMin = Math.min(finalLower * 0.999, ...history)
    const priceMax = Math.max(finalUpper * 1.001, ...history)
    const priceRange = priceMax - priceMin || 1

    const priceToY = (price: number) => {
      return padding.top + chartHeight - ((price - priceMin) / priceRange) * chartHeight
    }

    const animate = () => {
      timeRef.current += 0.015
      ctx.clearRect(0, 0, width, height)

      const bgGradient = ctx.createLinearGradient(0, 0, width, height)
      if (trend === "up") {
        bgGradient.addColorStop(0, "rgba(16, 185, 129, 0.03)")
        bgGradient.addColorStop(0.5, "rgba(6, 182, 212, 0.02)")
        bgGradient.addColorStop(1, "rgba(16, 185, 129, 0.03)")
      } else if (trend === "down") {
        bgGradient.addColorStop(0, "rgba(236, 59, 112, 0.03)")
        bgGradient.addColorStop(0.5, "rgba(192, 38, 96, 0.02)")
        bgGradient.addColorStop(1, "rgba(236, 59, 112, 0.03)")
      } else {
        bgGradient.addColorStop(0, "rgba(255, 255, 255, 0.02)")
        bgGradient.addColorStop(1, "rgba(255, 255, 255, 0.01)")
      }
      ctx.fillStyle = bgGradient
      ctx.fillRect(0, 0, width, height)

      const drawAuroraCloud = (yBase: number, intensity: number, isUpper: boolean) => {
        ctx.beginPath()
        ctx.moveTo(padding.left, yBase)

        for (let x = padding.left; x <= width - padding.right; x += 2) {
          const progress = (x - padding.left) / chartWidth
          const wave1 = Math.sin(progress * Math.PI * 3 + timeRef.current) * 8
          const wave2 = Math.sin(progress * Math.PI * 5 + timeRef.current * 1.5) * 4
          const wave3 = Math.sin(progress * Math.PI * 2 + timeRef.current * 0.7) * 6
          const y = yBase + (wave1 + wave2 + wave3) * intensity
          ctx.lineTo(x, y)
        }

        ctx.lineTo(width - padding.right, isUpper ? padding.top : height - padding.bottom)
        ctx.lineTo(padding.left, isUpper ? padding.top : height - padding.bottom)
        ctx.closePath()

        const cloudGradient = ctx.createLinearGradient(0, yBase, 0, isUpper ? padding.top : height - padding.bottom)
        if (trend === "up") {
          cloudGradient.addColorStop(0, "rgba(16, 185, 129, 0.15)")
          cloudGradient.addColorStop(0.5, "rgba(6, 182, 212, 0.08)")
          cloudGradient.addColorStop(1, "rgba(16, 185, 129, 0.02)")
        } else if (trend === "down") {
          cloudGradient.addColorStop(0, "rgba(236, 59, 112, 0.15)")
          cloudGradient.addColorStop(0.5, "rgba(192, 38, 96, 0.08)")
          cloudGradient.addColorStop(1, "rgba(236, 59, 112, 0.02)")
        } else {
          cloudGradient.addColorStop(0, "rgba(255, 255, 255, 0.1)")
          cloudGradient.addColorStop(1, "rgba(255, 255, 255, 0.02)")
        }
        ctx.fillStyle = cloudGradient
        ctx.fill()
      }

      const upperY = priceToY(finalUpper)
      const lowerY = priceToY(finalLower)
      drawAuroraCloud(upperY, 0.3, true)
      drawAuroraCloud(lowerY, 0.3, false)

      ctx.beginPath()
      for (let x = padding.left; x <= width - padding.right; x += 2) {
        const progress = (x - padding.left) / chartWidth
        const wave = Math.sin(progress * Math.PI * 4 + timeRef.current) * 3
        const y = upperY + wave
        if (x === padding.left) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      for (let x = width - padding.right; x >= padding.left; x -= 2) {
        const progress = (x - padding.left) / chartWidth
        const wave = Math.sin(progress * Math.PI * 4 + timeRef.current) * 3
        const y = lowerY + wave
        ctx.lineTo(x, y)
      }
      ctx.closePath()

      const bandGradient = ctx.createLinearGradient(0, upperY, 0, lowerY)
      if (trend === "up") {
        bandGradient.addColorStop(0, "rgba(16, 185, 129, 0.08)")
        bandGradient.addColorStop(0.5, "rgba(6, 182, 212, 0.12)")
        bandGradient.addColorStop(1, "rgba(16, 185, 129, 0.08)")
      } else if (trend === "down") {
        bandGradient.addColorStop(0, "rgba(236, 59, 112, 0.08)")
        bandGradient.addColorStop(0.5, "rgba(192, 38, 96, 0.12)")
        bandGradient.addColorStop(1, "rgba(236, 59, 112, 0.08)")
      } else {
        bandGradient.addColorStop(0, "rgba(255, 255, 255, 0.05)")
        bandGradient.addColorStop(0.5, "rgba(255, 255, 255, 0.08)")
        bandGradient.addColorStop(1, "rgba(255, 255, 255, 0.05)")
      }
      ctx.fillStyle = bandGradient
      ctx.fill()

      ctx.beginPath()
      const middleY = priceToY(finalMiddle)
      for (let x = padding.left; x <= width - padding.right; x += 2) {
        const progress = (x - padding.left) / chartWidth
        const wave = Math.sin(progress * Math.PI * 3 + timeRef.current * 0.8) * 2
        const y = middleY + wave
        if (x === padding.left) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)"
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.stroke()
      ctx.setLineDash([])

      ctx.beginPath()
      history.forEach((price, i) => {
        const x = padding.left + (i / (history.length - 1)) * chartWidth
        const y = priceToY(price)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })

      const lineGradient = ctx.createLinearGradient(padding.left, 0, width - padding.right, 0)
      if (trend === "up") {
        lineGradient.addColorStop(0, "rgba(16, 185, 129, 0.3)")
        lineGradient.addColorStop(0.5, "rgba(6, 182, 212, 0.8)")
        lineGradient.addColorStop(1, "rgba(16, 185, 129, 1)")
      } else if (trend === "down") {
        lineGradient.addColorStop(0, "rgba(236, 59, 112, 0.3)")
        lineGradient.addColorStop(0.5, "rgba(192, 38, 96, 0.8)")
        lineGradient.addColorStop(1, "rgba(236, 59, 112, 1)")
      } else {
        lineGradient.addColorStop(0, "rgba(255, 255, 255, 0.3)")
        lineGradient.addColorStop(1, "rgba(255, 255, 255, 0.8)")
      }
      ctx.strokeStyle = lineGradient
      ctx.lineWidth = 2
      ctx.stroke()

      const currentX = width - padding.right
      const currentY = priceToY(currentPrice)

      const glowSize = 12 + Math.sin(timeRef.current * 3) * 3
      const glowGradient = ctx.createRadialGradient(currentX, currentY, 0, currentX, currentY, glowSize)
      if (trend === "up") {
        glowGradient.addColorStop(0, "rgba(16, 185, 129, 0.8)")
        glowGradient.addColorStop(0.5, "rgba(6, 182, 212, 0.3)")
        glowGradient.addColorStop(1, "rgba(16, 185, 129, 0)")
      } else if (trend === "down") {
        glowGradient.addColorStop(0, "rgba(236, 59, 112, 0.8)")
        glowGradient.addColorStop(0.5, "rgba(192, 38, 96, 0.3)")
        glowGradient.addColorStop(1, "rgba(236, 59, 112, 0)")
      } else {
        glowGradient.addColorStop(0, "rgba(255, 255, 255, 0.8)")
        glowGradient.addColorStop(1, "rgba(255, 255, 255, 0)")
      }
      ctx.beginPath()
      ctx.arc(currentX, currentY, glowSize, 0, Math.PI * 2)
      ctx.fillStyle = glowGradient
      ctx.fill()

      ctx.beginPath()
      ctx.arc(currentX, currentY, 4, 0, Math.PI * 2)
      ctx.fillStyle = "#fff"
      ctx.fill()

      ctx.font = "10px system-ui"
      ctx.textAlign = "left"
      ctx.fillStyle =
        trend === "down"
          ? "rgba(236, 59, 112, 0.7)"
          : trend === "up"
            ? "rgba(16, 185, 129, 0.7)"
            : "rgba(255, 255, 255, 0.5)"
      ctx.fillText(`Upper $${finalUpper.toFixed(2)}`, padding.left + 4, upperY - 8)
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)"
      ctx.fillText(`SMA $${finalMiddle.toFixed(2)}`, padding.left + 4, middleY - 4)
      ctx.fillStyle =
        trend === "up"
          ? "rgba(16, 185, 129, 0.7)"
          : trend === "down"
            ? "rgba(236, 59, 112, 0.7)"
            : "rgba(255, 255, 255, 0.5)"
      ctx.fillText(`Lower $${finalLower.toFixed(2)}`, padding.left + 4, lowerY + 14)

      ctx.textAlign = "right"
      ctx.fillStyle = "#fff"
      ctx.font = "12px system-ui"
      ctx.fillText(`$${currentPrice.toFixed(2)}`, currentX - 8, currentY - 10)

      const trendLabel = trend === "up" ? "UPTREND" : trend === "down" ? "DOWNTREND" : "RANGING"
      ctx.font = "10px system-ui"
      ctx.textAlign = "right"
      ctx.fillStyle =
        trend === "up"
          ? "rgba(16, 185, 129, 0.8)"
          : trend === "down"
            ? "rgba(236, 59, 112, 0.8)"
            : "rgba(255, 255, 255, 0.5)"
      ctx.fillText(trendLabel, width - padding.right, padding.top - 10)

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [dimensions, currentPrice, finalUpper, finalMiddle, finalLower, history, trend])

  const positionStatus =
    currentPrice >= finalUpper
      ? "overbought"
      : currentPrice <= finalLower
        ? "oversold"
        : currentPrice > finalMiddle
          ? "above-sma"
          : "below-sma"

  return (
    <div className={cn("glass-frost rounded-3xl p-4 flex flex-col", className)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white/40 text-xs uppercase tracking-wider">Bollinger Cloud</p>
          <p className="text-white/60 text-xs mt-0.5">20-period, 2 std dev</p>
        </div>
        <div
          className={`px-3 py-1 rounded-full text-xs ${
            positionStatus === "overbought"
              ? "bg-[#ec3b70]/20 text-[#ec3b70]"
              : positionStatus === "oversold"
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-white/10 text-white/60"
          }`}
        >
          {positionStatus === "overbought" && "Near Upper Band"}
          {positionStatus === "oversold" && "Near Lower Band"}
          {positionStatus === "above-sma" && "Above SMA"}
          {positionStatus === "below-sma" && "Below SMA"}
        </div>
      </div>

      <div
        ref={containerRef}
        className="w-full h-[160px] rounded-2xl mt-3 relative"
        style={{ background: "rgba(0, 0, 0, 0.3)" }}
      >
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      </div>

      <div className="grid grid-cols-3 gap-2 pt-3">
        <div className="text-center">
          <p className="text-white/40 text-xs">Bandwidth</p>
          <p className="text-white text-sm font-light">
            {(((finalUpper - finalLower) / finalMiddle) * 100).toFixed(1)}%
          </p>
        </div>
        <div className="text-center">
          <p className="text-white/40 text-xs">Position</p>
          <p className={`text-sm font-light ${currentPrice > finalMiddle ? "text-emerald-400" : "text-[#ec3b70]"}`}>
            {currentPrice > finalMiddle ? "+" : ""}
            {(((currentPrice - finalMiddle) / finalMiddle) * 100).toFixed(2)}%
          </p>
        </div>
        <div className="text-center">
          <p className="text-white/40 text-xs">To Band</p>
          <p className={`text-sm font-light ${currentPrice > finalMiddle ? "text-[#ec3b70]" : "text-emerald-400"}`}>
            $
            {currentPrice > finalMiddle
              ? (finalUpper - currentPrice).toFixed(2)
              : (currentPrice - finalLower).toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  )
}
