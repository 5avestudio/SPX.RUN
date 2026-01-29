"use client"

import { useState, useEffect, useRef } from "react"
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card"
import { Button } from "@/components/ui/button"
import { shouldShowAlerts } from "@/lib/market-calendar"
import {
  TrendingUp,
  TrendingDown,
  Clock,
  AlertTriangle,
  Play,
  Square,
  CheckCircle2,
  XCircle,
  Target,
  Zap,
} from "lucide-react"

interface TradeSignal {
  type: "CALL" | "PUT" | "NONE"
  strikePrice: number
  entryPrice: number
  estimatedPremium: number
  profitTarget1: number
  profitTarget2: number
  profitTarget3: number
  stopLoss: number
  targetSpxPrice: number
  stopSpxPrice: number
  reason: string
  strength: "HIGH" | "MEDIUM" | "LOW"
  timestamp: Date
}

interface TradeSignalCardProps {
  currentPrice: number
  signal: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL"
  rsi: number
  adx: number
  pivotR1: number
  pivotS1: number
  pivotR2: number
  pivotS2: number
  superTrendSignal: "BUY" | "SELL" | "HOLD"
  ewoSignal: "BUY" | "SELL" | "HOLD"
  macdCrossover: "BULLISH" | "BEARISH" | "NONE" | "BUY" | "SELL" | "HOLD" | string
  budget: number
}

export function TradeSignalCard({
  currentPrice,
  signal,
  rsi,
  adx,
  pivotR1,
  pivotS1,
  pivotR2,
  pivotS2,
  superTrendSignal,
  ewoSignal,
  macdCrossover,
  budget = 200,
}: TradeSignalCardProps) {
  const [activeSignal, setActiveSignal] = useState<TradeSignal | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [isTracking, setIsTracking] = useState(false)
  const [tradeStatus, setTradeStatus] = useState<"PENDING" | "ACTIVE" | "PROFIT" | "STOPPED" | null>(null)
  const prevSignalRef = useRef<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const normalizedMacdCrossover =
    macdCrossover === "BUY" || macdCrossover === "BULLISH"
      ? "BULLISH"
      : macdCrossover === "SELL" || macdCrossover === "BEARISH"
        ? "BEARISH"
        : "NONE"

  const calculateSignal = (): TradeSignal | null => {
    let bullishScore = 0
    let bearishScore = 0

    if (rsi < 30) bullishScore += 3
    else if (rsi < 40) bullishScore += 2
    else if (rsi < 45) bullishScore += 1
    if (rsi > 70) bearishScore += 3
    else if (rsi > 60) bearishScore += 2
    else if (rsi > 55) bearishScore += 1

    const trendStrength = adx > 30 ? 1.8 : adx > 25 ? 1.5 : adx > 20 ? 1.2 : 1

    if (superTrendSignal === "BUY") bullishScore += 2.5
    if (superTrendSignal === "SELL") bearishScore += 2.5

    if (ewoSignal === "BUY") bullishScore += 2
    if (ewoSignal === "SELL") bearishScore += 2

    if (normalizedMacdCrossover === "BULLISH") bullishScore += 3
    if (normalizedMacdCrossover === "BEARISH") bearishScore += 3

    const distToS1 = currentPrice - pivotS1
    const distToS2 = currentPrice - pivotS2
    const distToR1 = pivotR1 - currentPrice
    const distToR2 = pivotR2 - currentPrice

    if (distToS2 < 3) bullishScore += 4
    else if (distToS2 < 8) bullishScore += 3
    else if (distToS1 < 3) bullishScore += 2.5
    else if (distToS1 < 8) bullishScore += 1.5

    if (distToR2 < 3) bearishScore += 4
    else if (distToR2 < 8) bearishScore += 3
    else if (distToR1 < 3) bearishScore += 2.5
    else if (distToR1 < 8) bearishScore += 1.5

    bullishScore *= trendStrength
    bearishScore *= trendStrength

    const scoreDiff = bullishScore - bearishScore
    const totalScore = Math.max(bullishScore, bearishScore)

    if (Math.abs(scoreDiff) < 1.5 || totalScore < 3) {
      return null
    }

    const isCall = scoreDiff > 0
    const strength: "HIGH" | "MEDIUM" | "LOW" = totalScore > 12 ? "HIGH" : totalScore > 7 ? "MEDIUM" : "LOW"

    const strikePrice = isCall ? Math.ceil(currentPrice / 5) * 5 : Math.floor(currentPrice / 5) * 5

    const distanceToStrike = Math.abs(strikePrice - currentPrice)
    const basePremium = Math.max(1.5, 4 - distanceToStrike * 0.4)
    const volatilityAdj = adx > 25 ? 0.5 : 0
    const estimatedPremium = Math.max(1, Math.min(6, basePremium + volatilityAdj))

    const targetSpxPrice = isCall ? pivotR1 : pivotS1
    const stopSpxPrice = isCall ? pivotS1 : pivotR1

    const profitTarget1 = estimatedPremium * 1.5
    const profitTarget2 = estimatedPremium * 2.0
    const profitTarget3 = estimatedPremium * 3.0
    const stopLoss = estimatedPremium * 0.5

    const reasons: string[] = []
    if (isCall) {
      if (rsi < 40) reasons.push(`RSI ${rsi.toFixed(0)} oversold`)
      if (superTrendSignal === "BUY") reasons.push("SuperTrend bullish")
      if (normalizedMacdCrossover === "BULLISH") reasons.push("MACD crossing up")
      if (distToS1 < 10 || distToS2 < 10) reasons.push(`Near ${distToS2 < distToS1 ? "S2" : "S1"} support`)
    } else {
      if (rsi > 60) reasons.push(`RSI ${rsi.toFixed(0)} overbought`)
      if (superTrendSignal === "SELL") reasons.push("SuperTrend bearish")
      if (normalizedMacdCrossover === "BEARISH") reasons.push("MACD crossing down")
      if (distToR1 < 10 || distToR2 < 10) reasons.push(`Near ${distToR2 < distToR1 ? "R2" : "R1"} resistance`)
    }

    return {
      type: isCall ? "CALL" : "PUT",
      strikePrice,
      entryPrice: currentPrice,
      estimatedPremium,
      profitTarget1,
      profitTarget2,
      profitTarget3,
      stopLoss,
      targetSpxPrice,
      stopSpxPrice,
      reason: reasons.join(" | ") || (isCall ? "Bullish momentum" : "Bearish momentum"),
      strength,
      timestamp: new Date(),
    }
  }

  useEffect(() => {
    const newSignal = calculateSignal()
    const signalKey = newSignal ? `${newSignal.type}-${newSignal.strikePrice}-${newSignal.strength}` : null

    if (signalKey !== prevSignalRef.current) {
      if (newSignal && (newSignal.strength === "HIGH" || newSignal.strength === "MEDIUM")) {
        setActiveSignal(newSignal)
        setElapsedTime(0)
        setIsTracking(true)
        setTradeStatus("PENDING")
        prevSignalRef.current = signalKey

        if (newSignal.strength === "HIGH" && audioRef.current && shouldShowAlerts()) {
          audioRef.current.play().catch(() => {})
        }

        if (
          newSignal.strength === "HIGH" &&
          typeof window !== "undefined" &&
          Notification.permission === "granted" &&
          shouldShowAlerts()
        ) {
          new Notification(`${newSignal.type} Signal!`, {
            body: `$${newSignal.strikePrice} ${newSignal.type} @ ~$${newSignal.estimatedPremium.toFixed(2)}`,
          })
        }
      } else if (newSignal && !activeSignal) {
        setActiveSignal(newSignal)
        setElapsedTime(0)
        setTradeStatus("PENDING")
        prevSignalRef.current = signalKey
      } else if (!newSignal && !isTracking) {
        setActiveSignal(null)
        prevSignalRef.current = null
      }
    }

    if (activeSignal && isTracking) {
      if (activeSignal.type === "CALL") {
        if (currentPrice >= activeSignal.targetSpxPrice) {
          setTradeStatus("PROFIT")
        } else if (currentPrice <= activeSignal.stopSpxPrice) {
          setTradeStatus("STOPPED")
        } else {
          setTradeStatus("ACTIVE")
        }
      } else {
        if (currentPrice <= activeSignal.targetSpxPrice) {
          setTradeStatus("PROFIT")
        } else if (currentPrice >= activeSignal.stopSpxPrice) {
          setTradeStatus("STOPPED")
        } else {
          setTradeStatus("ACTIVE")
        }
      }
    }
  }, [currentPrice, rsi, adx, superTrendSignal, ewoSignal, normalizedMacdCrossover])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isTracking && activeSignal) {
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - activeSignal.timestamp.getTime()) / 1000))
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isTracking, activeSignal])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const clearSignal = () => {
    setActiveSignal(null)
    setIsTracking(false)
    setElapsedTime(0)
    setTradeStatus(null)
    prevSignalRef.current = null
  }

  const startTracking = () => {
    setIsTracking(true)
    setTradeStatus("ACTIVE")
    if (activeSignal) {
      setActiveSignal({ ...activeSignal, timestamp: new Date() })
      setElapsedTime(0)
    }
  }

  const contractsForBudget = activeSignal ? Math.floor(budget / (activeSignal.estimatedPremium * 100)) : 0
  const totalCost = activeSignal ? contractsForBudget * activeSignal.estimatedPremium * 100 : 0

  return (
    <GlassCard
      variant={activeSignal?.type === "CALL" ? "success" : activeSignal?.type === "PUT" ? "danger" : "default"}
      glow={activeSignal?.strength === "HIGH"}
      className="overflow-hidden"
    >
      <audio
        ref={audioRef}
        src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2telezcJZp7NvG1fOF9+o7GGXkxne5OjpYN2cXRsQEI/X47D7duCNCEXba/u/6FNKBBP"
      />

      <GlassCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${activeSignal?.strength === "HIGH" ? "bg-white/20" : "bg-white/10"}`}>
              <Zap
                className={`h-5 w-5 ${activeSignal?.strength === "HIGH" ? "text-white animate-pulse" : "text-foreground/50"}`}
              />
            </div>
            <div>
              <GlassCardTitle>Trade Signal</GlassCardTitle>
              {activeSignal && (
                <span
                  className={`text-xs font-medium ${
                    activeSignal.strength === "HIGH"
                      ? "text-white"
                      : activeSignal.strength === "MEDIUM"
                        ? "text-white/80"
                        : "text-foreground/50"
                  }`}
                >
                  {activeSignal.strength} Probability
                </span>
              )}
            </div>
          </div>
          {activeSignal && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                <Clock className="h-4 w-4 text-foreground/50" />
                <span className="font-mono text-lg text-foreground/80">{formatTime(elapsedTime)}</span>
              </div>
              {!isTracking ? (
                <Button
                  onClick={startTracking}
                  className="rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30"
                >
                  <Play className="h-4 w-4 mr-1" /> Track
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={clearSignal} className="rounded-xl">
                  <Square className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </GlassCardHeader>

      <GlassCardContent className="space-y-5">
        {activeSignal ? (
          <>
            {/* Main Signal Display */}
            <div
              className={`
              p-6 rounded-2xl text-center relative overflow-hidden
              ${
                activeSignal.type === "CALL"
                  ? "bg-gradient-to-br from-emerald-500/20 to-teal-500/10"
                  : "bg-gradient-to-br from-rose-500/20 to-fuchsia-700/10"
              }
            `}
            >
              <div className="flex items-center justify-center gap-4">
                {activeSignal.type === "CALL" ? (
                  <TrendingUp className="h-10 w-10 text-emerald-400" />
                ) : (
                  <TrendingDown className="h-10 w-10 text-rose-400" />
                )}
                <div>
                  <p
                    className={`text-3xl font-light tracking-tight ${activeSignal.type === "CALL" ? "text-emerald-400" : "text-rose-400"}`}
                  >
                    BUY {activeSignal.type}
                  </p>
                  <p className="text-4xl font-light mt-1">{activeSignal.strikePrice.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Entry Details */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-white/5 text-center">
                <p className="text-xs text-foreground/40 uppercase tracking-wider">Signal Time</p>
                <p className="text-lg font-light mt-1">
                  {activeSignal.timestamp.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                    timeZone: "America/New_York",
                  })}{" "}
                  ET
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 text-center">
                <p className="text-xs text-foreground/40 uppercase tracking-wider">SPX Entry</p>
                <p className="text-lg font-light mt-1">${activeSignal.entryPrice.toFixed(2)}</p>
              </div>
            </div>

            {/* Premium & Budget */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 border border-primary/20">
              <div className="flex justify-between items-center">
                <span className="text-foreground/60 font-light">Est. Premium</span>
                <span className="text-3xl font-light text-primary">~${activeSignal.estimatedPremium.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm mt-3 pt-3 border-t border-white/10">
                <span className="text-foreground/40">${budget} budget</span>
                <span className="font-light text-foreground/70">
                  {contractsForBudget} contract{contractsForBudget !== 1 ? "s" : ""} (~${totalCost.toFixed(0)})
                </span>
              </div>
            </div>

            {/* Profit Targets */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-emerald-400" />
                <p className="text-sm font-light text-foreground/60">Profit Targets</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "+50%", value: activeSignal.profitTarget1, opacity: "10" },
                  { label: "+100%", value: activeSignal.profitTarget2, opacity: "15" },
                  { label: "+200%", value: activeSignal.profitTarget3, opacity: "20" },
                ].map((target) => (
                  <div
                    key={target.label}
                    className={`p-4 bg-emerald-500/${target.opacity} rounded-2xl text-center border border-emerald-500/20`}
                  >
                    <p className="text-xs text-foreground/40">{target.label}</p>
                    <p className="text-xl font-light text-emerald-400">${target.value.toFixed(2)}</p>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-rose-500/10 rounded-2xl text-center border border-rose-500/20">
                <p className="text-xs text-foreground/40">Stop Loss (-50%)</p>
                <p className="text-xl font-light text-rose-400">${activeSignal.stopLoss.toFixed(2)}</p>
              </div>
            </div>

            {/* SPX Target Levels */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-emerald-500/10 rounded-2xl text-center border border-emerald-500/20">
                <p className="text-xs text-foreground/40 uppercase tracking-wider">SPX Target</p>
                <p className="text-2xl font-light text-emerald-400">{activeSignal.targetSpxPrice.toFixed(0)}</p>
                <p className="text-xs text-foreground/30 mt-1">
                  {Math.abs(activeSignal.targetSpxPrice - currentPrice).toFixed(1)} pts
                </p>
              </div>
              <div className="p-4 bg-rose-500/10 rounded-2xl text-center border border-rose-500/20">
                <p className="text-xs text-foreground/40 uppercase tracking-wider">SPX Stop</p>
                <p className="text-2xl font-light text-rose-400">{activeSignal.stopSpxPrice.toFixed(0)}</p>
                <p className="text-xs text-foreground/30 mt-1">
                  {Math.abs(activeSignal.stopSpxPrice - currentPrice).toFixed(1)} pts
                </p>
              </div>
            </div>

            {/* Trade Status */}
            {tradeStatus && isTracking && (
              <div
                className={`
                p-5 rounded-2xl flex items-center justify-center gap-3
                ${
                  tradeStatus === "PROFIT"
                    ? "bg-emerald-500/20 border border-emerald-500/30"
                    : tradeStatus === "STOPPED"
                      ? "bg-rose-500/20 border border-rose-500/30"
                      : tradeStatus === "ACTIVE"
                        ? "bg-sky-500/15 border border-sky-500/20"
                        : "bg-white/5 border border-white/10"
                }
              `}
              >
                {tradeStatus === "PROFIT" && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
                {tradeStatus === "STOPPED" && <XCircle className="h-5 w-5 text-rose-400" />}
                {tradeStatus === "ACTIVE" && <Play className="h-5 w-5 text-sky-400 animate-pulse" />}
                {tradeStatus === "PENDING" && <Clock className="h-5 w-5 text-foreground/50" />}
                <span
                  className={`font-light text-lg ${
                    tradeStatus === "PROFIT"
                      ? "text-emerald-400"
                      : tradeStatus === "STOPPED"
                        ? "text-rose-400"
                        : tradeStatus === "ACTIVE"
                          ? "text-sky-400"
                          : "text-foreground/50"
                  }`}
                >
                  {tradeStatus === "PROFIT" && "Target Hit — Take Profit"}
                  {tradeStatus === "STOPPED" && "Stop Hit — Exit Trade"}
                  {tradeStatus === "ACTIVE" && "Trade Active"}
                  {tradeStatus === "PENDING" && "Awaiting Entry"}
                </span>
              </div>
            )}

            {/* Reason */}
            <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
              <p className="text-sm text-foreground/50 font-light">{activeSignal.reason}</p>
            </div>
          </>
        ) : (
          <div className="p-10 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-foreground/30" />
            </div>
            <p className="text-xl font-light text-foreground/60">Scanning for Entry</p>
            <p className="text-sm text-foreground/30 mt-2 font-light">Waiting for indicators to align at key levels</p>
          </div>
        )}
      </GlassCardContent>
    </GlassCard>
  )
}
