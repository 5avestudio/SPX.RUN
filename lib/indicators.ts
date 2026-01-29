// Technical Indicators Calculation Library

export interface OHLCData {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

// ADX (Average Directional Index) - Trend Strength
export function calculateADX(data: OHLCData[], period = 14): number[] {
  if (data.length < period + 1) return []

  const trueRanges: number[] = []
  const plusDM: number[] = []
  const minusDM: number[] = []

  for (let i = 1; i < data.length; i++) {
    const high = data[i].high
    const low = data[i].low
    const prevHigh = data[i - 1].high
    const prevLow = data[i - 1].low
    const prevClose = data[i - 1].close

    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose))
    trueRanges.push(tr)

    const upMove = high - prevHigh
    const downMove = prevLow - low

    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0)
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0)
  }

  const smoothedTR = smoothData(trueRanges, period)
  const smoothedPlusDM = smoothData(plusDM, period)
  const smoothedMinusDM = smoothData(minusDM, period)

  const adx: number[] = []
  const dx: number[] = []

  for (let i = 0; i < smoothedTR.length; i++) {
    const plusDI = (smoothedPlusDM[i] / smoothedTR[i]) * 100
    const minusDI = (smoothedMinusDM[i] / smoothedTR[i]) * 100
    const dxValue = (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100
    dx.push(dxValue)
  }

  for (let i = period - 1; i < dx.length; i++) {
    const sum = dx.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0)
    adx.push(sum / period)
  }

  return adx
}

// ADX with Directional Indicators (+DI/-DI) for trend direction
export interface ADXWithDirection {
  adx: number
  plusDI: number
  minusDI: number
  direction: "BULLISH" | "BEARISH" | "NEUTRAL"
  strength: "VERY_STRONG" | "STRONG" | "MODERATE" | "WEAK" | "NO_TREND"
  trendDescription: string
}

export function calculateADXWithDirection(data: OHLCData[], period = 14): ADXWithDirection {
  if (data.length < period + 1) {
    return { adx: 0, plusDI: 0, minusDI: 0, direction: "NEUTRAL", strength: "NO_TREND", trendDescription: "Insufficient data" }
  }

  const trueRanges: number[] = []
  const plusDMArray: number[] = []
  const minusDMArray: number[] = []

  for (let i = 1; i < data.length; i++) {
    const high = data[i].high
    const low = data[i].low
    const prevHigh = data[i - 1].high
    const prevLow = data[i - 1].low
    const prevClose = data[i - 1].close

    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose))
    trueRanges.push(tr)

    const upMove = high - prevHigh
    const downMove = prevLow - low

    plusDMArray.push(upMove > downMove && upMove > 0 ? upMove : 0)
    minusDMArray.push(downMove > upMove && downMove > 0 ? downMove : 0)
  }

  const smoothedTR = smoothData(trueRanges, period)
  const smoothedPlusDM = smoothData(plusDMArray, period)
  const smoothedMinusDM = smoothData(minusDMArray, period)

  const lastIdx = smoothedTR.length - 1
  if (lastIdx < 0 || smoothedTR[lastIdx] === 0) {
    return { adx: 0, plusDI: 0, minusDI: 0, direction: "NEUTRAL", strength: "NO_TREND", trendDescription: "No data" }
  }

  const plusDI = (smoothedPlusDM[lastIdx] / smoothedTR[lastIdx]) * 100
  const minusDI = (smoothedMinusDM[lastIdx] / smoothedTR[lastIdx]) * 100
  const dx = (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100

  // Calculate ADX (smoothed DX)
  const dxArray: number[] = []
  for (let i = 0; i < smoothedTR.length; i++) {
    const pDI = (smoothedPlusDM[i] / smoothedTR[i]) * 100
    const mDI = (smoothedMinusDM[i] / smoothedTR[i]) * 100
    dxArray.push((Math.abs(pDI - mDI) / (pDI + mDI)) * 100)
  }
  
  const adxValues: number[] = []
  for (let i = period - 1; i < dxArray.length; i++) {
    const sum = dxArray.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0)
    adxValues.push(sum / period)
  }
  const adx = adxValues[adxValues.length - 1] || 0

  // Determine direction based on +DI vs -DI
  let direction: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL"
  if (plusDI > minusDI + 5) {
    direction = "BULLISH"
  } else if (minusDI > plusDI + 5) {
    direction = "BEARISH"
  }

  // Determine strength based on ADX value
  let strength: "VERY_STRONG" | "STRONG" | "MODERATE" | "WEAK" | "NO_TREND" = "NO_TREND"
  if (adx >= 50) {
    strength = "VERY_STRONG"
  } else if (adx >= 40) {
    strength = "STRONG"
  } else if (adx >= 25) {
    strength = "MODERATE"
  } else if (adx >= 15) {
    strength = "WEAK"
  }

  // Generate description
  let trendDescription = ""
  if (strength === "NO_TREND") {
    trendDescription = `ADX at ${adx.toFixed(0)} - No clear trend, avoid trading`
  } else if (direction === "NEUTRAL") {
    trendDescription = `ADX at ${adx.toFixed(0)} - ${strength} but directionless`
  } else {
    trendDescription = `ADX at ${adx.toFixed(0)} - ${strength} ${direction.toLowerCase()} trend`
  }

  return { adx, plusDI, minusDI, direction, strength, trendDescription }
}

// SuperTrend Indicator - Optimized for 5-15 minute scalping
// Uses period=7, multiplier=2.5 for faster signals on 1m chart
export function calculateSuperTrend(
  data: OHLCData[],
  period = 7,  // Reduced from 10 for faster response
  multiplier = 2.5,  // Reduced from 3 for tighter bands
): { trend: number[]; signal: ("BUY" | "SELL" | "HOLD")[]; upperBand: number[]; lowerBand: number[] } {
  const atr = calculateATR(data, period)
  const trend: number[] = []
  const signal: ("BUY" | "SELL" | "HOLD")[] = []
  const upperBand: number[] = []
  const lowerBand: number[] = []

  let prevTrend = 1
  let prevUpperBand = 0
  let prevLowerBand = 0

  for (let i = 0; i < data.length; i++) {
    const hl2 = (data[i].high + data[i].low) / 2
    const atrValue = atr[i] || 0
    
    // Calculate basic bands
    let basicUpperBand = hl2 + multiplier * atrValue
    let basicLowerBand = hl2 - multiplier * atrValue

    // Final bands with trailing logic
    const finalUpperBand = (basicUpperBand < prevUpperBand || data[i - 1]?.close > prevUpperBand) 
      ? basicUpperBand 
      : prevUpperBand
    const finalLowerBand = (basicLowerBand > prevLowerBand || data[i - 1]?.close < prevLowerBand)
      ? basicLowerBand
      : prevLowerBand

    upperBand.push(finalUpperBand)
    lowerBand.push(finalLowerBand)

    const close = data[i].close

    // Determine trend direction
    if (close > finalUpperBand) {
      trend.push(1)
      signal.push(prevTrend === -1 ? "BUY" : "HOLD")
      prevTrend = 1
    } else if (close < finalLowerBand) {
      trend.push(-1)
      signal.push(prevTrend === 1 ? "SELL" : "HOLD")
      prevTrend = -1
    } else {
      trend.push(prevTrend)
      signal.push("HOLD")
    }

    prevUpperBand = finalUpperBand
    prevLowerBand = finalLowerBand
  }

  return { trend, signal, upperBand, lowerBand }
}

// RSI (Relative Strength Index)
export function calculateRSI(data: OHLCData[], period = 14): number[] {
  if (data.length < period + 1) return []

  const changes: number[] = []
  for (let i = 1; i < data.length; i++) {
    changes.push(data[i].close - data[i - 1].close)
  }

  const rsi: number[] = []

  for (let i = period; i < changes.length; i++) {
    const gains = changes.slice(i - period, i).filter((c) => c > 0)
    const losses = changes
      .slice(i - period, i)
      .filter((c) => c < 0)
      .map((c) => Math.abs(c))

    const avgGain = gains.length ? gains.reduce((a, b) => a + b, 0) / period : 0
    const avgLoss = losses.length ? losses.reduce((a, b) => a + b, 0) / period : 0

    if (avgLoss === 0) {
      rsi.push(100)
    } else {
      const rs = avgGain / avgLoss
      rsi.push(100 - 100 / (1 + rs))
    }
  }

  return rsi
}

// EWO (Elliott Wave Oscillator)
export function calculateEWO(
  data: OHLCData[],
  shortPeriod = 5,
  longPeriod = 35,
): { ewo: number[]; signal: ("BUY" | "SELL" | "HOLD")[] } {
  const shortEMA = calculateEMA(
    data.map((d) => d.close),
    shortPeriod,
  )
  const longEMA = calculateEMA(
    data.map((d) => d.close),
    longPeriod,
  )

  const ewo: number[] = []
  const signal: ("BUY" | "SELL" | "HOLD")[] = []

  for (let i = 0; i < Math.min(shortEMA.length, longEMA.length); i++) {
    const ewoValue = shortEMA[i] - longEMA[i]
    ewo.push(ewoValue)

    if (i > 0) {
      if (ewo[i] > 0 && ewo[i - 1] <= 0) {
        signal.push("BUY")
      } else if (ewo[i] < 0 && ewo[i - 1] >= 0) {
        signal.push("SELL")
      } else {
        signal.push("HOLD")
      }
    } else {
      signal.push("HOLD")
    }
  }

  return { ewo, signal }
}

