import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { Redis } from '@upstash/redis'
import type { Db, StoredCredential, StoredUser } from './types'

const KV_KEY = 'yubikey:db'
const DEFAULT_REGISTERED_RP_ID = process.env.DEFAULT_REGISTERED_RP_ID ?? 'localhost'
const DEFAULT_DB: Db = { users: {}, sessions: {} }

const LOCAL_DB_PATH = join(process.cwd(), 'data', 'db.json')

function getRedisUrl(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
}

function getRedisToken(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
}

function useKv(): boolean {
  return Boolean(getRedisUrl() && getRedisToken())
}

function getRedis(): Redis {
  return new Redis({
    url: getRedisUrl()!,
    token: getRedisToken()!,
  })
}

function migrateCredentials(db: Db): Db {
  let changed = false

  for (const user of Object.values(db.users)) {
    for (const credential of user.credentials ?? []) {
      if (!credential.registeredRpId) {
        credential.registeredRpId = DEFAULT_REGISTERED_RP_ID
        changed = true
      }
    }
  }

  if (changed) void writeDB(db)
  return db
}

function readLocalDB(): Db {
  if (!existsSync(LOCAL_DB_PATH)) {
    mkdirSync(join(process.cwd(), 'data'), { recursive: true })
    writeFileSync(LOCAL_DB_PATH, JSON.stringify(DEFAULT_DB, null, 2))
    return { ...DEFAULT_DB }
  }

  const raw = readFileSync(LOCAL_DB_PATH, 'utf-8').trim()
  if (!raw) {
    writeFileSync(LOCAL_DB_PATH, JSON.stringify(DEFAULT_DB, null, 2))
    return { ...DEFAULT_DB }
  }

  try {
    const data = JSON.parse(raw)
    return migrateCredentials({
      users: data.users ?? {},
      sessions: data.sessions ?? {},
    })
  } catch {
    writeFileSync(LOCAL_DB_PATH, JSON.stringify(DEFAULT_DB, null, 2))
    return { ...DEFAULT_DB }
  }
}

function writeLocalDB(data: Db): void {
  mkdirSync(join(process.cwd(), 'data'), { recursive: true })
  writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2))
}

export async function readDB(): Promise<Db> {
  if (useKv()) {
    const redis = getRedis()
    const data = await redis.get<Db>(KV_KEY)
    if (!data) {
      await redis.set(KV_KEY, DEFAULT_DB)
      return { ...DEFAULT_DB }
    }
    return migrateCredentials({
      users: data.users ?? {},
      sessions: data.sessions ?? {},
    })
  }

  return readLocalDB()
}

export async function writeDB(data: Db): Promise<void> {
  if (useKv()) {
    const redis = getRedis()
    await redis.set(KV_KEY, data)
    return
  }

  writeLocalDB(data)
}

export function findUserByCredentialId(db: Db, credentialID: string) {
  for (const user of Object.values(db.users)) {
    const credential = user.credentials.find(c => c.credentialID === credentialID)
    if (credential) return { user, credential }
  }
  return null
}

export function getCredentialRpId(credential: StoredCredential): string {
  return credential.registeredRpId ?? DEFAULT_REGISTERED_RP_ID
}

export function getAllSecurityCredentials(db: Db): StoredCredential[] {
  const credentials: StoredCredential[] = []
  for (const user of Object.values(db.users)) {
    for (const credential of user.credentials) {
      if (extractSecurityKeyTransports(credential.transports).length > 0) {
        credentials.push(credential)
      }
    }
  }
  return credentials
}

export const SECURITY_KEY_TRANSPORTS = ['usb', 'nfc', 'ble']

export function extractSecurityKeyTransports(transports?: string[]): string[] {
  return (transports || []).filter(t => SECURITY_KEY_TRANSPORTS.includes(t))
}

export function toBase64URLString(value: string | Uint8Array | Buffer): string {
  if (typeof value === 'string') return value
  return Buffer.from(value).toString('base64url')
}

export function toBufferFromBase64URL(value: string | Uint8Array): Buffer {
  if (value instanceof Uint8Array) return Buffer.from(value)
  return Buffer.from(value, 'base64url')
}

export type { StoredUser, StoredCredential }
