"use client"

import { useState, useEffect } from "react"

type SplashStyle = "uppercase" | "lowercase"

interface SplashScreenProps {
  onComplete?: () => void
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [phase, setPhase] = useState<"visible" | "exiting" | "hidden">("visible")
  const [style, setStyle] = useState<SplashStyle>("lowercase")

  useEffect(() => {
    const savedStyle = localStorage.getItem("spx_splash_style") as SplashStyle | null
    if (savedStyle) {
      setStyle(savedStyle)
    }

    const exitTimer = setTimeout(() => {
      setPhase("exiting")
    }, 5000)

    const hideTimer = setTimeout(() => {
      setPhase("hidden")
      onComplete?.()
    }, 5700)

    return () => {
      clearTimeout(exitTimer)
      clearTimeout(hideTimer)
    }
  }, [onComplete])

  return (
    <>
      {/* Solid black background that covers everything until splash is done */}
      {phase !== "hidden" && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9998,
            backgroundColor: "#000000",
          }}
        />
      )}

      {/* Splash content */}
      {phase !== "hidden" && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#000000",
            opacity: phase === "exiting" ? 0 : 1,
            transition: "opacity 0.7s ease-out",
            pointerEvents: phase === "exiting" ? "none" : "auto",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "32px" }}>
            <div style={{ textAlign: "center" }}>
              <h1
                style={{
                  fontSize: style === "uppercase" ? "52px" : "48px",
                  fontWeight: style === "uppercase" ? 300 : 200,
                  letterSpacing: style === "uppercase" ? "0.25em" : "0.3em",
                  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                  background: "linear-gradient(135deg, #10b981 0%, #06b6d4 50%, #3b82f6 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  margin: 0,
                  transform: phase === "exiting" ? "scale(0.95)" : "scale(1)",
                  transition: "transform 0.7s ease-out",
                  textTransform: style === "uppercase" ? "uppercase" : "lowercase",
                }}
              >
                {style === "uppercase" ? "SPX" : "spx"}
                <span
                  style={{
                    background: "linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    fontWeight: 100,
                    letterSpacing: style === "uppercase" ? "0.15em" : "0.2em",
                  }}
                >
                  .
                </span>
                {style === "uppercase" ? "RUN" : "run"}
              </h1>
            </div>

            <div
              style={{
                width: "48px",
                height: "1px",
                background: "linear-gradient(90deg, transparent, #10b981, #06b6d4, #3b82f6, transparent)",
                opacity: phase === "exiting" ? 0 : 0.6,
                transition: "opacity 0.5s ease-out",
                animation: "shimmer 2s ease-in-out infinite",
              }}
            />

            <p
              style={{
                position: "absolute",
                bottom: "180px",
                left: 0,
                right: 0,
                fontSize: "8px",
                fontWeight: 300,
                letterSpacing: "0.15em",
                fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                color: "rgba(255, 255, 255, 0.25)",
                margin: 0,
                textAlign: "center",
                opacity: phase === "exiting" ? 0 : 1,
                transition: "opacity 0.5s ease-out",
              }}
            >
              Version 2.0
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "8px",
                marginTop: "16px",
                opacity: phase === "exiting" ? 0 : 1,
                transition: "opacity 0.5s ease-out",
              }}
            >
              <p
                style={{
                  fontSize: "11px",
                  fontWeight: 300,
                  letterSpacing: "0.15em",
                  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                  color: "rgba(255, 255, 255, 0.7)",
                  margin: 0,
                  textAlign: "center",
                  textShadow: "0 0 20px rgba(16, 185, 129, 0.4), 0 0 40px rgba(6, 182, 212, 0.2)",
                }}
              >
                Designed & Developed by{" "}
                <span
                  style={{
                    background: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    fontWeight: 400,
                  }}
                >
                  5ave.studio
                </span>
              </p>
              <p
                style={{
                  fontSize: "9px",
                  fontWeight: 300,
                  letterSpacing: "0.1em",
                  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                  color: "rgba(255, 255, 255, 0.75)",
                  textShadow:
                    "0 0 10px rgba(255, 255, 255, 0.4), 0 0 20px rgba(255, 255, 255, 0.25), 0 0 30px rgba(255, 255, 255, 0.15)",
                  margin: 0,
                  textAlign: "center",
                }}
              >
                Copyright ©2026 ILIN CHUNG
              </p>
              <p
                style={{
                  fontSize: "9px",
                  fontWeight: 300,
                  letterSpacing: "0.1em",
                  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                  color: "rgba(255, 255, 255, 0.35)",
                  margin: 0,
                  textAlign: "center",
                }}
              >
                All rights reserved.
              </p>
            </div>
          </div>

          <style>{`
            @keyframes shimmer {
              0%, 100% { opacity: 0.3; transform: scaleX(0.8); }
              50% { opacity: 0.8; transform: scaleX(1.2); }
            }
          `}</style>
        </div>
      )}
    </>
  )
}
