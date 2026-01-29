// Trade Archive - Store winning runs with indicator data for backtesting reference

export interface ArchivedTrade {
  id: string
  date: string
  time: string
  symbol: string
  strike: number
  type: "CALL" | "PUT"
  entry: number
  exit: number
  pnlPercent: number
  pnlDollar?: number

  // Indicator readings at entry
  indicators: {
    adx: number
    adxTrend: "rising" | "falling" | "flat"
    ewo: number
    rsi: number
    rvol: number
    macdHistogram: number
    vwapPosition: "above" | "below" | "at"
  }

  // SuperTrend data
  superTrend: {
    signal: "BUY" | "SELL" | "HOLD"
    timeframe: "1m" | "5m" | "10m" | "15m"
    trendFlipTime?: string
    signalDelay?: number // seconds between signal and optimal entry
  }

  // Pivot points at entry (from Webull)
  pivotPoints?: {
    r3?: number
    r2?: number
    r1?: number
    p?: number
    s1?: number
    s2?: number
    s3?: number
  }

  // Notes
  notes?: string
  tags?: string[]

  // Source
  source: "webull" | "manual" | "imported"
}

export type TimePeriodFilter = "today" | "week" | "month" | "year" | "all"

export interface TradeArchiveStats {
  totalTrades: number
  winRate: number
  avgPnlPercent: number
  bestTrade: ArchivedTrade | null
  worstTrade: ArchivedTrade | null
  avgAdxAtEntry: number
  avgRvolAtEntry: number
  callCount: number
  putCount: number
}

