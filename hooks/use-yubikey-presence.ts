'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { logout } from '@/lib/client/auth'
import {
  broadcastPresenceLogout,
  isWebHidSupported,
  requestYubiKeyHidAccess,
  startYubiKeyPresenceMonitor,
  subscribePresenceLogout,
} from '@/lib/client/yubikey-presence'

interface UseYubiKeyPresenceOptions {
  enabled: boolean
  onLogout: () => void
}

export function useYubiKeyPresence({ enabled, onLogout }: UseYubiKeyPresenceOptions) {
  const onLogoutRef = useRef(onLogout)
  const loggingOutRef = useRef(false)
  const [keyPresent, setKeyPresent] = useState<boolean | null>(null)
  const [monitoringActive, setMonitoringActive] = useState(false)

  onLogoutRef.current = onLogout

  const handleLogout = useCallback(async () => {
    if (loggingOutRef.current) return
    loggingOutRef.current = true
    broadcastPresenceLogout()
    try {
      await logout()
    } catch {
      // session may already be gone
    }
    onLogoutRef.current()
  }, [])

  useEffect(() => {
    if (!enabled) {
      setKeyPresent(null)
      setMonitoringActive(false)
      return
    }

    let stopMonitor = () => {}
    let stopBroadcast = () => {}

    async function init() {
      const hidGranted = await requestYubiKeyHidAccess()
      setMonitoringActive(hidGranted && isWebHidSupported())

      stopMonitor = startYubiKeyPresenceMonitor({
        onKeyAbsent: () => void handleLogout(),
        onKeyPresentChange: setKeyPresent,
      })

      stopBroadcast = subscribePresenceLogout(() => {
        onLogoutRef.current()
      })
    }

    void init()

    return () => {
      stopMonitor()
      stopBroadcast()
    }
  }, [enabled, handleLogout])

  return { keyPresent, monitoringActive }
}