// Bollinger Bands
export function calculateBollingerBands(
  data: OHLCData[],
  period = 20,
  stdDev = 2,
): { upper: number[]; middle: number[]; lower: number[]; danger: boolean[] } {
  const closes = data.map((d) => d.close)
  const sma = calculateSMA(closes, period)

  const upper: number[] = []
  const middle: number[] = []
  const lower: number[] = []
  const danger: boolean[] = []

  for (let i = period - 1; i < data.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1)
    const mean = sma[i - period + 1]
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period
    const std = Math.sqrt(variance)

    const upperBand = mean + stdDev * std
    const lowerBand = mean - stdDev * std

    upper.push(upperBand)
    middle.push(mean)
    lower.push(lowerBand)

    // Danger zone: price near or outside bands
    const close = closes[i]
    const isDanger = close >= upperBand * 0.98 || close <= lowerBand * 1.02
    danger.push(isDanger)
  }

  return { upper, middle, lower, danger }
}

// Pivot Points (Standard)
export function calculatePivotPoints(data: OHLCData | undefined): {
  pivot: number
  r1: number
  r2: number
  r3: number
  s1: number
  s2: number
  s3: number
} {
  // Handle undefined or null data
  if (!data) {
    return { pivot: 0, r1: 0, r2: 0, r3: 0, s1: 0, s2: 0, s3: 0 }
  }

  const { high, low, close } = data
  const pivot = (high + low + close) / 3

  const r1 = 2 * pivot - low
  const s1 = 2 * pivot - high
  const r2 = pivot + (high - low)
  const s2 = pivot - (high - low)
  const r3 = high + 2 * (pivot - low)
  const s3 = low - 2 * (high - pivot)

  return { pivot, r1, r2, r3, s1, s2, s3 }
}

