"use client"

import type * as React from "react"
import { useRef, useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface ParallaxSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  sticky?: boolean
  parallaxSpeed?: number
  fadeIn?: boolean
  index?: number
}

export function ParallaxSection({
  children,
  className,
  sticky = false,
  parallaxSpeed = 0.3,
  fadeIn = true,
  index = 0,
  ...props
}: ParallaxSectionProps) {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting)
      },
      { threshold: 0.1, rootMargin: "50px" },
    )

    observer.observe(section)

    const handleScroll = () => {
      const rect = section.getBoundingClientRect()
      const windowHeight = window.innerHeight
      const sectionTop = rect.top
      const sectionHeight = rect.height

      // Calculate how far through the viewport the section is
      const progress = Math.max(0, Math.min(1, 1 - sectionTop / (windowHeight - sectionHeight * 0.5)))
      setScrollProgress(progress)
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    handleScroll()

    return () => {
      observer.disconnect()
      window.removeEventListener("scroll", handleScroll)
    }
  }, [])

  const translateY = sticky ? 0 : scrollProgress * parallaxSpeed * -50
  const opacity = fadeIn ? Math.min(1, scrollProgress * 1.5 + 0.3) : 1
  const scale = 0.95 + scrollProgress * 0.05
  const blur = fadeIn ? Math.max(0, (1 - scrollProgress * 2) * 4) : 0

  return (
    <div
      ref={sectionRef}
      className={cn(
        "transition-all duration-100 ease-out will-change-transform",
        sticky && "sticky top-4 z-10",
        className,
      )}
      style={{
        transform: `translateY(${translateY}px) scale(${scale})`,
        opacity,
        filter: blur > 0 ? `blur(${blur}px)` : undefined,
        transitionDelay: `${index * 30}ms`,
      }}
      {...props}
    >
      {children}
    </div>
  )
}
