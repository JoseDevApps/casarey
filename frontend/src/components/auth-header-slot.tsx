'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { UserMenu } from '@/components/user-menu'
import {
  dashboardHomeForRole,
  initialsOf,
  roleLabel,
  type MeResponse,
} from '@/lib/auth'

export function AuthHeaderSlot({ initialUser }: { initialUser: MeResponse | null }) {
  const [user, setUser] = useState<MeResponse | null>(initialUser)

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' })
      if (!res.ok) {
        setUser(null)
        return
      }
      setUser((await res.json()) as MeResponse)
    } catch {
      setUser(null)
    }
  }, [])

  useEffect(() => {
    refreshUser()
    window.addEventListener('auth:changed', refreshUser)
    return () => window.removeEventListener('auth:changed', refreshUser)
  }, [refreshUser])

  if (user) {
    return (
      <UserMenu
        fullName={user.full_name}
        email={user.email}
        initials={initialsOf(user.full_name)}
        roleLabel={roleLabel(user.role)}
        dashboardHref={dashboardHomeForRole(user.role)}
        placement="header"
      />
    )
  }

  return (
    <>
      <Link
        href="/login"
        className="hidden sm:inline-flex items-center text-sm px-3 py-2 rounded-lg font-medium transition-colors hover:bg-[var(--surface-2)]"
        style={{ color: 'var(--text-secondary)' }}
      >
        Iniciar sesión
      </Link>
      <Link
        href="/register"
        className="inline-flex items-center text-sm px-4 py-2 rounded-lg font-semibold transition-colors"
        style={{
          background: 'var(--brand-accent)',
          color: 'var(--color-bone, rgb(249,244,230))',
        }}
      >
        Crear cuenta
      </Link>
    </>
  )
}
