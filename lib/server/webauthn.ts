import type { NextRequest } from 'next/server'
import {
  extractSecurityKeyTransports,
  SECURITY_KEY_TRANSPORTS,
  type StoredCredential,
} from './db'

export const RP_NAME = 'YubiKey Demo'
export const USER_VERIFICATION = 'discouraged' as const

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false

  try {
    const { hostname, protocol } = new URL(origin)
    if (protocol !== 'http:' && protocol !== 'https:') return false
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true
    if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true

    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (appUrl) {
      const appHost = new URL(appUrl).hostname
      if (hostname === appHost) return true
    }

    if (hostname.endsWith('.vercel.app')) return true

    return false
  } catch {
    return false
  }
}

export function getWebAuthnContext(req: NextRequest) {
  let origin = req.headers.get('origin')

  if (!origin) {
    const host = req.headers.get('host')
    const proto = req.headers.get('x-forwarded-proto') ?? 'https'
    if (host) origin = `${proto}://${host}`
  }

  if (!origin || !isAllowedOrigin(origin)) {
    throw new Error(
      'Открой сайт по правильному адресу (localhost или домен Vercel). Для телефона в Wi‑Fi — IP компьютера.'
    )
  }
  return { origin, rpId: new URL(origin).hostname }
}

export function credentialTransportsForClient(
  credential: StoredCredential,
  req: NextRequest
): AuthenticatorTransport[] | undefined {
  const ua = req.headers.get('user-agent') || ''
  const isMobile = /android|iphone|ipad|ipod/i.test(ua)

  // Safari на iPhone нестабильно реагирует на жёсткий transports: ['nfc'] / ['usb'].
  // Без подсказки браузер сам выберет NFC.
  if (isMobile) return undefined

  const transports = extractSecurityKeyTransports(credential.transports)
  return (transports.length ? transports : SECURITY_KEY_TRANSPORTS) as AuthenticatorTransport[]
}
