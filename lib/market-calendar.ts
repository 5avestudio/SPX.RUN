// US Market Holiday Calendar and Trading Hours Utility

export interface MarketStatus {
  isOpen: boolean
  isWeekend: boolean
  isHoliday: boolean
  holidayName?: string
  nextOpenDate: Date
  nextOpenLabel: string
  minutesUntilOpen: number
  hoursUntilOpen: number
  daysUntilOpen: number
}

// US Stock Market Holidays for 2024-2026
// Markets close at 1pm ET on early close days
const US_MARKET_HOLIDAYS: Record<string, { name: string; earlyClose?: boolean }> = {
  // 2024
  "2024-01-01": { name: "New Year's Day" },
  "2024-01-15": { name: "Martin Luther King Jr. Day" },
  "2024-02-19": { name: "Presidents' Day" },
  "2024-03-29": { name: "Good Friday" },
  "2024-05-27": { name: "Memorial Day" },
  "2024-06-19": { name: "Juneteenth" },
  "2024-07-04": { name: "Independence Day" },
  "2024-09-02": { name: "Labor Day" },
  "2024-11-28": { name: "Thanksgiving Day" },
  "2024-11-29": { name: "Day After Thanksgiving", earlyClose: true },
  "2024-12-24": { name: "Christmas Eve", earlyClose: true },
  "2024-12-25": { name: "Christmas Day" },

  // 2025
  "2025-01-01": { name: "New Year's Day" },
  "2025-01-09": { name: "National Day of Mourning (Carter)" }, // Special closure
  "2025-01-20": { name: "Martin Luther King Jr. Day" },
  "2025-02-17": { name: "Presidents' Day" },
  "2025-04-18": { name: "Good Friday" },
  "2025-05-26": { name: "Memorial Day" },
  "2025-06-19": { name: "Juneteenth" },
  "2025-07-04": { name: "Independence Day" },
  "2025-09-01": { name: "Labor Day" },
  "2025-11-27": { name: "Thanksgiving Day" },
  "2025-11-28": { name: "Day After Thanksgiving", earlyClose: true },
  "2025-12-24": { name: "Christmas Eve", earlyClose: true },
  "2025-12-25": { name: "Christmas Day" },

  // 2026
  "2026-01-01": { name: "New Year's Day" },
  "2026-01-19": { name: "Martin Luther King Jr. Day" },
  "2026-02-16": { name: "Presidents' Day" },
  "2026-04-03": { name: "Good Friday" },
  "2026-05-25": { name: "Memorial Day" },
  "2026-06-19": { name: "Juneteenth" },
  "2026-07-03": { name: "Independence Day (Observed)" },
  "2026-09-07": { name: "Labor Day" },
  "2026-11-26": { name: "Thanksgiving Day" },
  "2026-11-27": { name: "Day After Thanksgiving", earlyClose: true },
  "2026-12-24": { name: "Christmas Eve", earlyClose: true },
  "2026-12-25": { name: "Christmas Day" },
}

// Format date as YYYY-MM-DD for holiday lookup
function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

// Get Eastern Time from a Date object
function getEasternTime(date: Date = new Date()): { hours: number; minutes: number; dayOfWeek: number; date: Date } {
  // Create a formatter for Eastern Time
  const etFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })

  const parts = etFormatter.formatToParts(date)
  const hours = Number.parseInt(parts.find((p) => p.type === "hour")?.value || "0")
  const minutes = Number.parseInt(parts.find((p) => p.type === "minute")?.value || "0")
  const weekdayStr = parts.find((p) => p.type === "weekday")?.value || "Mon"

  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const dayOfWeek = weekdayMap[weekdayStr] ?? 1

  return { hours, minutes, dayOfWeek, date }
}

// Check if a specific date is a market holiday
export function isMarketHoliday(date: Date = new Date()): {
  isHoliday: boolean
  holidayName?: string
  isEarlyClose?: boolean
} {
  const dateKey = formatDateKey(date)
  const holiday = US_MARKET_HOLIDAYS[dateKey]

  if (holiday) {
    return { isHoliday: true, holidayName: holiday.name, isEarlyClose: holiday.earlyClose }
  }

  return { isHoliday: false }
}

// Check if it's a weekend
export function isWeekend(date: Date = new Date()): boolean {
  const { dayOfWeek } = getEasternTime(date)
  return dayOfWeek === 0 || dayOfWeek === 6 // Sunday or Saturday
}

// Get the next trading day
export function getNextTradingDay(fromDate: Date = new Date()): Date {
  const nextDay = new Date(fromDate)
  nextDay.setDate(nextDay.getDate() + 1)
  nextDay.setHours(9, 30, 0, 0) // Set to market open

  // Skip weekends and holidays
  let iterations = 0
  while (iterations < 10) {
    // Safety limit
    const { dayOfWeek } = getEasternTime(nextDay)
    const { isHoliday } = isMarketHoliday(nextDay)

    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isHoliday) {
      return nextDay
    }

    nextDay.setDate(nextDay.getDate() + 1)
    iterations++
  }

  return nextDay
}

