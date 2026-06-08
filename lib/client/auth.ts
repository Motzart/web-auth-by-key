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

export async function registerWithYubiKey() {
  assertWebAuthnSupported()
  const options = await api.post<PublicKeyCredentialCreationOptionsJSON>('/api/auth/register/begin')
  const credential = await startRegistration({
    optionsJSON: { ...options, hints: [...SECURITY_KEY_HINTS] },
  })
  return api.post('/api/auth/register/finish', credential)
}

export async function loginWithYubiKey() {
  assertWebAuthnSupported()
  const options = await api.post<PublicKeyCredentialRequestOptionsJSON>('/api/auth/login/begin')
  const assertion = await startAuthentication({
    optionsJSON: { ...options, hints: [...SECURITY_KEY_HINTS] },
  })
  return api.post('/api/auth/login/finish', assertion)
}

export async function logout() {
  await api.post('/api/auth/logout')
}

export async function getMe() {
  return api.get('/api/auth/me')
}
