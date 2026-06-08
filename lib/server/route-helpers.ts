import { NextResponse } from 'next/server'
import { AuthError } from './auth-service'

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status })
}

export function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status })
}

export function handleRouteError(err: unknown) {
  if (err instanceof AuthError) {
    return jsonError(err.message, err.status)
  }
  if (err instanceof Error) {
    return jsonError(err.message, 400)
  }
  return jsonError('Internal error', 500)
}
