"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

interface FadeSectionProps {
  children: ReactNode
  className?: string
  delay?: number
  parallaxStrength?: number
}

export function FadeSection({ children, className, delay = 0, parallaxStrength = 0.1 }: FadeSectionProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [parallaxY, setParallaxY] = useState(0)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setIsVisible(true), delay)
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" },
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => observer.disconnect()
  }, [delay])

  useEffect(() => {
    const handleScroll = () => {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect()
        const scrollProgress = (window.innerHeight - rect.top) / (window.innerHeight + rect.height)
        const clampedProgress = Math.max(0, Math.min(1, scrollProgress))
        setParallaxY((clampedProgress - 0.5) * 50 * parallaxStrength)
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [parallaxStrength])

  return (
    <div
      ref={ref}
      style={{
        transform: `translateY(${parallaxY}px)`,
      }}
      className={cn(
        "transition-all duration-700 ease-out will-change-transform",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10",
        className,
      )}
    >
      {children}
    </div>
  )
}
