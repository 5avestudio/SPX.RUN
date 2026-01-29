"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import {
  generateScalpAlert,
  type DirectorResult,
  type TrapModeResult,
  type AlertCooldownState,
  type ScalpAlert,
  SCALP_CONFIG,
} from "@/lib/scalp-signal-engine"
import type { OHLCData } from "@/lib/indicators"

interface UseScalpAlertsOptions {
  onAlert?: (alert: ScalpAlert) => void
  onPushAlert?: (alert: ScalpAlert) => void
}

interface ScalpAlertState {
  currentAlert: ScalpAlert | null
  alertHistory: ScalpAlert[]
  director: DirectorResult | null
  trap: TrapModeResult | null
  isActive: boolean
}

export function useScalpAlerts(options: UseScalpAlertsOptions = {}) {
  const { onAlert, onPushAlert } = options

  const [state, setState] = useState<ScalpAlertState>({
    currentAlert: null,
    alertHistory: [],
    director: null,
    trap: null,
    isActive: false,
  })

  const directorRef = useRef<DirectorResult | undefined>(undefined)
  const trapRef = useRef<TrapModeResult | undefined>(undefined)
  const cooldownRef = useRef<AlertCooldownState>({
    lastAlertDirection: null,
    lastAlertTimestamp: 0,
    vwapRetestSinceLastAlert: false,
    sameDirectionBlocked: false,
  })
  const candleIndexRef = useRef(0)
  const lastProcessedCandleRef = useRef<number>(0)

  // Process new candle data and check for alerts
  const processCandles = useCallback(
    (data1m: OHLCData[], data2m: OHLCData[], data5m: OHLCData[]) => {
      if (data1m.length < 30 || data2m.length < 20 || data5m.length < 52) {
        return null
      }

      // Prevent processing the same candle multiple times
      const latestCandleTime = data1m[data1m.length - 1]?.time || 0
      if (latestCandleTime === lastProcessedCandleRef.current) {
        return null
      }
      lastProcessedCandleRef.current = latestCandleTime

      candleIndexRef.current += 1

      const result = generateScalpAlert(
        data1m,
        data2m,
        data5m,
        directorRef.current,
        trapRef.current,
        cooldownRef.current,
        candleIndexRef.current
      )

      // Update refs
      directorRef.current = result.director
      trapRef.current = result.trap
      cooldownRef.current = result.updatedCooldown

      // Update state
      setState((prev) => ({
        ...prev,
        director: result.director,
        trap: result.trap,
        isActive: true,
      }))

      if (result.alert) {
        setState((prev) => ({
          ...prev,
          currentAlert: result.alert,
          alertHistory: [result.alert!, ...prev.alertHistory].slice(0, 50), // Keep last 50 alerts
        }))

        // Trigger callbacks
        onAlert?.(result.alert)
        if (result.alert.shouldPush) {
          onPushAlert?.(result.alert)
        }
      }

      return result
    },
    [onAlert, onPushAlert]
  )

  // Dismiss current alert
  const dismissAlert = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentAlert: null,
    }))
  }, [])

  // Reset all state
  const reset = useCallback(() => {
    directorRef.current = undefined
    trapRef.current = undefined
    cooldownRef.current = {
      lastAlertDirection: null,
      lastAlertTimestamp: 0,
      vwapRetestSinceLastAlert: false,
      sameDirectionBlocked: false,
    }
    candleIndexRef.current = 0
    lastProcessedCandleRef.current = 0

    setState({
      currentAlert: null,
      alertHistory: [],
      director: null,
      trap: null,
      isActive: false,
    })
  }, [])

  // Get current state summary for UI display
  const getStateSummary = useCallback(() => {
    const director = state.director
    const trap = state.trap

    return {
      directorState: director?.state || "CHOP",
      biasScore: director?.biasScore || 0,
      insideCloud: director?.insideCloud || false,
      trapActive: trap?.active || false,
      trapType: trap?.type || null,
      cooldownActive:
        cooldownRef.current.lastAlertDirection !== null &&
        Date.now() - cooldownRef.current.lastAlertTimestamp < SCALP_CONFIG.OPPOSITE_DIRECTION_COOLDOWN_MS,
      lastAlertDirection: cooldownRef.current.lastAlertDirection,
    }
  }, [state.director, state.trap])

  return {
    // State
    currentAlert: state.currentAlert,
    alertHistory: state.alertHistory,
    director: state.director,
    trap: state.trap,
    isActive: state.isActive,

    // Actions
    processCandles,
    dismissAlert,
    reset,

    // Helpers
    getStateSummary,
    config: SCALP_CONFIG,
  }
}