// MACD indicator for momentum confirmation
export function calculateMACD(
  data: OHLCData[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): { macd: number[]; signal: number[]; histogram: number[]; crossover: ("BUY" | "SELL" | "HOLD")[] } {
  const closes = data.map((d) => d.close)
  const fastEMA = calculateEMA(closes, fastPeriod)
  const slowEMA = calculateEMA(closes, slowPeriod)

  const macdLine: number[] = []
  const offset = slowPeriod - fastPeriod

  for (let i = 0; i < slowEMA.length; i++) {
    macdLine.push(fastEMA[i + offset] - slowEMA[i])
  }

  const signalLine = calculateEMA(macdLine, signalPeriod)
  const histogram: number[] = []
  const crossover: ("BUY" | "SELL" | "HOLD")[] = []

  const signalOffset = signalPeriod - 1
  for (let i = 0; i < signalLine.length; i++) {
    const macdIdx = i + signalOffset
    histogram.push(macdLine[macdIdx] - signalLine[i])

    if (i > 0) {
      const prevMACD = macdLine[macdIdx - 1]
      const prevSignal = signalLine[i - 1]
      const currMACD = macdLine[macdIdx]
      const currSignal = signalLine[i]

      // Bullish crossover: MACD crosses above signal
      if (prevMACD <= prevSignal && currMACD > currSignal) {
        crossover.push("BUY")
      }
      // Bearish crossover: MACD crosses below signal
      else if (prevMACD >= prevSignal && currMACD < currSignal) {
        crossover.push("SELL")
      } else {
        crossover.push("HOLD")
      }
    } else {
      crossover.push("HOLD")
    }
  }

  return { macd: macdLine, signal: signalLine, histogram, crossover }
}

// Golden Cross detection function
export function calculateGoldenCross(
  data: OHLCData[],
  shortPeriod = 50,
  longPeriod = 200,
): { shortSMA: number[]; longSMA: number[]; signal: ("GOLDEN" | "DEATH" | "NONE")[] } {
  const closes = data.map((d) => d.close)
  const shortSMA = calculateSMA(closes, shortPeriod)
  const longSMA = calculateSMA(closes, longPeriod)

  const signal: ("GOLDEN" | "DEATH" | "NONE")[] = []

  // Align arrays - longSMA starts later
  const offset = longPeriod - shortPeriod

  for (let i = 0; i < longSMA.length; i++) {
    const shortIdx = i + offset
    if (shortIdx < 1 || i < 1) {
      signal.push("NONE")
      continue
    }

    const prevShort = shortSMA[shortIdx - 1]
    const currShort = shortSMA[shortIdx]
    const prevLong = longSMA[i - 1]
    const currLong = longSMA[i]

    // Golden Cross: Short SMA crosses above Long SMA
    if (prevShort <= prevLong && currShort > currLong) {
      signal.push("GOLDEN")
    }
    // Death Cross: Short SMA crosses below Long SMA
    else if (prevShort >= prevLong && currShort < currLong) {
      signal.push("DEATH")
    } else {
      signal.push("NONE")
    }
  }

  return { shortSMA, longSMA, signal }
}

// Volume Spike Detection for capitulation
export function detectVolumeSpike(data: OHLCData[], lookback = 20, threshold = 2.0): boolean[] {
  const spikes: boolean[] = []

  for (let i = 0; i < data.length; i++) {
    if (i < lookback) {
      spikes.push(false)
      continue
    }

    const avgVolume = data.slice(i - lookback, i).reduce((sum, d) => sum + d.volume, 0) / lookback
    spikes.push(data[i].volume > avgVolume * threshold)
  }

  return spikes
}

// RSI Divergence Detection
export function detectRSIDivergence(
  data: OHLCData[],
  rsi: number[],
  lookback = 10,
): { bullish: boolean; bearish: boolean } {
  if (data.length < lookback || rsi.length < lookback) {
    return { bullish: false, bearish: false }
  }

  const recentPrices = data.slice(-lookback).map((d) => d.close)
  const recentRSI = rsi.slice(-lookback)

  // Find price lows/highs
  const priceLow1 = Math.min(...recentPrices.slice(0, 5))
  const priceLow2 = Math.min(...recentPrices.slice(5))
  const rsiLow1 = Math.min(...recentRSI.slice(0, 5))
  const rsiLow2 = Math.min(...recentRSI.slice(5))

  const priceHigh1 = Math.max(...recentPrices.slice(0, 5))
  const priceHigh2 = Math.max(...recentPrices.slice(5))
  const rsiHigh1 = Math.max(...recentRSI.slice(0, 5))
  const rsiHigh2 = Math.max(...recentRSI.slice(5))

  // Bullish divergence: lower price lows but higher RSI lows
  const bullish = priceLow2 < priceLow1 && rsiLow2 > rsiLow1

  // Bearish divergence: higher price highs but lower RSI highs
  const bearish = priceHigh2 > priceHigh1 && rsiHigh2 < rsiHigh1

  return { bullish, bearish }
}

// Support/Resistance Bounce Detection
export function detectSupportResistanceBounce(
  currentPrice: number,
  pivots: { pivot: number; r1: number; r2: number; r3: number; s1: number; s2: number; s3: number },
  rsi: number,
  threshold = 5, // Points from level
): {
  atSupport: boolean
  atResistance: boolean
  level: string
  bounceSignal: "STRONG_BUY" | "BUY" | "SELL" | "STRONG_SELL" | "NONE"
  distance: number
} {
  const levels = [
    { name: "S3", value: pivots.s3 },
    { name: "S2", value: pivots.s2 },
    { name: "S1", value: pivots.s1 },
    { name: "P", value: pivots.pivot },
    { name: "R1", value: pivots.r1 },
    { name: "R2", value: pivots.r2 },
    { name: "R3", value: pivots.r3 },
  ]

  let closestLevel = levels[0]
  let minDistance = Math.abs(currentPrice - levels[0].value)

  for (const level of levels) {
    const distance = Math.abs(currentPrice - level.value)
    if (distance < minDistance) {
      minDistance = distance
      closestLevel = level
    }
  }

  const atSupport = closestLevel.name.startsWith("S") && minDistance <= threshold
  const atResistance = closestLevel.name.startsWith("R") && minDistance <= threshold

  let bounceSignal: "STRONG_BUY" | "BUY" | "SELL" | "STRONG_SELL" | "NONE" = "NONE"

  // At support with oversold RSI = strong buy signal
  if (atSupport && rsi < 35) {
    bounceSignal = "STRONG_BUY"
  } else if (atSupport && rsi < 45) {
    bounceSignal = "BUY"
  }
  // At resistance with overbought RSI = strong sell signal
  else if (atResistance && rsi > 65) {
    bounceSignal = "STRONG_SELL"
  } else if (atResistance && rsi > 55) {
    bounceSignal = "SELL"
  }

  return {
    atSupport,
    atResistance,
    level: closestLevel.name,
    bounceSignal,
    distance: minDistance,
  }
}

export interface PremiumOpportunity {
  type: "CALL" | "PUT" | "NONE"
  strength: "HIGH" | "MEDIUM" | "LOW"
  reason: string
  entryScore: number
  conditions: {
    atKeyLevel: boolean
    rsiExtreme: boolean
    volumeSpike: boolean
    macdCrossing: boolean
    trendAligning: boolean
  }
}

export function detectPremiumOpportunity(
  data: OHLCData[],
  currentPrice: number,
  pivots: { pivot: number; r1: number; r2: number; r3: number; s1: number; s2: number; s3: number },
): PremiumOpportunity {
  // Faster RSI for scalping (10 period instead of 14)
  const rsi = calculateRSI(data, 10)
  const currentRSI = rsi[rsi.length - 1] || 50
  
  // Faster MACD for scalping (8, 17, 9 instead of 12, 26, 9)
  const macd = calculateMACD(data, 8, 17, 9)
  const currentMACDCross = macd.crossover[macd.crossover.length - 1] || "HOLD"
  const macdHistogram = macd.histogram[macd.histogram.length - 1] || 0
  
  // Scalp-optimized SuperTrend (7, 2.5)
  const superTrend = calculateSuperTrend(data, 7, 2.5)
  const currentSTSignal = superTrend.signal[superTrend.signal.length - 1] || "HOLD"
  const currentSTTrend = superTrend.trend[superTrend.trend.length - 1] || 0
  
  // ADX with direction - KEY for determining trend
  const adxData = calculateADXWithDirection(data, 10)
  
  const volumeSpikes = detectVolumeSpike(data, 20, 1.3) // Lower threshold for scalps
  const hasVolumeSpike = volumeSpikes[volumeSpikes.length - 1] || false
  const bounceInfo = detectSupportResistanceBounce(currentPrice, pivots, currentRSI, 6) // Tighter threshold

  let entryScore = 0
  const conditions = {
    atKeyLevel: bounceInfo.atSupport || bounceInfo.atResistance,
    rsiExtreme: currentRSI < 35 || currentRSI > 65,
    volumeSpike: hasVolumeSpike,
    macdCrossing: currentMACDCross !== "HOLD",
    trendAligning: currentSTSignal !== "HOLD" || adxData.direction !== "NEUTRAL",
  }

  // Scoring for CALL/PUT opportunity
  let callScore = 0
  let putScore = 0

  // ADX Direction - PRIMARY signal for scalping (weight: 30)
  if (adxData.direction === "BULLISH" && adxData.strength !== "NO_TREND") {
    callScore += 30
    if (adxData.strength === "STRONG" || adxData.strength === "VERY_STRONG") callScore += 10
  } else if (adxData.direction === "BEARISH" && adxData.strength !== "NO_TREND") {
    putScore += 30
    if (adxData.strength === "STRONG" || adxData.strength === "VERY_STRONG") putScore += 10
  }

  // SuperTrend alignment (weight: 20)
  if (currentSTSignal === "BUY" || currentSTTrend === 1) {
    callScore += currentSTSignal === "BUY" ? 20 : 10
  }
  if (currentSTSignal === "SELL" || currentSTTrend === -1) {
    putScore += currentSTSignal === "SELL" ? 20 : 10
  }

  // CONFLICT CHECK: If ADX and SuperTrend disagree, reduce scores
  if ((adxData.direction === "BULLISH" && currentSTTrend === -1) ||
      (adxData.direction === "BEARISH" && currentSTTrend === 1)) {
    callScore = Math.max(0, callScore - 15)
    putScore = Math.max(0, putScore - 15)
  }

  // Support/Resistance levels (weight: 20)
  if (bounceInfo.atSupport) {
    callScore += 20
    if (bounceInfo.level === "S2" || bounceInfo.level === "S3") callScore += 10
  }
  if (bounceInfo.atResistance) {
    putScore += 20
    if (bounceInfo.level === "R2" || bounceInfo.level === "R3") putScore += 10
  }

  // RSI for scalping - different thresholds
  if (currentRSI < 25) callScore += 20  // Extremely oversold
  else if (currentRSI < 35) callScore += 12
  else if (currentRSI < 45) callScore += 5
  if (currentRSI > 75) putScore += 20   // Extremely overbought
  else if (currentRSI > 65) putScore += 12
  else if (currentRSI > 55) putScore += 5

  // MACD crossover and histogram momentum (weight: 15)
  if (currentMACDCross === "BUY") callScore += 15
  else if (macdHistogram > 0.3) callScore += 8
  if (currentMACDCross === "SELL") putScore += 15
  else if (macdHistogram < -0.3) putScore += 8

  // Volume spike confirmation
  if (hasVolumeSpike) {
    if (callScore > putScore) callScore += 10
    else if (putScore > callScore) putScore += 10
  }

  // Determine winner - lower threshold for scalps
  const isCall = callScore > putScore && callScore >= 35
  const isPut = putScore > callScore && putScore >= 35
  entryScore = Math.max(callScore, putScore)

  let strength: "HIGH" | "MEDIUM" | "LOW" = "LOW"
  if (entryScore >= 65) strength = "HIGH"
  else if (entryScore >= 45) strength = "MEDIUM"

  let reason = ""
  if (isCall) {
    reason = `CALL: `
    if (adxData.direction === "BULLISH") reason += `ADX BULLISH (+DI:${adxData.plusDI.toFixed(0)}), `
    if (currentSTTrend === 1) reason += `ST:UP, `
    reason += `RSI:${currentRSI.toFixed(0)}`
    if (bounceInfo.atSupport) reason += `, at ${bounceInfo.level}`
    if (currentMACDCross === "BUY") reason += `, MACD cross`
  } else if (isPut) {
    reason = `PUT: `
    if (adxData.direction === "BEARISH") reason += `ADX BEARISH (-DI:${adxData.minusDI.toFixed(0)}), `
    if (currentSTTrend === -1) reason += `ST:DOWN, `
    reason += `RSI:${currentRSI.toFixed(0)}`
    if (bounceInfo.atResistance) reason += `, at ${bounceInfo.level}`
    if (currentMACDCross === "SELL") reason += `, MACD cross`
  } else {
    reason = "WAIT - No clear direction or conflicting signals"
  }

  return {
    type: isCall ? "CALL" : isPut ? "PUT" : "NONE",
    strength,
    reason,
    entryScore,
    conditions,
  }
}

export function generateTradingSignal(
  data: OHLCData[],
  currentPrice: number,
): {
  signal: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL"
  confidence: number
  reasons: string[]
  macd: { value: number; signal: number; histogram: number; crossover: string }
  premiumOpportunity: PremiumOpportunity | null
} {
  const reasons: string[] = []
  let score = 0

  // Get pivot points from most recent data
  const lastCandle = data[data.length - 1]
  const pivots = calculatePivotPoints(lastCandle)

  // RSI Analysis
  const rsi = calculateRSI(data, 14)
  const currentRSI = rsi[rsi.length - 1] || 50
  if (currentRSI < 30) {
    score += 2.5
    reasons.push(`RSI oversold at ${currentRSI.toFixed(1)} - STRONG BUY zone`)
  } else if (currentRSI > 70) {
    score -= 2.5
    reasons.push(`RSI overbought at ${currentRSI.toFixed(1)} - STRONG SELL zone`)
  } else if (currentRSI < 40) {
    score += 1
    reasons.push(`RSI bullish at ${currentRSI.toFixed(1)}`)
  } else if (currentRSI > 60) {
    score -= 1
    reasons.push(`RSI bearish at ${currentRSI.toFixed(1)}`)
  }

  // RSI Divergence
  const divergence = detectRSIDivergence(data, rsi, 10)
  if (divergence.bullish) {
    score += 1.5
    reasons.push("Bullish RSI divergence detected")
  }
  if (divergence.bearish) {
    score -= 1.5
    reasons.push("Bearish RSI divergence detected")
  }

  // SuperTrend Analysis - using scalp-optimized parameters
  const superTrend = calculateSuperTrend(data, 7, 2.5)
  const stSignal = superTrend.signal[superTrend.signal.length - 1]
  const stTrend = superTrend.trend[superTrend.trend.length - 1]
  if (stSignal === "BUY") {
    score += 2.5
    reasons.push("SuperTrend: BUY signal (scalp)")
  } else if (stSignal === "SELL") {
    score -= 2.5
    reasons.push("SuperTrend: SELL signal (scalp)")
  } else if (stTrend === 1) {
    score += 1
    reasons.push("SuperTrend: Bullish trend")
  } else if (stTrend === -1) {
    score -= 1
    reasons.push("SuperTrend: Bearish trend")
  }

  // MACD Analysis - faster settings for scalping (8, 17, 9)
  const macd = calculateMACD(data, 8, 17, 9)
  const macdCrossover = macd.crossover[macd.crossover.length - 1]
  const macdHistogram = macd.histogram[macd.histogram.length - 1] || 0
  if (macdCrossover === "BUY") {
    score += 2.5
    reasons.push("MACD bullish crossover (scalp)")
  } else if (macdCrossover === "SELL") {
    score -= 2.5
    reasons.push("MACD bearish crossover (scalp)")
  }
  // Histogram momentum for scalping
  if (macdHistogram > 0.5) {
    score += 1
    reasons.push("MACD histogram strong bullish")
  } else if (macdHistogram < -0.5) {
    score -= 1
    reasons.push("MACD histogram strong bearish")
  }

  // ADX with Direction Analysis - KEY FIX: uses +DI/-DI for direction
  const adxData = calculateADXWithDirection(data, 10) // Faster period for scalping
  if (adxData.strength !== "NO_TREND" && adxData.strength !== "WEAK") {
    // Only add direction score if trend is strong enough
    if (adxData.direction === "BULLISH") {
      score += 2
      reasons.push(`ADX ${adxData.adx.toFixed(0)} BULLISH (+DI > -DI)`)
    } else if (adxData.direction === "BEARISH") {
      score -= 2
      reasons.push(`ADX ${adxData.adx.toFixed(0)} BEARISH (-DI > +DI)`)
    }
    // Amplify signal in strong trends
    if (adxData.strength === "VERY_STRONG" || adxData.strength === "STRONG") {
      score = score * 1.2
      reasons.push(`${adxData.strength} trend momentum`)
    }
  } else {
    reasons.push(`ADX ${adxData.adx.toFixed(0)} - Weak/no trend, signals unreliable`)
  }

  // EWO Analysis
  const ewo = calculateEWO(data, 5, 35)
  const ewoSignal = ewo.signal[ewo.signal.length - 1]
  if (ewoSignal === "BUY") {
    score += 1.5
    reasons.push("EWO: Bullish crossover")
  } else if (ewoSignal === "SELL") {
    score -= 1.5
    reasons.push("EWO: Bearish crossover")
  }

  // Support/Resistance Bounce
  const bounce = detectSupportResistanceBounce(currentPrice, pivots, currentRSI, 8)
  if (bounce.bounceSignal === "STRONG_BUY") {
    score += 2.5
    reasons.push(`At ${bounce.level} support with oversold RSI - BOUNCE SETUP`)
  } else if (bounce.bounceSignal === "BUY") {
    score += 1.5
    reasons.push(`Near ${bounce.level} support`)
  } else if (bounce.bounceSignal === "STRONG_SELL") {
    score -= 2.5
    reasons.push(`At ${bounce.level} resistance with overbought RSI - REVERSAL SETUP`)
  } else if (bounce.bounceSignal === "SELL") {
    score -= 1.5
    reasons.push(`Near ${bounce.level} resistance`)
  }

  // Volume Analysis
  const volumeSpikes = detectVolumeSpike(data, 20, 1.5)
  if (volumeSpikes[volumeSpikes.length - 1]) {
    reasons.push("Volume spike detected - Potential capitulation")
  }

  // Bollinger Bands Analysis
  const bb = calculateBollingerBands(data, 20, 2)
  const lastIdx = bb.upper.length - 1
  if (lastIdx >= 0) {
    if (currentPrice <= bb.lower[lastIdx]) {
      score += 1
      reasons.push("Price at lower Bollinger Band")
    } else if (currentPrice >= bb.upper[lastIdx]) {
      score -= 1
      reasons.push("Price at upper Bollinger Band")
    }
  }

  // Premium opportunity detection
  const premiumOpportunity = detectPremiumOpportunity(data, currentPrice, pivots)

  // Determine final signal
  let signal: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL"
  const confidence = Math.min(Math.abs(score) * 12, 100)

  if (score >= 5) {
    signal = "STRONG_BUY"
  } else if (score >= 2) {
    signal = "BUY"
  } else if (score <= -5) {
    signal = "STRONG_SELL"
  } else if (score <= -2) {
    signal = "SELL"
  } else {
    signal = "HOLD"
  }

  return {
    signal,
    confidence,
    reasons,
    macd: {
      value: macd.macd[macd.macd.length - 1] || 0,
      signal: macd.signal[macd.signal.length - 1] || 0,
      histogram: macdHistogram,
      crossover: macdCrossover || "HOLD",
    },
    premiumOpportunity,
  }
}

// Helper: ATR (Average True Range)
export function calculateATR(data: OHLCData[], period: number): number[] {
  const trueRanges: number[] = []

  for (let i = 1; i < data.length; i++) {
    const tr = Math.max(
      data[i].high - data[i].low,
      Math.abs(data[i].high - data[i - 1].close),
      Math.abs(data[i].low - data[i - 1].close),
    )
    trueRanges.push(tr)
  }

  return calculateEMA(trueRanges, period)
}

// Helper: SMA (Simple Moving Average)
function calculateSMA(data: number[], period: number): number[] {
  const sma: number[] = []
  for (let i = period - 1; i < data.length; i++) {
    const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0)
    sma.push(sum / period)
  }
  return sma
}

