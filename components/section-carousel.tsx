"use client"

import type React from "react"

import { useRef, useState, useEffect, type ReactNode } from "react"

interface SectionCarouselProps {
  children: ReactNode[]
  className?: string
}

export function SectionCarousel({ children, className = "" }: SectionCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleScroll = () => {
      const scrollPosition = container.scrollLeft
      const itemWidth = container.offsetWidth * 0.85 + 16 // card width + gap
      const newIndex = Math.round(scrollPosition / itemWidth)
      setActiveIndex(Math.min(newIndex, children.length - 1))
    }

    container.addEventListener("scroll", handleScroll)
    return () => container.removeEventListener("scroll", handleScroll)
  }, [children.length])

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true)
    setStartX(e.touches[0].pageX - (containerRef.current?.offsetLeft || 0))
    setScrollLeft(containerRef.current?.scrollLeft || 0)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !containerRef.current) return
    const x = e.touches[0].pageX - (containerRef.current.offsetLeft || 0)
    const walk = (x - startX) * 1.5
    containerRef.current.scrollLeft = scrollLeft - walk
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
  }

  return (
    <div className={className}>
      <div
        ref={containerRef}
        className="carousel-container py-2"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children.map((child, index) => (
          <div
            key={index}
            className="carousel-item w-[85vw] max-w-[400px]"
            style={{
              opacity: activeIndex === index ? 1 : 0.5,
              transform: activeIndex === index ? "scale(1)" : "scale(0.95)",
              transition: "opacity 0.3s ease, transform 0.3s ease",
            }}
          >
            {child}
          </div>
        ))}
        {/* Padding element for last card */}
        <div className="w-4 flex-shrink-0" />
      </div>

      {/* Dot indicators */}
      {children.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-4">
          {children.map((_, index) => (
            <div
              key={index}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                activeIndex === index ? "w-6 bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]" : "w-1.5 bg-white/20"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
