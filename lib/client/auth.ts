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
          ? 'Время вышло. Нажми снова → Security Key → сразу приложи YubiKey к верху телефона (у камеры) и держи до мигания.'
          : 'Время вышло. Нажми снова → Security Key → приложи YubiKey к верху телефона у камеры и держи 3–5 сек.'
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
        'Safari отменил запрос. Если раньше закрывал окно — перезагрузи iPhone. Затем: кнопка → Security Key → приложи YubiKey к верху телефона (у камеры).'
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
  try {
    const options = await api.post<T>(beginPath)
    return await start(withSecurityKeyHints(options))
  } catch (err) {
    formatWebAuthnError(err, mode)
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

export async function logout() {
  await api.post('/api/auth/logout')
}

export async function getMe() {
  return api.get('/api/auth/me')
}
