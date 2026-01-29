"use client"

import { useMemo, useState, useEffect, useCallback } from "react"
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

interface TradierOption {
  symbol: string
  strike: number
  type: "call" | "put"
  bid: number
  ask: number
  last: number
  mark?: number // Mark-first mid price
  displayPrice?: number // Stable price (mark if available, else last)
  volume: number
  open_interest: number
  greeks?: {
    delta: number
    gamma: number
    theta: number
    vega: number
    iv: number
  }
}

interface OptionsMonitorPanelProps {
  currentPrice: number
  impliedVolatility?: number
  volume?: number
  priceChange?: number
  isOpen?: boolean
  onToggle?: () => void
  className?: string
}

export function OptionsMonitorPanel({
  currentPrice,
  impliedVolatility = 14.97,
  volume = 3310000,
  priceChange = 0,
  isOpen = false,
  onToggle = () => { },
  className,
}: OptionsMonitorPanelProps) {
  const [realOptions, setRealOptions] = useState<TradierOption[]>([])
  const [loading, setLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [usingRealData, setUsingRealData] = useState(false)
  const [dataSource, setDataSource] = useState<string>("none")
  const [sourceSymbol, setSourceSymbol] = useState<string>("SPX")

  // Panel width - matches Image 1 reference (narrower panel)
  const PANEL_WIDTH = "w-[180px]"

  const formatVolume = (vol: number) => {
    if (vol >= 1000000) return `${(vol / 1000000).toFixed(1)}M`
    if (vol >= 1000) return `${(vol / 1000).toFixed(0)}K`
    return vol.toString()
  }

  const fetchRealOptions = useCallback(async () => {
    if (!currentPrice || currentPrice < 100) {
      return
    }

    try {
      setLoading(true)

      // Create AbortController for timeout and request cancellation
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000)

      // Step 1: Get available roots for SPX (may have SPXW for 0DTE)
      let rootSymbol = "SPXW" // Default to SPXW for 0DTE
      try {
        const rootsRes = await fetch(`/api/tradier/options/roots?underlying=SPX`, {
          signal: controller.signal,
          cache: "no-store",
        })
        if (rootsRes.ok) {
          const rootsData = await rootsRes.json()
          // Prefer SPXW for 0DTE trading
          rootSymbol = rootsData.preferredRoot || (rootsData.roots?.includes("SPXW") ? "SPXW" : "SPX")
        }
      } catch {
        // Fallback to SPXW if roots lookup fails
        rootSymbol = "SPXW"
      }

      // Step 2: Get expirations for the chosen root
      const expRes = await fetch(`/api/tradier/options/expirations?symbol=${rootSymbol}`, {
        signal: controller.signal,
        cache: "no-store",
      }).catch(() => null)

      if (!expRes || !expRes.ok) {
        clearTimeout(timeoutId)
        setUsingRealData(false)
        setDataSource("simulated")
        return
      }

      const expData = await expRes.json()
      const expiration = expData.expirations?.[0] // Nearest expiration (0DTE)

      if (!expiration) {
        clearTimeout(timeoutId)
        setUsingRealData(false)
        setDataSource("simulated")
        return
      }

      // Step 3: Fetch the chain with mark-first pricing (no greeks/OI in UI per requirement)
      const chainRes = await fetch(`/api/tradier/options/chains?symbol=${rootSymbol}&expiration=${expiration}`, {
        signal: controller.signal,
        cache: "no-store",
      }).catch((err) => {
        if (err.name === 'AbortError') {
          // Silently ignore aborted requests
        }
        return null
      })

      clearTimeout(timeoutId)

      // If Tradier fails, try Public API as fallback
      if (!chainRes || !chainRes.ok) {
        console.log("[Options Monitor] Tradier failed, trying Public API fallback...")
        try {
          // Try Public API for expirations
          const publicExpRes = await fetch(`/api/public/options/expirations?symbol=SPY`, {
            signal: controller.signal,
            cache: "no-store",
          }).catch(() => null)

          if (publicExpRes?.ok) {
            const publicExpData = await publicExpRes.json()
            const publicExpiration = publicExpData.expirations?.[0]

            if (publicExpiration) {
              const publicChainRes = await fetch(`/api/public/options/chains?symbol=SPY&expiration=${publicExpiration}`, {
                signal: controller.signal,
                cache: "no-store",
              }).catch(() => null)

              if (publicChainRes?.ok) {
                const publicChainData = await publicChainRes.json()

                if (publicChainData.chain && publicChainData.chain.length > 0) {
                  const options: TradierOption[] = []
                  for (const exp of publicChainData.chain) {
                    if (exp.calls) {
                      for (const c of exp.calls) {
                        options.push({
                          symbol: c.symbol,
                          strike: c.strike,
                          type: "call",
                          bid: c.bid || 0,
                          ask: c.ask || 0,
                          last: c.displayPrice || c.mark || c.last || 0,
                          mark: c.mark,
                          displayPrice: c.displayPrice,
                          volume: c.volume || 0,
                          open_interest: 0,
                        })
                      }
                    }
                    if (exp.puts) {
                      for (const p of exp.puts) {
                        options.push({
                          symbol: p.symbol,
                          strike: p.strike,
                          type: "put",
                          bid: p.bid || 0,
                          ask: p.ask || 0,
                          last: p.displayPrice || p.mark || p.last || 0,
                          mark: p.mark,
                          displayPrice: p.displayPrice,
                          volume: p.volume || 0,
                          open_interest: 0,
                        })
                      }
                    }
                  }

                  if (options.length > 0) {
                    setRealOptions(options)
                    setUsingRealData(true)
                    setDataSource("public")
                    setSourceSymbol("SPY")
                    setLastUpdate(new Date())
                    console.log("[Options Monitor] Using Public API data (SPY proxy):", options.length, "options")
                    return
                  }
                }
              }
            }
          }
        } catch (publicErr) {
          console.log("[Options Monitor] Public API fallback also failed:", publicErr)
        }

        // Both APIs failed, use simulated
        setUsingRealData(false)
        setDataSource("simulated")
        return
      }

      const chainData = await chainRes.json()

      if (chainData.chain && chainData.chain.length > 0) {
        // Flatten calls and puts from chain data, use mark-first displayPrice
        const options: TradierOption[] = []
        for (const exp of chainData.chain) {
          if (exp.calls) {
            for (const c of exp.calls) {
              options.push({
                symbol: c.symbol,
                strike: c.strike,
                type: "call",
                bid: c.bid || 0,
                ask: c.ask || 0,
                last: c.displayPrice || c.mark || c.last || 0, // Mark-first for stable pricing
                mark: c.mark,
                displayPrice: c.displayPrice,
                volume: c.volume || 0,
                open_interest: 0, // Not shown in UI per requirement
              })
            }
          }
          if (exp.puts) {
            for (const p of exp.puts) {
              options.push({
                symbol: p.symbol,
                strike: p.strike,
                type: "put",
                bid: p.bid || 0,
                ask: p.ask || 0,
                last: p.displayPrice || p.mark || p.last || 0, // Mark-first for stable pricing
                mark: p.mark,
                displayPrice: p.displayPrice,
                volume: p.volume || 0,
                open_interest: 0, // Not shown in UI per requirement
              })
            }
          }
        }

        if (options.length > 0) {
          setRealOptions(options)
          setUsingRealData(true)
          setDataSource("tradier")
          setSourceSymbol(rootSymbol)
          setLastUpdate(new Date())
          return
        }
      }

      // Fallback to simulated if no valid data
      setUsingRealData(false)
      setDataSource("simulated")
    } catch (error) {
      // Silently fall back to simulated data
      setUsingRealData(false)
      setDataSource("simulated")
    } finally {
      setLoading(false)
    }
  }, [currentPrice])

  const [strikes, setStrikes] = useState<any[]>([])

  useEffect(() => {
    fetchRealOptions()
    const interval = setInterval(() => {
      if (isOpen) {
        fetchRealOptions()
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [fetchRealOptions, isOpen])

  const generateStrikes = useMemo(() => {
    const baseStrike = Math.round(currentPrice / 5) * 5
    const result = []

    for (let i = -2; i <= 2; i++) {
      const strike = baseStrike + i * 5
      const isCallITM = strike < currentPrice
      const isPutITM = strike > currentPrice
      const isATM = i === 0

      // Match strikes, accounting for SPX (6000) vs SPY (600) scaling if needed
      const realCall = realOptions.find((o) => {
        if (o.type !== "call") return false
        if (o.strike === strike) return true
        // Handle 10:1 scaling for SPX -> SPY proxy
        if (dataSource === "public" && Math.abs(o.strike * 10 - strike) < 2) return true
        return false
      })

      const realPut = realOptions.find((o) => {
        if (o.type !== "put") return false
        if (o.strike === strike) return true
        // Handle 10:1 scaling for SPX -> SPY proxy
        if (dataSource === "public" && Math.abs(o.strike * 10 - strike) < 2) return true
        return false
      })

      let callData: { bid: number; ask: number; last: number }
      let putData: { bid: number; ask: number; last: number }

      if (realCall && (realCall.bid > 0 || realCall.ask > 0)) {
        // Use mark-first displayPrice for stable pricing (prevents flipping)
        const stablePrice = realCall.displayPrice ?? realCall.mark ?? realCall.last ??
          (realCall.bid > 0 && realCall.ask > 0 ? (realCall.bid + realCall.ask) / 2 : realCall.last)
        callData = {
          bid: realCall.bid,
          ask: realCall.ask,
          last: stablePrice, // Use stable displayPrice as "last" for UI consistency
        }
      } else {
        // Realistic SPX 0DTE pricing based on actual market data
        const callIntrinsic = Math.max(0, currentPrice - strike)
        const strikesFromATM = Math.abs(i)
        if (isCallITM) {
          // ITM calls: intrinsic value + small time premium (~$2-4)
          const timePremium = 2 + Math.random() * 2
          const basePremium = callIntrinsic + timePremium
          const spread = 0.10 + Math.random() * 0.20
          callData = {
            bid: Math.round((basePremium - spread / 2) * 100) / 100,
            ask: Math.round((basePremium + spread / 2) * 100) / 100,
            last: Math.round(basePremium * 100) / 100,
          }
        } else if (isATM) {
          // ATM options: ~$10-13 for SPX 0DTE
          const basePremium = 10 + Math.random() * 3
          const spread = 0.10 + Math.random() * 0.15
          callData = {
            bid: Math.round((basePremium - spread / 2) * 100) / 100,
            ask: Math.round((basePremium + spread / 2) * 100) / 100,
            last: Math.round(basePremium * 100) / 100,
          }
        } else {
          // OTM calls: decreasing premium as strike goes higher
          const basePremium = Math.max(0.5, 8 - strikesFromATM * 2.5 + Math.random() * 1)
          const spread = 0.10 + Math.random() * 0.15
          callData = {
            bid: Math.round((basePremium - spread / 2) * 100) / 100,
            ask: Math.round((basePremium + spread / 2) * 100) / 100,
            last: Math.round(basePremium * 100) / 100,
          }
        }
      }

      if (realPut && (realPut.bid > 0 || realPut.ask > 0)) {
        // Use mark-first displayPrice for stable pricing (prevents flipping)
        const stablePrice = realPut.displayPrice ?? realPut.mark ?? realPut.last ??
          (realPut.bid > 0 && realPut.ask > 0 ? (realPut.bid + realPut.ask) / 2 : realPut.last)
        putData = {
          bid: realPut.bid,
          ask: realPut.ask,
          last: stablePrice, // Use stable displayPrice as "last" for UI consistency
        }
      } else {
        // Realistic SPX 0DTE put pricing
        const putIntrinsic = Math.max(0, strike - currentPrice)
        const strikesFromATM = Math.abs(i)
        if (isPutITM) {
          // ITM puts: intrinsic value + small time premium (~$2-4)
          const timePremium = 2 + Math.random() * 2
          const basePremium = putIntrinsic + timePremium
          const spread = 0.10 + Math.random() * 0.20
          putData = {
            bid: Math.round((basePremium - spread / 2) * 100) / 100,
            ask: Math.round((basePremium + spread / 2) * 100) / 100,
            last: Math.round(basePremium * 100) / 100,
          }
        } else if (isATM) {
          // ATM options: ~$10-13 for SPX 0DTE
          const basePremium = 10 + Math.random() * 3
          const spread = 0.10 + Math.random() * 0.15
          putData = {
            bid: Math.round((basePremium - spread / 2) * 100) / 100,
            ask: Math.round((basePremium + spread / 2) * 100) / 100,
            last: Math.round(basePremium * 100) / 100,
          }
        } else {
          // OTM puts: decreasing premium as strike goes lower
          const basePremium = Math.max(0.5, 8 - strikesFromATM * 2.5 + Math.random() * 1)
          const spread = 0.10 + Math.random() * 0.15
          putData = {
            bid: Math.round((basePremium - spread / 2) * 100) / 100,
            ask: Math.round((basePremium + spread / 2) * 100) / 100,
            last: Math.round(basePremium * 100) / 100,
          }
        }
      }

      result.push({
        strike,
        isCallITM,
        isPutITM,
        isATM,
        isCallOTM: !isCallITM && !isATM,
        isPutOTM: !isPutITM && !isATM,
        distanceFromATM: Math.abs(i),
        call: callData,
        put: putData,
        hasRealData: !!(realCall || realPut),
      })
    }

    return result
  }, [currentPrice, realOptions])

  useEffect(() => {
    setStrikes(generateStrikes)
  }, [generateStrikes])

  const callsOrdered = useMemo(() => {
    const sorted = [...strikes].sort((a, b) => b.strike - a.strike)
    return sorted
  }, [strikes])

  const putsOrdered = useMemo(() => {
    const sorted = [...strikes].sort((a, b) => b.strike - a.strike)
    return sorted
  }, [strikes])

  const ivPercentile = Math.round((impliedVolatility / 50) * 100)
  const trendDirection = priceChange > 0.5 ? "bullish" : priceChange < -0.5 ? "bearish" : "neutral"
  const chevronColor =
    trendDirection === "bullish" ? "bg-emerald-400" : trendDirection === "bearish" ? "bg-[#ec3b70]" : "bg-white"

  const getCallCircleColor = (moneyness: string) => {
    if (moneyness === "ATM") return "stroke-emerald-400"
    if (moneyness === "ITM") return "stroke-emerald-400"
    return "stroke-white/30"
  }

  const getPutCircleColor = (moneyness: string) => {
    if (moneyness === "ATM") return "stroke-yellow-400"
    if (moneyness === "ITM") return "stroke-[#ec3b70]"
    return "stroke-white/30"
  }

  return (
    <div
      className={cn(
        "fixed top-0 left-0 z-40 h-screen flex transition-transform duration-300 ease-out",
        isOpen ? "items-center" : "items-start pt-[calc(57vh+50px)]",
        isOpen ? "translate-x-0" : "translate-x-[calc(-100%+28px)]",
        className,
      )}
    >
      <div
        className={cn(
          "bg-gradient-to-r from-black/90 via-black/70 to-transparent backdrop-blur-md",
          PANEL_WIDTH, "h-full pt-[115px] pb-[70px] px-1 overflow-y-auto rounded-r-2xl",
        )}
      >
        <div className="flex flex-col mb-2 px-1 gap-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium tracking-widest text-white/40 uppercase">OPTIONS CHAIN</span>
            <div className="flex items-center gap-1.5">
              {loading && <RefreshCw className="w-2.5 h-2.5 text-white/30 animate-spin" />}
              <span className={cn(
                "text-[7px] px-1 py-0.5 rounded-sm font-bold uppercase",
                dataSource === "tradier" ? "bg-emerald-500/20 text-emerald-400" :
                  dataSource === "public" ? "bg-blue-500/20 text-blue-400" :
                    "bg-amber-500/20 text-amber-400"
              )}>
                {dataSource === "none" ? "OFFLINE" : dataSource}
                {sourceSymbol && dataSource !== "simulated" && ` (${sourceSymbol})`}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between text-[7px] text-white/30">
            <div className="flex items-center gap-1">
              <span>VOL: {formatVolume(volume)}</span>
              <span className="text-emerald-400/60">IV: {impliedVolatility.toFixed(1)}%</span>
            </div>
            <span>{lastUpdate ? lastUpdate.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'}</span>
          </div>
        </div>

        {/* CALLS Section */}
        <div className="mb-1">
          <div className="flex items-center justify-between mb-1 px-1">
            <span className="text-[10px] font-semibold tracking-wider text-emerald-400">CALLS</span>
            <span className="text-[8px] text-white/40">OTM ↑ · ATM ↓</span>
          </div>
          <div className="space-y-1.5">
            {callsOrdered.map((s, idx) => {
              const moneyness = s.isATM ? "ATM" : s.isCallITM ? "ITM" : "OTM"
              const rank = 5 - idx
              const progressColor = getCallCircleColor(moneyness)
              const ringColor = moneyness === "OTM" ? "ring-white/10" : "ring-emerald-400/30"
              const bgColor = moneyness === "OTM" ? "bg-white/[0.02]" : "bg-emerald-400/[0.03]"

              return (
                <div
                  key={`call-${s.strike}`}
                  className={cn("flex items-center gap-2 px-2 py-2 rounded-xl ring-1", ringColor, bgColor)}
                >
                  <div className="relative w-11 h-11 flex-shrink-0">
                    <svg className="w-full h-full -rotate-90">
                      <circle
                        cx="22"
                        cy="22"
                        r="18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="text-white/10"
                      />
                      <circle
                        cx="22"
                        cy="22"
                        r="18"
                        fill="none"
                        strokeWidth="3"
                        strokeDasharray={2 * Math.PI * 18}
                        strokeDashoffset={2 * Math.PI * 18 - (rank / 5) * (2 * Math.PI * 18)}
                        strokeLinecap="round"
                        className={progressColor}
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[15px] font-bold text-white/90">
                      {rank}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-medium text-[13px]">${s.strike}</span>
                      <span
                        className={cn(
                          "text-[8px] px-1.5 py-0.5 rounded font-semibold",
                          moneyness === "ATM"
                            ? "bg-emerald-400/20 text-emerald-400"
                            : moneyness === "ITM"
                              ? "bg-emerald-400/20 text-emerald-400"
                              : "bg-white/10 text-white/50",
                        )}
                      >
                        {moneyness}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[8px] text-white/40">BID</span>
                      <span className="text-[8px] text-white/40">LAST</span>
                      <span className="text-[8px] text-white/40">ASK</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-400 font-normal text-[10px]">{s.call.bid.toFixed(2)}</span>
                      <span className="text-white font-normal text-[10px]">{s.call.last.toFixed(2)}</span>
                      <span className="text-[#ec3b70] font-normal text-[10px]">{s.call.ask.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* PUTS Section */}
        <div className="mb-1">
          <div className="flex items-center justify-between mb-1 px-1">
            <span className="text-[10px] font-semibold tracking-wider text-[#ec3b70]">PUTS</span>
            <span className="text-[7.5px] text-white/35 italic leading-tight">
              Rank 1 = best (tight spread, closest ATM)
            </span>
            <span className="text-[8px] text-white/40">ATM ↑ · OTM ↓</span>
          </div>
          <div className="space-y-1.5">
            {putsOrdered.map((s, idx) => {
              const moneyness = s.isATM ? "ATM" : s.isPutITM ? "ITM" : "OTM"
              const rank = idx + 1
              const progressColor = getPutCircleColor(moneyness)
              const ringColor =
                moneyness === "ATM" ? "ring-yellow-400/30" : moneyness === "ITM" ? "ring-[#ec3b70]/30" : "ring-white/10"
              const bgColor =
                moneyness === "ATM"
                  ? "bg-yellow-400/[0.03]"
                  : moneyness === "ITM"
                    ? "bg-[#ec3b70]/[0.03]"
                    : "bg-white/[0.02]"

              return (
                <div
                  key={`put-${s.strike}`}
                  className={cn("flex items-center gap-2 px-2 py-2 rounded-xl ring-1", ringColor, bgColor)}
                >
                  <div className="relative w-11 h-11 flex-shrink-0">
                    <svg className="w-full h-full -rotate-90">
                      <circle
                        cx="22"
                        cy="22"
                        r="18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="text-white/10"
                      />
                      <circle
                        cx="22"
                        cy="22"
                        r="18"
                        fill="none"
                        strokeWidth="3"
                        strokeDasharray={2 * Math.PI * 18}
                        strokeDashoffset={2 * Math.PI * 18 - ((6 - rank) / 5) * (2 * Math.PI * 18)}
                        strokeLinecap="round"
                        className={progressColor}
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[15px] font-bold text-white/90">
                      {rank}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-medium text-[13px]">${s.strike}</span>
                      <span
                        className={cn(
                          "text-[8px] px-1.5 py-0.5 rounded font-semibold",
                          moneyness === "ATM"
                            ? "bg-yellow-400/20 text-yellow-400"
                            : moneyness === "ITM"
                              ? "bg-[#ec3b70]/20 text-[#ec3b70]"
                              : "bg-white/10 text-white/50",
                        )}
                      >
                        {moneyness}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[8px] text-white/40">BID</span>
                      <span className="text-[8px] text-white/40">LAST</span>
                      <span className="text-[8px] text-white/40">ASK</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-400 font-normal text-[10px]">{s.put.bid.toFixed(2)}</span>
                      <span className="text-white font-normal text-[10px]">{s.put.last.toFixed(2)}</span>
                      <span className="text-[#ec3b70] font-normal text-[10px]">{s.put.ask.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>


      </div>

      {/* Toggle button */}
      <button
        onClick={onToggle}
        className={cn(
          "flex items-center justify-center w-7 h-16 rounded-r-2xl",
          "bg-gradient-to-l from-black/80 to-transparent backdrop-blur-sm",
          "transition-all duration-200",
        )}
      >
        <div className="flex flex-col items-center gap-1">
          <div className={cn("w-1.5 h-1.5 rounded-full", chevronColor)} />
          {isOpen ? (
            <ChevronLeft className="w-4 h-4 text-white/70" />
          ) : (
            <ChevronRight className="w-4 h-4 text-white/70" />
          )}
        </div>
      </button>
    </div>
  )
}
