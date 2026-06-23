import { confirmYubiKeyPresence, setPresenceMonitoringMethod } from '@/lib/client/auth'
import { PRESENCE_POLL_INTERVAL_MS, PRESENCE_WEBAUTHN_INTERVAL_MS } from '@/lib/shared/presence-config'

const YUBICO_VENDOR_ID = 0x1050

/** YubiKey 5 NFC — productId 0x0407. Chrome видит только OTP keyboard, не FIDO. */
const YUBIKEY_KEYBOARD_HID_FILTERS: HIDDeviceFilter[] = [
  { vendorId: YUBICO_VENDOR_ID, productId: 0x0407, usagePage: 0x0001, usage: 0x0006 },
  { vendorId: YUBICO_VENDOR_ID, productId: 0x0410, usagePage: 0x0001, usage: 0x0006 },
  { vendorId: YUBICO_VENDOR_ID, productId: 0x0403, usagePage: 0x0001, usage: 0x0006 },
  { vendorId: YUBICO_VENDOR_ID, usagePage: 0x0001, usage: 0x0006 },
]

export { PRESENCE_POLL_INTERVAL_MS }
export const LOGOUT_BROADCAST_CHANNEL = 'yubikey-auth-logout'

export type HidAccessResult =
  | { ok: true }
  | { ok: false; reason: 'unsupported' | 'denied' | 'no_devices' }

export type PresenceMonitoringMethod = 'none' | 'hid' | 'webauthn'

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

export async function hasGrantedYubiKeyHidAccess(): Promise<boolean> {
  const hid = getHid()
  if (!hid) return false
  return getYubiKeyDevices(await hid.getDevices()).length > 0
}

export async function requestYubiKeyHidAccess(): Promise<HidAccessResult> {
  const hid = getHid()
  if (!hid) return { ok: false, reason: 'unsupported' }

  try {
    if (await hasGrantedYubiKeyHidAccess()) return { ok: true }

    const picked = await hid.requestDevice({ filters: YUBIKEY_KEYBOARD_HID_FILTERS })
    if (getYubiKeyDevices(picked).length > 0) return { ok: true }

    if (await hasGrantedYubiKeyHidAccess()) return { ok: true }

    return { ok: false, reason: 'no_devices' }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'NotFoundError') {
      return { ok: false, reason: 'no_devices' }
    }
    return { ok: false, reason: 'denied' }
  }
}

export async function isYubiKeyConnected(): Promise<boolean> {
  return hasGrantedYubiKeyHidAccess()
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

  async function syncPresence() {
    if (stopped) return

    const hasKey = await isYubiKeyConnected()
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

  function onConnect(event: Event) {
    if (stopped) return
    const device = (event as HIDConnectionEvent).device
    if (device.vendorId !== YUBICO_VENDOR_ID) return
    hadKey = true
    onKeyPresentChange?.(true)
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'visible') void syncPresence()
  }

  hid.addEventListener('disconnect', onDisconnect)
  hid.addEventListener('connect', onConnect)
  document.addEventListener('visibilitychange', onVisibilityChange)

  void syncPresence()

  const pollId = window.setInterval(() => {
    void syncPresence()
  }, PRESENCE_POLL_INTERVAL_MS)

  return () => {
    stopped = true
    window.clearInterval(pollId)
    hid.removeEventListener('disconnect', onDisconnect)
    hid.removeEventListener('connect', onConnect)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }
}

export interface WebAuthnPresenceMonitorOptions {
  onKeyAbsent: () => void
  onAwaitingTouch?: () => void
  onConfirmed?: () => void
}

export function startWebAuthnPresenceMonitor({
  onKeyAbsent,
  onAwaitingTouch,
  onConfirmed,
}: WebAuthnPresenceMonitorOptions): () => void {
  let stopped = false
  let running = false

  async function runCheck() {
    if (stopped || running) return
    running = true
    onAwaitingTouch?.()
    try {
      await confirmYubiKeyPresence()
      onConfirmed?.()
    } catch {
      if (!stopped) onKeyAbsent()
    } finally {
      running = false
    }
  }

  void runCheck()

  const intervalId = window.setInterval(() => {
    void runCheck()
  }, PRESENCE_WEBAUTHN_INTERVAL_MS)

  function onVisibilityChange() {
    if (document.visibilityState === 'visible') void runCheck()
  }
  document.addEventListener('visibilitychange', onVisibilityChange)

  return () => {
    stopped = true
    window.clearInterval(intervalId)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }
}

export async function activateHidPresenceMonitoring(): Promise<HidAccessResult> {
  const result = await requestYubiKeyHidAccess()
  if (result.ok) await setPresenceMonitoringMethod('hid')
  return result
}

export async function activateWebAuthnPresenceMonitoring(): Promise<void> {
  await setPresenceMonitoringMethod('webauthn')
  await confirmYubiKeyPresence()
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

export const PRESENCE_SETUP_HINT =
  'YubiKey 5 NFC + Chrome: FIDO-интерфейс скрыт браузером. В YubiKey Manager включите OTP (не «FIDO only»), переподключите ключ и нажмите «HID-мониторинг».'

export const PRESENCE_WEBAUTHN_HINT =
  'Касайте YubiKey каждые 2 мин. Если ключ вытащен — проверка не пройдёт и сессия завершится.'
