import type { NextRequest } from 'next/server'
import { isMobileUserAgent } from './webauthn'
import type { SessionData } from './session'

export function shouldEnablePresenceMode(req: NextRequest): boolean {
  return !isMobileUserAgent(req)
}

export function enablePresenceSession(session: SessionData, credentialId: string) {
  session.presenceMode = true
  session.credentialId = credentialId
}