// Helper: EMA (Exponential Moving Average)
export function calculateEMA(data: number[], period: number): number[] {
  if (data.length === 0) return []

  const ema: number[] = []
  const multiplier = 2 / (period + 1)

  let emaPrev = data.slice(0, Math.min(period, data.length)).reduce((a, b) => a + b, 0) / Math.min(period, data.length)
  ema.push(emaPrev)

  for (let i = period; i < data.length; i++) {
    const emaValue = (data[i] - emaPrev) * multiplier + emaPrev
    ema.push(emaValue)
    emaPrev = emaValue
  }

  return ema
}

// Helper: Smooth data
function smoothData(data: number[], period: number): number[] {
  const smoothed: number[] = []
  let sum = data.slice(0, period).reduce((a, b) => a + b, 0)
  smoothed.push(sum)

  for (let i = period; i < data.length; i++) {
    sum = sum - data[i - period] + data[i]
    smoothed.push(sum)
  }

  return smoothed.map((s) => s / period)
}

// Volume Analysis function
export function analyzeVolume(
  data: OHLCData[],
  lookback = 20,
): { currentVolume: number; avgVolume: number; volumeRatio: number; signal: "HIGH" | "LOW" | "NORMAL" } {
  if (data.length < lookback) {
    return { currentVolume: 0, avgVolume: 0, volumeRatio: 1, signal: "NORMAL" }
  }

  const currentVolume = data[data.length - 1].volume
  const recentVolumes = data.slice(-lookback).map((d) => d.volume)
  const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / lookback
  const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1

  let signal: "HIGH" | "LOW" | "NORMAL" = "NORMAL"
  if (volumeRatio > 1.5) signal = "HIGH"
  else if (volumeRatio < 0.5) signal = "LOW"

  return { currentVolume, avgVolume, volumeRatio, signal }
}

// Trend Reversal Detection function
export interface TrendReversalWarning {
  hasWarning: boolean
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  type: "BULLISH_REVERSAL" | "BEARISH_REVERSAL" | "NONE"
  signals: string[]
  confidence: number
}

export function detectTrendReversal(
  data: OHLCData[],
  rsi: number[],
  macdHistogram: number[],
  adx: number[],
  currentPrice: number,
  pivots: { pivot: number; r1: number; r2: number; r3: number; s1: number; s2: number; s3: number },
): TrendReversalWarning {
  const signals: string[] = []
  let bullishScore = 0
  let bearishScore = 0

  if (data.length < 5 || rsi.length < 5) {
    return { hasWarning: false, severity: "LOW", type: "NONE", signals: [], confidence: 0 }
  }

  const currentRSI = rsi[rsi.length - 1] || 50
  const prevRSI = rsi[rsi.length - 2] || 50

  // 1. RSI Divergence Check
  const divergence = detectRSIDivergence(data, rsi, 10)
  if (divergence.bullish) {
    bullishScore += 25
    signals.push("Bullish RSI divergence")
  }
  if (divergence.bearish) {
    bearishScore += 25
    signals.push("Bearish RSI divergence")
  }

  // 2. RSI Extreme Zones with reversal - more extreme thresholds
  if (currentRSI < 20) {
    bullishScore += 20
    signals.push("RSI extremely oversold")
  }
  if (currentRSI > 80) {
    bearishScore += 20
    signals.push("RSI extremely overbought")
  }

  // 3. MACD Histogram Check
  const currentMacdHist = macdHistogram[macdHistogram.length - 1] || 0
  const prevMacdHist = macdHistogram[macdHistogram.length - 2] || 0

  if (currentMacdHist > 0 && prevMacdHist <= 0) {
    bullishScore += 15
    signals.push("MACD Histogram turned positive")
  } else if (currentMacdHist < 0 && prevMacdHist >= 0) {
    bearishScore += 15
    signals.push("MACD Histogram turned negative")
  }

  // 4. ADX Check for Trend Strength
  const currentADX = adx[adx.length - 1] || 0
  if (currentADX < 25) {
    bullishScore -= 10
    bearishScore -= 10
    signals.push("Weak trend strength (ADX < 25)")
  }

  // 5. Support/Resistance Levels Check
  const bounceInfo = detectSupportResistanceBounce(currentPrice, pivots, currentRSI, 8)
  if (bounceInfo.atSupport && bounceInfo.bounceSignal === "STRONG_BUY") {
    bullishScore += 20
    signals.push("Strong bounce near support")
  } else if (bounceInfo.atResistance && bounceInfo.bounceSignal === "STRONG_SELL") {
    bearishScore += 20
    signals.push("Strong bounce near resistance")
  }

  // Determine warning type and severity
  let hasWarning = false
  let severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW"
  let type: "BULLISH_REVERSAL" | "BEARISH_REVERSAL" | "NONE" = "NONE"
  let confidence = 0

  if (bullishScore > bearishScore) {
    hasWarning = true
    type = "BULLISH_REVERSAL"
    confidence = bullishScore
    severity = bullishScore >= 50 ? "CRITICAL" : bullishScore >= 30 ? "HIGH" : "MEDIUM"
  } else if (bearishScore > bullishScore) {
    hasWarning = true
    type = "BEARISH_REVERSAL"
    confidence = bearishScore
    severity = bearishScore >= 50 ? "CRITICAL" : bearishScore >= 30 ? "HIGH" : "MEDIUM"
  }

  return {
    hasWarning,
    severity,
    type,
    signals,
    confidence,
  }
}

// Export aliases for getPivotPoints and getBollingerBands
export const getPivotPoints = calculatePivotPoints
export const getBollingerBands = calculateBollingerBands

// Function to get relative volume for chart
export function getRelativeVolumeForChart(
  data: OHLCData[],
  lookback = 20,
): { volumeRatio: number; signal: "BUY" | "SELL" | "HOLD"; currentVolume: number; avgVolume: number } {
  const analysis = analyzeVolume(data, lookback)

  // Determine signal based on volume and price action
  let signal: "BUY" | "SELL" | "HOLD" = "HOLD"
  if (data.length >= 2) {
    const lastCandle = data[data.length - 1]
    const prevCandle = data[data.length - 2]
    const priceUp = lastCandle.close > prevCandle.close

    if (analysis.volumeRatio > 1.5) {
      signal = priceUp ? "BUY" : "SELL"
    }
  }

  return {
    volumeRatio: analysis.volumeRatio,
    signal,
    currentVolume: analysis.currentVolume,
    avgVolume: analysis.avgVolume,
  }
}

// Internal use function for calculateATR
function calculateATRExport(data: OHLCData[], period: number): number[] {
  return calculateATR(data, period)
}

// Function to calculate ATR with slope
export function calculateATRWithSlope(
  data: OHLCData[],
  period = 14,
  slopeLookback = 5,
): { current: number; slope: number; isExpanding: boolean; expansionRate: number } {
  const atrValues = calculateATR(data, period)
  const current = atrValues[atrValues.length - 1] || 0

  if (atrValues.length < slopeLookback + 1) {
    return { current, slope: 0, isExpanding: false, expansionRate: 0 }
  }

  const recentATR = atrValues.slice(-slopeLookback)
  const oldATR = recentATR[0] || 1
  const newATR = recentATR[recentATR.length - 1] || 1
  const slope = newATR - oldATR
  const expansionRate = ((newATR - oldATR) / oldATR) * 100

  return {
    current,
    slope,
    isExpanding: slope > 0,
    expansionRate,
  }
}

