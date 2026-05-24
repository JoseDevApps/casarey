import { redirect } from 'next/navigation'
import { ChangePasswordForm } from './change-password-form'
import { getMe, dashboardHomeForRole } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

export default async function ChangePasswordPage() {
  const user = await getMe()
  if (!user) {
    redirect('/login?redirect=/change-password')
  }

  if (!user.must_change_password) {
    redirect(dashboardHomeForRole(user.role))
  }

  return <ChangePasswordForm />
}
