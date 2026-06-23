'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getMe } from '@/lib/client/auth'
import { AppLayout } from '@/components/AppLayout'
import { api, type User } from '@/lib/client/api'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [data, setData] = useState<{ message?: string; stats?: { sessions: number; keys: number } } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getMe(), api.get<typeof data>('/api/dashboard')])
      .then(([u, d]) => { setUser(u as User); setData(d) })
      .catch(() => router.push('/'))
      .finally(() => setLoading(false))
  }, [router])

  if (loading) return <LoadingScreen />

  return (
    <AppLayout user={user} onLogout={() => router.push('/')}>
      <div style={ps.page}>
        <header style={ps.header}>
          <div>
            <h1 style={ps.title}>{data?.message}</h1>
            <p style={ps.sub}>
              {user?.presenceMode
                ? 'Сессия привязана к USB-ключу · выход при отключении'
                : 'Сессия активна · sliding session · 1 день'}
            </p>
          </div>
          <Badge text="Authenticated" color="green" />
        </header>

        <div style={ps.grid}>
          <StatCard label="Активных сессий" value={data?.stats?.sessions} />
          <StatCard label="Ключей YubiKey" value={data?.stats?.keys} />
          <StatCard
            label="Дней аккаунту"
            value={Math.floor((Date.now() - new Date(user?.createdAt || '').getTime()) / 86400000) || '< 1'}
          />
        </div>

        <section style={ps.section}>
          <h2 style={ps.sectionTitle}>Как работает авторизация</h2>
          <div style={ps.timeline}>
            {[
              { step: '01', title: 'Challenge', desc: 'Сервер генерирует случайный байт-массив' },
              { step: '02', title: 'Подпись', desc: 'YubiKey подписывает challenge приватным ключом' },
              { step: '03', title: 'Верификация', desc: 'Сервер проверяет подпись публичным ключом' },
              { step: '04', title: 'Сессия', desc: user?.presenceMode
                ? 'На ноутбуке сессия живёт пока YubiKey в USB; при извлечении — автоматический выход'
                : 'Выдаётся cookie, живёт 1 день со sliding reset' },
            ].map(item => (
              <div key={item.step} style={ps.timelineItem}>
                <div style={ps.timelineStep}>{item.step}</div>
                <div>
                  <div style={ps.timelineTitle}>{item.title}</div>
                  <div style={ps.timelineDesc}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppLayout>
  )
}

function StatCard({ label, value }: { label: string; value: unknown }) {
  return (
    <div style={ps.statCard}>
      <div style={ps.statValue}>{value as React.ReactNode}</div>
      <div style={ps.statLabel}>{label}</div>
    </div>
  )
}

function Badge({ text, color }: { text: string; color: string }) {
  const colors: Record<string, { background: string; color: string; border: string }> = {
    green: { background: 'var(--green-bg)', color: 'var(--green)', border: 'rgba(74,222,128,0.2)' },
  }
  const c = colors[color] || colors.green
  return (
    <div style={{
      padding: '4px 12px', borderRadius: 6, fontSize: 11,
      border: `1px solid ${c.border}`, background: c.background, color: c.color,
      letterSpacing: '0.04em', textTransform: 'uppercase',
    }}>
      {text}
    </div>
  )
}

function LoadingScreen() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: 'var(--text3)', fontSize: 13 }}>
      Loading...
    </div>
  )
}

const ps: Record<string, React.CSSProperties> = {
  page: { display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: 720 },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' },
  title: { fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 4 },
  sub: { fontSize: 12, color: 'var(--text3)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 },
  statCard: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem' },
  statValue: { fontSize: 28, fontWeight: 600, color: 'var(--accent2)', letterSpacing: '-0.02em' },
  statLabel: { fontSize: 11, color: 'var(--text3)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.04em' },
  section: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.5rem' },
  sectionTitle: { fontSize: 13, fontWeight: 500, color: 'var(--text2)', marginBottom: '1.25rem', textTransform: 'uppercase', letterSpacing: '0.04em' },
  timeline: { display: 'flex', flexDirection: 'column', gap: 16 },
  timelineItem: { display: 'flex', gap: 16, alignItems: 'flex-start' },
  timelineStep: {
    width: 32, height: 32, borderRadius: 8,
    background: 'var(--accent-bg)', border: '1px solid rgba(108,99,255,0.2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, color: 'var(--accent2)', fontWeight: 600, flexShrink: 0,
  },
  timelineTitle: { fontSize: 13, fontWeight: 500, marginBottom: 2 },
  timelineDesc: { fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 },
}
