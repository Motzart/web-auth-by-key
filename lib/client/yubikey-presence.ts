const YUBICO_VENDOR_ID = 0x1050
export const PRESENCE_POLL_INTERVAL_MS = 2000
export const LOGOUT_BROADCAST_CHANNEL = 'yubikey-auth-logout'

export function isDesktopClient(): boolean {
  if (typeof navigator === 'undefined') return false
  return !/android|iphone|ipad|ipod/i.test(navigator.userAgent)
}

export function isWebHidSupported(): boolean {
  return typeof navigator !== 'undefined' && 'hid' in navigator
}

function getHid(): HID | null {
  if (!isWebHidSupported()) return null
  return navigator.hid ?? null
}

function getYubiKeyDevices(devices: HIDDevice[]): HIDDevice[] {
  return devices.filter(device => device.vendorId === YUBICO_VENDOR_ID)
}

export async function requestYubiKeyHidAccess(): Promise<boolean> {
  const hid = getHid()
  if (!hid) return false

  try {
    const existing = getYubiKeyDevices(await hid.getDevices())
    if (existing.length > 0) return true

    await hid.requestDevice({ filters: [{ vendorId: YUBICO_VENDOR_ID }] })
    return getYubiKeyDevices(await hid.getDevices()).length > 0
  } catch {
    return false
  }
}

export async function isYubiKeyConnected(): Promise<boolean> {
  const hid = getHid()
  if (!hid) return false
  const devices = getYubiKeyDevices(await hid.getDevices())
  return devices.length > 0
}

export function broadcastPresenceLogout() {
  if (typeof BroadcastChannel === 'undefined') return
  try {
    new BroadcastChannel(LOGOUT_BROADCAST_CHANNEL).postMessage('logout')
  } catch {
    // ignore
  }
}

export interface PresenceMonitorOptions {
  onKeyAbsent: () => void
  onKeyPresentChange?: (present: boolean) => void
}

export function startYubiKeyPresenceMonitor({
  onKeyAbsent,
  onKeyPresentChange,
}: PresenceMonitorOptions): () => void {
  const hid = getHid()
  if (!hid || !isDesktopClient()) {
    return () => {}
  }

  let stopped = false
  let hadKey = false

  async function syncPresence(forceAbsent = false) {
    if (stopped) return

    const hasKey = forceAbsent ? false : await isYubiKeyConnected()
    onKeyPresentChange?.(hasKey)

    if (hasKey) {
      hadKey = true
      return
    }

    if (hadKey) {
      stopped = true
      onKeyAbsent()
    }
  }

  function onDisconnect(event: Event) {
    if (stopped) return
    const device = (event as HIDConnectionEvent).device
    if (device.vendorId !== YUBICO_VENDOR_ID) return
    stopped = true
    onKeyPresentChange?.(false)
    onKeyAbsent()
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'visible') void syncPresence()
  }

  hid.addEventListener('disconnect', onDisconnect)
  document.addEventListener('visibilitychange', onVisibilityChange)

  void syncPresence()

  const pollId = window.setInterval(() => {
    void syncPresence()
  }, PRESENCE_POLL_INTERVAL_MS)

  return () => {
    stopped = true
    window.clearInterval(pollId)
    hid.removeEventListener('disconnect', onDisconnect)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }
}

export function subscribePresenceLogout(onLogout: () => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {}

  const channel = new BroadcastChannel(LOGOUT_BROADCAST_CHANNEL)
  const handler = (event: MessageEvent) => {
    if (event.data === 'logout') onLogout()
  }
  channel.addEventListener('message', handler)

  return () => {
    channel.removeEventListener('message', handler)
    channel.close()
  }
}
