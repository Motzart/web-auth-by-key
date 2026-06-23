'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { logout } from '@/lib/client/auth'
import { useYubiKeyPresence } from '@/hooks/use-yubikey-presence'
import type { User } from '@/lib/client/api'

interface AppLayoutProps {
  children: React.ReactNode
  user: User | null
  onLogout: () => void
}

export function AppLayout({ children, user, onLogout }: AppLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()

  const { keyPresent, monitoringActive } = useYubiKeyPresence({
    enabled: !!user?.presenceMode,
    onLogout: () => {
      onLogout()
      router.push('/')
    },
  })

  async function handleLogout() {
    await logout()
    onLogout()
    router.push('/')
  }

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: '⬡' },
    { to: '/settings', label: 'Settings', icon: '⊙' },
    { to: '/security', label: 'Security', icon: '⊞' },
  ]

  return (
    <div style={ls.root}>
      <aside style={ls.sidebar}>
        <div style={ls.sideTop}>
          <div style={ls.logo}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="7" cy="12" r="4" />
              <path d="M11 12h10M17 9v6" strokeLinecap="round" />
            </svg>
          </div>
          <span style={ls.logoText}>YubiAuth</span>
        </div>

        <nav style={ls.nav}>
          {navItems.map(({ to, label, icon }) => {
            const isActive = pathname === to
            return (
              <Link
                key={to}
                href={to}
                style={{
                  ...ls.navItem,
                  ...(isActive ? ls.navItemActive : {}),
                }}
              >
                <span style={ls.navIcon}>{icon}</span>
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>

        <div style={ls.sideBottom}>
          {user?.presenceMode && (
            <div style={ls.presenceBlock}>
              <span
                style={{
                  ...ls.presenceDot,
                  background: keyPresent === false ? 'var(--red)' : keyPresent ? 'var(--green)' : 'var(--text3)',
                }}
              />
              <span style={ls.presenceText}>
                {monitoringActive
                  ? keyPresent === false
                    ? 'Ключ отключён'
                    : keyPresent
                      ? 'Ключ подключён'
                      : 'Проверка ключа...'
                  : 'Мониторинг USB недоступен'}
              </span>
            </div>
          )}
          {user && (
            <div style={ls.userBlock}>
              <div style={ls.avatar}>
                {(user.displayName || user.username).charAt(0).toUpperCase()}
              </div>
              <div style={ls.userInfo}>
                <div style={ls.userName}>{user.displayName}</div>
                <div style={ls.userSub}>@{user.username}</div>
              </div>
            </div>
          )}
          <button style={ls.logoutBtn} onClick={handleLogout}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Выйти
          </button>
        </div>
      </aside>

      <main style={ls.main}>{children}</main>
    </div>
  )
}

const ls: Record<string, React.CSSProperties> = {
  root: { display: 'flex', minHeight: '100vh' },
  sidebar: {
    width: 220,
    flexShrink: 0,
    background: 'var(--bg2)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    padding: '1.25rem 0',
  },
  sideTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '0 1.25rem 1.5rem',
    borderBottom: '1px solid var(--border)',
    marginBottom: '0.75rem',
    color: 'var(--accent2)',
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 8,
    background: 'var(--accent-bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  logoText: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text)',
    letterSpacing: '-0.01em',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: '0 0.75rem',
    flex: 1,
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 12px',
    borderRadius: 8,
    fontSize: 13,
    color: 'var(--text2)',
    transition: 'all 0.15s',
    border: '1px solid transparent',
  },
  navItemActive: {
    background: 'var(--accent-bg)',
    color: 'var(--accent2)',
    border: '1px solid rgba(108,99,255,0.2)',
  },
  navIcon: { fontSize: 16, lineHeight: 1, opacity: 0.7 },
  sideBottom: {
    padding: '1rem 0.75rem 0',
    borderTop: '1px solid var(--border)',
    marginTop: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  presenceBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    fontSize: 11,
    color: 'var(--text3)',
  },
  presenceDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  presenceText: { lineHeight: 1.3 },
  userBlock: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px' },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: '50%',
    background: 'var(--accent-bg)',
    border: '1px solid rgba(108,99,255,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--accent2)',
    flexShrink: 0,
  },
  userInfo: { overflow: 'hidden' },
  userName: {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  userSub: { fontSize: 11, color: 'var(--text3)' },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid transparent',
    background: 'transparent',
    color: 'var(--text3)',
    fontSize: 12,
    transition: 'all 0.15s',
    width: '100%',
    textAlign: 'left',
  },
  main: { flex: 1, padding: '2.5rem 3rem', overflowY: 'auto' },
}
