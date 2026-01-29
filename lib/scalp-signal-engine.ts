// Scalp Signal Engine for SPX/SPY 0DTE (5-15 minute holds)
// Architecture: Director (5m) -> Validator (2m) -> Trigger (1m)

import {
  calculateADX,
  calculateADXWithDirection,
  calculateSuperTrend,
  calculateRSI,
  calculateEWO,
  calculateVWAP,
  calculateRVOL,
  calculateBollingerBands,
  calculatePivotPoints,
  calculateIchimoku,
  calculateATR,
  type OHLCData,
} from "./indicators"

// =============================================================================
// VIBE SETTINGS (hardcoded defaults)
// =============================================================================
export const SCALP_CONFIG = {
  RVOL_THRESHOLD: 1.7,
  PUSH_ALERT_CONFIDENCE_THRESHOLD: 72,
  OPPOSITE_DIRECTION_COOLDOWN_MS: 3 * 60 * 1000, // 3 minutes
  TRAP_MODE_DURATION_CANDLES: 3,
  ADX_TREND_THRESHOLD: 18,
  ADX_CHOP_THRESHOLD: 16,
  VWAP_CROSS_LOOKBACK_MINUTES: 10,
  HYSTERESIS_CANDLES: 2, // Consecutive closes required
}

// =============================================================================
// TYPES
// =============================================================================
export type DirectorState = "BULL" | "BEAR" | "CHOP" | "TRAP"
export type ValidatorState = "BULL" | "BEAR" | "NEUTRAL"

export interface DirectorResult {
  state: DirectorState
  biasScore: number
  breakdown: {
    superTrend: number
    vwap: number
    rsi: number
    ewo: number
    adx: number
    ichimoku: number
  }
  lockedUntil: number // timestamp of next 5m close
  insideCloud: boolean
}

export interface ValidatorResult {
  state: ValidatorState
  longValid: boolean
  shortValid: boolean
  conditions: {
    vwapPosition: boolean
    superTrend: boolean
    rsi: boolean
    ewo: boolean
    adx: boolean
  }
}

export interface TrapModeResult {
  active: boolean
  type: "UP_WICK" | "DOWN_WICK" | null
  expiresAtCandle: number
  wickHigh?: number
  wickLow?: number
  trapCandle?: OHLCData
}

export interface TriggerResult {
  valid: boolean
  direction: "LONG" | "SHORT" | null
  conditions: {
    vwapHysteresis: boolean
    stHysteresis: boolean
    rvol: boolean
    adx: boolean
    rsi: boolean
    ewo: boolean
    notInCloud: boolean
    pivotConfirm: boolean
    bollConfirm: boolean
  }
}

export interface ScalpAlert {
  id: string
  type: "SQUEEZE_LONG" | "SQUEEZE_SHORT" | "TRAP_FADE_LONG" | "TRAP_FADE_SHORT"
  timestamp: Date
  confidence: number
  shouldPush: boolean
  director: DirectorState
  validator: ValidatorState
  triggerReason: string
  explanation: string // Single-line explanation
  entryPrice: number
  stopLoss: number
  targetPrice: number
  holdTime: string
}

export interface AlertCooldownState {
  lastAlertDirection: "LONG" | "SHORT" | null
  lastAlertTimestamp: number
  vwapRetestSinceLastAlert: boolean
  sameDirectionBlocked: boolean
}

