'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Home,
  CalendarDays,
  Building2,
  CreditCard,
  BarChart3,
  Users,
  Image,
  FileText,
  Star,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useState } from 'react'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
}

type Variant = 'client' | 'admin' | 'superadmin'

const NAV_BY_VARIANT: Record<Variant, NavItem[]> = {
  client: [
    { href: '/dashboard/reservations', label: 'Mis Reservas', icon: CalendarDays },
  ],
  admin: [
    { href: '/dashboard/properties', label: 'Propiedades', icon: Building2 },
    { href: '/dashboard/requests', label: 'Reservas', icon: CalendarDays },
    { href: '/dashboard/payments', label: 'Pagos', icon: CreditCard },
    { href: '/dashboard/finances', label: 'Finanzas', icon: BarChart3 },
  ],
  superadmin: [
    { href: '/dashboard/users', label: 'Usuarios', icon: Users },
    { href: '/dashboard/cms/banners', label: 'Banners', icon: Image },
    { href: '/dashboard/cms/pages', label: 'Páginas estáticas', icon: FileText },
    { href: '/dashboard/cms/featured', label: 'Destacadas', icon: Star },
    { href: '/dashboard/global-finances', label: 'Auditoría financiera', icon: BarChart3 },
  ],
}

interface DashboardSidebarProps {
  variant: Variant
  userEmail?: string
  userName?: string
}

export function DashboardSidebar({ variant, userEmail, userName }: DashboardSidebarProps) {
  const items = NAV_BY_VARIANT[variant]
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    router.push('/login')
    router.refresh()
  }

  return (
    <aside
      className="flex flex-col h-full relative transition-all duration-200"
      style={{
        background: 'var(--surface-1)',
        borderRight: '1px solid var(--border-soft)',
        width: collapsed ? '64px' : '220px',
        minWidth: collapsed ? '64px' : '220px',
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-2 px-4 h-16"
        style={{ borderBottom: '1px solid var(--border-soft)' }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'var(--brand-primary)' }}
        >
          <Home size={15} style={{ color: 'var(--brand-accent)' }} />
        </div>
        {!collapsed && (
          <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
            Casas de <span style={{ color: 'var(--brand-accent)' }}>Campo</span>
          </span>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-2 py-4 flex flex-col gap-0.5 overflow-y-auto">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-100',
                isActive ? 'font-semibold' : 'hover:bg-[var(--surface-2)]'
              )}
              style={{
                color: isActive ? 'var(--brand-accent)' : 'var(--text-secondary)',
                background: isActive ? 'rgba(224, 155, 107, 0.08)' : undefined,
              }}
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={17} className="shrink-0" />
              {!collapsed && <span className="line-clamp-1">{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* User + logout */}
      <div
        className="px-2 py-3"
        style={{ borderTop: '1px solid var(--border-soft)' }}
      >
        {!collapsed && userName && (
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-medium line-clamp-1" style={{ color: 'var(--text-primary)' }}>
              {userName}
            </p>
            {userEmail && (
              <p className="text-xs line-clamp-1 mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {userEmail}
              </p>
            )}
          </div>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-100 hover:bg-[var(--surface-2)]"
          style={{ color: 'var(--text-tertiary)' }}
          title="Cerrar sesión"
        >
          <LogOut size={16} className="shrink-0" />
          {!collapsed && 'Cerrar sesión'}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full flex items-center justify-center z-10 transition-colors hover:opacity-80"
        style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--border-mid)',
          color: 'var(--text-muted)',
        }}
        aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  )
}

export { type NavItem }
export { CalendarDays, Building2, CreditCard, BarChart3, Users, Image, FileText, Star }
