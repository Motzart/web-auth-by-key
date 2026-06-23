import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser'
import { api } from './api'

function isIOS() {
  return typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isIOSChrome() {
  return isIOS() && /crios/i.test(navigator.userAgent)
}

function isNotAllowedError(err: unknown) {
  const name = err instanceof DOMException ? err.name : ''
  const raw = err instanceof Error ? err.message : String(err)
  return name === 'NotAllowedError' || /not allowed by the user agent/i.test(raw)
}

function isTimeoutError(err: unknown) {
  const name = err instanceof DOMException ? err.name : ''
  return name === 'TimeoutError' || /timed out|timeout/i.test(err instanceof Error ? err.message : String(err))
}

function formatWebAuthnError(err: unknown, mode: 'login' | 'register'): never {
  const raw = err instanceof Error ? err.message : String(err)

  if (isTimeoutError(err)) {
    if (isIOS()) {
      throw new Error(
        mode === 'register'
          ? 'Время вышло. Подожди 5 сек → снова кнопка → Security Key → YubiKey к камере 5 сек.'
          : 'Время вышло. Подожди 5 сек и попробуй снова. Если ключ регистрировали на компе — привяжи заново на «Первый раз» в Safari.'
      )
    }
    throw new Error('Время ожидания ключа истекло. Попробуй ещё раз.')
  }

  if (isNotAllowedError(err)) {
    if (isIOSChrome()) {
      throw new Error(
        'Chrome на iPhone не поддерживает YubiKey по NFC. Открой этот сайт в Safari и попробуй снова.'
      )
    }
    if (isIOS()) {
      throw new Error(
        mode === 'login'
          ? 'Safari отклонил вход. Подожди 5 сек перед повтором. Если ключ с компа — зарегистрируй на «Первый раз» в Safari на этом сайте.'
          : 'Safari отклонил регистрацию. Подожди 5 сек → Security Key → YubiKey к верху телефона (у камеры).'
      )
    }
    throw new Error(
      'Браузер отклонил запрос. Выбери «USB security key», не Passkey/QR, и коснись YubiKey.'
    )
  }

  if (err instanceof Error) throw err
  throw new Error(raw || 'Ошибка WebAuthn')
}

function assertWebAuthnSupported() {
  if (browserSupportsWebAuthn()) return

  if (typeof window !== 'undefined' && !window.isSecureContext) {
    throw new Error(
      'На iPhone нужен HTTPS. На Vercel это работает автоматически; локально — https://localhost:3000.'
    )
  }

  if (isIOS()) {
    throw new Error('На iPhone используй Safari (не Chrome) и iOS 16.3 или новее для NFC-ключа.')
  }

  throw new Error('WebAuthn не поддерживается. Используй Chrome на Android или Safari на iPhone.')
}

export function isWebAuthnAvailable() {
  return typeof window !== 'undefined' && browserSupportsWebAuthn()
}

const SECURITY_KEY_HINTS = ['security-key'] as const
const IOS_CEREMONY_GAP_MS = 5000

let lastIosCeremonyEndedAt = 0

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

async function prepareCeremony() {
  await api.post('/api/auth/cancel').catch(() => {})

  if (!isIOS()) return

  const elapsed = Date.now() - lastIosCeremonyEndedAt
  if (lastIosCeremonyEndedAt > 0 && elapsed < IOS_CEREMONY_GAP_MS) {
    await sleep(IOS_CEREMONY_GAP_MS - elapsed)
  }
}

function markCeremonyEnded() {
  if (isIOS()) lastIosCeremonyEndedAt = Date.now()
}

function withSecurityKeyHints<T extends PublicKeyCredentialCreationOptionsJSON | PublicKeyCredentialRequestOptionsJSON>(
  options: T
): T {
  return { ...options, hints: [...SECURITY_KEY_HINTS] }
}

async function runWebAuthnCeremony<T extends PublicKeyCredentialCreationOptionsJSON | PublicKeyCredentialRequestOptionsJSON>(
  beginPath: string,
  start: (optionsJSON: T) => Promise<unknown>,
  mode: 'login' | 'register'
) {
  await prepareCeremony()
  try {
    const options = await api.post<T>(beginPath)
    return await start(withSecurityKeyHints(options))
  } catch (err) {
    formatWebAuthnError(err, mode)
  } finally {
    markCeremonyEnded()
  }
}

export async function registerWithYubiKey() {
  assertWebAuthnSupported()
  const credential = await runWebAuthnCeremony(
    '/api/auth/register/begin',
    options => startRegistration({ optionsJSON: options as PublicKeyCredentialCreationOptionsJSON }),
    'register'
  )
  return api.post('/api/auth/register/finish', credential)
}

export async function loginWithYubiKey() {
  assertWebAuthnSupported()
  const assertion = await runWebAuthnCeremony(
    '/api/auth/login/begin',
    options => startAuthentication({ optionsJSON: options as PublicKeyCredentialRequestOptionsJSON }),
    'login'
  )
  return api.post('/api/auth/login/finish', assertion)
}

export async function confirmYubiKeyPresence() {
  assertWebAuthnSupported()
  const assertion = await runWebAuthnCeremony(
    '/api/auth/presence/begin',
    options => startAuthentication({ optionsJSON: options as PublicKeyCredentialRequestOptionsJSON }),
    'login'
  )
  return api.post('/api/auth/presence/finish', assertion)
}

export async function setPresenceMonitoringMethod(method: 'hid' | 'webauthn') {
  return api.post('/api/auth/presence/method', { method })
}

export async function logout() {
  await api.post('/api/auth/logout')
}

export async function getMe() {
  return api.get('/api/auth/me')
}

export function getIosCeremonyGapMs() {
  return IOS_CEREMONY_GAP_MS
}
