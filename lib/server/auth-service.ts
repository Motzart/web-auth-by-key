import { randomBytes } from 'crypto'
import type { NextRequest } from 'next/server'
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import {
  readDB,
  writeDB,
  findUserByCredentialId,
  getAllSecurityCredentials,
  getCredentialRpId,
  extractSecurityKeyTransports,
  toBase64URLString,
  toBufferFromBase64URL,
} from './db'
import {
  RP_NAME,
  USER_VERIFICATION,
  getWebAuthnContext,
  credentialTransportsForClient,
  isMobileUserAgent,
  userVerificationForRequest,
} from './webauthn'
import { getSession } from './session'
import { enablePresenceSession, shouldEnablePresenceMode } from './presence'

export async function beginRegistration(req: NextRequest) {
  const webAuthn = getWebAuthnContext(req)
  const db = await readDB()
  const userID = `user_${randomBytes(8).toString('hex')}`

  const excludeCredentials = getAllSecurityCredentials(db).map(c => ({
    id: c.credentialID,
    type: 'public-key' as const,
    transports: extractSecurityKeyTransports(c.transports) as AuthenticatorTransport[],
  }))

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: webAuthn.rpId,
    userID: new TextEncoder().encode(userID),
    userName: userID,
    userDisplayName: 'YubiKey',
    attestationType: 'none',
    excludeCredentials,
    authenticatorSelection: isMobileUserAgent(req)
      ? {
          userVerification: userVerificationForRequest(req),
          residentKey: 'required',
        }
      : {
          authenticatorAttachment: 'cross-platform',
          userVerification: USER_VERIFICATION,
          residentKey: 'discouraged',
        },
  })

  const session = await getSession()
  session.registrationChallenge = options.challenge
  session.pendingUserId = userID
  session.webAuthnOrigin = webAuthn.origin
  session.webAuthnRpId = webAuthn.rpId
  await session.save()

  return options
}

export async function finishRegistration(req: NextRequest, body: unknown) {
  const session = await getSession()
  const { pendingUserId } = session
  const expectedChallenge = session.registrationChallenge

  if (!expectedChallenge || !pendingUserId) {
    throw new AuthError('No challenge in session', 400)
  }

  const { webAuthnOrigin, webAuthnRpId } = session
  if (!webAuthnOrigin || !webAuthnRpId) {
    throw new AuthError('WebAuthn session expired, try again', 400)
  }

  let verification
  try {
    verification = await verifyRegistrationResponse({
      response: body as Parameters<typeof verifyRegistrationResponse>[0]['response'],
      expectedChallenge,
      expectedOrigin: webAuthnOrigin,
      expectedRPID: webAuthnRpId,
      requireUserVerification: false,
    })
  } catch (err) {
    throw new AuthError(err instanceof Error ? err.message : 'Verification failed', 400)
  }

  if (!verification.verified) {
    throw new AuthError('Verification failed', 400)
  }

  const registrationInfo = verification.registrationInfo
  if (!registrationInfo) {
    throw new AuthError('Registration info missing', 400)
  }

  const { credentialID, credentialPublicKey, counter } = registrationInfo
  const storedCredentialID = toBase64URLString(credentialID)
  const rawTransports = (body as { response?: { transports?: string[] } }).response?.transports || []
  let securityTransports = extractSecurityKeyTransports(rawTransports)

  // YubiKey с USB почти всегда имеет NFC — без этого iPhone не найдёт ключ при входе.
  if (securityTransports.includes('usb') && !securityTransports.includes('nfc')) {
    securityTransports = [...securityTransports, 'nfc']
  }

  if (securityTransports.length === 0) {
    throw new AuthError(
      'Выбран Passkey (iCloud/Chrome), а не USB-ключ. Вставь YubiKey и в диалоге выбери «USB security key».',
      400
    )
  }

  const db = await readDB()

  if (findUserByCredentialId(db, storedCredentialID)) {
    throw new AuthError('Этот YubiKey уже зарегистрирован', 409)
  }

  const username = `key_${storedCredentialID.slice(0, 12)}`
  const displayName = `YubiKey ${storedCredentialID.slice(0, 8)}`

  db.users[pendingUserId] = {
    id: pendingUserId,
    username,
    displayName,
    createdAt: new Date().toISOString(),
    credentials: [],
  }

  db.users[pendingUserId].credentials.push({
    credentialID: storedCredentialID,
    credentialPublicKey: toBase64URLString(credentialPublicKey),
    counter,
    transports: securityTransports,
    registeredRpId: webAuthnRpId,
    resident: isMobileUserAgent(req),
    addedAt: new Date().toISOString(),
  })

  await writeDB(db)

  delete session.registrationChallenge
  delete session.pendingUserId
  delete session.webAuthnOrigin
  delete session.webAuthnRpId
  session.userId = pendingUserId
  if (shouldEnablePresenceMode(req)) {
    enablePresenceSession(session, storedCredentialID)
  }
  await session.save()

  return { ok: true, userId: pendingUserId, username, presenceMode: !!session.presenceMode }
}

