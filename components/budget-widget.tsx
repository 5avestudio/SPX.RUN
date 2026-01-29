"use client"

import type React from "react"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"
import { triggerHaptic } from "@/lib/haptics"

interface BudgetWidgetProps {
  value: number
  onChange: (budget: number) => void
  className?: string
}

const BUDGET_PRESETS = [5, 50, 100, 200, 500, 1000, 2000, 5000]

function formatBudgetWithSymbol(value: number): string {
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}K`
  }
  return `$${value}`
}

function formatBudgetNoSymbol(value: number): string {
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}K`
  }
  return `$${value}`
}

export function BudgetWidget({ value, onChange, className }: BudgetWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [tempValue, setTempValue] = useState(value)

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = Number(e.target.value)
    setTempValue(newValue)
    triggerHaptic("light")
  }

  const handleSliderEnd = () => {
    onChange(tempValue)
    triggerHaptic("medium")
  }

  const handlePresetClick = (preset: number) => {
    setTempValue(preset)
    onChange(preset)
    triggerHaptic("medium")
  }

  return (
    <div className={cn("relative", className)}>
      {/* Trigger button - pill form */}
      <button
        onClick={() => {
          triggerHaptic("light")
          setTempValue(value)
          setIsOpen(!isOpen)
        }}
        className={cn(
          "flex items-center gap-1 px-3 py-1.5 rounded-full",
          "bg-white/10 border border-white/10 backdrop-blur-sm",
          "text-xs font-medium text-white/70 tracking-wider",
          "transition-all press-effect",
          isOpen && "bg-white/20 border-white/20",
        )}
      >
        <span>{formatBudgetNoSymbol(value)}</span>
        <ChevronDown className={cn("w-3 h-3 transition-transform text-white/50", isOpen && "rotate-180")} />
      </button>

      {/* Expanded dropdown with slider */}
      {isOpen && (
        <>
          {/* Backdrop to close */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          <div
            className={cn(
              "absolute top-full right-0 mt-2 z-50",
              "w-[220px] p-4 rounded-2xl",
              "bg-[#1a1a1a]/80 backdrop-blur-xl border border-white/[0.08]",
              "shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
              "animate-in fade-in slide-in-from-top-2 duration-200",
            )}
          >
            {/* Header */}
            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-3">Trade Budget</p>

            {/* Current value display */}
            <div className="text-center mb-4">
              <span className="text-2xl font-light text-white">{formatBudgetWithSymbol(tempValue)}</span>
            </div>

            {/* Slider */}
            <div className="relative mb-4">
              <input
                type="range"
                min={5}
                max={5000}
                step={5}
                value={tempValue}
                onChange={handleSliderChange}
                onMouseUp={handleSliderEnd}
                onTouchEnd={handleSliderEnd}
                className="w-full h-1 bg-white/[0.08] rounded-full appearance-none cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:w-4
                  [&::-webkit-slider-thumb]:h-4
                  [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:bg-white
                  [&::-webkit-slider-thumb]:shadow-[0_0_12px_rgba(255,255,255,0.6)]
                  [&::-webkit-slider-thumb]:cursor-pointer
                  [&::-moz-range-thumb]:w-4
                  [&::-moz-range-thumb]:h-4
                  [&::-moz-range-thumb]:rounded-full
                  [&::-moz-range-thumb]:bg-white
                  [&::-moz-range-thumb]:border-0
                  [&::-moz-range-thumb]:cursor-pointer"
              />
              {/* Track fill */}
              <div
                className="absolute top-1/2 left-0 h-1 bg-white/30 rounded-full pointer-events-none -translate-y-1/2"
                style={{ width: `${((tempValue - 5) / (5000 - 5)) * 100}%` }}
              />
            </div>

            {/* Min/Max labels */}
            <div className="flex justify-between text-[10px] text-white/30 mb-4">
              <span>$5</span>
              <span>$5K</span>
            </div>

            {/* Quick presets */}
            <div className="border-t border-white/[0.06] pt-3">
              <p className="text-[10px] uppercase tracking-wider text-white/30 mb-2">Quick Select</p>
              <div className="grid grid-cols-4 gap-1.5">
                {BUDGET_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => handlePresetClick(preset)}
                    className={cn(
                      "py-1.5 rounded-lg text-[10px] transition-all",
                      tempValue === preset
                        ? "bg-white text-black font-medium"
                        : "text-white/40 hover:bg-white/[0.06] hover:text-white/60",
                    )}
                  >
                    {formatBudgetWithSymbol(preset)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