export const SAMPLE_WINNING_RUNS: ArchivedTrade[] = [
  // Jan 12, 2026 choppy power hour trade for analysis
  {
    id: "straddle-2026-01-12-6980",
    date: "2026-01-12",
    time: "15:00-16:00",
    symbol: "SPXW",
    strike: 6980,
    type: "CALL", // Primary position
    entry: 2.57, // Avg entry from orders
    exit: 3.5,
    pnlPercent: 36.26, // Call side
    pnlDollar: 93,
    indicators: {
      adx: 18.06, // VERY WEAK - key issue
      adxTrend: "flat",
      ewo: -1.2,
      rsi: 53.53, // Neutral - no reversal signal
      rvol: 1.1, // Low volume
      macdHistogram: 0.05, // Weak
      vwapPosition: "at",
    },
    superTrend: {
      signal: "HOLD",
      timeframe: "1m",
      signalDelay: 0,
    },
    pivotPoints: {
      r3: 7000,
      r2: 6990,
      r1: 6985,
      p: 6977,
      s1: 6970,
      s2: 6965,
      s3: 6960,
    },
    notes:
      "LESSON - CHOPPY POWER HOUR: ADX only 18.06 = NO TREND. Ran straddle ($6,980 Call +$93, Put -$155 = NET -$62). RSI neutral at 53.53 gave no reversal warning. Multiple whipsaws visible on chart. AVOID trading when ADX < 20. Need reversal warning indicator when RSI crosses 30/70 thresholds.",
    tags: ["loss", "choppy", "no-trend", "adx-very-weak", "straddle-loss", "needs-reversal-warning", "power-hour-chop"],
    source: "webull",
  },
  {
    id: "put-2026-01-12-6980-loss",
    date: "2026-01-12",
    time: "15:00-16:00",
    symbol: "SPXW",
    strike: 6980,
    type: "PUT",
    entry: 4.3,
    exit: 2.75,
    pnlPercent: -36.05,
    pnlDollar: -155,
    indicators: {
      adx: 18.06,
      adxTrend: "flat",
      ewo: -1.2,
      rsi: 53.53,
      rvol: 1.1,
      macdHistogram: 0.05,
      vwapPosition: "at",
    },
    superTrend: {
      signal: "HOLD",
      timeframe: "1m",
    },
    notes:
      "PUT side of straddle. Lost $155 (-36.05%). Market chopped without directional move. ADX 18.06 warned against this trade.",
    tags: ["loss", "choppy", "straddle-put-side", "adx-very-weak"],
    source: "webull",
  },
  // Jan 9, 2026 - Today's Scalp Data from Webull Screenshots
  {
    id: "put-2026-01-09-6970",
    date: "2026-01-09",
    time: "15:59",
    symbol: "SPXW",
    strike: 6970,
    type: "PUT",
    entry: 49.17, // Calculated from -92.07% loss to $3.90
    exit: 3.9,
    pnlPercent: -92.07,
    indicators: {
      adx: 22.36,
      adxTrend: "flat",
      ewo: -2.1,
      rsi: 78.59, // OVERBOUGHT - key learning
      rvol: 1.2,
      macdHistogram: -0.1,
      vwapPosition: "above",
    },
    superTrend: {
      signal: "SELL",
      timeframe: "1m",
      signalDelay: 300, // 5 min late
    },
    pivotPoints: {
      r3: 6967.33,
      r2: 6949.31,
      r1: 6935.38,
      p: 6917.36,
      s1: 6903.43,
      s2: 6885.41,
      s3: 6871.48,
    },
    notes:
      "LESSON: Entered too late. RSI 78.59 showed overbought - PUT was right direction but entry was after the move. ADX weak at 22.36. SuperTrend signal was ~5 min delayed.",
    tags: ["loss", "late-entry", "rsi-overbought", "weak-adx", "supertrend-delayed"],
    source: "webull",
  },
  {
    id: "put-2026-01-07-6945-win",
    date: "2026-01-07",
    time: "12:35",
    symbol: "SPXW",
    strike: 6945,
    type: "PUT",
    entry: 11.9, // From +71.01% to $20.35
    exit: 20.35,
    pnlPercent: 71.01,
    indicators: {
      adx: 55.5, // VERY STRONG - key pattern
      adxTrend: "rising",
      ewo: -8.2,
      rsi: 76.07,
      rvol: 2.4,
      macdHistogram: -0.85,
      vwapPosition: "below",
    },
    superTrend: {
      signal: "SELL",
      timeframe: "1m",
      signalDelay: 0, // On time
    },
    notes:
      "BIG WIN! ADX 55.50 confirmed extremely strong downtrend. RSI 76 still elevated but ADX dominated. Perfect SuperTrend timing.",
    tags: ["win", "strong-adx", "perfect-timing", "high-conviction"],
    source: "webull",
  },
  {
    id: "call-2026-01-07-6940-loss",
    date: "2026-01-07",
    time: "11:54",
    symbol: "SPXW",
    strike: 6940,
    type: "CALL",
    entry: 15.57, // From -55.68% to $6.90
    exit: 6.9,
    pnlPercent: -55.68,
    indicators: {
      adx: 25.82,
      adxTrend: "falling", // ADX declining = weakening trend
      ewo: 1.2,
      rsi: 34.6, // Oversold but wrong direction
      rvol: 1.1,
      macdHistogram: 0.12,
      vwapPosition: "below",
    },
    superTrend: {
      signal: "BUY",
      timeframe: "1m",
      signalDelay: 180, // 3 min late
    },
    pivotPoints: {
      r3: 35.73,
      r2: 26.87,
      r1: 21.03,
      p: 12.17,
      s1: 6.33,
      s2: -2.53,
      s3: -8.37,
    },
    notes:
      "LOSS: ADX was declining (25.82 but falling). RSI oversold at 34.60 suggested bounce but trend continued down. SuperTrend was 3 min late.",
    tags: ["loss", "adx-declining", "false-bounce", "supertrend-delayed"],
    source: "webull",
  },
  {
    id: "call-2026-01-07-6945-loss",
    date: "2026-01-07",
    time: "11:54",
    symbol: "SPXW",
    strike: 6945,
    type: "CALL",
    entry: 12.6, // From -70.63% to $3.70
    exit: 3.7,
    pnlPercent: -70.63,
    indicators: {
      adx: 24.58, // Below threshold
      adxTrend: "falling",
      ewo: 0.8,
      rsi: 33.22,
      rvol: 1.0,
      macdHistogram: 0.08,
      vwapPosition: "below",
    },
    superTrend: {
      signal: "BUY",
      timeframe: "1m",
      signalDelay: 180,
    },
    pivotPoints: {
      r3: 29.37,
      r2: 22.09,
      r1: 17.14,
      p: 9.86,
      s1: 4.91,
      s2: -2.37,
      s3: -7.32,
    },
    notes: "LOSS: ADX below 25 threshold at 24.58 and FALLING. Should have avoided. MACD histogram weak at 0.08.",
    tags: ["loss", "weak-adx", "adx-below-threshold", "avoid-pattern"],
    source: "webull",
  },
  {
    id: "put-2026-01-05-6900-win",
    date: "2026-01-05",
    time: "12:55",
    symbol: "SPXW",
    strike: 6900,
    type: "PUT",
    entry: 0.35, // From entry $0.35 to target
    exit: 2.3,
    pnlPercent: 557.14,
    pnlDollar: 195,
    indicators: {
      adx: 20.71,
      adxTrend: "rising",
      ewo: -4.2,
      rsi: 65.56,
      rvol: 1.8,
      macdHistogram: -0.3,
      vwapPosition: "at",
    },
    superTrend: {
      signal: "SELL",
      timeframe: "1m",
      signalDelay: 60, // 1 min delay
    },
    notes: "Nice scalp! Entry at $0.35, target hit at $2.30. ADX just above 20, VWAP at 3.01. Good risk/reward.",
    tags: ["win", "scalp", "good-rr", "vwap-confluence"],
    source: "webull",
  },
  {
    id: "put-2026-01-05-6900-followup",
    date: "2026-01-05",
    time: "12:58",
    symbol: "SPXW",
    strike: 6900,
    type: "PUT",
    entry: 1.84,
    exit: 0.82,
    pnlPercent: -55.43,
    indicators: {
      adx: 19.96, // Below 20 - weak
      adxTrend: "falling",
      ewo: -3.8,
      rsi: 47.15,
      rvol: 1.4,
      macdHistogram: -0.2,
      vwapPosition: "at",
    },
    superTrend: {
      signal: "SELL",
      timeframe: "1m",
      signalDelay: 120,
    },
    notes:
      "LOSS: Re-entered too soon. ADX dropped below 20 to 19.96. Trend exhausted. Should have waited for ADX to recover.",
    tags: ["loss", "re-entry-too-soon", "adx-below-20", "trend-exhausted"],
    source: "webull",
  },
  {
    id: "put-2026-01-05-6895-expired",
    date: "2026-01-05",
    time: "12:56",
    symbol: "SPXW",
    strike: 6895,
    type: "PUT",
    entry: 39.4, // From -98.98% to $0.40
    exit: 0.4,
    pnlPercent: -98.98,
    indicators: {
      adx: 18.5, // Very weak
      adxTrend: "flat",
      ewo: -2.1,
      rsi: 54.95,
      rvol: 1.0,
      macdHistogram: -0.1,
      vwapPosition: "above",
    },
    superTrend: {
      signal: "HOLD",
      timeframe: "1m",
    },
    notes:
      "EXPIRED WORTHLESS: ADX only 18.50 - no trend. Should have avoided entirely. Strike too close to current price with no momentum.",
    tags: ["total-loss", "no-trend", "adx-very-weak", "avoid"],
    source: "webull",
  },
  {
    id: "call-2026-01-05-6920-win",
    date: "2026-01-05",
    time: "07:36",
    symbol: "SPXW",
    strike: 6920,
    type: "CALL",
    entry: 0.5, // From +572% to $3.36
    exit: 3.36,
    pnlPercent: 572.0,
    indicators: {
      adx: 31.62, // Strong
      adxTrend: "rising",
      ewo: 6.2,
      rsi: 52.15,
      rvol: 2.2,
      macdHistogram: 0.45,
      vwapPosition: "above",
    },
    superTrend: {
      signal: "BUY",
      timeframe: "1m",
      signalDelay: 0, // Perfect timing
    },
    notes:
      "MASSIVE WIN! Morning breakout. ADX 31.62 rising, VWAP 2.58 supportive. Perfect SuperTrend timing - no delay. RSI neutral at 52.",
    tags: ["big-win", "morning-breakout", "strong-adx", "perfect-timing", "neutral-rsi"],
    source: "webull",
  },
  // Dec 31, 2024 - Today's Massive Scalp Win - Power Hour Puts
  {
    id: "put-2024-12-31-001",
    date: "2024-12-31",
    time: "15:59",
    symbol: "SPXW",
    strike: 6870,
    type: "PUT",
    entry: 9.62,
    exit: 24.7,
    pnlPercent: 156.76,
    pnlDollar: 1508,
    indicators: {
      adx: 24.31,
      adxTrend: "rising",
      ewo: -6.5,
      rsi: 34.61,
      rvol: 2.2,
      macdHistogram: -0.62,
      vwapPosition: "below",
    },
    superTrend: {
      signal: "SELL",
      timeframe: "1m",
      trendFlipTime: "15:47",
    },
    pivotPoints: {
      r3: 6930,
      r2: 6920,
      r1: 6910,
      p: 6900,
      s1: 6890,
      s2: 6880,
      s3: 6870,
    },
    notes:
      "Power hour breakdown through multiple S levels. MACD bearish, price fell from 6,900 to 6,845. ADX confirming trend strength.",
    tags: ["power-hour", "breakdown", "multi-level-break", "big-win"],
    source: "webull",
  },
  {
    id: "put-2024-12-31-002",
    date: "2024-12-31",
    time: "15:59",
    symbol: "SPXW",
    strike: 6855,
    type: "PUT",
    entry: 3.0,
    exit: 9.65,
    pnlPercent: 221.67,
    pnlDollar: 665,
    indicators: {
      adx: 24.31,
      adxTrend: "rising",
      ewo: -6.8,
      rsi: 34.61,
      rvol: 2.3,
      macdHistogram: 0.59,
      vwapPosition: "below",
    },
    superTrend: {
      signal: "SELL",
      timeframe: "1m",
      trendFlipTime: "15:47",
    },
    notes: "Best % gain of the session at 221%. Caught the breakdown perfectly. Price sliced through S1, S2, S3.",
    tags: ["power-hour", "best-percent", "breakdown", "s-level-cascade"],
    source: "webull",
  },
  {
    id: "put-2024-12-31-003",
    date: "2024-12-31",
    time: "15:59",
    symbol: "SPXW",
    strike: 6850,
    type: "PUT",
    entry: 1.63,
    exit: 4.35,
    pnlPercent: 166.87,
    pnlDollar: 272,
    indicators: {
      adx: 24.31,
      adxTrend: "rising",
      ewo: -7.0,
      rsi: 34.61,
      rvol: 2.1,
      macdHistogram: 0.38,
      vwapPosition: "below",
    },
    superTrend: {
      signal: "SELL",
      timeframe: "1m",
      trendFlipTime: "15:47",
    },
    notes: "Solid gain riding the same breakdown. SPX closed at 6,845.50 - right at this strike.",
    tags: ["power-hour", "breakdown", "atm-finish"],
    source: "webull",
  },
  {
    id: "put-2024-12-31-004-loss",
    date: "2024-12-31",
    time: "15:59",
    symbol: "SPXW",
    strike: 6820,
    type: "PUT",
    entry: 0.1,
    exit: 0.01,
    pnlPercent: -90.0,
    pnlDollar: -9,
    indicators: {
      adx: 24.31,
      adxTrend: "rising",
      ewo: -7.2,
      rsi: 34.61,
      rvol: 2.0,
      macdHistogram: -0.62,
      vwapPosition: "below",
    },
    superTrend: {
      signal: "SELL",
      timeframe: "1m",
    },
    notes:
      "LESSON: Too far OTM. SPX only dropped to 6,844.55 low - never reached 6,820. Small loss but good lesson on strike selection.",
    tags: ["loss", "too-otm", "lesson", "strike-selection"],
    source: "webull",
  },
  // Dec 30, 2024 - PUT Trades
  {
    id: "put-001",
    date: "2024-12-30",
    time: "15:51",
    symbol: "SPXW",
    strike: 6900,
    type: "PUT",
    entry: 0.35,
    exit: 7.9,
    pnlPercent: 2157,
    indicators: {
      adx: 30.41,
      adxTrend: "rising",
      ewo: -8.46,
      rsi: 41,
      rvol: 2.3,
      macdHistogram: 0.59,
      vwapPosition: "below",
    },
    superTrend: {
      signal: "SELL",
      timeframe: "1m",
      trendFlipTime: "15:48",
    },
    notes: "Power hour breakdown. ADX crossed 30, volume spike confirmed move.",
    tags: ["power-hour", "breakdown", "high-rvol"],
    source: "webull",
  },
  {
    id: "put-002",
    date: "2024-12-30",
    time: "15:33",
    symbol: "SPXW",
    strike: 6905,
    type: "PUT",
    entry: 0.05,
    exit: 8.73,
    pnlPercent: 17360,
    indicators: {
      adx: 30.1,
      adxTrend: "rising",
      ewo: -6.2,
      rsi: 38,
      rvol: 2.1,
      macdHistogram: 0.9,
      vwapPosition: "below",
    },
    superTrend: {
      signal: "SELL",
      timeframe: "1m",
      trendFlipTime: "15:30",
    },
    notes: "Massive power hour run. Caught at the very bottom.",
    tags: ["power-hour", "massive-run", "perfect-entry"],
    source: "webull",
  },
  {
    id: "put-003",
    date: "2024-12-30",
    time: "14:37",
    symbol: "SPXW",
    strike: 6900,
    type: "PUT",
    entry: 1.45,
    exit: 4.3,
    pnlPercent: 320,
    indicators: {
      adx: 24.5,
      adxTrend: "rising",
      ewo: -5.2,
      rsi: 44,
      rvol: 1.8,
      macdHistogram: 0.1,
      vwapPosition: "below",
    },
    superTrend: {
      signal: "SELL",
      timeframe: "5m",
      trendFlipTime: "14:33",
    },
    notes: "Early breakdown through Ichimoku cloud. MACD histogram weak but positive.",
    tags: ["ichimoku-break", "early-entry"],
    source: "webull",
  },
  {
    id: "put-004",
    date: "2024-12-30",
    time: "14:33",
    symbol: "SPXW",
    strike: 6900,
    type: "PUT",
    entry: 2.85,
    exit: 4.3,
    pnlPercent: 299,
    indicators: {
      adx: 25.0,
      adxTrend: "rising",
      ewo: -4.8,
      rsi: 46,
      rvol: 1.7,
      macdHistogram: 0.21,
      vwapPosition: "below",
    },
    superTrend: {
      signal: "SELL",
      timeframe: "5m",
      trendFlipTime: "14:30",
    },
    notes: "Cloud breakdown confirmed. ADX just hit 25 threshold.",
    tags: ["ichimoku-break", "adx-threshold"],
    source: "webull",
  },
  {
    id: "put-005",
    date: "2024-12-30",
    time: "14:33",
    symbol: "SPXW",
    strike: 6900,
    type: "PUT",
    entry: 5.5,
    exit: 6.2,
    pnlPercent: 474,
    indicators: {
      adx: 25.57,
      adxTrend: "rising",
      ewo: -6.1,
      rsi: 40,
      rvol: 2.0,
      macdHistogram: 0.38,
      vwapPosition: "below",
    },
    superTrend: {
      signal: "SELL",
      timeframe: "1m",
      trendFlipTime: "14:30",
    },
    notes: "Strong MACD histogram. ADX confirmed above 25. Clean breakdown.",
    tags: ["strong-macd", "confirmed-adx"],
    source: "webull",
  },
  {
    id: "put-006",
    date: "2024-12-30",
    time: "14:33",
    symbol: "SPXW",
    strike: 6900,
    type: "PUT",
    entry: 4.0,
    exit: 7.9,
    pnlPercent: 633,
    indicators: {
      adx: 25.76,
      adxTrend: "rising",
      ewo: -5.9,
      rsi: 41,
      rvol: 1.9,
      macdHistogram: 0.29,
      vwapPosition: "below",
    },
    superTrend: {
      signal: "SELL",
      timeframe: "1m",
      trendFlipTime: "14:28",
    },
    notes: "Best PUT of the session. ADX just above threshold, strong continuation.",
    tags: ["best-run", "continuation"],
    source: "webull",
  },
  // Weak ADX example - for learning
  {
    id: "put-007-weak",
    date: "2024-12-30",
    time: "15:27",
    symbol: "SPXW",
    strike: 6895,
    type: "PUT",
    entry: 0.05,
    exit: 1.5,
    pnlPercent: 486,
    indicators: {
      adx: 17.43, // WEAK - below 25 threshold
      adxTrend: "flat",
      ewo: -2.1,
      rsi: 48,
      rvol: 1.2,
      macdHistogram: 0.01, // Weak histogram
      vwapPosition: "below",
    },
    superTrend: {
      signal: "SELL",
      timeframe: "5m",
      trendFlipTime: "15:20",
    },
    notes:
      "WARNING: ADX was only 17.43 - below threshold. Got lucky. MACD histogram nearly flat at 0.01. Avoid these setups.",
    tags: ["weak-adx", "avoid-pattern", "lucky-win"],
    source: "webull",
  },
  {
    id: "put-008",
    date: "2024-12-30",
    time: "15:27",
    symbol: "SPXW",
    strike: 6905,
    type: "PUT",
    entry: 8.73,
    exit: 11.1,
    pnlPercent: 309,
    indicators: {
      adx: 30.41,
      adxTrend: "rising",
      ewo: -7.2,
      rsi: 36,
      rvol: 2.4,
      macdHistogram: 0.59,
      vwapPosition: "below",
    },
    superTrend: {
      signal: "SELL",
      timeframe: "1m",
      trendFlipTime: "15:24",
    },
    notes: "Very strong ADX at 30+. High RVOL confirmed conviction. Clean power hour move.",
    tags: ["strong-adx", "power-hour", "high-conviction"],
    source: "webull",
  },
  // Dec 29, 2024 - CALL Trade
  {
    id: "call-001",
    date: "2024-12-29",
    time: "12:13",
    symbol: "SPXW",
    strike: 6900,
    type: "CALL",
    entry: 12.2,
    exit: 13.1,
    pnlPercent: 623,
    indicators: {
      adx: 39.28, // VERY STRONG
      adxTrend: "rising",
      ewo: 8.5,
      rsi: 63,
      rvol: 2.6,
      macdHistogram: -0.11, // Negative but ADX very strong
      vwapPosition: "above",
    },
    pivotPoints: {
      r3: 33.26,
      r2: 33.26,
      r1: 33.26,
      p: 33.26,
      s1: 33.26,
      s2: 33.26,
      s3: 33.26,
    },
    superTrend: {
      signal: "BUY",
      timeframe: "5m",
      trendFlipTime: "12:08",
    },
    notes:
      "CALL trade! ADX at 39.28 - extremely strong trend. Price riding above Ichimoku cloud with support. MACD histogram slightly negative but ADX dominates.",
    tags: ["call-trade", "strong-adx", "cloud-support", "trend-ride"],
    source: "webull",
  },
  // Previous PUT trades
  {
    id: "put-009",
    date: "2024-12-29",
    time: "11:30",
    symbol: "SPXW",
    strike: 6900,
    type: "PUT",
    entry: 2.0,
    exit: 6.9,
    pnlPercent: 245,
    indicators: {
      adx: 25.06,
      adxTrend: "rising",
      ewo: -8.46,
      rsi: 41.12,
      rvol: 1.8,
      macdHistogram: 0.46,
      vwapPosition: "below",
    },
    superTrend: {
      signal: "SELL",
      timeframe: "15m",
      trendFlipTime: "11:15",
    },
    notes: "Mid-day breakdown. EWO strongly negative.",
    tags: ["mid-day", "breakdown", "strong-ewo"],
    source: "webull",
  },
]

