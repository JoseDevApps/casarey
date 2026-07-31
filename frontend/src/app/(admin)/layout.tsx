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

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getMe()
  if (!user) redirect('/login')
  if (user.must_change_password) redirect('/change-password')
  if (user.role === 'CLIENT') redirect('/dashboard/reservations')

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--surface-0)' }}>
      <DashboardSidebar
        variant={
          user.role === 'SUPER_ADMIN'
            ? 'superadmin'
            : user.role === 'TECH_ADMIN'
              ? 'techadmin'
              : 'admin'
        }
        userName={user.full_name}
        userEmail={user.email}
        userInitials={initialsOf(user.full_name)}
        userRoleLabel={roleLabel(user.role)}
        dashboardHref={dashboardHomeForRole(user.role)}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
      </main>
    </div>
  )
}