export async function beginLogin(req: NextRequest) {
  const webAuthn = getWebAuthnContext(req)
  const db = await readDB()
  const securityCredentials = getAllSecurityCredentials(db).filter(c => {
    return getCredentialRpId(c) === webAuthn.rpId
  })

  if (securityCredentials.length === 0) {
    throw new AuthError(
      'Нет ключей для этого адреса. Привяжи YubiKey на телефоне через «Первый раз» (не с localhost).',
      404
    )
  }

  const allowCredentials = securityCredentials.map(c => {
    const transports = credentialTransportsForClient(c, req)
    return {
      id: c.credentialID,
      type: 'public-key' as const,
      ...(transports ? { transports } : {}),
    }
  })

  const mobile = isMobileUserAgent(req)
  const useDiscoverableLogin = mobile && securityCredentials.some(c => c.resident)

  const options = await generateAuthenticationOptions(
    useDiscoverableLogin
      ? {
          rpID: webAuthn.rpId,
          userVerification: userVerificationForRequest(req),
          timeout: 120000,
        }
      : {
          rpID: webAuthn.rpId,
          allowCredentials,
          userVerification: userVerificationForRequest(req),
          timeout: mobile ? 120000 : 60000,
        }
  )

  const session = await getSession()
  delete session.registrationChallenge
  delete session.pendingUserId
  session.authChallenge = options.challenge
  session.webAuthnOrigin = webAuthn.origin
  session.webAuthnRpId = webAuthn.rpId
  await session.save()

  return options
}

export async function finishLogin(req: NextRequest, body: { id?: string }) {
  const session = await getSession()
  const { authChallenge } = session

  if (!authChallenge) {
    throw new AuthError('No active challenge', 400)
  }

  const { webAuthnOrigin, webAuthnRpId } = session
  if (!webAuthnOrigin || !webAuthnRpId) {
    throw new AuthError('WebAuthn session expired, try again', 400)
  }

  const db = await readDB()
  const credentialIDFromBody = body.id
  if (!credentialIDFromBody) {
    throw new AuthError('Missing credential id', 400)
  }

  const found = findUserByCredentialId(db, credentialIDFromBody)

  if (!found) {
    throw new AuthError(
      'Ключ не зарегистрирован. Сначала привяжите YubiKey на вкладке «Зарегистрироваться».',
      404
    )
  }

  const { user, credential: storedCred } = found

  if (extractSecurityKeyTransports(storedCred.transports).length === 0) {
    throw new AuthError('Этот ключ сохранён как Passkey. Зарегистрируй YubiKey заново.', 404)
  }

  let verification
  try {
    verification = await verifyAuthenticationResponse({
      response: body as Parameters<typeof verifyAuthenticationResponse>[0]['response'],
      expectedChallenge: authChallenge,
      expectedOrigin: webAuthnOrigin,
      expectedRPID: webAuthnRpId,
      requireUserVerification: false,
      authenticator: {
        credentialID: storedCred.credentialID,
        credentialPublicKey: toBufferFromBase64URL(storedCred.credentialPublicKey),
        counter: storedCred.counter,
        transports: storedCred.transports as AuthenticatorTransport[],
      },
    })
  } catch (err) {
    throw new AuthError(err instanceof Error ? err.message : 'Verification failed', 400)
  }

  if (!verification.verified) {
    throw new AuthError('Verification failed', 400)
  }

  storedCred.counter = verification.authenticationInfo.newCounter
  storedCred.lastUsed = new Date().toISOString()
  await writeDB(db)

  delete session.authChallenge
  delete session.webAuthnOrigin
  delete session.webAuthnRpId
  session.userId = user.id
  if (shouldEnablePresenceMode(req)) {
    enablePresenceSession(session, credentialIDFromBody)
  }
  await session.save()

  return { ok: true, userId: user.id, username: user.username, presenceMode: !!session.presenceMode }
}