// =============================================================================
// DIRECTOR (5m) - Bias determination, updates only on 5m close
// =============================================================================
export function calculateDirector(
  data5m: OHLCData[],
  currentTimestamp: number,
  prevDirector?: DirectorResult
): DirectorResult {
  if (data5m.length < 52) {
    return {
      state: "CHOP",
      biasScore: 0,
      breakdown: { superTrend: 0, vwap: 0, rsi: 0, ewo: 0, adx: 0, ichimoku: 0 },
      lockedUntil: 0,
      insideCloud: false,
    }
  }

  // Check if we should use cached result (mid-candle)
  const lastCandle = data5m[data5m.length - 1]
  const candleCloseTime = lastCandle.time + 5 * 60 * 1000 // 5 minutes after candle open

  // If previous director exists and we haven't crossed a 5m boundary, keep it
  if (prevDirector && currentTimestamp < prevDirector.lockedUntil) {
    return prevDirector
  }

  let biasScore = 0
  const breakdown = { superTrend: 0, vwap: 0, rsi: 0, ewo: 0, adx: 0, ichimoku: 0 }

  // SuperTrend (5m)
  const st = calculateSuperTrend(data5m, 10, 3)
  const stTrend = st.trend[st.trend.length - 1]
  const stSignal = st.signal[st.signal.length - 1]
  if (stTrend === 1 || stSignal === "BUY") {
    breakdown.superTrend = 1
    biasScore += 1
  } else if (stTrend === -1 || stSignal === "SELL") {
    breakdown.superTrend = -1
    biasScore -= 1
  }

  // VWAP (5m)
  const vwap = calculateVWAP(data5m)
  const currentPrice = lastCandle.close
  if (currentPrice > vwap.vwap) {
    breakdown.vwap = 1
    biasScore += 1
  } else if (currentPrice < vwap.vwap) {
    breakdown.vwap = -1
    biasScore -= 1
  }

  // RSI (5m, 14-period)
  const rsi = calculateRSI(data5m, 14)
  const currentRSI = rsi[rsi.length - 1] || 50
  if (currentRSI > 55) {
    breakdown.rsi = 1
    biasScore += 1
  } else if (currentRSI < 45) {
    breakdown.rsi = -1
    biasScore -= 1
  }

  // EWO (5m)
  const ewo = calculateEWO(data5m, 5, 35)
  const currentEWO = ewo.ewo[ewo.ewo.length - 1] || 0
  const prevEWO = ewo.ewo[ewo.ewo.length - 2] || 0
  const ewoRising = currentEWO > prevEWO
  const ewoFalling = currentEWO < prevEWO
  if (currentEWO > 0 && ewoRising) {
    breakdown.ewo = 1
    biasScore += 1
  } else if (currentEWO < 0 && ewoFalling) {
    breakdown.ewo = -1
    biasScore -= 1
  }

  // ADX (5m)
  const adxData = calculateADXWithDirection(data5m, 14)
  const adxValues = calculateADX(data5m, 14)
  const currentADX = adxData.adx
  const prevADX = adxValues[adxValues.length - 2] || currentADX
  const adxRising = currentADX > prevADX
  if (currentADX >= SCALP_CONFIG.ADX_TREND_THRESHOLD && adxRising) {
    breakdown.adx = 1
    biasScore += 1
  }
  // ADX < 18 or falling = 0 (no contribution)

  // Ichimoku (5m)
  const ichimoku = calculateIchimoku(data5m, 9, 26, 52)
  const insideCloud = currentPrice >= ichimoku.cloudBottom && currentPrice <= ichimoku.cloudTop
  if (insideCloud) {
    breakdown.ichimoku = 0 // Force CHOP unless TRAP
  } else if (ichimoku.priceAboveCloud) {
    breakdown.ichimoku = 1
    biasScore += 1
  } else if (ichimoku.priceBelowCloud) {
    breakdown.ichimoku = -1
    biasScore -= 1
  }

  // Determine state
  let state: DirectorState = "CHOP"
  if (insideCloud) {
    state = "CHOP" // Cloud forces CHOP
  } else if (biasScore >= 3) {
    state = "BULL"
  } else if (biasScore <= -3) {
    state = "BEAR"
  }

  // Calculate next 5m candle close time
  const now = new Date(currentTimestamp)
  const minuteOfHour = now.getMinutes()
  const nextFiveMinMark = Math.ceil((minuteOfHour + 1) / 5) * 5
  const lockedUntil = new Date(now)
  lockedUntil.setMinutes(nextFiveMinMark, 0, 0)

  return {
    state,
    biasScore,
    breakdown,
    lockedUntil: lockedUntil.getTime(),
    insideCloud,
  }
}

