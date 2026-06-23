export interface User {
  id: string
  username: string
  displayName: string
  credentialsCount: number
  createdAt: string
  presenceMode?: boolean
  presenceMethod?: 'none' | 'hid' | 'webauthn'
}

interface ApiError {
  error?: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })

  const data = await res.json().catch(() => ({})) as T & ApiError

  if (!res.ok) {
    const err = new Error(data.error || res.statusText) as Error & { status: number }
    err.status = res.status
    throw err
  }

  return data
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
}
