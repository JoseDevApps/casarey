import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DashboardSidebar } from '@/components/dashboard-sidebar'
import { ErrorBoundary } from '@/components/error-boundary'

export const dynamic = 'force-dynamic'

async function getMe() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('access_token')?.value
    if (!token) return null
    const base = process.env.BACKEND_URL || 'http://localhost:8000'
    const res = await fetch(`${base}/auth/me`, {
      headers: { Cookie: `access_token=${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getMe()
  if (!user) redirect('/login')
  if (user.role !== 'CLIENT') {
    if (user.role === 'ADMIN') redirect('/dashboard/properties')
    if (user.role === 'SUPER_ADMIN') redirect('/dashboard/users')
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--surface-0)' }}>
      <DashboardSidebar
        variant="client"
        userName={user.full_name}
        userEmail={user.email}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
      </main>
    </div>
  )
}