// =============================================================================
// VALIDATOR (2m) - Must agree with Director before squeeze can fire
// =============================================================================
export function calculateValidator(
  data2m: OHLCData[],
  data1m: OHLCData[],
  director: DirectorResult
): ValidatorResult {
  if (data2m.length < 30) {
    return {
      state: "NEUTRAL",
      longValid: false,
      shortValid: false,
      conditions: { vwapPosition: false, superTrend: false, rsi: false, ewo: false, adx: false },
    }
  }

  const lastCandle = data2m[data2m.length - 1]
  const prevCandle = data2m[data2m.length - 2]
  const currentPrice = lastCandle.close

  // VWAP (2m)
  const vwap = calculateVWAP(data2m)
  const aboveVWAP = currentPrice > vwap.vwap
  const belowVWAP = currentPrice < vwap.vwap

  // SuperTrend (2m)
  const st = calculateSuperTrend(data2m, 7, 2.5)
  const stTrend = st.trend[st.trend.length - 1]
  const stGreen = stTrend === 1
  const stRed = stTrend === -1

  // RSI (2m)
  const rsi = calculateRSI(data2m, 14)
  const currentRSI = rsi[rsi.length - 1] || 50
  const prevRSI = rsi[rsi.length - 2] || 50
  const rsiRising = currentRSI > prevRSI
  const rsiFalling = currentRSI < prevRSI

  // EWO (2m)
  const ewo = calculateEWO(data2m, 5, 35)
  const currentEWO = ewo.ewo[ewo.ewo.length - 1] || 0
  const prevEWO = ewo.ewo[ewo.ewo.length - 2] || 0
  const ewoRising = currentEWO > prevEWO

  // ADX (2m or 1m proxy)
  let adxRisingOrStrong = false
  if (data2m.length >= 20) {
    const adxData = calculateADXWithDirection(data2m, 14)
    const adxValues = calculateADX(data2m, 14)
    const prevADX = adxValues[adxValues.length - 2] || adxData.adx
    adxRisingOrStrong = adxData.adx >= SCALP_CONFIG.ADX_TREND_THRESHOLD || adxData.adx > prevADX
  } else if (data1m.length >= 20) {
    // Use 1m ADX as proxy
    const adxData = calculateADXWithDirection(data1m, 14)
    const adxValues = calculateADX(data1m, 14)
    const prevADX = adxValues[adxValues.length - 2] || adxData.adx
    adxRisingOrStrong = adxData.adx >= SCALP_CONFIG.ADX_TREND_THRESHOLD || adxData.adx > prevADX
  }

  // LONG validation
  const longConditions = {
    vwapPosition: aboveVWAP,
    superTrend: stGreen,
    rsi: currentRSI >= 52 && rsiRising,
    ewo: currentEWO > 0 || ewoRising,
    adx: adxRisingOrStrong,
  }
  const longValid = Object.values(longConditions).every(Boolean)

  // SHORT validation
  const shortConditions = {
    vwapPosition: belowVWAP,
    superTrend: stRed,
    rsi: currentRSI <= 48 && rsiFalling,
    ewo: currentEWO < 0 || !ewoRising,
    adx: adxRisingOrStrong,
  }
  const shortValid = Object.values(shortConditions).every(Boolean)

  let state: ValidatorState = "NEUTRAL"
  if (longValid && director.state === "BULL") state = "BULL"
  else if (shortValid && director.state === "BEAR") state = "BEAR"

  return {
    state,
    longValid,
    shortValid,
    conditions: longConditions, // Return long conditions for display
  }
}

// =============================================================================
// CHOP FILTER - Suppress noise
// =============================================================================
export function isChopCondition(
  data5m: OHLCData[],
  data2m: OHLCData[],
  data1m: OHLCData[],
  director: DirectorResult
): { isChop: boolean; reason: string } {
  // 1. Check if inside Ichimoku cloud (already in director)
  if (director.insideCloud) {
    return { isChop: true, reason: "Price inside 5m Ichimoku cloud" }
  }

  // 2. ADX < 16 and falling on 5m or 2m
  const checkADXChop = (data: OHLCData[], timeframe: string): boolean => {
    if (data.length < 20) return false
    const adxValues = calculateADX(data, 14)
    const current = adxValues[adxValues.length - 1] || 0
    const prev = adxValues[adxValues.length - 2] || 0
    return current < SCALP_CONFIG.ADX_CHOP_THRESHOLD && current < prev
  }

  if (checkADXChop(data5m, "5m")) {
    return { isChop: true, reason: "ADX < 16 and falling on 5m" }
  }
  if (checkADXChop(data2m, "2m")) {
    return { isChop: true, reason: "ADX < 16 and falling on 2m" }
  }

  // 3. VWAP crosses >= 3 times in last 10 minutes (1m basis)
  if (data1m.length >= 10) {
    const recent1m = data1m.slice(-10)
    const vwap = calculateVWAP(data1m)
    let crossCount = 0
    for (let i = 1; i < recent1m.length; i++) {
      const prevAbove = recent1m[i - 1].close > vwap.vwap
      const currAbove = recent1m[i].close > vwap.vwap
      if (prevAbove !== currAbove) crossCount++
    }
    if (crossCount >= 3) {
      return { isChop: true, reason: `VWAP crossed ${crossCount} times in last 10 min` }
    }
  }

  // 4. Bollinger bands tight + price oscillating around VWAP
  if (data1m.length >= 20) {
    const bb = calculateBollingerBands(data1m, 20, 2)
    const vwap = calculateVWAP(data1m)
    if (bb.upper.length > 0 && bb.lower.length > 0) {
      const bandwidth = (bb.upper[bb.upper.length - 1] - bb.lower[bb.lower.length - 1]) / bb.middle[bb.middle.length - 1]
      const priceNearVWAP = Math.abs(data1m[data1m.length - 1].close - vwap.vwap) / vwap.vwap < 0.001
      if (bandwidth < 0.01 && priceNearVWAP) {
        return { isChop: true, reason: "Tight Bollinger bands with VWAP oscillation" }
      }
    }
  }

  return { isChop: false, reason: "" }
}