// Function to calculate VWAP
export function calculateVWAP(data: OHLCData[]): {
  vwap: number
  upperBand: number
  lowerBand: number
  pricePosition: string
  signal: string
} {
  if (data.length === 0) {
    return { vwap: 0, upperBand: 0, lowerBand: 0, pricePosition: "AT_VWAP", signal: "HOLD" }
  }

  let cumulativeTPV = 0
  let cumulativeVolume = 0
  const tpvArray: number[] = []

  for (const candle of data) {
    const typicalPrice = (candle.high + candle.low + candle.close) / 3
    cumulativeTPV += typicalPrice * candle.volume
    cumulativeVolume += candle.volume
    tpvArray.push(typicalPrice)
  }

  const vwap = cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : data[data.length - 1].close

  // Calculate standard deviation for bands
  const squaredDiffs = tpvArray.map((tp) => Math.pow(tp - vwap, 2))
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length
  const stdDev = Math.sqrt(avgSquaredDiff)

  const upperBand = vwap + stdDev * 2
  const lowerBand = vwap - stdDev * 2

  const currentPrice = data[data.length - 1].close
  let pricePosition = "AT_VWAP"
  let signal = "HOLD"

  if (currentPrice > upperBand) {
    pricePosition = "ABOVE_UPPER"
    signal = "DOWNWARD_RUN"
  } else if (currentPrice < lowerBand) {
    pricePosition = "BELOW_LOWER"
    signal = "UPWARD_RUN"
  } else if (currentPrice > vwap) {
    pricePosition = "ABOVE_VWAP"
    signal = "UPWARD_RUN"
  } else if (currentPrice < vwap) {
    pricePosition = "BELOW_VWAP"
    signal = "DOWNWARD_RUN"
  }

  return { vwap, upperBand, lowerBand, pricePosition, signal }
}

// Function to calculate RVOL
export function calculateRVOL(
  data: OHLCData[],
  lookback = 20,
): { currentRVOL: number; avgVolume: number; isSpike: boolean } {
  if (data.length < lookback + 1) {
    return { currentRVOL: 1, avgVolume: 0, isSpike: false }
  }

  const currentVolume = data[data.length - 1].volume
  const historicalVolumes = data.slice(-lookback - 1, -1).map((d) => d.volume)
  const avgVolume = historicalVolumes.reduce((a, b) => a + b, 0) / lookback
  const currentRVOL = avgVolume > 0 ? currentVolume / avgVolume : 1

  return {
    currentRVOL,
    avgVolume,
    isSpike: currentRVOL > 1.5,
  }
}

// Function to calculate net volume
export function calculateNetVolume(
  data: OHLCData[],
  lookback = 5,
): { netVolume: number; direction: "POSITIVE" | "NEGATIVE" | "NEUTRAL" } {
  if (data.length < lookback) {
    return { netVolume: 0, direction: "NEUTRAL" }
  }

  const recentCandles = data.slice(-lookback)
  let buyVolume = 0
  let sellVolume = 0

  for (const candle of recentCandles) {
    if (candle.close > candle.open) {
      buyVolume += candle.volume
    } else {
      sellVolume += candle.volume
    }
  }

  const netVolume = buyVolume - sellVolume
  const direction = netVolume > 0 ? "POSITIVE" : netVolume < 0 ? "NEGATIVE" : "NEUTRAL"

  return { netVolume, direction }
}

// Function to calculate Heikin-Ashi
export function calculateHeikinAshi(data: OHLCData[]): { signal: "UP" | "DOWN" | "NEUTRAL"; haCandles: OHLCData[] } {
  if (data.length < 2) {
    return { signal: "NEUTRAL", haCandles: [] }
  }

  const haCandles: OHLCData[] = []

  for (let i = 0; i < data.length; i++) {
    const candle = data[i]
    const haClose = (candle.open + candle.high + candle.low + candle.close) / 4

    let haOpen: number
    if (i === 0) {
      haOpen = (candle.open + candle.close) / 2
    } else {
      const prevHA = haCandles[i - 1]
      haOpen = (prevHA.open + prevHA.close) / 2
    }

    const haHigh = Math.max(candle.high, haOpen, haClose)
    const haLow = Math.min(candle.low, haOpen, haClose)

    haCandles.push({
      time: candle.time,
      open: haOpen,
      high: haHigh,
      low: haLow,
      close: haClose,
      volume: candle.volume,
    })
  }

  // Determine signal from last few HA candles
  const lastHA = haCandles[haCandles.length - 1]
  const prevHA = haCandles[haCandles.length - 2]

  if (lastHA.close > lastHA.open && prevHA.close > prevHA.open) {
    return { signal: "UP", haCandles }
  } else if (lastHA.close < lastHA.open && prevHA.close < prevHA.open) {
    return { signal: "DOWN", haCandles }
  }

  return { signal: "NEUTRAL", haCandles }
}

// Function to calculate reversal probability
export function calculateReversalProbability(
  data: OHLCData[],
  type: "UPWARD_RUN" | "DOWNWARD_RUN",
): { probability: number; level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; factors: string[] } {
  const factors: string[] = []
  let probability = 0

  const rsi = calculateRSI(data, 14)
  const currentRSI = rsi[rsi.length - 1] || 50
  const vwap = calculateVWAP(data)

  // RSI extremes
  if (type === "UPWARD_RUN" && currentRSI > 70) {
    probability += 25
    factors.push("RSI overbought")
  } else if (type === "DOWNWARD_RUN" && currentRSI < 30) {
    probability += 25
    factors.push("RSI oversold")
  }

  // VWAP extension
  if (type === "UPWARD_RUN" && vwap.pricePosition === "ABOVE_UPPER") {
    probability += 20
    factors.push("Price extended above VWAP")
  } else if (type === "DOWNWARD_RUN" && vwap.pricePosition === "BELOW_LOWER") {
    probability += 20
    factors.push("Price extended below VWAP")
  }

  // Determine level
  let level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW"
  if (probability >= 60) level = "CRITICAL"
  else if (probability >= 40) level = "HIGH"
  else if (probability >= 20) level = "MEDIUM"

  return { probability, level, factors }
}

// Run Alert System
export interface RunAlert {
  id: string
  type: "UPWARD_RUN" | "DOWNWARD_RUN" | "SQUEEZE_LONG" | "SQUEEZE_SHORT" | "TRAP_FADE_LONG" | "TRAP_FADE_SHORT"
  confidence: "HIGH" | "MEDIUM" | "LOW"
  timestamp: Date
  indicators: {
    name: string
    value: string | number
    weight: number
    contributing: boolean
  }[]
  conditions: {
    priceSlope: number
    vwapPosition: string
    volumeSpike: boolean
    atrExpanding: boolean
  }
  muted: boolean
  muteReason?: string
  notes: string[]
  entryPrice?: number
  targetPrice?: number
  stopLoss?: number
  expectedGain?: string
  expectedHoldTime?: string
  superTrendConfirmed: boolean
  trendStrength?: "WEAK" | "MODERATE" | "STRONG" | "VERY_STRONG"
  reversalProbability?: number
  reversalLevel?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  reversalFactors?: string[]
  // New scalp alert fields
  explanation?: string // Single-line explanation: "Director: X | Validator: X | Trigger: X"
  director?: "BULL" | "BEAR" | "CHOP" | "TRAP"
  validator?: "BULL" | "BEAR" | "NEUTRAL"
}

export interface RunAlertConfig {
  atrSlopeThreshold: number
  volumeSpikeThreshold: number
  volumeMuteThreshold: number
  candleBodyMinPercent: number
}

