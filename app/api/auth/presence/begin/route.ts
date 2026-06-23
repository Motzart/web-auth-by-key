import type { NextRequest } from 'next/server'
import { beginPresenceCheck } from '@/lib/server/auth-service'
import { handleRouteError, jsonOk } from '@/lib/server/route-helpers'

export async function POST(req: NextRequest) {
  try {
    const options = await beginPresenceCheck(req)
    return jsonOk(options)
  } catch (err) {
    return handleRouteError(err)
  }
}