// =============================================================================
// TRAP MODE - Liquidity wick detection
// =============================================================================
export function detectTrapMode(
  data1m: OHLCData[],
  currentCandleIndex: number,
  prevTrap?: TrapModeResult
): TrapModeResult {
  // Check if previous trap is still active
  if (prevTrap?.active && currentCandleIndex < prevTrap.expiresAtCandle) {
    return prevTrap
  }

  if (data1m.length < 21) {
    return { active: false, type: null, expiresAtCandle: 0 }
  }

  const currentCandle = data1m[data1m.length - 1]
  const lookback = data1m.slice(-21, -1) // Last 20 candles before current

  // Calculate average volume and range
  const avgVolume = lookback.reduce((sum, c) => sum + c.volume, 0) / 20
  const avgRange = lookback.reduce((sum, c) => sum + (c.high - c.low), 0) / 20

  // RVOL check
  const rvol = currentCandle.volume / avgVolume
  const volumeSpike = rvol >= 2.0

  // Range check
  const candleRange = currentCandle.high - currentCandle.low
  const rangeSpike = candleRange >= avgRange * 1.6

  // Wick analysis
  const body = Math.abs(currentCandle.close - currentCandle.open)
  const upperWick = currentCandle.high - Math.max(currentCandle.open, currentCandle.close)
  const lowerWick = Math.min(currentCandle.open, currentCandle.close) - currentCandle.low

  const upperWickPct = candleRange > 0 ? upperWick / candleRange : 0
  const lowerWickPct = candleRange > 0 ? lowerWick / candleRange : 0

  // Check for key level tags
  const pivots = calculatePivotPoints(lookback[lookback.length - 1])
  const bb = calculateBollingerBands(data1m.slice(-21), 20, 2)
  const bbUpper = bb.upper[bb.upper.length - 1] || 0
  const bbLower = bb.lower[bb.lower.length - 1] || 0

  const keyLevels = [pivots.r1, pivots.r2, pivots.r3, pivots.s1, pivots.s2, pivots.s3, bbUpper, bbLower]
  const tagsKeyLevel = keyLevels.some(
    (level) => currentCandle.high >= level * 0.999 && currentCandle.high <= level * 1.001
  ) || keyLevels.some(
    (level) => currentCandle.low >= level * 0.999 && currentCandle.low <= level * 1.001
  )

  // TRAP detection: all conditions must be met
  if (volumeSpike && rangeSpike && tagsKeyLevel) {
    // UP-WICK TRAP (bearish - price spiked up then rejected)
    if (upperWickPct >= 0.3 && currentCandle.close < currentCandle.open) {
      return {
        active: true,
        type: "UP_WICK",
        expiresAtCandle: currentCandleIndex + SCALP_CONFIG.TRAP_MODE_DURATION_CANDLES,
        wickHigh: currentCandle.high,
        wickLow: currentCandle.low,
        trapCandle: currentCandle,
      }
    }
    // DOWN-WICK TRAP (bullish - price spiked down then rejected)
    if (lowerWickPct >= 0.3 && currentCandle.close > currentCandle.open) {
      return {
        active: true,
        type: "DOWN_WICK",
        expiresAtCandle: currentCandleIndex + SCALP_CONFIG.TRAP_MODE_DURATION_CANDLES,
        wickHigh: currentCandle.high,
        wickLow: currentCandle.low,
        trapCandle: currentCandle,
      }
    }
  }

  return { active: false, type: null, expiresAtCandle: 0 }
}

