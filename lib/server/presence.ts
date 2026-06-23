import type { NextRequest } from 'next/server'
import { isMobileUserAgent } from './webauthn'
import type { SessionData } from './session'

export { PRESENCE_WEBAUTHN_INTERVAL_MS, PRESENCE_WEBAUTHN_TIMEOUT_MS } from '@/lib/shared/presence-config'

export function shouldEnablePresenceMode(req: NextRequest): boolean {
  return !isMobileUserAgent(req)
}

export function enablePresenceSession(session: SessionData, credentialId: string) {
  session.presenceMode = true
  session.credentialId = credentialId
  session.presenceMethod = 'none'
}