// Get full market status
export function getMarketStatus(now: Date = new Date()): MarketStatus {
  const et = getEasternTime(now)
  const { isHoliday, holidayName, isEarlyClose } = isMarketHoliday(now)
  const weekend = et.dayOfWeek === 0 || et.dayOfWeek === 6

  const currentMinutes = et.hours * 60 + et.minutes
  const marketOpenMinutes = 9 * 60 + 30 // 9:30 AM ET
  const marketCloseMinutes = isEarlyClose ? 13 * 60 : 16 * 60 // 1 PM or 4 PM ET

  // Determine if market is currently open
  const isOpen = !weekend && !isHoliday && currentMinutes >= marketOpenMinutes && currentMinutes < marketCloseMinutes

  // Calculate next open
  let nextOpenDate: Date
  let nextOpenLabel: string

  if (isOpen) {
    // Market is open now
    nextOpenDate = now
    nextOpenLabel = "Market Open"
  } else if (!weekend && !isHoliday && currentMinutes < marketOpenMinutes) {
    // Today is a trading day, before market open
    nextOpenDate = new Date(now)
    nextOpenDate.setHours(9, 30, 0, 0)
    nextOpenLabel = "Opens today 9:30 AM ET"
  } else {
    // Market closed for the day, find next trading day
    nextOpenDate = getNextTradingDay(now)

    const nextET = getEasternTime(nextOpenDate)
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    const nextDayName = dayNames[nextET.dayOfWeek]

    // Check if it's tomorrow or further out
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowKey = formatDateKey(tomorrow)
    const nextKey = formatDateKey(nextOpenDate)

    if (tomorrowKey === nextKey) {
      nextOpenLabel = "Opens tomorrow 9:30 AM ET"
    } else {
      nextOpenLabel = `Opens ${nextDayName} 9:30 AM ET`
    }
  }

  // Calculate time until open
  const msUntilOpen = nextOpenDate.getTime() - now.getTime()
  const minutesUntilOpen = Math.max(0, Math.floor(msUntilOpen / (1000 * 60)))
  const hoursUntilOpen = Math.floor(minutesUntilOpen / 60)
  const daysUntilOpen = Math.floor(hoursUntilOpen / 24)

  return {
    isOpen,
    isWeekend: weekend,
    isHoliday,
    holidayName,
    nextOpenDate,
    nextOpenLabel,
    minutesUntilOpen,
    hoursUntilOpen: hoursUntilOpen % 24,
    daysUntilOpen,
  }
}

// Format countdown string
export function formatMarketCountdown(status: MarketStatus): string {
  if (status.isOpen) {
    return "Market Open"
  }

  if (status.daysUntilOpen > 0) {
    const days = status.daysUntilOpen
    const hours = status.hoursUntilOpen
    if (hours > 0) {
      return `${days}d ${hours}h`
    }
    return `${days}d`
  }

  if (status.hoursUntilOpen > 0) {
    return `${status.hoursUntilOpen}h ${status.minutesUntilOpen % 60}m`
  }

  return `${status.minutesUntilOpen}m`
}

// Check if alerts should be active (only during market hours or pre-market)
export function shouldShowAlerts(now: Date = new Date()): boolean {
  const status = getMarketStatus(now)

  // Show alerts if market is open
  if (status.isOpen) return true

  // Also show alerts 30 minutes before market open (pre-market prep)
  if (status.minutesUntilOpen <= 30 && status.minutesUntilOpen > 0) return true

  return false
}

// Extended hours session detection
export type ExtendedHoursSession = "pre-market" | "after-hours" | "night-market" | "regular" | "closed"

export function getExtendedHoursSession(now: Date = new Date()): {
  session: ExtendedHoursSession
  label: string
  tradingActive: boolean
} {
  const et = getEasternTime(now)
  const { isHoliday } = isMarketHoliday(now)
  const weekend = et.dayOfWeek === 0 || et.dayOfWeek === 6
  
  const currentMinutes = et.hours * 60 + et.minutes
  
  // Night Market: 8:00 PM - 4:00 AM ET (overnight futures/index trading)
  const nightMarketStart = 20 * 60 // 8:00 PM
  const nightMarketEnd = 4 * 60 // 4:00 AM
  
  // Pre-market: 4:00 AM - 9:30 AM ET
  const preMarketStart = 4 * 60 // 4:00 AM
  const marketOpen = 9 * 60 + 30 // 9:30 AM
  
  // Regular hours: 9:30 AM - 4:00 PM ET
  const marketClose = 16 * 60 // 4:00 PM
  
  // After-hours: 4:00 PM - 8:00 PM ET
  const afterHoursEnd = 20 * 60 // 8:00 PM

  // Weekend - show as closed but note weekend trading may be available
  if (weekend) {
    return { session: "closed", label: "Weekend", tradingActive: false }
  }
  
  // Holiday
  if (isHoliday) {
    return { session: "closed", label: "Holiday", tradingActive: false }
  }

  // Night Market session (8 PM - midnight)
  if (currentMinutes >= nightMarketStart) {
    return { session: "night-market", label: "Night Market", tradingActive: true }
  }
  
  // Night Market session (midnight - 4 AM)
  if (currentMinutes < nightMarketEnd) {
    return { session: "night-market", label: "Night Market", tradingActive: true }
  }

  // Pre-market session
  if (currentMinutes >= preMarketStart && currentMinutes < marketOpen) {
    return { session: "pre-market", label: "Pre-Market", tradingActive: true }
  }

  // Regular trading hours
  if (currentMinutes >= marketOpen && currentMinutes < marketClose) {
    return { session: "regular", label: "Market Open", tradingActive: true }
  }

  // After-hours session
  if (currentMinutes >= marketClose && currentMinutes < afterHoursEnd) {
    return { session: "after-hours", label: "After Hours", tradingActive: true }
  }

  // Fallback (shouldn't reach here)
  return { session: "closed", label: "Market Closed", tradingActive: false }
}
