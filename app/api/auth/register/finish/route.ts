import type { NextRequest } from 'next/server'
import { finishRegistration } from '@/lib/server/auth-service'
import { handleRouteError, jsonOk } from '@/lib/server/route-helpers'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const result = await finishRegistration(req, body)
    return jsonOk(result)
  } catch (err) {
    return handleRouteError(err)
  }
}
