"use client"

import type * as React from "react"
import { useRef, useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface StickyHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  threshold?: number
}

export function StickyHeader({ children, className, threshold = 100, ...props }: StickyHeaderProps) {
  const [isSticky, setIsSticky] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)
  const headerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY
      setIsSticky(scrollY > threshold)
      setScrollProgress(Math.min(1, scrollY / (threshold * 2)))
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [threshold])

  return (
    <div
      ref={headerRef}
      className={cn(
        "sticky top-0 z-50 transition-all duration-500 ease-out",
        isSticky && "backdrop-blur-2xl bg-background/60",
        className,
      )}
      style={{
        transform: `translateY(${isSticky ? 0 : -scrollProgress * 10}px)`,
        paddingTop: isSticky ? "1rem" : "0",
        paddingBottom: isSticky ? "1rem" : "0",
        borderBottom: isSticky ? "1px solid rgba(255,255,255,0.1)" : "none",
      }}
      {...props}
    >
      <div
        style={{
          transform: `scale(${1 - scrollProgress * 0.1})`,
          transformOrigin: "left center",
        }}
      >
        {children}
      </div>
    </div>
  )
}
