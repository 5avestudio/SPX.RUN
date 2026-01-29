"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface OpenCardProps {
  children: ReactNode
  className?: string
  variant?: "default" | "highlight" | "large"
  signal?: "BUY" | "SELL" | "HOLD"
  onClick?: () => void
}

export function OpenCard({ children, className, variant = "default", signal, onClick }: OpenCardProps) {
  const auroraClass = signal === "BUY" ? "aurora-card-buy" : signal === "SELL" ? "aurora-card-sell" : ""

  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-2xl glass-frost transition-all duration-300 press-effect card-glow relative overflow-hidden",
        variant === "highlight" && "border-primary/30 bg-primary/5",
        variant === "large" && "min-h-[280px]",
        onClick && "cursor-pointer",
        auroraClass,
        className,
      )}
    >
      {children}
    </div>
  )
}

interface OpenCardHeaderProps {
  children: ReactNode
  className?: string
}

export function OpenCardHeader({ children, className }: OpenCardHeaderProps) {
  return <div className={cn("px-5 pt-5 pb-2 relative z-10", className)}>{children}</div>
}

interface OpenCardContentProps {
  children: ReactNode
  className?: string
}

export function OpenCardContent({ children, className }: OpenCardContentProps) {
  return <div className={cn("px-5 pb-5 relative z-10", className)}>{children}</div>
}

interface OpenCardTitleProps {
  children: ReactNode
  className?: string
}

export function OpenCardTitle({ children, className }: OpenCardTitleProps) {
  return <h3 className={cn("text-xs uppercase tracking-[0.2em] text-white/40 font-normal", className)}>{children}</h3>
}
