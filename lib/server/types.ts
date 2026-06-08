export interface StoredCredential {
  credentialID: string
  credentialPublicKey: string
  counter: number
  transports: string[]
  registeredRpId?: string
  addedAt: string
  lastUsed?: string
}

export interface StoredUser {
  id: string
  username: string
  displayName: string
  createdAt: string
  credentials: StoredCredential[]
}

export interface Db {
  users: Record<string, StoredUser>
  sessions: Record<string, unknown>
}
