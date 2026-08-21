import { redirect } from 'next/navigation'
import { DashboardSidebar } from '@/components/dashboard-sidebar'
import { ErrorBoundary } from '@/components/error-boundary'
import {
  getMe,
  initialsOf,
  roleLabel,
  dashboardHomeForRole,
} from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * Grupo de rutas de cuenta: accesible a CUALQUIER usuario autenticado.
 * El sidebar se elige según su rol, para que no pierda su navegación habitual.
 */
export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getMe()
  if (!user) redirect('/login')
  if (user.must_change_password) redirect('/change-password')

  const variant =
    user.role === 'SUPER_ADMIN'
      ? 'superadmin'
      : user.role === 'TECH_ADMIN'
        ? 'techadmin'
        : user.role === 'ADMIN'
          ? 'admin'
          : 'client'

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--surface-0)' }}>
      <DashboardSidebar
        variant={variant}
        userName={user.full_name}
        userEmail={user.email}
        userInitials={initialsOf(user.full_name)}
        userRoleLabel={roleLabel(user.role)}
        dashboardHref={dashboardHomeForRole(user.role)}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
      </main>
    </div>
  )
}
