import type { NextRequest } from 'next/server'
import { beginLogin } from '@/lib/server/auth-service'
import { handleRouteError, jsonOk } from '@/lib/server/route-helpers'

export async function POST(req: NextRequest) {
  try {
    const options = await beginLogin(req)
    return jsonOk(options)
  } catch (err) {
    return handleRouteError(err)
  }
}
