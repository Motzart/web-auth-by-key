'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { registerWithYubiKey, loginWithYubiKey, getMe, isWebAuthnAvailable } from '@/lib/client/auth'

type Tab = 'login' | 'register'
type Status = { type: 'idle' | 'loading' | 'success' | 'error'; msg?: string }

const STEPS_LOGIN = [
  'Запрашиваем challenge у сервера...',
  'Коснись YubiKey — ключ мигает...',
  'Верифицируем подпись...',
]
const STEPS_REG = [
  'Генерируем параметры регистрации...',
  'Коснись YubiKey для привязки ключа...',
  'Сохраняем публичный ключ...',
]

export default function LoginPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('login')
  const [status, setStatus] = useState<Status>({ type: 'idle' })
  const [webAuthnOk, setWebAuthnOk] = useState(false)
  const [needsHttps, setNeedsHttps] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isIOSChrome, setIsIOSChrome] = useState(false)
  const inFlightRef = useRef(false)

  useEffect(() => {
    getMe().then(() => router.push('/dashboard')).catch(() => {})
    setWebAuthnOk(isWebAuthnAvailable())
    setNeedsHttps(typeof window !== 'undefined' && !window.isSecureContext)
    const ua = navigator.userAgent
    setIsIOS(/iphone|ipad|ipod/i.test(ua))
    setIsIOSChrome(/iphone|ipad|ipod/i.test(ua) && /crios/i.test(ua))
  }, [router])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (inFlightRef.current) return
    inFlightRef.current = true
    setStatus({ type: 'loading', msg: STEPS_LOGIN[1] })
    try {
      await loginWithYubiKey()
      setStatus({ type: 'success', msg: 'Авторизация прошла успешно!' })
      setTimeout(() => router.push('/dashboard'), 600)
    } catch (err: unknown) {
      const error = err as Error & { status?: number }
      const msg = error?.message || 'Ошибка авторизации'
      setStatus({ type: 'error', msg })
    } finally {
      inFlightRef.current = false
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (inFlightRef.current) return
    inFlightRef.current = true
    setStatus({ type: 'loading', msg: STEPS_REG[1] })
    try {
      await registerWithYubiKey()
      setStatus({ type: 'success', msg: 'Ключ привязан! Входим...' })
      setTimeout(() => router.push('/dashboard'), 600)
    } catch (err: unknown) {
      const error = err as Error
      const msg = error?.message || 'Ошибка регистрации'
      setStatus({ type: 'error', msg })
    } finally {
      inFlightRef.current = false
    }
  }

  const loading = status.type === 'loading'

  return (
    <div style={styles.page}>
      <div style={styles.bgDot1} />
      <div style={styles.bgDot2} />

      <div style={styles.card}>
        <div style={styles.logoWrap}>
          <KeyIcon />
        </div>
        <h1 style={styles.title}>YubiKey Auth</h1>
        <p style={styles.subtitle}>Passwordless — одно касание</p>

        <div style={styles.tabs}>
          {(['login', 'register'] as Tab[]).map(t => (
            <button
              key={t}
              style={{ ...styles.tab, ...(tab === t ? styles.tabActive : {}) }}
              onClick={() => { setTab(t); setStatus({ type: 'idle' }) }}
              disabled={loading}
            >
              {t === 'login' ? 'Войти' : 'Первый раз'}
            </button>
          ))}
        </div>

        {isIOSChrome && (
          <div style={{ ...styles.status, ...styles.status_error, width: '100%' }}>
            <span style={statusDot('error')} />
            <span>
              Chrome на iPhone не умеет YubiKey по NFC. Скопируй адрес и открой сайт в Safari.
            </span>
          </div>
        )}

        {!webAuthnOk && (
          <div style={{ ...styles.status, ...styles.status_error, width: '100%' }}>
            <span style={statusDot('error')} />
            <span>
              {needsHttps
                ? 'Нужен HTTPS. На Vercel работает автоматически; локально — http://localhost:3000.'
                : isIOS
                  ? 'WebAuthn недоступен. iPhone: Safari, iOS 16.3+, NFC — к верхней части задней панели.'
                  : 'WebAuthn недоступен — используй Chrome на Android или Safari на iPhone.'}
            </span>
          </div>
        )}

        {loading && isIOS && (
          <div style={{ ...styles.status, ...styles.status_loading, width: '100%' }}>
            <span style={statusDot('loading')} />
            <span>
              {tab === 'login'
                ? '① В меню Safari нажми «Security Key». ② Вверху появится NFC — сразу приложи YubiKey к камере (верх телефона) и держи 3–5 сек.'
                : '① В меню Safari нажми «Security Key». ② Приложи YubiKey NFC к верху телефона (у камеры) и держи до мигания.'}
            </span>
          </div>
        )}

        <form onSubmit={tab === 'login' ? handleLogin : handleRegister} style={{ width: '100%' }}>
          <button
            type="submit"
            style={{ ...styles.btn, ...(loading || !webAuthnOk ? styles.btnDisabled : {}) }}
            disabled={loading || !webAuthnOk}
          >
            {loading ? (
              <span style={styles.spinner}>⟳</span>
            ) : (
              <UsbIcon />
            )}
            {tab === 'login'
              ? (loading ? 'Ожидаем ключ...' : 'Войти с YubiKey')
              : (loading ? 'Касайся ключа...' : 'Привязать YubiKey')}
          </button>
        </form>

        {status.type !== 'idle' && (
          <div style={{ ...styles.status, ...styles['status_' + status.type] }}>
            <span style={statusDot(status.type)} />
            <span>{status.msg}</span>
          </div>
        )}

        <p style={styles.hint}>
          {isIOS
            ? tab === 'login'
              ? 'iPhone 13: NFC-антенна у камеры (верх задней панели). После «Security Key» в меню — сразу поднеси ключ, не жди.'
              : 'Регистрация только в Safari на этом домене. После «Security Key» — приложи YubiKey к верху телефона.'
            : tab === 'login'
              ? 'В окне Chrome выбери «Use your security key» (внизу), не QR-код. Вставь YubiKey и коснись.'
              : 'В окне Chrome выбери «Use your security key», не Passkey по QR. Вставь YubiKey и коснись.'}
        </p>
        <p style={{ ...styles.hint, marginTop: -8 }}>
          {isIOS
            ? 'Если зависло после выбора ключа — перезагрузи iPhone (баг Safari) и зарегистрируй ключ на вкладке «Первый раз».'
            : 'Это окно браузера, не приложения — так же было в старом клиенте.'}
        </p>
      </div>
    </div>
  )
}

