// Power Hour Indicator Analysis Engine
// Based on backtested thresholds from SPX chart analysis

export interface IndicatorThresholds {
  adx: {
    entryMin: number
    exitWarning: number
    strongTrend: number
  }
  ewo: {
    bullishEntry: number
    bearishEntry: number
    neutralZone: [number, number]
  }
  rvol: {
    spikeThreshold: number
    confirmationThreshold: number
  }
  rsi: {
    overbought: number
    oversold: number
    avoidZone: [number, number]
  }
  vwap: {
    deviationThreshold: number // in standard deviations
  }
  macd: {
    histogramStrong: number
  }
}

// Calibrated thresholds from chart analysis
export const POWER_HOUR_THRESHOLDS: IndicatorThresholds = {
  adx: {
    entryMin: 25, // Only enter when ADX > 25 AND rising
    exitWarning: 20, // Exit warning when ADX drops below 20
    strongTrend: 30, // Strong trend confirmation
  },
  ewo: {
    bullishEntry: 5, // EWO > 5 for bullish entry
    bearishEntry: -5, // EWO < -5 for bearish entry
    neutralZone: [-3, 3], // Avoid entries in this range
  },
  rvol: {
    spikeThreshold: 2.0, // Power hour requires 2x+ volume
    confirmationThreshold: 1.5, // Minimum for any signal
  },
  rsi: {
    overbought: 70,
    oversold: 30,
    avoidZone: [40, 60], // Chop zone - avoid entries here
  },
  vwap: {
    deviationThreshold: 1.0, // 1 sigma deviation required
  },
  macd: {
    histogramStrong: 0.25, // Strong momentum threshold
  },
}

export interface IndicatorState {
  adx: number
  adxSlope: number // positive = rising, negative = falling
  adxDirection?: "BULLISH" | "BEARISH" | "NEUTRAL" // +DI vs -DI
  plusDI?: number
  minusDI?: number
  ewo: number
  rvol: number
  rsi: number
  vwapDeviation: number // in sigma
  macdHistogram: number
}

export interface SignalResult {
  signal: "strong_bullish" | "strong_bearish" | "weak_bullish" | "weak_bearish" | "neutral" | "avoid"
  confidence: number // 0-100
  alignedCount: number
  warnings: string[]
  recommendation: string
}

export function analyzeIndicators(state: IndicatorState): SignalResult {
  const warnings: string[] = []
  let bullishScore = 0
  let bearishScore = 0
  let totalWeight = 0

  const T = POWER_HOUR_THRESHOLDS

  // ADX Analysis (Weight: 30%) - Now uses +DI/-DI for direction
  const adxWeight = 30
  if (state.adx >= T.adx.strongTrend && state.adxSlope > 0) {
    // Strong trend and rising - full weight
    totalWeight += adxWeight
    // Use +DI/-DI for direction scoring
    if (state.adxDirection === "BULLISH") {
      bullishScore += adxWeight
    } else if (state.adxDirection === "BEARISH") {
      bearishScore += adxWeight
    }
  } else if (state.adx >= T.adx.entryMin && state.adxSlope > 0) {
    // Good trend and rising - 75% weight
    totalWeight += adxWeight * 0.75
    if (state.adxDirection === "BULLISH") {
      bullishScore += adxWeight * 0.75
    } else if (state.adxDirection === "BEARISH") {
      bearishScore += adxWeight * 0.75
    }
  } else if (state.adx < T.adx.exitWarning) {
    // Weak trend - EXIT WARNING
    warnings.push(`ADX EXIT WARNING: ${state.adx.toFixed(1)} < ${T.adx.exitWarning} (trend dying)`)
  } else if (state.adxSlope < 0) {
    // Falling ADX - trend weakening
    warnings.push(`ADX falling: trend losing strength`)
  }
  
  // Add direction info to warnings if available
  if (state.plusDI !== undefined && state.minusDI !== undefined) {
    if (state.adxDirection === "BULLISH") {
      warnings.push(`ADX Direction: BULLISH (+DI:${state.plusDI.toFixed(0)} > -DI:${state.minusDI.toFixed(0)})`)
    } else if (state.adxDirection === "BEARISH") {
      warnings.push(`ADX Direction: BEARISH (-DI:${state.minusDI.toFixed(0)} > +DI:${state.plusDI.toFixed(0)})`)
    }
  }

  // EWO Analysis (Weight: 20%)
  const ewoWeight = 20
  if (state.ewo >= T.ewo.bullishEntry) {
    bullishScore += ewoWeight
    totalWeight += ewoWeight
  } else if (state.ewo <= T.ewo.bearishEntry) {
    bearishScore += ewoWeight
    totalWeight += ewoWeight
  } else if (state.ewo > T.ewo.neutralZone[0] && state.ewo < T.ewo.neutralZone[1]) {
    warnings.push(`EWO in neutral zone (${state.ewo.toFixed(1)}): no momentum`)
  }

  // RVOL Analysis (Weight: 25%)
  const rvolWeight = 25
  if (state.rvol >= T.rvol.spikeThreshold) {
    // Volume spike - confirms direction
    totalWeight += rvolWeight
    // Add to dominant direction
    if (state.ewo > 0) bullishScore += rvolWeight
    else if (state.ewo < 0) bearishScore += rvolWeight
  } else if (state.rvol < T.rvol.confirmationThreshold) {
    warnings.push(`Low volume (${state.rvol.toFixed(1)}x): weak confirmation`)
  }

  // RSI Analysis (Weight: 15%)
  const rsiWeight = 15
  if (state.rsi <= T.rsi.oversold) {
    bullishScore += rsiWeight
    totalWeight += rsiWeight
  } else if (state.rsi >= T.rsi.overbought) {
    bearishScore += rsiWeight
    totalWeight += rsiWeight
  } else if (state.rsi > T.rsi.avoidZone[0] && state.rsi < T.rsi.avoidZone[1]) {
    warnings.push(`RSI in chop zone (${state.rsi.toFixed(0)}): avoid entries`)
  }

  // VWAP Deviation (Weight: 15%)
  const vwapWeight = 15
  if (Math.abs(state.vwapDeviation) >= T.vwap.deviationThreshold) {
    totalWeight += vwapWeight
    if (state.vwapDeviation > 0) bullishScore += vwapWeight
    else bearishScore += vwapWeight
  }

  // Calculate signal
  const alignedCount = Math.floor(totalWeight / 20) // Rough count of aligned indicators
  const netScore = bullishScore - bearishScore
  const confidence = Math.min(Math.abs(netScore) + (state.adx > T.adx.strongTrend ? 20 : 0), 100)

  // Determine signal type
  let signal: SignalResult["signal"]
  let recommendation: string

  if (warnings.some((w) => w.includes("EXIT WARNING"))) {
    signal = "avoid"
    recommendation = "EXIT POSITION - Trend dying"
  } else if (warnings.length >= 2) {
    signal = "avoid"
    recommendation = "AVOID - Multiple warnings"
  } else if (netScore >= 50 && confidence >= 70) {
    signal = "strong_bullish"
    recommendation = "STRONG BUY - High confidence setup"
  } else if (netScore <= -50 && confidence >= 70) {
    signal = "strong_bearish"
    recommendation = "STRONG SELL - High confidence setup"
  } else if (netScore >= 25) {
    signal = "weak_bullish"
    recommendation = "Cautious bullish bias"
  } else if (netScore <= -25) {
    signal = "weak_bearish"
    recommendation = "Cautious bearish bias"
  } else {
    signal = "neutral"
    recommendation = "NO TRADE - Wait for alignment"
  }

  return {
    signal,
    confidence,
    alignedCount,
    warnings,
    recommendation,
  }
}

// Check if ADX is showing exit warning
export function checkADXExitWarning(
  currentADX: number,
  previousADX: number,
  peakADX: number,
): { shouldExit: boolean; reason: string } | null {
  const T = POWER_HOUR_THRESHOLDS

  // ADX dropped below exit threshold
  if (currentADX < T.adx.exitWarning) {
    return {
      shouldExit: true,
      reason: `ADX (${currentADX.toFixed(1)}) dropped below ${T.adx.exitWarning} - trend exhausted`,
    }
  }

  // ADX falling from peak by more than 20%
  if (peakADX > 0 && currentADX < peakADX * 0.8 && currentADX < previousADX) {
    return {
      shouldExit: true,
      reason: `ADX falling from peak (${peakADX.toFixed(1)} → ${currentADX.toFixed(1)}) - momentum fading`,
    }
  }

  return null
}