export function detectRunAlert(
  data: OHLCData[],
  config: RunAlertConfig = {
    atrSlopeThreshold: 8,  // Lower threshold for scalping sensitivity
    volumeSpikeThreshold: 1.3,  // More sensitive for scalps
    volumeMuteThreshold: 40,
    candleBodyMinPercent: 25,
  },
  realtimePrice?: number,
): RunAlert | null {
  if (data.length < 50) return null

  const indicators: RunAlert["indicators"] = []
  const notes: string[] = []
  let bullishScore = 0
  let bearishScore = 0

  // Scalp-optimized SuperTrend (7, 2.5)
  const stData = calculateSuperTrend(data, 7, 2.5)
  const stSignal = stData.signal[stData.signal.length - 1]
  const stTrend = stData.trend[stData.trend.length - 1]
  const superTrendConfirmed = stSignal !== "HOLD"

  // ADX with direction - KEY FIX: properly uses +DI/-DI
  const adxDir = calculateADXWithDirection(data, 10)
  const currentADX = adxDir.adx

  // Validate that SuperTrend direction matches ADX direction
  const directionMismatch = 
    (stSignal === "BUY" && adxDir.direction === "BEARISH") ||
    (stSignal === "SELL" && adxDir.direction === "BULLISH")

  if (directionMismatch && adxDir.strength !== "NO_TREND" && adxDir.strength !== "WEAK") {
    notes.push(`⚠️ CONFLICT: SuperTrend ${stSignal} but ADX shows ${adxDir.direction} - Wait for confirmation`)
    return null  // Don't trigger alert on conflicting signals
  }

  if (!superTrendConfirmed && stTrend === 0) {
    return null
  }

  // Calculate weight based on ADX strength and direction alignment
  let superTrendWeight = 35
  if (adxDir.strength === "NO_TREND" || currentADX < 15) {
    superTrendWeight = 10
    notes.push("⚠️ ADX < 15: No clear trend - signals unreliable")
  } else if (adxDir.strength === "WEAK" || currentADX < 20) {
    superTrendWeight = 20
    notes.push("⚠️ ADX 15-20: Weak trend, proceed with caution")
  } else if (adxDir.strength === "MODERATE") {
    superTrendWeight = 30
  } else if (adxDir.strength === "STRONG" || adxDir.strength === "VERY_STRONG") {
    superTrendWeight = 40
    notes.push(`ADX ${currentADX.toFixed(0)} with ${adxDir.direction} - Strong trend`)
  }

  // Add ADX direction indicator
  indicators.push({
    name: "ADX Direction",
    value: `${adxDir.direction} (${adxDir.plusDI.toFixed(0)}/${adxDir.minusDI.toFixed(0)})`,
    weight: 20,
    contributing: adxDir.direction !== "NEUTRAL" && adxDir.strength !== "WEAK",
  })

  indicators.push({
    name: "SuperTrend 1M",
    value: stSignal !== "HOLD" ? stSignal : (stTrend === 1 ? "BULLISH" : "BEARISH"),
    weight: superTrendWeight,
    contributing: true,
  })

  // Use ADX direction as primary, SuperTrend as confirmation
  if (adxDir.direction === "BULLISH" && (stSignal === "BUY" || stTrend === 1)) {
    bullishScore += superTrendWeight + 15
    notes.push(`Confirmed BULLISH: ADX +DI(${adxDir.plusDI.toFixed(0)}) > -DI(${adxDir.minusDI.toFixed(0)}) + SuperTrend`)
  } else if (adxDir.direction === "BEARISH" && (stSignal === "SELL" || stTrend === -1)) {
    bearishScore += superTrendWeight + 15
    notes.push(`Confirmed BEARISH: ADX -DI(${adxDir.minusDI.toFixed(0)}) > +DI(${adxDir.plusDI.toFixed(0)}) + SuperTrend`)
  } else if (stSignal === "BUY") {
    bullishScore += superTrendWeight
    notes.push(`SuperTrend BULLISH (ADX neutral)`)
  } else if (stSignal === "SELL") {
    bearishScore += superTrendWeight
    notes.push(`SuperTrend BEARISH (ADX neutral)`)
  } else if (stTrend === 1) {
    bullishScore += superTrendWeight * 0.6
  } else if (stTrend === -1) {
    bearishScore += superTrendWeight * 0.6
  }

  const atrData = calculateATRWithSlope(data, 14, 5)
  const atrContributing = atrData.isExpanding && atrData.expansionRate > config.atrSlopeThreshold
  indicators.push({
    name: "ATR Slope",
    value: `${atrData.expansionRate.toFixed(1)}%`,
    weight: 10,
    contributing: atrContributing,
  })
  if (atrContributing) {
    bullishScore += 5
    bearishScore += 5
    notes.push(`ATR expanding at ${atrData.expansionRate.toFixed(1)}% - trend strengthening`)
  }

  const vwapData = calculateVWAP(data)
  const vwapExtended = vwapData.pricePosition === "ABOVE_UPPER" || vwapData.pricePosition === "BELOW_LOWER"

  let vwapAligned = false
  let vwapWarning = false

  if (stSignal === "BUY") {
    if (vwapData.pricePosition === "ABOVE_UPPER") {
      vwapWarning = true
      notes.push("⚠️ VWAP: Price extended above upper band - reversal risk")
    } else if (vwapData.signal === "UPWARD_RUN") {
      vwapAligned = true
    }
  } else if (stSignal === "SELL") {
    if (vwapData.pricePosition === "BELOW_LOWER") {
      vwapWarning = true
      notes.push("⚠️ VWAP: Price extended below lower band - reversal risk")
    } else if (vwapData.signal === "DOWNWARD_RUN") {
      vwapAligned = true
    }
  }

  indicators.push({
    name: "VWAP Position",
    value: vwapData.pricePosition,
    weight: vwapWarning ? -10 : 15,
    contributing: vwapAligned,
  })

  if (vwapAligned && !vwapWarning) {
    if (stSignal === "BUY") {
      bullishScore += 15
      notes.push("VWAP confirms bullish - healthy position")
    } else {
      bearishScore += 15
      notes.push("VWAP confirms bearish - healthy position")
    }
  } else if (vwapWarning) {
    if (stSignal === "BUY") bullishScore -= 10
    else bearishScore -= 10
  }

  const rvolData = calculateRVOL(data, 20)
  const volumeSpike = rvolData.currentRVOL > config.volumeSpikeThreshold
  indicators.push({
    name: "RVOL",
    value: `${rvolData.currentRVOL.toFixed(2)}x`,
    weight: 10,
    contributing: volumeSpike,
  })
  if (volumeSpike) {
    const netVol = calculateNetVolume(data, 5)
    const volumeAligned =
      (stSignal === "BUY" && netVol.direction === "POSITIVE") ||
      (stSignal === "SELL" && netVol.direction === "NEGATIVE")
    if (volumeAligned) {
      if (stSignal === "BUY") bullishScore += 10
      else bearishScore += 10
      notes.push(
        `Volume confirms trend: ${rvolData.currentRVOL.toFixed(1)}x with ${netVol.direction.toLowerCase()} flow`,
      )
    }
  }

  // ADX strength already factored in via adxDir - add strength indicator
  const strongTrend = adxDir.strength === "STRONG" || adxDir.strength === "VERY_STRONG"
  indicators.push({
    name: "ADX Strength",
    value: `${currentADX.toFixed(1)} (${adxDir.strength})`,
    weight: strongTrend ? 15 : 5,
    contributing: strongTrend,
  })

  const haData = calculateHeikinAshi(data)
  const haAligned = (stSignal === "BUY" && haData.signal === "UP") || (stSignal === "SELL" && haData.signal === "DOWN")
  indicators.push({
    name: "Heikin-Ashi",
    value: haData.signal,
    weight: 10,
    contributing: haAligned,
  })
  if (haAligned) {
    if (stSignal === "BUY") bullishScore += 10
    else bearishScore += 10
    notes.push(`Heikin-Ashi confirms trend direction`)
  } else if (haData.signal !== "NEUTRAL") {
    notes.push(`⚠️ Heikin-Ashi ${haData.signal} - trend not confirmed`)
  }

  const maxScore = Math.max(bullishScore, bearishScore)
  const type: "UPWARD_RUN" | "DOWNWARD_RUN" = bullishScore > bearishScore ? "UPWARD_RUN" : "DOWNWARD_RUN"
  const confidence: "HIGH" | "MEDIUM" | "LOW" = maxScore >= 70 ? "HIGH" : maxScore >= 50 ? "MEDIUM" : "LOW"

  let trendStrength: "WEAK" | "MODERATE" | "STRONG" | "VERY_STRONG" = "WEAK"
  if (maxScore >= 80) trendStrength = "VERY_STRONG"
  else if (maxScore >= 60) trendStrength = "STRONG"
  else if (maxScore >= 40) trendStrength = "MODERATE"

  const recentCandles = data.slice(-5)
  const priceSlope =
    ((recentCandles[recentCandles.length - 1].close - recentCandles[0].close) / recentCandles[0].close) * 100

  const reversalData = calculateReversalProbability(data, type)

  let muted = false
  let muteReason: string | undefined

  const avgVolume = data.slice(-20).reduce((sum, d) => sum + d.volume, 0) / 20
  const currentVolume = data[data.length - 1].volume
  if (currentVolume < avgVolume * (config.volumeMuteThreshold / 100)) {
    muted = true
    muteReason = `Low volume (${((currentVolume / avgVolume) * 100).toFixed(0)}% of avg)`
  }

  if (adxDir.strength === "NO_TREND") {
    muted = true
    muteReason = `ADX too weak (${currentADX.toFixed(1)}) - no real trend`
  }

  const lastCandle = data[data.length - 1]
  const candleBody = Math.abs(lastCandle.close - lastCandle.open)
  const avgBody = data.slice(-20).reduce((sum, d) => sum + Math.abs(d.close - d.open), 0) / 20
  if (candleBody < avgBody * (config.candleBodyMinPercent / 100)) {
    muted = true
    muteReason = `Candle body ${((candleBody / avgBody) * 100).toFixed(0)}% of avg`
  }

  if (trendStrength === "WEAK" || maxScore < 35) return null

  const currentPrice = realtimePrice || lastCandle.close
  const atrValue = atrData.current || lastCandle.high - lastCandle.low

  let entryPrice: number
  let targetPrice: number
  let stopLoss: number

  // SCALP-OPTIMIZED: Tighter targets for 5-15 minute holds
  // Use 1.5-2x risk/reward ratio with ATR-based stops
  const targetMultiplier = trendStrength === "VERY_STRONG" ? 1.2 : trendStrength === "STRONG" ? 1.0 : 0.7
  const stopMultiplier = trendStrength === "VERY_STRONG" ? 0.6 : trendStrength === "STRONG" ? 0.5 : 0.4

  if (type === "UPWARD_RUN") {
    // Entry slightly above current for confirmation
    entryPrice = currentPrice + atrValue * 0.02
    targetPrice = currentPrice + atrValue * targetMultiplier
    stopLoss = currentPrice - atrValue * stopMultiplier
  } else {
    // Entry slightly below current for confirmation
    entryPrice = currentPrice - atrValue * 0.02
    targetPrice = currentPrice - atrValue * targetMultiplier
    stopLoss = currentPrice + atrValue * stopMultiplier
  }

  // Calculate expected gain in points and percentage
  const expectedGainPts = Math.abs(targetPrice - entryPrice)
  const expectedGainPct = (expectedGainPts / currentPrice) * 100
  
  // Lower threshold for scalps - even small moves can be profitable with options
  const MIN_PROFIT_THRESHOLD = 0.15 // 0.15% minimum for SPX scalps (~$10 move)
  if (expectedGainPct < MIN_PROFIT_THRESHOLD) {
    return null
  }
  const expectedGain = `+$${expectedGainPts.toFixed(2)} (${expectedGainPct.toFixed(2)}%)`

  // Scalp-optimized hold times
  let holdMinutes = "5-15 min"
  if (trendStrength === "VERY_STRONG") holdMinutes = "3-7 min"
  else if (trendStrength === "STRONG") holdMinutes = "5-10 min"
  else if (trendStrength === "MODERATE") holdMinutes = "8-15 min"

  const stableId = `run-${type}-${confidence}-${stSignal}-${Math.round(currentPrice)}`

  return {
    id: stableId,
    type,
    confidence,
    timestamp: new Date(),
    indicators,
    conditions: {
      priceSlope,
      vwapPosition: vwapData.pricePosition,
      volumeSpike,
      atrExpanding: atrData.isExpanding,
    },
    muted,
    muteReason,
    notes,
    entryPrice,
    targetPrice,
    stopLoss,
    expectedGain,
    expectedHoldTime: holdMinutes,
    superTrendConfirmed: true,
    trendStrength,
    reversalProbability: reversalData.probability,
    reversalLevel: reversalData.level,
    reversalFactors: reversalData.factors,
  }
}

