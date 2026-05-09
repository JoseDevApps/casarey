/**
 * Pure helpers safe to import from BOTH server and client components.
 * No `cookies()`, no `fetch()` against the backend — just data shapes
 * and small derivations.
 */

export interface MeResponse {
  id: string
  email: string
  full_name: string
  phone?: string | null
  role: 'CLIENT' | 'ADMIN' | 'SUPER_ADMIN'
  is_active: boolean
  created_at: string
}

export type UserRole = MeResponse['role']

export function dashboardHomeForRole(role: UserRole): string {
  switch (role) {
    case 'CLIENT':
      return '/dashboard/reservations'
    case 'ADMIN':
      return '/dashboard/properties'
    case 'SUPER_ADMIN':
      return '/dashboard/users'
  }
}

const ROLE_LABELS: Record<UserRole, string> = {
  CLIENT: 'Cliente',
  ADMIN: 'Administrador',
  SUPER_ADMIN: 'Super Admin',
}

export function roleLabel(role: UserRole): string {
  return ROLE_LABELS[role]
}

/** Up to 2 initials in uppercase. */
export function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '·'
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}
