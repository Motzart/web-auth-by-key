import { setPresenceMethod } from '@/lib/server/auth-service'
import { handleRouteError, jsonOk } from '@/lib/server/route-helpers'

export async function POST(req: Request) {
  try {
    const body = await req.json() as { method?: 'hid' | 'webauthn' }
    if (body.method !== 'hid' && body.method !== 'webauthn') {
      return handleRouteError(new Error('Invalid method'))
    }
    const result = await setPresenceMethod(body.method)
    return jsonOk(result)
  } catch (err) {
    return handleRouteError(err)
  }
}