// =============================================================================
// TRAP FADE CONFIRMATION
// =============================================================================
export function checkTrapFadeConfirmation(
  data1m: OHLCData[],
  trap: TrapModeResult,
  vwap: number
): { confirmed: boolean; direction: "LONG" | "SHORT" | null; reason: string } {
  if (!trap.active || !trap.trapCandle) {
    return { confirmed: false, direction: null, reason: "" }
  }

  const recent = data1m.slice(-3) // Last 3 candles including current
  if (recent.length < 2) return { confirmed: false, direction: null, reason: "" }

  const current = recent[recent.length - 1]
  const prev = recent[recent.length - 2]

  const rsi = calculateRSI(data1m, 14)
  const currentRSI = rsi[rsi.length - 1] || 50

  // SHORT FADE after UP-WICK trap
  if (trap.type === "UP_WICK") {
    const failedAboveVWAP = current.close < vwap && prev.close < vwap
    const lowerHigh = current.high < prev.high
    const rsiFailed = currentRSI < 50
    const redClose = current.close < current.open

    if (failedAboveVWAP && lowerHigh && rsiFailed && redClose) {
      return {
        confirmed: true,
        direction: "SHORT",
        reason: "Liquidity trap + VWAP reject",
      }
    }
  }

  // LONG FADE after DOWN-WICK trap
  if (trap.type === "DOWN_WICK") {
    const failedBelowVWAP = current.close > vwap && prev.close > vwap
    const higherLow = current.low > prev.low
    const rsiReclaimed = currentRSI >= 50
    const greenClose = current.close > current.open

    if (failedBelowVWAP && higherLow && rsiReclaimed && greenClose) {
      return {
        confirmed: true,
        direction: "LONG",
        reason: "Liquidity trap + VWAP reject",
      }
    }
  }

  return { confirmed: false, direction: null, reason: "" }
}