export function filterByTimePeriod(trades: ArchivedTrade[], period: TimePeriodFilter): ArchivedTrade[] {
  if (period === "all") return trades

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  return trades.filter((trade) => {
    const tradeDate = new Date(trade.date)

    switch (period) {
      case "today":
        return tradeDate >= today
      case "week": {
        const weekAgo = new Date(today)
        weekAgo.setDate(weekAgo.getDate() - 7)
        return tradeDate >= weekAgo
      }
      case "month": {
        const monthAgo = new Date(today)
        monthAgo.setMonth(monthAgo.getMonth() - 1)
        return tradeDate >= monthAgo
      }
      case "year": {
        const yearAgo = new Date(today)
        yearAgo.setFullYear(yearAgo.getFullYear() - 1)
        return tradeDate >= yearAgo
      }
      default:
        return true
    }
  })
}

export function calculateArchiveStats(trades: ArchivedTrade[]): TradeArchiveStats {
  if (trades.length === 0) {
    return {
      totalTrades: 0,
      winRate: 0,
      avgPnlPercent: 0,
      bestTrade: null,
      worstTrade: null,
      avgAdxAtEntry: 0,
      avgRvolAtEntry: 0,
      callCount: 0,
      putCount: 0,
    }
  }

  const winners = trades.filter((t) => t.pnlPercent > 0)
  const avgPnl = trades.reduce((sum, t) => sum + t.pnlPercent, 0) / trades.length
  const avgAdx = trades.reduce((sum, t) => sum + t.indicators.adx, 0) / trades.length
  const avgRvol = trades.reduce((sum, t) => sum + t.indicators.rvol, 0) / trades.length

  const sorted = [...trades].sort((a, b) => b.pnlPercent - a.pnlPercent)

  return {
    totalTrades: trades.length,
    winRate: (winners.length / trades.length) * 100,
    avgPnlPercent: avgPnl,
    bestTrade: sorted[0],
    worstTrade: sorted[sorted.length - 1],
    avgAdxAtEntry: avgAdx,
    avgRvolAtEntry: avgRvol,
    callCount: trades.filter((t) => t.type === "CALL").length,
    putCount: trades.filter((t) => t.type === "PUT").length,
  }
}

