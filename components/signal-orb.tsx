"use client"

import { useRef, useEffect } from "react"
import { cn } from "@/lib/utils"

interface SignalOrbProps {
  signal: string // Accept any string signal and normalize it internally
  confidence: number
  className?: string
}

export function SignalOrb({ signal, confidence, className }: SignalOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const normalizedSignal = (() => {
    const upperSignal = signal.toUpperCase()
    if (upperSignal.includes("BUY")) return "BUY"
    if (upperSignal.includes("SELL")) return "SELL"
    return "HOLD"
  })() as "BUY" | "SELL" | "HOLD"

  // BUY: green -> teal -> blue -> violet
  const colorPalettes = {
    BUY: [
      { r: 16, g: 185, b: 129 }, // emerald/green
      { r: 20, g: 184, b: 166 }, // teal
      { r: 59, g: 130, b: 246 }, // blue
      { r: 139, g: 92, b: 246 }, // violet
    ],
    SELL: [
      { r: 236, g: 59, b: 112 }, // custom cooler red
      { r: 219, g: 39, b: 95 }, // slightly darker
      { r: 190, g: 30, b: 85 }, // deeper
      { r: 244, g: 90, b: 135 }, // lighter accent
    ],
    HOLD: [
      { r: 255, g: 255, b: 255 }, // white
      { r: 229, g: 231, b: 235 }, // gray-200
      { r: 209, g: 213, b: 219 }, // gray-300
      { r: 156, g: 163, b: 175 }, // gray-400
    ],
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const size = 240
    canvas.width = size
    canvas.height = size

    const colors = colorPalettes[normalizedSignal] // Use normalized signal
    let animationId: number
    let time = 0

    const draw = () => {
      time += 0.006
      ctx.clearRect(0, 0, size, size)

      const centerX = size / 2
      const centerY = size / 2

      for (let i = 0; i < 7; i++) {
        const colorIndex = i % colors.length
        const color = colors[colorIndex]
        const nextColor = colors[(colorIndex + 1) % colors.length]

        const phaseOffset = (i * Math.PI * 2) / 7
        const breathe = Math.sin(time * 0.8 + phaseOffset) * 0.3 + 1
        const radius = (35 + Math.sin(time + phaseOffset) * 20 + (confidence / 100) * 25) * breathe
        const x = centerX + Math.cos(time * 0.4 + phaseOffset) * 30 * Math.sin(time * 0.2)
        const y = centerY + Math.sin(time * 0.5 + phaseOffset) * 30 * Math.cos(time * 0.3)

        // Create gradient that blends between colors
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
        gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, 0.9)`)
        gradient.addColorStop(
          0.3,
          `rgba(${(color.r + nextColor.r) / 2}, ${(color.g + nextColor.g) / 2}, ${(color.b + nextColor.b) / 2}, 0.5)`,
        )
        gradient.addColorStop(0.7, `rgba(${nextColor.r}, ${nextColor.g}, ${nextColor.b}, 0.2)`)
        gradient.addColorStop(1, `rgba(${nextColor.r}, ${nextColor.g}, ${nextColor.b}, 0)`)

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.fill()
      }

      const pulseSize = 50 + Math.sin(time * 2) * 15 + (confidence / 100) * 10
      const centerGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, pulseSize)
      const mainColor = colors[0]
      const secondColor = colors[1]
      centerGradient.addColorStop(0, `rgba(${mainColor.r}, ${mainColor.g}, ${mainColor.b}, 0.7)`)
      centerGradient.addColorStop(0.4, `rgba(${secondColor.r}, ${secondColor.g}, ${secondColor.b}, 0.3)`)
      centerGradient.addColorStop(1, `rgba(${mainColor.r}, ${mainColor.g}, ${mainColor.b}, 0)`)

      ctx.fillStyle = centerGradient
      ctx.beginPath()
      ctx.arc(centerX, centerY, pulseSize, 0, Math.PI * 2)
      ctx.fill()

      animationId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animationId)
    }
  }, [normalizedSignal, confidence]) // Use normalized signal in dependency array

  const auroraClass =
    normalizedSignal === "BUY" ? "animate-orb-aurora-buy" : normalizedSignal === "SELL" ? "animate-orb-aurora-sell" : ""

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <div className={cn("relative", auroraClass)}>
        <canvas ref={canvasRef} className="w-44 h-44" style={{ filter: "blur(2px)" }} />
      </div>

      <div className="text-center">
        <p
          className={cn(
            "text-3xl font-light tracking-widest",
            normalizedSignal === "BUY" &&
              "bg-gradient-to-r from-emerald-400 via-teal-400 to-blue-400 bg-clip-text text-transparent",
            normalizedSignal === "SELL" &&
              "bg-gradient-to-r from-[#ec3b70] via-[#db2760] to-[#f45a87] bg-clip-text text-transparent",
            normalizedSignal === "HOLD" && "text-white",
          )}
        >
          {signal.replace(/_/g, " ")} {/* Replace underscores with spaces for display */}
        </p>
        <p className="text-white/40 text-sm mt-1">{confidence.toFixed(0)}% confidence</p>
      </div>
    </div>
  )
}