// =============================================================================
// TRIGGER (1m) - Entry timing with hysteresis
// =============================================================================
export function calculateTrigger(
  data1m: OHLCData[],
  data5m: OHLCData[],
  director: DirectorResult,
  validator: ValidatorResult,
  trap: TrapModeResult
): TriggerResult {
  if (data1m.length < 30) {
    return {
      valid: false,
      direction: null,
      conditions: {
        vwapHysteresis: false,
        stHysteresis: false,
        rvol: false,
        adx: false,
        rsi: false,
        ewo: false,
        notInCloud: false,
        pivotConfirm: false,
        bollConfirm: false,
      },
    }
  }

  // If in TRAP MODE, don't allow squeeze triggers
  if (trap.active) {
    return {
      valid: false,
      direction: null,
      conditions: {
        vwapHysteresis: false,
        stHysteresis: false,
        rvol: false,
        adx: false,
        rsi: false,
        ewo: false,
        notInCloud: false,
        pivotConfirm: false,
        bollConfirm: false,
      },
    }
  }

  const last3Candles = data1m.slice(-3)
  const currentCandle = last3Candles[2]
  const prevCandle = last3Candles[1]
  const prevPrevCandle = last3Candles[0]

  // VWAP
  const vwap = calculateVWAP(data1m)
  const vwapValue = vwap.vwap

  // Hysteresis: 2 consecutive closes above/below VWAP
  const vwapAbove2 = prevCandle.close > vwapValue && currentCandle.close > vwapValue
  const vwapBelow2 = prevCandle.close < vwapValue && currentCandle.close < vwapValue

  // SuperTrend (1m)
  const st = calculateSuperTrend(data1m, 7, 2.5)
  const stTrend = st.trend.slice(-2)
  const stGreen2 = stTrend.every((t) => t === 1)
  const stRed2 = stTrend.every((t) => t === -1)

  // RVOL
  const rvol = calculateRVOL(data1m, 20)
  const rvolOK = rvol.currentRVOL >= SCALP_CONFIG.RVOL_THRESHOLD

  // ADX (1m)
  const adxData = calculateADXWithDirection(data1m, 14)
  const adxValues = calculateADX(data1m, 14)
  const prevADX = adxValues[adxValues.length - 2] || adxData.adx
  const adxOK = adxData.adx >= SCALP_CONFIG.ADX_TREND_THRESHOLD && adxData.adx >= prevADX

  // RSI (1m)
  const rsi = calculateRSI(data1m, 14)
  const currentRSI = rsi[rsi.length - 1] || 50
  const prevRSI = rsi[rsi.length - 2] || 50
  const rsiRising = currentRSI > prevRSI
  const rsiFalling = currentRSI < prevRSI

  // EWO (1m)
  const ewo = calculateEWO(data1m, 5, 35)
  const currentEWO = ewo.ewo[ewo.ewo.length - 1] || 0
  const prevEWO = ewo.ewo[ewo.ewo.length - 2] || 0
  const ewoRising = currentEWO > prevEWO

  // Ichimoku cloud check (5m)
  const notInCloud = !director.insideCloud

  // Pivot analysis
  const pivots = calculatePivotPoints(data1m[data1m.length - 2])
  const currentPrice = currentCandle.close
  const pivotConfirmLong =
    currentPrice > pivots.r1 || // Break above R1
    (currentPrice > pivots.s1 && currentPrice > vwapValue) // Bounce from S1 with VWAP hold
  const pivotConfirmShort =
    currentPrice < pivots.s1 || // Break below S1
    (currentPrice < pivots.r1 && currentPrice < vwapValue) // Rejection at R1 with VWAP loss

  // Bollinger analysis
  const bb = calculateBollingerBands(data1m, 20, 2)
  const bbUpper = bb.upper[bb.upper.length - 1] || 0
  const bbLower = bb.lower[bb.lower.length - 1] || 0
  const bbMiddle = bb.middle[bb.middle.length - 1] || 0
  const prevBBWidth = bb.upper.length > 5 ? bb.upper[bb.upper.length - 5] - bb.lower[bb.lower.length - 5] : 0
  const currBBWidth = bbUpper - bbLower
  const bollExpanding = currBBWidth > prevBBWidth * 1.1
  const bollConfirmLong = bollExpanding && currentPrice > bbMiddle
  const bollConfirmShort = bollExpanding && currentPrice < bbMiddle

  // LONG trigger conditions
  const longConditions = {
    vwapHysteresis: vwapAbove2,
    stHysteresis: stGreen2,
    rvol: rvolOK,
    adx: adxOK,
    rsi: rsiRising && currentRSI >= 52,
    ewo: currentEWO > 0 && ewoRising,
    notInCloud,
    pivotConfirm: pivotConfirmLong,
    bollConfirm: bollConfirmLong,
  }

  // SHORT trigger conditions
  const shortConditions = {
    vwapHysteresis: vwapBelow2,
    stHysteresis: stRed2,
    rvol: rvolOK,
    adx: adxOK,
    rsi: rsiFalling && currentRSI <= 48,
    ewo: currentEWO < 0 && !ewoRising,
    notInCloud,
    pivotConfirm: pivotConfirmShort,
    bollConfirm: bollConfirmShort,
  }

  // Check LONG
  if (
    director.state === "BULL" &&
    validator.longValid &&
    longConditions.vwapHysteresis &&
    longConditions.stHysteresis &&
    longConditions.rvol &&
    longConditions.adx &&
    longConditions.rsi &&
    longConditions.ewo &&
    longConditions.notInCloud
  ) {
    return { valid: true, direction: "LONG", conditions: longConditions }
  }

  // Check SHORT
  if (
    director.state === "BEAR" &&
    validator.shortValid &&
    shortConditions.vwapHysteresis &&
    shortConditions.stHysteresis &&
    shortConditions.rvol &&
    shortConditions.adx &&
    shortConditions.rsi &&
    shortConditions.ewo &&
    shortConditions.notInCloud
  ) {
    return { valid: true, direction: "SHORT", conditions: shortConditions }
  }

  return {
    valid: false,
    direction: null,
    conditions: director.state === "BULL" ? longConditions : shortConditions,
  }
}