// Visual Monitoring Data
export interface VisualMonitoringData {
  superTrend: { signal: "BUY" | "SELL" | "HOLD"; trend: number } | null
  vwap: { vwap: number; pricePosition: string } | null
  atr: { current: number; expansionRate: number; isExpanding: boolean } | null
  rsi: number | null
  adx: number | null
}

export function getVisualMonitoringData(data: OHLCData[]): VisualMonitoringData {
  if (data.length < 50) {
    return { superTrend: null, vwap: null, atr: null, rsi: null, adx: null }
  }

  const stData = calculateSuperTrend(data, 10, 3)
  const vwapData = calculateVWAP(data)
  const atrData = calculateATRWithSlope(data, 14, 5)
  const rsiData = calculateRSI(data, 14)
  const adxData = calculateADX(data, 14)

  return {
    superTrend: {
      signal: stData.signal[stData.signal.length - 1] || "HOLD",
      trend: stData.trend[stData.trend.length - 1] || 0,
    },
    vwap: {
      vwap: vwapData.vwap,
      pricePosition: vwapData.pricePosition,
    },
    atr: {
      current: atrData.current,
      expansionRate: atrData.expansionRate,
      isExpanding: atrData.isExpanding,
    },
    rsi: rsiData[rsiData.length - 1] || null,
    adx: adxData[adxData.length - 1] || null,
  }
}

// Ichimoku Cloud Calculation
export interface IchimokuData {
  tenkanSen: number[] // Conversion Line (9-period)
  kijunSen: number[] // Base Line (26-period)
  senkouSpanA: number[] // Leading Span A
  senkouSpanB: number[] // Leading Span B (52-period)
  chikouSpan: number[] // Lagging Span
  signal: "BULLISH" | "BEARISH" | "NEUTRAL"
  cloudTop: number
  cloudBottom: number
  priceAboveCloud: boolean
  priceBelowCloud: boolean
}

export function calculateIchimoku(data: OHLCData[], tenkanPeriod = 9, kijunPeriod = 26, senkouBPeriod = 52): IchimokuData {
  const tenkanSen: number[] = []
  const kijunSen: number[] = []
  const senkouSpanA: number[] = []
  const senkouSpanB: number[] = []
  const chikouSpan: number[] = []

  // Helper to get highest high and lowest low
  const getHighLow = (slice: OHLCData[]) => {
    const highs = slice.map((d) => d.high)
    const lows = slice.map((d) => d.low)
    return {
      high: Math.max(...highs),
      low: Math.min(...lows),
    }
  }

  for (let i = 0; i < data.length; i++) {
    // Tenkan-sen (Conversion Line) - 9-period
    if (i >= tenkanPeriod - 1) {
      const hl = getHighLow(data.slice(i - tenkanPeriod + 1, i + 1))
      tenkanSen.push((hl.high + hl.low) / 2)
    }

    // Kijun-sen (Base Line) - 26-period
    if (i >= kijunPeriod - 1) {
      const hl = getHighLow(data.slice(i - kijunPeriod + 1, i + 1))
      kijunSen.push((hl.high + hl.low) / 2)
    }

    // Senkou Span B - 52-period
    if (i >= senkouBPeriod - 1) {
      const hl = getHighLow(data.slice(i - senkouBPeriod + 1, i + 1))
      senkouSpanB.push((hl.high + hl.low) / 2)
    }

    // Chikou Span (Lagging Span) - current close shifted back 26 periods
    if (i >= kijunPeriod) {
      chikouSpan.push(data[i - kijunPeriod].close)
    }
  }

  // Senkou Span A - average of Tenkan and Kijun, shifted forward 26 periods
  const minLen = Math.min(tenkanSen.length, kijunSen.length)
  for (let i = 0; i < minLen; i++) {
    const tenkanIdx = tenkanSen.length - minLen + i
    const kijunIdx = kijunSen.length - minLen + i
    senkouSpanA.push((tenkanSen[tenkanIdx] + kijunSen[kijunIdx]) / 2)
  }

  // Get current values
  const currentTenkan = tenkanSen[tenkanSen.length - 1] || 0
  const currentKijun = kijunSen[kijunSen.length - 1] || 0
  const currentSpanA = senkouSpanA[senkouSpanA.length - 1] || 0
  const currentSpanB = senkouSpanB[senkouSpanB.length - 1] || 0
  const currentPrice = data[data.length - 1]?.close || 0

  const cloudTop = Math.max(currentSpanA, currentSpanB)
  const cloudBottom = Math.min(currentSpanA, currentSpanB)

  const priceAboveCloud = currentPrice > cloudTop
  const priceBelowCloud = currentPrice < cloudBottom

  // Determine signal
  let signal: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL"
  if (priceAboveCloud && currentTenkan > currentKijun) {
    signal = "BULLISH"
  } else if (priceBelowCloud && currentTenkan < currentKijun) {
    signal = "BEARISH"
  }

  return {
    tenkanSen,
    kijunSen,
    senkouSpanA,
    senkouSpanB,
    chikouSpan,
    signal,
    cloudTop,
    cloudBottom,
    priceAboveCloud,
    priceBelowCloud,
  }
}

// Reversal Price Point Calculation
export interface ReversalPricePoint {
  price: number
  confidence: number
  direction: "BULLISH" | "BEARISH"
  sources: {
    name: string
    level: number
    weight: number
  }[]
  reasoning: string[]
}

export function calculateReversalPricePoint(
  data: OHLCData[],
  currentPrice: number,
  pivots: { pivot: number; r1: number; r2: number; r3: number; s1: number; s2: number; s3: number },
): ReversalPricePoint | null {
  if (data.length < 52) return null

  const sources: ReversalPricePoint["sources"] = []
  const reasoning: string[] = []
  let totalWeight = 0
  let weightedSum = 0

  // Get all indicator data
  const bb = calculateBollingerBands(data, 20, 2)
  const ichimoku = calculateIchimoku(data)
  const rsi = calculateRSI(data, 14)
  const macd = calculateMACD(data, 12, 26, 9)
  const superTrend = calculateSuperTrend(data, 10, 3)
  const vwap = calculateVWAP(data)
  const adx = calculateADX(data, 14)

  const currentRSI = rsi[rsi.length - 1] || 50
  const currentADX = adx[adx.length - 1] || 20
  const stSignal = superTrend.signal[superTrend.signal.length - 1]
  const macdHistogram = macd.histogram[macd.histogram.length - 1] || 0

  // Determine if we're looking for bullish or bearish reversal
  const isBearishTrend = stSignal === "SELL" || currentRSI > 60
  const isBullishTrend = stSignal === "BUY" || currentRSI < 40

  // For bearish trend, look for bullish reversal points (support levels)
  // For bullish trend, look for bearish reversal points (resistance levels)

  if (isBearishTrend || (!isBullishTrend && currentPrice < pivots.pivot)) {
    // Looking for BULLISH reversal - find support levels
    // Use tighter thresholds based on distance from level (closer = higher weight contribution)

    // 1. Bollinger Lower Band (Weight: up to 25)
    const bbLower = bb.lower[bb.lower.length - 1]
    if (bbLower && bbLower > 0) {
      const distancePct = Math.abs(currentPrice - bbLower) / currentPrice
      if (distancePct < 0.005) { // Within 0.5% - very close
        sources.push({ name: "BB Lower", level: bbLower, weight: 25 })
        weightedSum += bbLower * 25
        totalWeight += 25
        reasoning.push(`At BB lower band $${bbLower.toFixed(2)}`)
      } else if (distancePct < 0.01) { // Within 1%
        sources.push({ name: "BB Lower", level: bbLower, weight: 15 })
        weightedSum += bbLower * 15
        totalWeight += 15
        reasoning.push(`Near BB lower band $${bbLower.toFixed(2)}`)
      } else if (distancePct < 0.02) { // Within 2%
        sources.push({ name: "BB Lower", level: bbLower, weight: 8 })
        weightedSum += bbLower * 8
        totalWeight += 8
        reasoning.push(`Approaching BB lower band $${bbLower.toFixed(2)}`)
      }
    }

    // 2. Ichimoku Cloud Bottom (Weight: up to 20)
    if (ichimoku.cloudBottom > 0) {
      const distancePct = Math.abs(currentPrice - ichimoku.cloudBottom) / currentPrice
      if (distancePct < 0.005) {
        sources.push({ name: "Ichimoku Cloud", level: ichimoku.cloudBottom, weight: 20 })
        weightedSum += ichimoku.cloudBottom * 20
        totalWeight += 20
        reasoning.push(`At Ichimoku cloud bottom $${ichimoku.cloudBottom.toFixed(2)}`)
      } else if (distancePct < 0.01) {
        sources.push({ name: "Ichimoku Cloud", level: ichimoku.cloudBottom, weight: 12 })
        weightedSum += ichimoku.cloudBottom * 12
        totalWeight += 12
        reasoning.push(`Near Ichimoku cloud bottom $${ichimoku.cloudBottom.toFixed(2)}`)
      } else if (distancePct < 0.02) {
        sources.push({ name: "Ichimoku Cloud", level: ichimoku.cloudBottom, weight: 5 })
        weightedSum += ichimoku.cloudBottom * 5
        totalWeight += 5
        reasoning.push(`Approaching Ichimoku cloud $${ichimoku.cloudBottom.toFixed(2)}`)
      }
    }

    // 3. Kijun-sen (Base Line) (Weight: up to 15)
    const kijun = ichimoku.kijunSen[ichimoku.kijunSen.length - 1]
    if (kijun && kijun > 0) {
      const distancePct = Math.abs(currentPrice - kijun) / currentPrice
      if (distancePct < 0.003) {
        sources.push({ name: "Kijun-sen", level: kijun, weight: 15 })
        weightedSum += kijun * 15
        totalWeight += 15
        reasoning.push(`At Kijun-sen $${kijun.toFixed(2)}`)
      } else if (distancePct < 0.008) {
        sources.push({ name: "Kijun-sen", level: kijun, weight: 8 })
        weightedSum += kijun * 8
        totalWeight += 8
        reasoning.push(`Near Kijun-sen $${kijun.toFixed(2)}`)
      }
    }

    // 4. Pivot Support Levels (Weight: up to 20)
    const nearestSupport =
      currentPrice > pivots.s1
        ? pivots.s1
        : currentPrice > pivots.s2
          ? pivots.s2
          : pivots.s3
    if (nearestSupport > 0) {
      const distancePct = Math.abs(currentPrice - nearestSupport) / currentPrice
      if (distancePct < 0.003) {
        sources.push({ name: "Pivot Support", level: nearestSupport, weight: 20 })
        weightedSum += nearestSupport * 20
        totalWeight += 20
        reasoning.push(`At pivot support $${nearestSupport.toFixed(2)}`)
      } else if (distancePct < 0.008) {
        sources.push({ name: "Pivot Support", level: nearestSupport, weight: 12 })
        weightedSum += nearestSupport * 12
        totalWeight += 12
        reasoning.push(`Near pivot support $${nearestSupport.toFixed(2)}`)
      } else if (distancePct < 0.015) {
        sources.push({ name: "Pivot Support", level: nearestSupport, weight: 5 })
        weightedSum += nearestSupport * 5
        totalWeight += 5
        reasoning.push(`Approaching pivot support $${nearestSupport.toFixed(2)}`)
      }
    }

    // 5. VWAP Lower Band (Weight: up to 15)
    if (vwap.lowerBand && vwap.lowerBand > 0) {
      const distancePct = Math.abs(currentPrice - vwap.lowerBand) / currentPrice
      if (distancePct < 0.003) {
        sources.push({ name: "VWAP Lower", level: vwap.lowerBand, weight: 15 })
        weightedSum += vwap.lowerBand * 15
        totalWeight += 15
        reasoning.push(`At VWAP lower band $${vwap.lowerBand.toFixed(2)}`)
      } else if (distancePct < 0.008) {
        sources.push({ name: "VWAP Lower", level: vwap.lowerBand, weight: 8 })
        weightedSum += vwap.lowerBand * 8
        totalWeight += 8
        reasoning.push(`Near VWAP lower band $${vwap.lowerBand.toFixed(2)}`)
      }
    }

    // Add RSI and MACD momentum factors
    if (currentRSI < 30) {
      totalWeight += 10
      reasoning.push(`RSI oversold at ${currentRSI.toFixed(0)}`)
    } else if (currentRSI < 40) {
      totalWeight += 5
      reasoning.push(`RSI low at ${currentRSI.toFixed(0)}`)
    }
    
    if (macdHistogram < 0 && Math.abs(macdHistogram) > 0.5) {
      totalWeight += 5
      reasoning.push("MACD showing bearish exhaustion")
    }

    if (totalWeight < 20) return null

    const reversalPrice = sources.length > 0 ? weightedSum / (totalWeight - (currentRSI < 30 ? 10 : currentRSI < 40 ? 5 : 0) - (macdHistogram < 0 ? 5 : 0)) : currentPrice
    // More realistic confidence: scale from 20-95 based on weight accumulated
    const confidence = Math.min(Math.max(totalWeight * 0.9, 15), 95)

    return {
      price: reversalPrice,
      confidence,
      direction: "BULLISH",
      sources,
      reasoning,
    }
  } else {
    // Looking for BEARISH reversal - find resistance levels

    // 1. Bollinger Upper Band (Weight: up to 25)
    const bbUpper = bb.upper[bb.upper.length - 1]
    if (bbUpper && bbUpper > 0) {
      const distancePct = Math.abs(bbUpper - currentPrice) / currentPrice
      if (distancePct < 0.005) {
        sources.push({ name: "BB Upper", level: bbUpper, weight: 25 })
        weightedSum += bbUpper * 25
        totalWeight += 25
        reasoning.push(`At BB upper band $${bbUpper.toFixed(2)}`)
      } else if (distancePct < 0.01) {
        sources.push({ name: "BB Upper", level: bbUpper, weight: 15 })
        weightedSum += bbUpper * 15
        totalWeight += 15
        reasoning.push(`Near BB upper band $${bbUpper.toFixed(2)}`)
      } else if (distancePct < 0.02) {
        sources.push({ name: "BB Upper", level: bbUpper, weight: 8 })
        weightedSum += bbUpper * 8
        totalWeight += 8
        reasoning.push(`Approaching BB upper band $${bbUpper.toFixed(2)}`)
      }
    }

    // 2. Ichimoku Cloud Top (Weight: up to 20)
    if (ichimoku.cloudTop > 0) {
      const distancePct = Math.abs(ichimoku.cloudTop - currentPrice) / currentPrice
      if (distancePct < 0.005) {
        sources.push({ name: "Ichimoku Cloud", level: ichimoku.cloudTop, weight: 20 })
        weightedSum += ichimoku.cloudTop * 20
        totalWeight += 20
        reasoning.push(`At Ichimoku cloud top $${ichimoku.cloudTop.toFixed(2)}`)
      } else if (distancePct < 0.01) {
        sources.push({ name: "Ichimoku Cloud", level: ichimoku.cloudTop, weight: 12 })
        weightedSum += ichimoku.cloudTop * 12
        totalWeight += 12
        reasoning.push(`Near Ichimoku cloud top $${ichimoku.cloudTop.toFixed(2)}`)
      } else if (distancePct < 0.02) {
        sources.push({ name: "Ichimoku Cloud", level: ichimoku.cloudTop, weight: 5 })
        weightedSum += ichimoku.cloudTop * 5
        totalWeight += 5
        reasoning.push(`Approaching Ichimoku cloud $${ichimoku.cloudTop.toFixed(2)}`)
      }
    }

    // 3. Kijun-sen (Base Line) (Weight: up to 15)
    const kijun = ichimoku.kijunSen[ichimoku.kijunSen.length - 1]
    if (kijun && kijun > 0) {
      const distancePct = Math.abs(currentPrice - kijun) / currentPrice
      if (distancePct < 0.003) {
        sources.push({ name: "Kijun-sen", level: kijun, weight: 15 })
        weightedSum += kijun * 15
        totalWeight += 15
        reasoning.push(`At Kijun-sen $${kijun.toFixed(2)}`)
      } else if (distancePct < 0.008) {
        sources.push({ name: "Kijun-sen", level: kijun, weight: 8 })
        weightedSum += kijun * 8
        totalWeight += 8
        reasoning.push(`Near Kijun-sen $${kijun.toFixed(2)}`)
      }
    }

    // 4. Pivot Resistance Levels (Weight: up to 20)
    const nearestResistance =
      currentPrice < pivots.r1
        ? pivots.r1
        : currentPrice < pivots.r2
          ? pivots.r2
          : pivots.r3
    if (nearestResistance > 0) {
      const distancePct = Math.abs(nearestResistance - currentPrice) / currentPrice
      if (distancePct < 0.003) {
        sources.push({ name: "Pivot Resistance", level: nearestResistance, weight: 20 })
        weightedSum += nearestResistance * 20
        totalWeight += 20
        reasoning.push(`At pivot resistance $${nearestResistance.toFixed(2)}`)
      } else if (distancePct < 0.008) {
        sources.push({ name: "Pivot Resistance", level: nearestResistance, weight: 12 })
        weightedSum += nearestResistance * 12
        totalWeight += 12
        reasoning.push(`Near pivot resistance $${nearestResistance.toFixed(2)}`)
      } else if (distancePct < 0.015) {
        sources.push({ name: "Pivot Resistance", level: nearestResistance, weight: 5 })
        weightedSum += nearestResistance * 5
        totalWeight += 5
        reasoning.push(`Approaching pivot resistance $${nearestResistance.toFixed(2)}`)
      }
    }

    // 5. VWAP Upper Band (Weight: up to 15)
    if (vwap.upperBand && vwap.upperBand > 0) {
      const distancePct = Math.abs(vwap.upperBand - currentPrice) / currentPrice
      if (distancePct < 0.003) {
        sources.push({ name: "VWAP Upper", level: vwap.upperBand, weight: 15 })
        weightedSum += vwap.upperBand * 15
        totalWeight += 15
        reasoning.push(`At VWAP upper band $${vwap.upperBand.toFixed(2)}`)
      } else if (distancePct < 0.008) {
        sources.push({ name: "VWAP Upper", level: vwap.upperBand, weight: 8 })
        weightedSum += vwap.upperBand * 8
        totalWeight += 8
        reasoning.push(`Near VWAP upper band $${vwap.upperBand.toFixed(2)}`)
      }
    }

    // Add RSI and MACD momentum factors
    if (currentRSI > 70) {
      totalWeight += 10
      reasoning.push(`RSI overbought at ${currentRSI.toFixed(0)}`)
    } else if (currentRSI > 60) {
      totalWeight += 5
      reasoning.push(`RSI elevated at ${currentRSI.toFixed(0)}`)
    }
    
    if (macdHistogram > 0 && macdHistogram > 0.5) {
      totalWeight += 5
      reasoning.push("MACD showing bullish exhaustion")
    }

    if (totalWeight < 20) return null

    const reversalPrice = sources.length > 0 ? weightedSum / (totalWeight - (currentRSI > 70 ? 10 : currentRSI > 60 ? 5 : 0) - (macdHistogram > 0 ? 5 : 0)) : currentPrice
    // More realistic confidence: scale from 20-95 based on weight accumulated
    const confidence = Math.min(Math.max(totalWeight * 0.9, 15), 95)

    return {
      price: reversalPrice,
      confidence,
      direction: "BEARISH",
      sources,
      reasoning,
    }
  }
}
