// Simulated market data generation for fallback when APIs are unavailable

export interface MarketDataPoint {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

/**
 * Generates realistic candle data with proper OHLC relationships
 * @param basePrice - The starting price for the simulation
 * @param count - Number of candles to generate
 * @param intervalMinutes - Time interval between candles in minutes
 * @returns Array of MarketDataPoint with realistic price movements
 */
export function generateRealisticCandles(
  basePrice: number,
  count: number = 100,
  intervalMinutes: number = 5
): MarketDataPoint[] {
  const data: MarketDataPoint[] = []
  const now = Date.now()
  
  // Volatility based on price level (higher priced assets have larger moves)
  const volatilityFactor = basePrice > 1000 ? 0.002 : basePrice > 100 ? 0.003 : 0.005
  
  let currentPrice = basePrice
  
  for (let i = count; i >= 0; i--) {
    const timestamp = now - i * intervalMinutes * 60 * 1000
    
    // Random walk with mean reversion tendency
    const trendBias = (basePrice - currentPrice) / basePrice * 0.1 // Pull toward base price
    const randomMove = (Math.random() - 0.5 + trendBias) * basePrice * volatilityFactor
    
    const open = currentPrice
    const close = currentPrice + randomMove
    
    // High and low should contain open and close
    const range = Math.abs(randomMove) + (Math.random() * basePrice * volatilityFactor * 0.5)
    const high = Math.max(open, close) + Math.random() * range * 0.5
    const low = Math.min(open, close) - Math.random() * range * 0.5
    
    // Volume varies with volatility
    const volumeBase = basePrice > 1000 ? 500000 : basePrice > 100 ? 1000000 : 2000000
    const volume = Math.floor(volumeBase * (0.5 + Math.random()) * (1 + Math.abs(randomMove) / basePrice * 10))
    
    data.push({
      timestamp,
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume,
    })
    
    currentPrice = close
  }
  
  return data
}