// =============================================================================
// CONFIDENCE SCORING (0-100)
// =============================================================================
export function calculateConfidence(
  director: DirectorResult,
  validator: ValidatorResult,
  trigger: TriggerResult,
  rvol: number,
  adxRising: boolean,
  adxValue: number
): number {
  let score = 0

  // +20 Director strong (absolute bias score >= 4)
  if (Math.abs(director.biasScore) >= 4) score += 20

  // +15 Validator alignment (2m confirms)
  if (validator.state !== "NEUTRAL") score += 15

  // +15 VWAP confirmed (2m close + 2x 1m closes)
  if (trigger.conditions.vwapHysteresis) score += 15

  // +10 RVOL >= 1.7
  if (rvol >= SCALP_CONFIG.RVOL_THRESHOLD) score += 10

  // +10 ADX rising or >= 18
  if (adxRising || adxValue >= SCALP_CONFIG.ADX_TREND_THRESHOLD) score += 10

  // +10 RSI confirms direction
  if (trigger.conditions.rsi) score += 10

  // +5 EWO confirms direction
  if (trigger.conditions.ewo) score += 5

  // +5 Pivot confirms
  if (trigger.conditions.pivotConfirm) score += 5

  // +5 Bollinger expansion confirms
  if (trigger.conditions.bollConfirm) score += 5

  return Math.min(score, 100)
}

// =============================================================================
// COOLDOWN & RE-ALERT GATE
// =============================================================================
export function checkCooldownAndReAlertGate(
  direction: "LONG" | "SHORT",
  cooldownState: AlertCooldownState,
  currentTimestamp: number,
  vwapTouched: boolean
): { allowed: boolean; reason: string } {
  // Check opposite-direction cooldown
  if (
    cooldownState.lastAlertDirection &&
    cooldownState.lastAlertDirection !== direction &&
    currentTimestamp - cooldownState.lastAlertTimestamp < SCALP_CONFIG.OPPOSITE_DIRECTION_COOLDOWN_MS
  ) {
    const remaining = Math.ceil(
      (SCALP_CONFIG.OPPOSITE_DIRECTION_COOLDOWN_MS - (currentTimestamp - cooldownState.lastAlertTimestamp)) / 1000
    )
    return { allowed: false, reason: `Opposite direction cooldown: ${remaining}s remaining` }
  }

  // Check same-direction re-alert gate
  if (cooldownState.lastAlertDirection === direction && !cooldownState.vwapRetestSinceLastAlert) {
    return { allowed: false, reason: "Same direction blocked until VWAP retest" }
  }

  return { allowed: true, reason: "" }
}

