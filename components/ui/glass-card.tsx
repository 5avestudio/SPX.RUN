"use client"

import * as React from "react"
import { useRef, useState } from "react"
import { cn } from "@/lib/utils"

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "highlight" | "success" | "danger"
  glow?: boolean
  interactive?: boolean
}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant = "default", glow = false, interactive = true, children, ...props }, ref) => {
    const cardRef = useRef<HTMLDivElement>(null)
    const [touchState, setTouchState] = useState({ x: 0, y: 0, isPressed: false })
    const [swipeOffset, setSwipeOffset] = useState(0)
    const startX = useRef(0)

    const variants = {
      default: "bg-white/[0.08] border-white/[0.12]",
      highlight: "bg-primary/[0.15] border-primary/[0.3]",
      success: "bg-emerald-500/[0.12] border-emerald-500/[0.25]",
      danger: "bg-rose-500/[0.12] border-rose-500/[0.25]",
    }

    const handleTouchStart = (e: React.TouchEvent) => {
      if (!interactive) return
      startX.current = e.touches[0].clientX
      setTouchState({ x: 0, y: 0, isPressed: true })
    }

    const handleTouchMove = (e: React.TouchEvent) => {
      if (!interactive || !touchState.isPressed) return
      const currentX = e.touches[0].clientX
      const diff = currentX - startX.current
      const dampedDiff = diff * 0.3
      setSwipeOffset(Math.max(-50, Math.min(50, dampedDiff)))
    }

    const handleTouchEnd = () => {
      if (!interactive) return
      setTouchState({ x: 0, y: 0, isPressed: false })
      setSwipeOffset(0)
    }

    return (
      <div
        ref={ref || cardRef}
        className={cn(
          "rounded-3xl border backdrop-blur-xl shadow-2xl transition-all duration-500",
          variants[variant],
          glow && "animate-glow",
          interactive && "active:scale-[0.98]",
          className,
        )}
        style={{
          transform: `translateX(${swipeOffset}px) scale(${touchState.isPressed ? 0.98 : 1})`,
          opacity: touchState.isPressed ? 0.9 : 1,
          transition: touchState.isPressed ? "none" : "all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        {...props}
      >
        {children}
      </div>
    )
  },
)
GlassCard.displayName = "GlassCard"

interface GlassCardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

const GlassCardHeader = React.forwardRef<HTMLDivElement, GlassCardHeaderProps>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("px-6 pt-6 pb-2", className)} {...props} />
))
GlassCardHeader.displayName = "GlassCardHeader"

interface GlassCardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

const GlassCardTitle = React.forwardRef<HTMLHeadingElement, GlassCardTitleProps>(({ className, ...props }, ref) => (
  <h3 ref={ref} className={cn("text-xl font-medium tracking-tight text-foreground/90", className)} {...props} />
))
GlassCardTitle.displayName = "GlassCardTitle"

interface GlassCardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

const GlassCardContent = React.forwardRef<HTMLDivElement, GlassCardContentProps>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("px-6 pb-6", className)} {...props} />
))
GlassCardContent.displayName = "GlassCardContent"

export { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent }
