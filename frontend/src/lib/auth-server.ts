// Server-only by virtue of using `next/headers`. Importing this file from a
// client component fails at build time because of the `cookies()` import.
import { cookies } from 'next/headers'
import { cache } from 'react'
import type { MeResponse } from '@/lib/auth'

export type { MeResponse } from '@/lib/auth'
export {
  dashboardHomeForRole,
  initialsOf,
  roleLabel,
  type UserRole,
} from '@/lib/auth'

/**
 * Returns the authenticated user (or null) for the current request.
 * Wrapped in `React.cache` so multiple components / layouts in the same
 * server render share a single backend call (per-request dedup).
 */
export const getMe = cache(async (): Promise<MeResponse | null> => {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('access_token')?.value
    if (!token) return null

    const base = process.env.BACKEND_URL || 'http://localhost:8100'
    const res = await fetch(`${base}/auth/me`, {
      headers: { Cookie: `access_token=${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return (await res.json()) as MeResponse
  } catch {
    return null
  }
})
