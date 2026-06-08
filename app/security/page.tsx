'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getMe } from '@/lib/client/auth'
import { AppLayout } from '@/components/AppLayout'
import { api, type User } from '@/lib/client/api'

interface SecurityData {
  events?: Array<{ type: string; method?: string; time: string; ip: string }>
}

export default function SecurityPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [data, setData] = useState<SecurityData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getMe(), api.get<SecurityData>('/api/security')])
      .then(([u, d]) => { setUser(u as User); setData(d) })
      .catch(() => router.push('/'))
      .finally(() => setLoading(false))
  }, [router])

  if (loading) return <div style={{ padding: '4rem', color: 'var(--text3)', fontSize: 13 }}>Loading...</div>

  const eventLabels: Record<string, { label: string; color: string }> = {
    login: { label: 'Вход', color: 'var(--green)' },
    session_refresh: { label: 'Сессия обновлена', color: 'var(--accent2)' },
    logout: { label: 'Выход', color: 'var(--red)' },
  }

  return (
    <AppLayout user={user} onLogout={() => router.push('/')}>
      <div style={ks.page}>
        <header style={ks.header}>
          <h1 style={ks.title}>Security Log</h1>
          <p style={ks.sub}>История активности аккаунта</p>
        </header>

        <div style={ks.infoBlock}>
          <div style={ks.infoIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
            Приватный ключ никогда не покидает YubiKey. На сервер передаётся только подпись,
            которую можно верифицировать публичным ключом. Replay-атаки невозможны — каждый
            challenge уникален и привязан к домену.
          </div>
        </div>

        <section style={ks.section}>
          <div style={ks.sectionTitle}>
            <span style={ks.dot} />
            Последние события
          </div>

          <div style={ks.log}>
            {data?.events?.map((e, i) => {
              const ev = eventLabels[e.type] || { label: e.type, color: 'var(--text2)' }
              return (
                <div key={i} style={ks.logRow}>
                  <div style={ks.logLeft}>
                    <div style={{
                      ...ks.logBadge,
                      color: ev.color,
                      borderColor: `${ev.color}33`,
                      background: `${ev.color}11`,
                    }}>
                      {ev.label}
                    </div>
                    <div style={ks.logMethod}>{e.method || '—'}</div>
                  </div>
                  <div style={ks.logRight}>
                    <div style={ks.logTime}>{new Date(e.time).toLocaleString('ru-RU')}</div>
                    <div style={ks.logIp}>{e.ip}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section style={ks.section}>
          <div style={ks.sectionTitle}>
            <span style={ks.dot} />
            Replay protection — counter
          </div>
          <div style={ks.row}>
            <span style={ks.rowLabel}>Механизм</span>
            <span style={ks.rowValue}>Monotonic counter в YubiKey</span>
          </div>
          <div style={ks.row}>
            <span style={ks.rowLabel}>Принцип</span>
            <span style={ks.rowValue}>Каждый вход увеличивает счётчик</span>
          </div>
          <div style={ks.row}>
            <span style={ks.rowLabel}>Проверка</span>
            <span style={ks.rowValue}>Сервер отклоняет counter ≤ сохранённого</span>
          </div>
        </section>
      </div>
    </AppLayout>
  )
}

const ks: Record<string, React.CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', gap: '1.75rem', maxWidth: 640 },
  header: { marginBottom: 4 },
  title: { fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 4 },
  sub: { fontSize: 12, color: 'var(--text3)' },
  infoBlock: {
    display: 'flex', gap: 12, alignItems: 'flex-start',
    background: 'var(--accent-bg)', border: '1px solid rgba(108,99,255,0.2)',
    borderRadius: 'var(--radius)', padding: '12px 14px',
  },
  infoIcon: { color: 'var(--accent2)', flexShrink: 0, marginTop: 1 },
  section: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem 1.5rem' },
  sectionTitle: {
    fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em',
    fontWeight: 500, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8,
  },
  dot: { width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' },
  log: { display: 'flex', flexDirection: 'column', gap: 0 },
  logRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 0', borderBottom: '1px solid var(--border)',
  },
  logLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  logBadge: { padding: '2px 10px', borderRadius: 5, fontSize: 11, border: '1px solid', letterSpacing: '0.02em' },
  logMethod: { fontSize: 12, color: 'var(--text3)' },
  logRight: { textAlign: 'right' },
  logTime: { fontSize: 12, color: 'var(--text2)' },
  logIp: { fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace' },
  row: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13,
  },
  rowLabel: { color: 'var(--text3)' },
  rowValue: { color: 'var(--text)' },
}
