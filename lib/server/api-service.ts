import type { NextRequest } from 'next/server'
import { readDB, getCredentialRpId } from './db'
import { requireAuthUserId } from './session'

export async function getDashboard() {
  const userId = await requireAuthUserId()
  if (!userId) return null

  const db = await readDB()
  const user = db.users[userId]
  if (!user) return null

  return {
    title: 'Dashboard',
    message: `Добро пожаловать, ${user.displayName}!`,
    stats: {
      sessions: Math.floor(Math.random() * 50) + 10,
      keys: user.credentials.length,
      lastLogin: user.credentials[0]?.lastUsed || user.createdAt,
    },
  }
}

export async function getSettings() {
  const userId = await requireAuthUserId()
  if (!userId) return null

  const db = await readDB()
  const user = db.users[userId]
  if (!user) return null

  return {
    title: 'Settings',
    user: {
      username: user.username,
      displayName: user.displayName,
      createdAt: user.createdAt,
      credentials: user.credentials.map(c => ({
        id: c.credentialID.slice(0, 12) + '...',
        registeredRpId: getCredentialRpId(c),
        addedAt: c.addedAt,
        lastUsed: c.lastUsed || 'Never',
        transports: c.transports,
      })),
    },
  }
}

export async function getSecurity(req: NextRequest) {
  const userId = await requireAuthUserId()
  if (!userId) return null

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

  return {
    title: 'Security Log',
    events: [
      { type: 'login', method: 'YubiKey', time: new Date().toISOString(), ip },
      { type: 'session_refresh', time: new Date(Date.now() - 3600000).toISOString(), ip },
      { type: 'login', method: 'YubiKey', time: new Date(Date.now() - 86400000).toISOString(), ip },
    ],
  }
}
