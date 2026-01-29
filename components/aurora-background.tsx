"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"

export function AuroraBackground({ children }: { children?: ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const readyTimer = setTimeout(() => {
      setIsReady(true)
    }, 500)

    return () => clearTimeout(readyTimer)
  }, [])

  useEffect(() => {
    if (!isReady) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d", {
      alpha: false,
      desynchronized: true,
    })
    if (!ctx) return

    let animationId: number
    let time = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      ctx.scale(dpr, dpr)
    }
    resize()
    window.addEventListener("resize", resize)

    // Aurora color palette - soothing, wellness-inspired
    const colors = [
      { r: 64, g: 180, b: 166 }, // Teal
      { r: 120, g: 100, b: 200 }, // Soft purple
      { r: 180, g: 120, b: 200 }, // Lavender
      { r: 100, g: 150, b: 220 }, // Sky blue
      { r: 80, g: 200, b: 160 }, // Mint
      { r: 200, g: 140, b: 180 }, // Rose
    ]

    interface Orb {
      x: number
      y: number
      radius: number
      color: (typeof colors)[0]
      speedX: number
      speedY: number
      phase: number
    }

    const width = window.innerWidth
    const height = window.innerHeight

    const orbs: Orb[] = colors.map((color, i) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: 200 + Math.random() * 300,
      color,
      speedX: (Math.random() - 0.5) * 0.3,
      speedY: (Math.random() - 0.5) * 0.3,
      phase: (i / colors.length) * Math.PI * 2,
    }))

    const noiseCanvas = document.createElement("canvas")
    const noiseSize = 128
    noiseCanvas.width = noiseSize
    noiseCanvas.height = noiseSize
    const noiseCtx = noiseCanvas.getContext("2d")
    if (noiseCtx) {
      const noiseData = noiseCtx.createImageData(noiseSize, noiseSize)
      for (let i = 0; i < noiseData.data.length; i += 4) {
        const noise = Math.random() * 20 - 10
        noiseData.data[i] = noise
        noiseData.data[i + 1] = noise
        noiseData.data[i + 2] = noise
        noiseData.data[i + 3] = 15 // Very subtle alpha
      }
      noiseCtx.putImageData(noiseData, 0, 0)
    }

    const animate = () => {
      time += 0.003

      const w = window.innerWidth
      const h = window.innerHeight

      // Dark background with slight transparency for trail effect
      ctx.fillStyle = "rgba(15, 15, 25, 0.15)"
      ctx.fillRect(0, 0, w, h)

      orbs.forEach((orb) => {
        // Slow, organic movement
        orb.x += Math.sin(time + orb.phase) * 0.5 + orb.speedX
        orb.y += Math.cos(time * 0.7 + orb.phase) * 0.5 + orb.speedY

        // Wrap around edges smoothly
        if (orb.x < -orb.radius) orb.x = w + orb.radius
        if (orb.x > w + orb.radius) orb.x = -orb.radius
        if (orb.y < -orb.radius) orb.y = h + orb.radius
        if (orb.y > h + orb.radius) orb.y = -orb.radius

        // Pulsing radius
        const pulseRadius = orb.radius + Math.sin(time * 2 + orb.phase) * 50

        const gradient = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, pulseRadius)

        const alpha = 0.15 + Math.sin(time + orb.phase) * 0.05
        gradient.addColorStop(0, `rgba(${orb.color.r}, ${orb.color.g}, ${orb.color.b}, ${alpha})`)
        gradient.addColorStop(0.2, `rgba(${orb.color.r}, ${orb.color.g}, ${orb.color.b}, ${alpha * 0.8})`)
        gradient.addColorStop(0.4, `rgba(${orb.color.r}, ${orb.color.g}, ${orb.color.b}, ${alpha * 0.6})`)
        gradient.addColorStop(0.6, `rgba(${orb.color.r}, ${orb.color.g}, ${orb.color.b}, ${alpha * 0.4})`)
        gradient.addColorStop(0.8, `rgba(${orb.color.r}, ${orb.color.g}, ${orb.color.b}, ${alpha * 0.2})`)
        gradient.addColorStop(1, `rgba(${orb.color.r}, ${orb.color.g}, ${orb.color.b}, 0)`)

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(orb.x, orb.y, pulseRadius, 0, Math.PI * 2)
        ctx.fill()
      })

      if (noiseCtx) {
        ctx.globalAlpha = 0.03
        ctx.globalCompositeOperation = "overlay"
        const pattern = ctx.createPattern(noiseCanvas, "repeat")
        if (pattern) {
          ctx.fillStyle = pattern
          ctx.fillRect(0, 0, w, h)
        }
        ctx.globalAlpha = 1
        ctx.globalCompositeOperation = "source-over"
      }

      animationId = requestAnimationFrame(animate)
    }

    // Initial fill
    ctx.fillStyle = "rgb(15, 15, 25)"
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight)

    animate()

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener("resize", resize)
    }
  }, [isReady])

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 -z-10"
        style={{
          background: "rgb(15, 15, 25)",
          imageRendering: "auto",
          opacity: isReady ? 1 : 0,
          transition: "opacity 0.5s ease-in-out",
        }}
      />
      {children}
    </>
  )
}
