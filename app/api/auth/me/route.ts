import { getMe } from '@/lib/server/auth-service'
import { jsonError, jsonOk } from '@/lib/server/route-helpers'

export async function GET() {
  const user = await getMe()
  if (!user) return jsonError('Unauthorized', 401)
  return jsonOk(user)
}
