"use client"

import type * as React from "react"
import { useRef, useState, useEffect } from "react"
import { cn } from "@/lib/utils"

interface SwipeContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function SwipeContainer({ children, className, ...props }: SwipeContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [velocity, setVelocity] = useState(0)
  const lastX = useRef(0)
  const lastTime = useRef(0)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let animationId: number

    const decelerate = () => {
      if (Math.abs(velocity) > 0.5) {
        container.scrollLeft -= velocity
        setVelocity((v) => v * 0.95)
        animationId = requestAnimationFrame(decelerate)
      }
    }

    if (!isDragging && Math.abs(velocity) > 0.5) {
      animationId = requestAnimationFrame(decelerate)
    }

    return () => cancelAnimationFrame(animationId)
  }, [isDragging, velocity])

  const handleTouchStart = (e: React.TouchEvent) => {
    const container = containerRef.current
    if (!container) return
    setIsDragging(true)
    setStartX(e.touches[0].pageX - container.offsetLeft)
    setScrollLeft(container.scrollLeft)
    lastX.current = e.touches[0].pageX
    lastTime.current = Date.now()
    setVelocity(0)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return
    const container = containerRef.current
    if (!container) return

    const x = e.touches[0].pageX - container.offsetLeft
    const walk = (x - startX) * 1.5
    container.scrollLeft = scrollLeft - walk

    const now = Date.now()
    const dt = now - lastTime.current
    if (dt > 0) {
      setVelocity(((e.touches[0].pageX - lastX.current) / dt) * 15)
    }
    lastX.current = e.touches[0].pageX
    lastTime.current = now
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
  }

  return (
    <div
      ref={containerRef}
      className={cn("overflow-x-auto scrollbar-hide scroll-smooth", isDragging && "cursor-grabbing", className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      {...props}
    >
      {children}
    </div>
  )
}