// =============================================================================
// MAIN ALERT GENERATOR
// =============================================================================
export function generateScalpAlert(
  data1m: OHLCData[],
  data2m: OHLCData[],
  data5m: OHLCData[],
  prevDirector: DirectorResult | undefined,
  prevTrap: TrapModeResult | undefined,
  cooldownState: AlertCooldownState,
  currentCandleIndex: number
): {
  alert: ScalpAlert | null
  director: DirectorResult
  validator: ValidatorResult
  trap: TrapModeResult
  updatedCooldown: AlertCooldownState
} {
  const currentTimestamp = Date.now()

  // Calculate Director (5m)
  const director = calculateDirector(data5m, currentTimestamp, prevDirector)

  // Calculate Validator (2m)
  const validator = calculateValidator(data2m, data1m, director)

  // Detect Trap Mode
  const trap = detectTrapMode(data1m, currentCandleIndex, prevTrap)

  // Check for CHOP condition
  const chopCheck = isChopCondition(data5m, data2m, data1m, director)

  // Update VWAP retest tracking
  const vwap = calculateVWAP(data1m)
  const currentPrice = data1m[data1m.length - 1]?.close || 0
  const vwapTouched = Math.abs(currentPrice - vwap.vwap) / vwap.vwap < 0.001 // Within 0.1%

  let updatedCooldown = { ...cooldownState }
  if (vwapTouched && cooldownState.lastAlertDirection) {
    updatedCooldown.vwapRetestSinceLastAlert = true
  }

  // Check for Trap Fade first (can override cooldown)
  if (trap.active) {
    const fadeCheck = checkTrapFadeConfirmation(data1m, trap, vwap.vwap)
    if (fadeCheck.confirmed && fadeCheck.direction) {
      const atr = calculateATR(data1m, 14)
      const atrValue = atr[atr.length - 1] || 1
      const entryPrice = currentPrice
      const stopLoss =
        fadeCheck.direction === "LONG"
          ? (trap.wickLow || currentPrice) - atrValue * 0.3
          : (trap.wickHigh || currentPrice) + atrValue * 0.3
      const targetPrice =
        fadeCheck.direction === "LONG" ? entryPrice + atrValue * 0.8 : entryPrice - atrValue * 0.8

      const alertType = fadeCheck.direction === "LONG" ? "TRAP_FADE_LONG" : "TRAP_FADE_SHORT"
      const explanation = `Director: ${director.state} | Validator: n/a | Trigger: ${fadeCheck.reason}`

      updatedCooldown = {
        lastAlertDirection: fadeCheck.direction,
        lastAlertTimestamp: currentTimestamp,
        vwapRetestSinceLastAlert: false,
        sameDirectionBlocked: true,
      }

      return {
        alert: {
          id: `trap-fade-${fadeCheck.direction}-${currentTimestamp}`,
          type: alertType as "TRAP_FADE_LONG" | "TRAP_FADE_SHORT",
          timestamp: new Date(),
          confidence: 75, // Trap fades have fixed confidence
          shouldPush: true,
          director: director.state,
          validator: "NEUTRAL" as ValidatorState,
          triggerReason: fadeCheck.reason,
          explanation,
          entryPrice,
          stopLoss,
          targetPrice,
          holdTime: "3-8 min",
        },
        director,
        validator,
        trap,
        updatedCooldown,
      }
    }

    // In TRAP MODE but no fade confirmed - block squeeze alerts
    return { alert: null, director, validator, trap, updatedCooldown }
  }

  // If in CHOP, no squeeze alerts
  if (chopCheck.isChop || director.state === "CHOP") {
    return { alert: null, director, validator, trap, updatedCooldown }
  }

  // Calculate Trigger (1m)
  const trigger = calculateTrigger(data1m, data5m, director, validator, trap)

  if (!trigger.valid || !trigger.direction) {
    return { alert: null, director, validator, trap, updatedCooldown }
  }

  // Check cooldown and re-alert gate
  const cooldownCheck = checkCooldownAndReAlertGate(
    trigger.direction,
    cooldownState,
    currentTimestamp,
    vwapTouched
  )
  if (!cooldownCheck.allowed) {
    return { alert: null, director, validator, trap, updatedCooldown }
  }

  // Calculate RVOL and ADX for confidence
  const rvol = calculateRVOL(data1m, 20)
  const adxData = calculateADXWithDirection(data1m, 14)
  const adxValues = calculateADX(data1m, 14)
  const prevADX = adxValues[adxValues.length - 2] || adxData.adx
  const adxRising = adxData.adx > prevADX

  // Calculate confidence
  const confidence = calculateConfidence(director, validator, trigger, rvol.currentRVOL, adxRising, adxData.adx)

  // Generate alert
  const atr = calculateATR(data1m, 14)
  const atrValue = atr[atr.length - 1] || 1
  const entryPrice = currentPrice
  const stopLoss = trigger.direction === "LONG" ? entryPrice - atrValue * 0.5 : entryPrice + atrValue * 0.5
  const targetPrice = trigger.direction === "LONG" ? entryPrice + atrValue * 1.0 : entryPrice - atrValue * 1.0

  const alertType = trigger.direction === "LONG" ? "SQUEEZE_LONG" : "SQUEEZE_SHORT"
  const triggerReason =
    trigger.direction === "LONG"
      ? `VWAP hold + RVOL ${rvol.currentRVOL.toFixed(1)}x`
      : `VWAP loss + RVOL ${rvol.currentRVOL.toFixed(1)}x`
  const explanation = `Director: ${director.state} | Validator: ${validator.state} | Trigger: ${triggerReason}`

  updatedCooldown = {
    lastAlertDirection: trigger.direction,
    lastAlertTimestamp: currentTimestamp,
    vwapRetestSinceLastAlert: false,
    sameDirectionBlocked: true,
  }

  return {
    alert: {
      id: `squeeze-${trigger.direction}-${currentTimestamp}`,
      type: alertType as "SQUEEZE_LONG" | "SQUEEZE_SHORT",
      timestamp: new Date(),
      confidence,
      shouldPush: confidence >= SCALP_CONFIG.PUSH_ALERT_CONFIDENCE_THRESHOLD,
      director: director.state,
      validator: validator.state,
      triggerReason,
      explanation,
      entryPrice,
      stopLoss,
      targetPrice,
      holdTime: "5-15 min",
    },
    director,
    validator,
    trap,
    updatedCooldown,
  }
}
