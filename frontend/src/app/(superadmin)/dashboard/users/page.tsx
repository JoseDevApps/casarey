'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  ShieldAlert,
  ShieldCheck,
  User as UserIcon,
  Search,
  ChevronDown,
  Check,
  Users as UsersIcon,
} from 'lucide-react'
import type { User as UserType, UserRole } from '@/types/index'
import { apiFetch } from '@/lib/api-client'
import { formatDate } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import { initialsOf } from '@/lib/auth'

interface UserListResponse {
  items: UserType[]
  total: number
  page: number
  page_size: number
}

function fetcher(url: string) {
  return apiFetch<UserListResponse>(url)
}

const ROLE_LABELS: Record<UserRole, string> = {
  CLIENT: 'Cliente',
  ADMIN: 'Administrador',
  SUPER_ADMIN: 'Super Admin',
}

const ROLE_ICON: Record<UserRole, React.ElementType> = {
  CLIENT: UserIcon,
  ADMIN: ShieldCheck,
  SUPER_ADMIN: ShieldAlert,
}

const ROLE_COLOR: Record<UserRole, string> = {
  CLIENT: 'var(--text-secondary)',
  ADMIN: 'var(--brand-accent)',
  SUPER_ADMIN: 'var(--brand-warm)',
}

const FILTERS: { value: UserRole | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Todos' },
  { value: 'CLIENT', label: 'Clientes' },
  { value: 'ADMIN', label: 'Administradores' },
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
]

const PROMOTABLE_ROLES: UserRole[] = ['CLIENT', 'ADMIN']

export default function UsersPage() {
  const { data: resp, error, isLoading, mutate } = useSWR(
    '/api/users?page_size=100',
    fetcher,
  )
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<UserRole | 'ALL'>('ALL')
  const [query, setQuery] = useState('')
  const { toast } = useToast()

  const items = resp?.items ?? []

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((u) => {
      if (filter !== 'ALL' && u.role !== filter) return false
      if (!q) return true
      return (
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      )
    })
  }, [items, filter, query])

  const counts = useMemo(() => {
    const acc: Record<UserRole | 'ALL', number> = {
      ALL: items.length,
      CLIENT: 0,
      ADMIN: 0,
      SUPER_ADMIN: 0,
    }
    for (const u of items) acc[u.role]++
    return acc
  }, [items])

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
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ color: 'var(--text-primary)' }}
          >
            Usuarios
          </h1>
          <p
            className="text-sm mt-1"
            style={{ color: 'var(--text-secondary)' }}
          >
            {resp ? (
              <>
                <span style={{ color: 'var(--text-primary)' }}>{counts.ALL}</span>
                {' '}
                personas registradas — {counts.CLIENT} clientes, {counts.ADMIN}{' '}
                administradores, {counts.SUPER_ADMIN} super admin
              </>
            ) : (
              'Gestiona roles y permisos'
            )}
          </p>
        </div>
      </div>

      {/* Filter chips + search */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const isActive = filter === f.value
            const count = counts[f.value]
            return (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className="text-sm px-3 py-1.5 rounded-full font-medium transition-all duration-150 inline-flex items-center gap-2"
                style={{
                  background: isActive ? 'var(--brand-primary)' : 'var(--surface-2)',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  border: `1px solid ${isActive ? 'var(--border-mid)' : 'var(--border-soft)'}`,
                }}
              >
                {f.label}
                <span
                  className="font-mono text-[10px] tabular-nums"
                  style={{
                    color: isActive ? 'var(--brand-warm)' : 'var(--text-muted)',
                  }}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--text-muted)' }}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar nombre o email…"
            className="input-field pl-9 text-sm"
            style={{ paddingTop: 8, paddingBottom: 8 }}
          />
        </div>
      </div>

      {/* States */}
      {isLoading && (
        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-16 rounded-xl skeleton"
              style={{ background: 'var(--surface-1)' }}
            />
          ))}
        </div>
      )}

      {error && !isLoading && (
        <div
          className="rounded-xl p-6 text-sm text-center"
          style={{
            background: 'rgba(217, 99, 78, 0.08)',
            border: '1px solid rgba(217, 99, 78, 0.25)',
            color: 'var(--color-error)',
          }}
        >
          No pudimos cargar los usuarios.{' '}
          <button
            onClick={() => mutate()}
            className="underline font-medium"
            style={{ color: 'var(--color-error)' }}
          >
            Reintentar
          </button>
        </div>
      )}

      {resp && items.length === 0 && !isLoading && (
        <EmptyCard
          title="Aún no hay usuarios"
          subtitle="Cuando alguien se registre, aparecerá aquí."
        />
      )}

      {resp && items.length > 0 && filtered.length === 0 && (
        <EmptyCard
          title="Ninguno coincide con tu búsqueda"
          subtitle={
            query
              ? `Intentamos con "${query}". Prueba con otro nombre o email.`
              : `Sin resultados con el filtro "${
                  FILTERS.find((f) => f.value === filter)?.label
                }".`
          }
        />
      )}

      {filtered.length > 0 && (
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border-soft)',
          }}
        >
          <ul>
            {filtered.map((u, i) => {
              const RoleIcon = ROLE_ICON[u.role]
              const isLast = i === filtered.length - 1
              return (
                <li
                  key={u.id}
                  className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--surface-2)]"
                  style={{
                    borderBottom: isLast ? 'none' : '1px solid var(--border-soft)',
                  }}
                >
                  {/* Avatar — same signature as the user-menu chip */}
                  <span
                    aria-hidden
                    className="font-mono text-xs font-semibold w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      background:
                        u.role === 'SUPER_ADMIN'
                          ? 'var(--brand-warm)'
                          : 'var(--brand-accent)',
                      color:
                        u.role === 'SUPER_ADMIN'
                          ? 'var(--color-ink)'
                          : 'var(--color-bone, rgb(249,244,230))',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {initialsOf(u.full_name)}
                  </span>

                  {/* Identity */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-medium leading-tight truncate"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {u.full_name}
                    </p>
                    <p
                      className="text-xs truncate mt-0.5"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {u.email}
                    </p>
                  </div>

                  {/* Role chip */}
                  <span
                    className="hidden sm:inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium shrink-0"
                    style={{
                      background:
                        u.role === 'SUPER_ADMIN'
                          ? 'rgba(232, 169, 58, 0.14)'
                          : u.role === 'ADMIN'
                            ? 'rgba(199, 90, 58, 0.14)'
                            : 'var(--surface-2)',
                      color: ROLE_COLOR[u.role],
                      border: `1px solid ${
                        u.role === 'SUPER_ADMIN'
                          ? 'rgba(232, 169, 58, 0.3)'
                          : u.role === 'ADMIN'
                            ? 'rgba(199, 90, 58, 0.3)'
                            : 'var(--border-soft)'
                      }`,
                    }}
                  >
                    <RoleIcon size={12} />
                    {ROLE_LABELS[u.role]}
                  </span>

                  {/* Joined date */}
                  <span
                    className="hidden md:block font-mono text-[11px] tabular-nums shrink-0"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {formatDate(u.created_at)}
                  </span>

                  {/* Role change menu */}
                  {u.role === 'SUPER_ADMIN' ? (
                    <span
                      className="text-xs font-mono shrink-0"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      —
                    </span>
                  ) : (
                    <RoleMenu
                      currentRole={u.role}
                      disabled={loadingId === u.id}
                      onChange={(role) => handleRoleChange(u.id, role)}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

function EmptyCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div
      className="rounded-2xl px-6 py-16 text-center"
      style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--border-soft)',
      }}
    >
      <div
        className="w-12 h-12 rounded-full inline-flex items-center justify-center mb-4"
        style={{ background: 'var(--surface-2)' }}
      >
        <UsersIcon size={20} style={{ color: 'var(--text-muted)' }} />
      </div>
      <p
        className="font-serif text-lg mb-1"
        style={{ color: 'var(--text-primary)' }}
      >
        {title}
      </p>
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        {subtitle}
      </p>
    </div>
  )
}