// Storage helpers
export function saveTradeToArchive(trade: ArchivedTrade): void {
  const existing = getArchivedTrades()
  existing.push(trade)
  localStorage.setItem("spx_trade_archive", JSON.stringify(existing))
}

export function getArchivedTrades(): ArchivedTrade[] {
  if (typeof window === "undefined") return SAMPLE_WINNING_RUNS
  const stored = localStorage.getItem("spx_trade_archive")
  if (!stored) return SAMPLE_WINNING_RUNS
  try {
    return JSON.parse(stored)
  } catch {
    return SAMPLE_WINNING_RUNS
  }
}

export function clearTradeArchive(): void {
  localStorage.removeItem("spx_trade_archive")
}

export interface SuperTrendPattern {
  avgDelaySeconds: number
  winRateWithDelay: number
  winRateNoDelay: number
  optimalAdxThreshold: number
  optimalRsiRange: { min: number; max: number }
}

export function analyzeSuperTrendPatterns(trades: ArchivedTrade[]): SuperTrendPattern {
  const tradesWithDelay = trades.filter((t) => t.superTrend.signalDelay !== undefined)

  // Calculate average delay
  const totalDelay = tradesWithDelay.reduce((sum, t) => sum + (t.superTrend.signalDelay || 0), 0)
  const avgDelay = tradesWithDelay.length > 0 ? totalDelay / tradesWithDelay.length : 0

  // Win rate with delay vs no delay
  const delayedTrades = trades.filter((t) => (t.superTrend.signalDelay || 0) > 60)
  const noDelayTrades = trades.filter((t) => (t.superTrend.signalDelay || 0) <= 60)

  const delayedWins = delayedTrades.filter((t) => t.pnlPercent > 0).length
  const noDelayWins = noDelayTrades.filter((t) => t.pnlPercent > 0).length

  // Find optimal ADX threshold from winning trades
  const winningTrades = trades.filter((t) => t.pnlPercent > 0)
  const avgWinningAdx =
    winningTrades.length > 0 ? winningTrades.reduce((sum, t) => sum + t.indicators.adx, 0) / winningTrades.length : 25

  // Find optimal RSI range from winning trades
  const winningRsis = winningTrades.map((t) => t.indicators.rsi)
  const minRsi = winningRsis.length > 0 ? Math.min(...winningRsis) : 30
  const maxRsi = winningRsis.length > 0 ? Math.max(...winningRsis) : 70

  return {
    avgDelaySeconds: avgDelay,
    winRateWithDelay: delayedTrades.length > 0 ? (delayedWins / delayedTrades.length) * 100 : 0,
    winRateNoDelay: noDelayTrades.length > 0 ? (noDelayWins / noDelayTrades.length) * 100 : 0,
    optimalAdxThreshold: avgWinningAdx,
    optimalRsiRange: { min: minRsi, max: maxRsi },
  }
}
