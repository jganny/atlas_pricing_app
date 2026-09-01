import { Link, NavLink, Outlet } from 'react-router-dom'
import {
  Anchor,
  Database,
  FileText,
  LayoutDashboard,
  LogOut,
  Plane,
  Sparkles,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useAuthStore } from '../store/auth'
import { MockBanner } from './MockBanner'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/smart-quote/air', label: 'Smart Quote · Air', icon: Plane },
  { to: '/smart-quote/sea', label: 'Smart Quote · Sea', icon: Anchor },
  { to: '/enquiries', label: 'Enquiry DB', icon: Database },
  { to: '/circulars', label: 'Circulars', icon: FileText },
]

export function AppShell() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      <MockBanner />
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-atlas-navy)] text-white md:flex md:flex-col">
          <div className="border-b border-white/10 px-5 py-5">
            <div className="flex items-center gap-2 text-sm font-extrabold tracking-wide">
              <Sparkles className="h-4 w-4 text-[var(--color-atlas-sky)]" />
              ATLAS PRICING
            </div>
            <div className="mt-1 text-xs text-white/60">React preview · v{import.meta.env.VITE_APP_VERSION}</div>
          </div>
          <nav className="flex flex-1 flex-col gap-1 p-3">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors',
                    isActive
                      ? 'bg-white/15 text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white',
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="border-t border-white/10 p-4">
            <div className="text-xs text-white/50">Signed in as</div>
            <div className="text-sm font-semibold">{user?.displayName}</div>
            <button
              type="button"
              onClick={logout}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-[var(--color-border)] bg-white px-4 py-3 md:px-6">
            <div className="md:hidden">
              <Link to="/" className="text-sm font-extrabold text-[var(--color-atlas-navy)]">
                Atlas Pricing
              </Link>
            </div>
            <div className="hidden text-sm text-[var(--color-text-muted)] md:block">
              Operational pricing workspace — React migration preview
            </div>
            <a
              href="/index.html"
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-atlas-navy)] hover:bg-slate-50"
            >
              Open legacy app
            </a>
          </header>

          <main className="flex-1 p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
