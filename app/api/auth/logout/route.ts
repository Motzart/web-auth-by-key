import { logout } from '@/lib/server/auth-service'
import { jsonOk } from '@/lib/server/route-helpers'

export async function POST() {
  await logout()
  return jsonOk({ ok: true })
}
