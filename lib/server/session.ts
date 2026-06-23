import { getIronSession, type SessionOptions } from 'iron-session'
import { cookies } from 'next/headers'

export interface SessionData {
  userId?: string
  registrationChallenge?: string
  pendingUserId?: string
  authChallenge?: string
  webAuthnOrigin?: string
  webAuthnRpId?: string
  /** Desktop USB: сессия привязана к физическому ключу */
  presenceMode?: boolean
  credentialId?: string
  presenceMethod?: 'none' | 'hid' | 'webauthn'
  lastPresenceAt?: number
}

const SESSION_SECRET = process.env.SESSION_SECRET

if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  console.warn(
    '[session] SESSION_SECRET must be at least 32 characters. Set it in .env.local'
  )
}

export const sessionOptions: SessionOptions = {
  password: SESSION_SECRET || 'dev-only-secret-must-be-32-chars-min!!',
  cookieName: 'yubikey_session',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60,
  },
}

export async function getSession() {
  const cookieStore = await cookies()
  return getIronSession<SessionData>(cookieStore, sessionOptions)
}

export async function touchSession() {
  const session = await getSession()
  if (session.userId) await session.save()
  return session
}

export async function requireAuthUserId(): Promise<string | null> {
  const session = await touchSession()
  return session.userId ?? null
}
