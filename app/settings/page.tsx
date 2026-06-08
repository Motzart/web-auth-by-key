'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getMe } from '@/lib/client/auth'
import { AppLayout } from '@/components/AppLayout'
import { api, type User } from '@/lib/client/api'

interface SettingsData {
  user?: {
    displayName: string
    username: string
    createdAt: string
    credentials: Array<{ id: string; addedAt: string; lastUsed: string; transports: string[] }>
  }
}

export default function SettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [data, setData] = useState<SettingsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getMe(), api.get<SettingsData>('/api/settings')])
      .then(([u, d]) => { setUser(u as User); setData(d) })
      .catch(() => router.push('/'))
      .finally(() => setLoading(false))
  }, [router])

  if (loading) return <div style={{ padding: '4rem', color: 'var(--text3)', fontSize: 13 }}>Loading...</div>

  const u = data?.user
  const creds = u?.credentials ?? []

  return (
    <AppLayout user={user} onLogout={() => router.push('/')}>
      <div style={ss.page}>
        <header style={ss.header}>
          <h1 style={ss.title}>Settings</h1>
          <p style={ss.sub}>Управление аккаунтом и ключами безопасности</p>
        </header>

        <section style={ss.section}>
          <div style={ss.sectionTitle}>
            <span style={ss.dot} />
            Профиль
          </div>
          <div style={ss.row}>
            <span style={ss.rowLabel}>Имя</span>
            <span style={ss.rowValue}>{u?.displayName}</span>
          </div>
          <div style={ss.row}>
            <span style={ss.rowLabel}>Username</span>
            <span style={ss.rowValue}>@{u?.username}</span>
          </div>
          <div style={ss.row}>
            <span style={ss.rowLabel}>Аккаунт создан</span>
            <span style={ss.rowValue}>{u?.createdAt ? new Date(u.createdAt).toLocaleDateString('ru-RU') : '—'}</span>
          </div>
        </section>

        <section style={ss.section}>
          <div style={ss.sectionTitle}>
            <span style={ss.dot} />
            Зарегистрированные ключи
          </div>
          {!creds?.length ? (
            <div style={{ padding: '1rem 0', color: 'var(--text3)', fontSize: 13 }}>Нет зарегистрированных ключей</div>
          ) : (
            creds.map((c, i) => (
              <div key={i} style={ss.keyCard}>
                <div style={ss.keyIcon}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="7" cy="12" r="4" />
                    <path d="M11 12h10M17 9v6" strokeLinecap="round" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={ss.keyId}>{c.id}</div>
                  <div style={ss.keyMeta}>
                    Добавлен {new Date(c.addedAt).toLocaleDateString('ru-RU')}
                    {' · '}
                    Последнее использование: {c.lastUsed === 'Never' ? '—' : new Date(c.lastUsed).toLocaleDateString('ru-RU')}
                  </div>
                  {c.transports?.length > 0 && (
                    <div style={ss.tags}>
                      {c.transports.map(t => (
                        <span key={t} style={ss.tag}>{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </section>

        <section style={ss.section}>
          <div style={ss.sectionTitle}>
            <span style={ss.dot} />
            Сессия
          </div>
          <div style={ss.row}>
            <span style={ss.rowLabel}>Тип</span>
            <span style={ss.rowValue}>Sliding session cookie (iron-session)</span>
          </div>
          <div style={ss.row}>
            <span style={ss.rowLabel}>Время жизни</span>
            <span style={ss.rowValue}>1 день с момента последнего запроса</span>
          </div>
          <div style={ss.row}>
            <span style={ss.rowLabel}>httpOnly</span>
            <span style={{ ...ss.rowValue, color: 'var(--green)' }}>✓ включён</span>
          </div>
          <div style={ss.row}>
            <span style={ss.rowLabel}>sameSite</span>
            <span style={ss.rowValue}>lax</span>
          </div>
        </section>
      </div>
    </AppLayout>
  )
}

const ss: Record<string, React.CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', gap: '1.75rem', maxWidth: 640 },
  header: { marginBottom: 4 },
  title: { fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 4 },
  sub: { fontSize: 12, color: 'var(--text3)' },
  section: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem 1.5rem' },
  sectionTitle: {
    fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em',
    fontWeight: 500, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8,
  },
  dot: { width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' },
  row: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13,
  },
  rowLabel: { color: 'var(--text3)' },
  rowValue: { color: 'var(--text)', fontWeight: 400 },
  keyCard: { display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 0', borderBottom: '1px solid var(--border)' },
  keyIcon: {
    width: 32, height: 32, borderRadius: 8, background: 'var(--accent-bg)',
    border: '1px solid rgba(108,99,255,0.2)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', color: 'var(--accent2)', flexShrink: 0,
  },
  keyId: { fontSize: 12, fontFamily: 'monospace', color: 'var(--text2)', marginBottom: 3 },
  keyMeta: { fontSize: 11, color: 'var(--text3)' },
  tags: { display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' },
  tag: {
    padding: '2px 8px', borderRadius: 4, background: 'var(--bg3)',
    border: '1px solid var(--border)', fontSize: 10, color: 'var(--text3)', letterSpacing: '0.03em',
  },
}