export async function beginPresenceCheck(req: NextRequest) {
  const session = await getSession()
  if (!session.userId || !session.credentialId || !session.presenceMode) {
    throw new AuthError('Presence mode not active', 400)
  }

  const webAuthn = getWebAuthnContext(req)
  const db = await readDB()
  const found = findUserByCredentialId(db, session.credentialId)

  if (!found || found.user.id !== session.userId) {
    throw new AuthError('Credential not found', 404)
  }

  const { credential } = found
  const transports = credentialTransportsForClient(credential, req)

  const allowCredentials = [
    {
      id: credential.credentialID,
      type: 'public-key' as const,
      ...(transports ? { transports } : {}),
    },
  ]

  const options = await generateAuthenticationOptions({
    rpID: webAuthn.rpId,
    allowCredentials,
    userVerification: 'discouraged',
    timeout: 15000,
  })

  session.authChallenge = options.challenge
  session.webAuthnOrigin = webAuthn.origin
  session.webAuthnRpId = webAuthn.rpId
  await session.save()

  return options
}

export async function finishPresenceCheck(req: NextRequest, body: { id?: string }) {
  const session = await getSession()
  if (!session.userId || !session.credentialId || !session.presenceMode) {
    throw new AuthError('Presence mode not active', 400)
  }

  const { authChallenge } = session
  if (!authChallenge) {
    throw new AuthError('No active challenge', 400)
  }

  const { webAuthnOrigin, webAuthnRpId } = session
  if (!webAuthnOrigin || !webAuthnRpId) {
    throw new AuthError('WebAuthn session expired, try again', 400)
  }

  const credentialIDFromBody = body.id
  if (!credentialIDFromBody || credentialIDFromBody !== session.credentialId) {
    throw new AuthError('Wrong credential for presence check', 400)
  }

  const db = await readDB()
  const found = findUserByCredentialId(db, credentialIDFromBody)

  if (!found || found.user.id !== session.userId) {
    throw new AuthError('Credential not found', 404)
  }

  const { credential: storedCred } = found

  let verification
  try {
    verification = await verifyAuthenticationResponse({
      response: body as Parameters<typeof verifyAuthenticationResponse>[0]['response'],
      expectedChallenge: authChallenge,
      expectedOrigin: webAuthnOrigin,
      expectedRPID: webAuthnRpId,
      requireUserVerification: false,
      authenticator: {
        credentialID: storedCred.credentialID,
        credentialPublicKey: toBufferFromBase64URL(storedCred.credentialPublicKey),
        counter: storedCred.counter,
        transports: storedCred.transports as AuthenticatorTransport[],
      },
    })
  } catch (err) {
    throw new AuthError(err instanceof Error ? err.message : 'Verification failed', 400)
  }

  if (!verification.verified) {
    throw new AuthError('Verification failed', 400)
  }

  storedCred.counter = verification.authenticationInfo.newCounter
  storedCred.lastUsed = new Date().toISOString()
  await writeDB(db)

  delete session.authChallenge
  delete session.webAuthnOrigin
  delete session.webAuthnRpId
  session.presenceMethod = 'webauthn'
  session.lastPresenceAt = Date.now()
  await session.save()

  return { ok: true }
}

export async function setPresenceMethod(method: 'hid' | 'webauthn') {
  const session = await getSession()
  if (!session.userId || !session.presenceMode) {
    throw new AuthError('Presence mode not active', 400)
  }
  session.presenceMethod = method
  if (method === 'hid') session.lastPresenceAt = Date.now()
  await session.save()
  return { ok: true, presenceMethod: method }
}

export async function getMe() {
  const session = await getSession()
  if (!session.userId) return null

  const db = await readDB()
  const user = db.users[session.userId]
  if (!user) return null

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    credentialsCount: user.credentials.length,
    createdAt: user.createdAt,
    presenceMode: session.presenceMode ?? false,
    presenceMethod: session.presenceMethod ?? 'none',
  }
}

export async function logout() {
  const session = await getSession()
  session.destroy()
}

export async function cancelCeremony() {
  const session = await getSession()
  delete session.authChallenge
  delete session.registrationChallenge
  delete session.pendingUserId
  delete session.webAuthnOrigin
  delete session.webAuthnRpId
  await session.save()
}

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message)
    this.name = 'AuthError'
  }
}
