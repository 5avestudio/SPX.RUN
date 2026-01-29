"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { triggerHaptic } from "@/lib/haptics"

interface BudgetSliderProps {
  value: number
  onChange: (value: number) => void
  className?: string
  compact?: boolean
}

const PRESETS = [5, 50, 100, 500, 1000, 5000]
const MIN_VALUE = 5
const MAX_VALUE = 5000
const SNAP_THRESHOLD_PERCENT = 5

export function BudgetSlider({ value, onChange, className, compact = false }: BudgetSliderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const sliderRef = useRef<HTMLDivElement>(null)
  const lastValueRef = useRef(value)

  const valueToPercent = (val: number) => {
    const minLog = Math.log(MIN_VALUE)
    const maxLog = Math.log(MAX_VALUE)
    return ((Math.log(val) - minLog) / (maxLog - minLog)) * 100
  }

  const percentToValue = (percent: number) => {
    const minLog = Math.log(MIN_VALUE)
    const maxLog = Math.log(MAX_VALUE)
    const logValue = minLog + (percent / 100) * (maxLog - minLog)
    return Math.exp(logValue)
  }

  const getPresetPercent = (preset: number) => {
    return valueToPercent(preset)
  }

  const getSnappedValue = (percent: number): number | null => {
    for (const preset of PRESETS) {
      const presetPercent = getPresetPercent(preset)
      if (Math.abs(percent - presetPercent) <= SNAP_THRESHOLD_PERCENT) {
        return preset
      }
    }
    return null
  }

  const roundToIncrement = (rawValue: number): number => {
    if (rawValue < 50) {
      return Math.round(rawValue)
    } else {
      return Math.round(rawValue / 5) * 5
    }
  }

  const handleMove = (clientX: number) => {
    if (!sliderRef.current) return
    const rect = sliderRef.current.getBoundingClientRect()
    const percent = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))

    const snappedValue = getSnappedValue(percent)
    let finalValue: number

    if (snappedValue !== null) {
      finalValue = snappedValue
    } else {
      const rawValue = percentToValue(percent)
      const roundedValue = roundToIncrement(rawValue)
      finalValue = Math.max(MIN_VALUE, Math.min(MAX_VALUE, roundedValue))
    }

    const isPreset = PRESETS.includes(finalValue)
    if (isPreset && finalValue !== lastValueRef.current) {
      triggerHaptic("medium")
      lastValueRef.current = finalValue
    } else if (finalValue !== lastValueRef.current) {
      triggerHaptic("light")
      lastValueRef.current = finalValue
    }

    onChange(finalValue)
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

  if (compact) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <span className="text-white/40 text-xs uppercase tracking-wider">Budget</span>
        <div className="flex items-center gap-2 flex-1">
          <div
            ref={sliderRef}
            className="relative h-8 flex-1 cursor-pointer touch-none"
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
            <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-0.5 bg-white/10 rounded-full">
              <div className="absolute top-0 left-0 h-full bg-white/40 rounded-full" style={{ width: `${percent}%` }} />
            </div>

            <div
              className={cn(
                "absolute top-1/2 -translate-y-1/2 -translate-x-1/2",
                "w-2 h-2 rounded-full bg-white",
                "shadow-[0_0_8px_rgba(255,255,255,0.4)]",
                "transition-transform",
                isDragging && "scale-110",
              )}
              style={{ left: `${percent}%` }}
            />
          </div>
          <span className="text-lg font-light w-16 text-right">
            ${value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 text-center">Trade Budget</p>

      <div className="flex items-baseline justify-center">
        <span className="text-4xl font-extralight tracking-tight">${value.toLocaleString()}</span>
      </div>

      <div
        ref={sliderRef}
        className="relative h-8 cursor-pointer touch-none mt-2"
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
        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-[2px] bg-white/20 rounded-full">
          <div className="absolute top-0 left-0 h-full bg-white/40 rounded-full" style={{ width: `${percent}%` }} />
        </div>

        {PRESETS.map((preset) => {
          const pos = getPresetPercent(preset)
          const isActive = value >= preset
          return (
            <div
              key={preset}
              className={cn(
                "absolute top-1/2 -translate-y-1/2 -translate-x-1/2",
                "w-4 h-4 rounded-full transition-all cursor-pointer",
                "flex items-center justify-center",
              )}
              style={{ left: `${pos}%` }}
              onClick={(e) => {
                e.stopPropagation()
                triggerHaptic("medium")
                onChange(preset)
              }}
            >
              <div
                className={cn("w-1.5 h-1.5 rounded-full transition-all", isActive ? "bg-white/50" : "bg-white/15")}
              />
            </div>
          )
        })}

        <div
          className={cn(
            "absolute top-1/2 -translate-y-1/2 -translate-x-1/2",
            "w-3 h-3 rounded-full",
            "bg-white",
            "transition-transform",
            isDragging && "scale-110",
          )}
          style={{
            left: `${percent}%`,
            boxShadow: "0 0 10px rgba(255,255,255,0.4), 0 0 20px rgba(255,255,255,0.2)",
          }}
        />
      </div>

      <div className="relative h-5 mt-1">
        {PRESETS.map((preset) => {
          const pos = getPresetPercent(preset)
          const label = preset >= 1000 ? `$${preset / 1000}K` : `$${preset}`
          return (
            <span
              key={preset}
              className="absolute text-xs text-white/35 -translate-x-1/2 cursor-pointer hover:text-white/60 transition-colors"
              style={{ left: `${pos}%` }}
              onClick={() => {
                triggerHaptic("medium")
                onChange(preset)
              }}
            >
              {label}
            </span>
          )
        })}
      </div>
    </div>
  )
}
