import { cancelCeremony } from '@/lib/server/auth-service'
import { jsonOk } from '@/lib/server/route-helpers'

export async function POST() {
  await cancelCeremony()
  return jsonOk({ ok: true })
}