function statusDot(type: string): React.CSSProperties {
  return {
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0,
    background:
      type === 'loading' ? 'var(--accent2)' :
      type === 'success' ? 'var(--green)' : 'var(--red)',
  }
}

function KeyIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="7" cy="12" r="4" />
      <path d="M11 12h10M17 9v6" strokeLinecap="round" />
    </svg>
  )
}

function UsbIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}>
      <path d="M12 2v8m0 0l-3-3m3 3l3-3" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="5" y="10" width="14" height="9" rx="2" />
      <path d="M9 14h6" strokeLinecap="round" />
    </svg>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    position: 'relative',
    overflow: 'hidden',
  },
  bgDot1: {
    position: 'fixed',
    width: 400,
    height: 400,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(108,99,255,0.08) 0%, transparent 70%)',
    top: '-100px',
    left: '-100px',
    pointerEvents: 'none',
  },
  bgDot2: {
    position: 'fixed',
    width: 300,
    height: 300,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(108,99,255,0.06) 0%, transparent 70%)',
    bottom: '-50px',
    right: '-50px',
    pointerEvents: 'none',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '2.5rem 2rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1.25rem',
    position: 'relative',
    zIndex: 1,
  },
  logoWrap: {
    width: 64,
    height: 64,
    borderRadius: 16,
    background: 'var(--accent-bg)',
    border: '1px solid rgba(108,99,255,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--accent2)',
    marginBottom: 4,
  },
  title: { fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text)' },
  subtitle: { fontSize: 12, color: 'var(--text3)', letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: -8 },
  tabs: {
    display: 'flex',
    width: '100%',
    background: 'var(--bg3)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: 3,
    gap: 3,
  },
  tab: {
    flex: 1,
    height: 32,
    border: 'none',
    background: 'transparent',
    color: 'var(--text3)',
    borderRadius: 8,
    fontSize: 12,
    letterSpacing: '0.02em',
    transition: 'all 0.15s',
  },
  tabActive: {
    background: 'var(--bg2)',
    color: 'var(--text)',
    border: '1px solid var(--border2)',
    fontWeight: 500,
  },
  btn: {
    width: '100%',
    height: 42,
    marginTop: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--accent)',
    border: 'none',
    borderRadius: 'var(--radius)',
    color: '#fff',
    fontSize: 14,
    fontWeight: 500,
    letterSpacing: '0.01em',
    transition: 'opacity 0.15s',
  },
  btnDisabled: { opacity: 0.6, cursor: 'not-allowed' },
  spinner: { display: 'inline-block', marginRight: 8, animation: 'spin 1s linear infinite', fontSize: 16 },
  status: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 'var(--radius)',
    fontSize: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    border: '1px solid transparent',
  },
  status_loading: { background: 'var(--accent-bg)', borderColor: 'rgba(108,99,255,0.2)', color: 'var(--accent2)' },
  status_success: { background: 'var(--green-bg)', borderColor: 'rgba(74,222,128,0.2)', color: 'var(--green)' },
  status_error: { background: 'var(--red-bg)', borderColor: 'rgba(248,113,113,0.2)', color: 'var(--red)' },
  hint: { fontSize: 11, color: 'var(--text3)', textAlign: 'center', lineHeight: 1.6 },
}
