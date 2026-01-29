"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { triggerHaptic } from "@/lib/haptics"
import { ChevronUp, ChevronDown } from "lucide-react"

interface TradeBudgetSliderProps {
  value: number
  onChange: (value: number) => void
  className?: string
}

const QUICK_PRESETS = [5, 50, 100, 200, 500, 1000, 2000, 5000]

export function TradeBudgetSlider({ value, onChange, className }: TradeBudgetSliderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const sliderRef = useRef<HTMLDivElement>(null)
  const lastValueRef = useRef(value)

  // Logarithmic scale for better UX
  const valueToPercent = (val: number) => {
    const minLog = Math.log(5)
    const maxLog = Math.log(5000)
    return ((Math.log(Math.max(5, val)) - minLog) / (maxLog - minLog)) * 100
  }

  const percentToValue = (percent: number) => {
    const minLog = Math.log(5)
    const maxLog = Math.log(5000)
    const logValue = minLog + (percent / 100) * (maxLog - minLog)
    return Math.round(Math.exp(logValue))
  }

  const handleMove = (clientX: number) => {
    if (!sliderRef.current) return
    const rect = sliderRef.current.getBoundingClientRect()
    const percent = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
    const newValue = percentToValue(percent)

    // Snap to presets
    const snapThreshold = 6
    for (const preset of QUICK_PRESETS) {
      const presetPercent = valueToPercent(preset)
      if (Math.abs(percent - presetPercent) < snapThreshold) {
        if (lastValueRef.current !== preset) {
          triggerHaptic("light")
          lastValueRef.current = preset
        }
        onChange(preset)
        return
      }
    }
    if (Math.abs(newValue - lastValueRef.current) > 30) {
      triggerHaptic("light")
      lastValueRef.current = newValue
    }
    onChange(newValue)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return
    handleMove(e.touches[0].clientX)
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return
    handleMove(e.clientX)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      return () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
      }
    }
  }, [isDragging])

  const percent = valueToPercent(value)
  const displayValue = value >= 1000 ? `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}K` : value.toString()

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => {
          triggerHaptic("light")
          setIsOpen(!isOpen)
        }}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-full",
          "bg-white/10 border border-white/10 backdrop-blur-sm",
          "text-xs font-medium text-white/70 tracking-wider",
          "transition-all press-effect",
          isOpen && "bg-white/20 border-white/20",
        )}
      >
        <span>${displayValue}</span>
        {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {isOpen && (
        <>
          {/* Backdrop to close */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          <div
            className={cn(
              "absolute top-full right-0 mt-2 z-50",
              "w-[240px] p-4 rounded-2xl",
              "bg-[#0a0a0a]/95 border border-white/[0.06] backdrop-blur-xl",
              "shadow-[0_8px_40px_rgba(0,0,0,0.8)]",
              "animate-in fade-in slide-in-from-top-2 duration-200",
            )}
          >
            {/* Header */}
            <p className="text-[10px] uppercase tracking-[0.15em] text-white/40 mb-2">Trade Budget</p>

            {/* Value display */}
            <p className="text-3xl font-light text-white text-center mb-5">${displayValue}</p>

            {/* Slider track */}
            <div
              ref={sliderRef}
              className="relative h-10 cursor-pointer touch-none mb-2"
              onMouseDown={(e) => {
                setIsDragging(true)
                handleMove(e.clientX)
              }}
              onTouchStart={(e) => {
                setIsDragging(true)
                handleMove(e.touches[0].clientX)
              }}
              onTouchMove={handleTouchMove}
              onTouchEnd={() => setIsDragging(false)}
            >
              {/* Track background */}
              <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-[3px] bg-white/15 rounded-full">
                <div
                  className="absolute top-0 left-0 h-full rounded-full"
                  style={{
                    width: `${percent}%`,
                    background: "linear-gradient(90deg, #22d3ee, #06b6d4)",
                  }}
                />
              </div>

              {/* Glowing thumb */}
              <div
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 -translate-x-1/2",
                  "w-6 h-6 rounded-full",
                  "bg-white",
                  "transition-transform",
                  isDragging && "scale-110",
                )}
                style={{
                  left: `${percent}%`,
                  boxShadow: "0 0 16px rgba(255,255,255,0.6), 0 0 32px rgba(255,255,255,0.3)",
                }}
              />
            </div>

            {/* Range labels */}
            <div className="flex justify-between text-[10px] text-white/30 mb-4">
              <span>$5</span>
              <span>$5K</span>
            </div>

            {/* Quick select section */}
            <div className="border-t border-white/[0.06] pt-3">
              <p className="text-[10px] uppercase tracking-[0.15em] text-white/40 mb-2">Presets</p>
              <div className="grid grid-cols-4 gap-1.5">
                {QUICK_PRESETS.map((preset) => {
                  const label = preset >= 1000 ? `$${preset / 1000}K` : `$${preset}`
                  const isSelected = value === preset
                  return (
                    <button
                      key={preset}
                      onClick={() => {
                        triggerHaptic("light")
                        onChange(preset)
                      }}
                      className={cn(
                        "py-1.5 rounded-lg text-[11px] transition-all",
                        isSelected
                          ? "bg-white text-black font-medium"
                          : "text-white/50 hover:bg-white/10 hover:text-white/70",
                      )}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
