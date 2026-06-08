import { getSettings } from '@/lib/server/api-service'
import { jsonError, jsonOk } from '@/lib/server/route-helpers'

export async function GET() {
  const data = await getSettings()
  if (!data) return jsonError('Unauthorized', 401)
  return jsonOk(data)
}
