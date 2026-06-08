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

function formatWebAuthnError(err: unknown, mode: 'login' | 'register'): never {
  const name = err instanceof DOMException ? err.name : ''
  const raw = err instanceof Error ? err.message : String(err)

  if (name === 'NotAllowedError' || /not allowed by the user agent/i.test(raw)) {
    if (isIOSChrome()) {
      throw new Error(
        'Chrome на iPhone не поддерживает YubiKey по NFC. Открой этот сайт в Safari и попробуй снова.'
      )
    }
    if (isIOS()) {
      throw new Error(
        mode === 'register'
          ? 'Safari отклонил запрос. Разреши NFC, приложи YubiKey к верхней части задней панели и не закрывай окно.'
          : 'Safari отклонил запрос. Если ключ привязывал на компе — на iPhone нужен NFC: приложи YubiKey к верху телефона. Или зарегистрируй ключ заново на вкладке «Первый раз» в Safari.'
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
  if (isIOS()) return options
  return { ...options, hints: [...SECURITY_KEY_HINTS] }
}

export async function registerWithYubiKey() {
  assertWebAuthnSupported()
  const options = await api.post<PublicKeyCredentialCreationOptionsJSON>('/api/auth/register/begin')
  let credential
  try {
    credential = await startRegistration({ optionsJSON: withSecurityKeyHints(options) })
  } catch (err) {
    formatWebAuthnError(err, 'register')
  }
  return api.post('/api/auth/register/finish', credential)
}

export async function loginWithYubiKey() {
  assertWebAuthnSupported()
  const options = await api.post<PublicKeyCredentialRequestOptionsJSON>('/api/auth/login/begin')
  let assertion
  try {
    assertion = await startAuthentication({ optionsJSON: withSecurityKeyHints(options) })
  } catch (err) {
    formatWebAuthnError(err, 'login')
  }
  return api.post('/api/auth/login/finish', assertion)
}

export async function logout() {
  await api.post('/api/auth/logout')
}

export async function getMe() {
  return api.get('/api/auth/me')
}
