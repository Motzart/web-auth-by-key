'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { logout } from '@/lib/client/auth'
import {
  activateHidPresenceMonitoring,
  activateWebAuthnPresenceMonitoring,
  broadcastPresenceLogout,
  hasGrantedYubiKeyHidAccess,
  isWebHidSupported,
  startWebAuthnPresenceMonitor,
  startYubiKeyPresenceMonitor,
  subscribePresenceLogout,
  type HidAccessResult,
  type PresenceMonitoringMethod,
} from '@/lib/client/yubikey-presence'

interface UseYubiKeyPresenceOptions {
  enabled: boolean
  initialMethod?: PresenceMonitoringMethod
  onLogout: () => void
}

export function useYubiKeyPresence({
  enabled,
  initialMethod = 'none',
  onLogout,
}: UseYubiKeyPresenceOptions) {
  const onLogoutRef = useRef(onLogout)
  const loggingOutRef = useRef(false)
  const stopMonitorRef = useRef<(() => void) | null>(null)

  const [keyPresent, setKeyPresent] = useState<boolean | null>(null)
  const [monitoringMethod, setMonitoringMethod] = useState<PresenceMonitoringMethod>('none')
  const [needsSetup, setNeedsSetup] = useState(false)
  const [setupError, setSetupError] = useState<string | null>(null)
  const [enabling, setEnabling] = useState(false)
  const [awaitingTouch, setAwaitingTouch] = useState(false)

  onLogoutRef.current = onLogout

  const handleLogout = useCallback(async () => {
    if (loggingOutRef.current) return
    loggingOutRef.current = true
    stopMonitorRef.current?.()
    broadcastPresenceLogout()
    try {
      await logout()
    } catch {
      // session may already be gone
    }
    onLogoutRef.current()
  }, [])

  const startMonitorForMethod = useCallback((method: PresenceMonitoringMethod) => {
    stopMonitorRef.current?.()

    if (method === 'hid') {
      stopMonitorRef.current = startYubiKeyPresenceMonitor({
        onKeyAbsent: () => void handleLogout(),
        onKeyPresentChange: setKeyPresent,
      })
      setAwaitingTouch(false)
      return
    }

    if (method === 'webauthn') {
      stopMonitorRef.current = startWebAuthnPresenceMonitor({
        onKeyAbsent: () => void handleLogout(),
        onAwaitingTouch: () => setAwaitingTouch(true),
        onConfirmed: () => {
          setAwaitingTouch(false)
          setKeyPresent(true)
        },
      })
      return
    }

    stopMonitorRef.current = null
  }, [handleLogout])

  const refreshSetupState = useCallback(async (method: PresenceMonitoringMethod) => {
    if (method === 'hid') {
      const granted = await hasGrantedYubiKeyHidAccess()
      setNeedsSetup(!granted && isWebHidSupported())
      setMonitoringMethod(granted ? 'hid' : 'none')
      if (granted) setKeyPresent(true)
      return
    }

    if (method === 'webauthn') {
      setNeedsSetup(false)
      setMonitoringMethod('webauthn')
      setKeyPresent(true)
      return
    }

    setNeedsSetup(isWebHidSupported())
    setMonitoringMethod('none')
  }, [])

  const enableHidMonitoring = useCallback(async (): Promise<HidAccessResult> => {
    setEnabling(true)
    setSetupError(null)
    try {
      const result = await activateHidPresenceMonitoring()
      if (result.ok) {
        setMonitoringMethod('hid')
        setNeedsSetup(false)
        setKeyPresent(true)
        startMonitorForMethod('hid')
      } else if (result.reason === 'no_devices') {
        setSetupError('no_devices')
      }
      return result
    } finally {
      setEnabling(false)
    }
  }, [startMonitorForMethod])

  const enableWebAuthnMonitoring = useCallback(async () => {
    setEnabling(true)
    setSetupError(null)
    try {
      await activateWebAuthnPresenceMonitoring()
      setMonitoringMethod('webauthn')
      setNeedsSetup(false)
      setKeyPresent(true)
      startMonitorForMethod('webauthn')
    } catch {
      setSetupError('webauthn_failed')
    } finally {
      setEnabling(false)
    }
  }, [startMonitorForMethod])

  useEffect(() => {
    if (!enabled) {
      stopMonitorRef.current?.()
      setKeyPresent(null)
      setMonitoringMethod('none')
      setNeedsSetup(false)
      setSetupError(null)
      setAwaitingTouch(false)
      return
    }

    let stopBroadcast = () => {}

    async function init() {
      const method = initialMethod === 'none' ? 'none' : initialMethod
      await refreshSetupState(method)

      if (method === 'hid' && (await hasGrantedYubiKeyHidAccess())) {
        startMonitorForMethod('hid')
      } else if (method === 'webauthn') {
        startMonitorForMethod('webauthn')
      } else if (method === 'none') {
        setNeedsSetup(isWebHidSupported())
      }

      stopBroadcast = subscribePresenceLogout(() => {
        onLogoutRef.current()
      })
    }

    void init()

    return () => {
      stopMonitorRef.current?.()
      stopBroadcast()
    }
  }, [enabled, initialMethod, refreshSetupState, startMonitorForMethod])

  return {
    keyPresent,
    monitoringMethod,
    monitoringActive: monitoringMethod !== 'none',
    needsSetup,
    setupError,
    enabling,
    awaitingTouch,
    enableHidMonitoring,
    enableWebAuthnMonitoring,
  }
}
