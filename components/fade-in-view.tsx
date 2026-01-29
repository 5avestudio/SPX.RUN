"use client"

import type * as React from "react"
import { useRef, useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface FadeInViewProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  delay?: number
  direction?: "up" | "down" | "left" | "right"
  distance?: number
}

export function FadeInView({
  children,
  className,
  delay = 0,
  direction = "up",
  distance = 30,
  ...props
}: FadeInViewProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1, rootMargin: "20px" },
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const getTransform = () => {
    if (isVisible) return "translate3d(0, 0, 0)"
    switch (direction) {
      case "up":
        return `translate3d(0, ${distance}px, 0)`
      case "down":
        return `translate3d(0, -${distance}px, 0)`
      case "left":
        return `translate3d(${distance}px, 0, 0)`
      case "right":
        return `translate3d(-${distance}px, 0, 0)`
    }
  }

  return (
    <div
      ref={ref}
      className={cn("transition-all duration-700 ease-out will-change-transform", className)}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: getTransform(),
        transitionDelay: `${delay}ms`,
      }}
      {...props}
    >
      {children}
    </div>
  )
}