function RoleMenu({
  currentRole,
  disabled,
  onChange,
}: {
  currentRole: UserRole
  disabled: boolean
  onChange: (role: UserRole) => void
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="text-xs px-2.5 py-1.5 rounded-lg font-medium inline-flex items-center gap-1.5 transition-colors hover:bg-[var(--surface-3)] disabled:opacity-50 shrink-0"
          style={{
            background: 'var(--surface-2)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-soft)',
          }}
        >
          {disabled ? 'Guardando…' : 'Cambiar rol'}
          <ChevronDown size={12} style={{ color: 'var(--text-tertiary)' }} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-[180px] rounded-xl p-1.5 shadow-2xl outline-none data-[state=open]:animate-[fadeIn_140ms_ease-out]"
          style={{
            background: 'var(--surface-3)',
            border: '1px solid var(--border-mid)',
          }}
        >
          {PROMOTABLE_ROLES.map((r) => {
            const Icon = ROLE_ICON[r]
            const isCurrent = r === currentRole
            return (
              <DropdownMenu.Item
                key={r}
                disabled={isCurrent}
                onSelect={() => {
                  if (!isCurrent) onChange(r)
                }}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer outline-none transition-colors data-[highlighted]:bg-[var(--surface-2)] data-[disabled]:opacity-60 data-[disabled]:cursor-default"
                style={{ color: 'var(--text-secondary)' }}
              >
                <Icon size={14} style={{ color: ROLE_COLOR[r] }} />
                <span className="flex-1">{ROLE_LABELS[r]}</span>
                {isCurrent && <Check size={12} style={{ color: 'var(--brand-warm)' }} />}
              </DropdownMenu.Item>
            )
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
