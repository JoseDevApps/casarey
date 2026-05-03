'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { ShieldAlert, ShieldCheck, User } from 'lucide-react'
import type { User as UserType, UserRole } from '@/types/index'
import { apiFetch } from '@/lib/api-client'
import { formatDate } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'

interface UserListResponse { items: UserType[]; total: number; page: number; page_size: number }

function fetcher(url: string) {
  return apiFetch<UserListResponse>(url)
}

const ROLE_LABELS: Record<UserRole, string> = {
  CLIENT: 'Cliente',
  ADMIN: 'Administrador',
  SUPER_ADMIN: 'Super Admin',
}

const ROLE_ICON: Record<UserRole, React.ElementType> = {
  CLIENT: User,
  ADMIN: ShieldCheck,
  SUPER_ADMIN: ShieldAlert,
}

const PROMOTABLE_ROLES: UserRole[] = ['CLIENT', 'ADMIN']

export default function UsersPage() {
  const { data: resp, error, isLoading, mutate } = useSWR('/api/users', fetcher)
  const users = resp?.items
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const { toast } = useToast()

  async function handleRoleChange(userId: string, newRole: UserRole) {
    setLoadingId(userId)
    try {
      await apiFetch(`/api/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      toast(`Rol actualizado a ${ROLE_LABELS[newRole]}`, 'success')
      mutate()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al cambiar rol', 'error')
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Usuarios</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Gestiona roles y permisos de todos los usuarios registrados
        </p>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--surface-1)' }} />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl p-6 text-sm text-center" style={{ background: 'rgba(220,80,80,0.08)', border: '1px solid rgba(220,80,80,0.2)', color: 'var(--color-error)' }}>
          Error al cargar usuarios.
        </div>
      )}

      {users && (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-mid)' }}>
                {['Usuario', 'Email', 'Rol', 'Registrado', 'Cambiar rol'].map((h) => (
                  <th key={h} className="text-left px-5 py-3.5 font-medium" style={{ color: 'var(--text-tertiary)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => {
                const RoleIcon = ROLE_ICON[u.role]
                return (
                  <tr
                    key={u.id}
                    style={{ borderBottom: i < users.length - 1 ? '1px solid var(--border-soft)' : 'none' }}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)' }}>
                          {u.full_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{u.full_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5" style={{ color: 'var(--text-secondary)' }}>{u.email}</td>
                    <td className="px-5 py-3.5">
                      <span className="flex items-center gap-1.5 w-fit">
                        <RoleIcon size={13} style={{ color: u.role === 'SUPER_ADMIN' ? 'var(--color-error)' : u.role === 'ADMIN' ? 'var(--brand-accent)' : 'var(--text-tertiary)' }} />
                        <span style={{ color: 'var(--text-secondary)' }}>{ROLE_LABELS[u.role]}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {formatDate(u.created_at)}
                    </td>
                    <td className="px-5 py-3.5">
                      {u.role !== 'SUPER_ADMIN' && (
                        <select
                          value={u.role}
                          disabled={loadingId === u.id}
                          onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                          className="text-xs rounded-lg px-2 py-1.5 disabled:opacity-50"
                          style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)', border: '1px solid var(--border-mid)', outline: 'none' }}
                        >
                          {PROMOTABLE_ROLES.map((r) => (
                            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                          ))}
                        </select>
                      )}
                      {u.role === 'SUPER_ADMIN' && (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
