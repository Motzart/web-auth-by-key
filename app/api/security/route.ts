import type { NextRequest } from 'next/server'
import { getSecurity } from '@/lib/server/api-service'
import { jsonError, jsonOk } from '@/lib/server/route-helpers'

export async function GET(req: NextRequest) {
  const data = await getSecurity(req)
  if (!data) return jsonError('Unauthorized', 401)
  return jsonOk(data)
}
