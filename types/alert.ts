import type { RunAlert } from "@/lib/indicators"
import type { ScalpAlert, DirectorState, ValidatorState } from "@/lib/scalp-signal-engine"

export interface AlertItem {
  id: string
  type: "opportunity" | "danger" | "caution" | "info" | "BULLISH_REVERSAL" | "BEARISH_REVERSAL" | "SQUEEZE_LONG" | "SQUEEZE_SHORT" | "TRAP_FADE_LONG" | "TRAP_FADE_SHORT"
  severity?: "high" | "medium" | "low"
  title: string
  message?: string
  subtitle?: string
  timestamp: Date
  dismissed?: boolean
  signals?: string[]
  fullAlert?: RunAlert
  // New scalp alert fields
  scalpAlert?: ScalpAlert
  explanation?: string // Single-line explanation for scalp alerts
  confidence?: number
  shouldPush?: boolean
  director?: DirectorState
  validator?: ValidatorState
}
