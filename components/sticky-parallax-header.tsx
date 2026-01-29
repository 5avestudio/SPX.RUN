"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Wifi, WifiOff } from "lucide-react"
import { TimeframeWidget } from "./timeframe-widget"

interface StickyParallaxHeaderProps {
  symbol: string
  dateString: string
  dataSource: "finnhub" | "mock"
  isConnected: boolean
  price: number
  priceChange: number
  priceChangePercent: number
  timeframe: string
  onTimeframeChange: (timeframe: string) => void
}

export function StickyParallaxHeader({
  symbol,
  dateString,
  dataSource,
  isConnected,
  price,
  priceChange,
  priceChangePercent,
  timeframe,
  onTimeframeChange,
}: StickyParallaxHeaderProps) {
  const [scrollY, setScrollY] = useState(0)
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY)
      setIsScrolled(window.scrollY > 60)
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const parallaxOffset = Math.min(scrollY * 0.4, 40)
  const opacity = Math.max(1 - scrollY / 250, 0.7)
  const scale = Math.max(1 - scrollY / 1200, 0.88)
  const blur = Math.min(scrollY / 100, 1)

  return (
    <header
      className={cn(
        "sticky-header px-5 pt-14 pb-4 transition-all duration-500 ease-out",
        isScrolled && "scrolled pt-4 pb-3",
      )}
      style={{
        backdropFilter: isScrolled ? `blur(${20 + blur * 10}px)` : "none",
        WebkitBackdropFilter: isScrolled ? `blur(${20 + blur * 10}px)` : "none",
      }}
    >
      <div className="absolute top-14 right-5 z-20">
        <TimeframeWidget value={timeframe} onChange={onTimeframeChange} />
      </div>

      <div
        style={{
          transform: `translateY(-${parallaxOffset}px) scale(${scale})`,
          opacity,
          transformOrigin: "left top",
        }}
        className="transition-transform duration-150 ease-out"
      >
        <p className="text-white/40 text-sm tracking-wide">Market Analysis · {dateString}</p>
        <h1
          className={cn(
            "font-light tracking-tight mt-1 transition-all duration-500 ease-out",
            isScrolled ? "text-2xl" : "text-4xl",
          )}
        >
          {symbol}
        </h1>

        {isScrolled && (
          <div className="flex items-center gap-3 mt-1 animate-fade-up">
            <span className="text-lg font-light">${price.toFixed(2)}</span>
            <span
              className={cn(
                "text-sm font-medium",
                priceChange >= 0
                  ? "bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent"
                  : "bg-gradient-to-r from-[#ec3b70] to-[#db2760] bg-clip-text text-transparent",
              )}
            >
              {priceChange >= 0 ? "+" : ""}
              {priceChangePercent.toFixed(2)}%
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 mt-3">
        <span className="text-white/50 text-sm">{dataSource === "finnhub" ? "Live Data" : "Simulated"}</span>
        {isConnected ? <Wifi className="w-4 h-4 text-emerald-400" /> : <WifiOff className="w-4 h-4 text-white/30" />}
      </div>
    </header>
  )
}
