'use client'

import { useMemo, useState, type ElementType } from 'react'
import useSWR from 'swr'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as Dialog from '@radix-ui/react-dialog'
import {
  ShieldAlert,
  ShieldCheck,
  User as UserIcon,
  UserCheck,
  UserX,
  Search,
  ChevronDown,
  Check,
  KeyRound,
  X,
  Users as UsersIcon,
  Wrench,
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

interface PasswordResetResponse {
  revoked_sessions: number
}

function fetcher(url: string) {
  return apiFetch<UserListResponse>(url)
}

const ROLE_LABELS: Record<UserRole, string> = {
  CLIENT: 'Cliente',
  ADMIN: 'Administrador',
  SUPER_ADMIN: 'Super Admin',
  TECH_ADMIN: 'Admin Técnico',
}

const ROLE_ICON: Record<UserRole, ElementType> = {
  CLIENT: UserIcon,
  ADMIN: ShieldCheck,
  SUPER_ADMIN: ShieldAlert,
  TECH_ADMIN: Wrench,
}

const ROLE_COLOR: Record<UserRole, string> = {
  CLIENT: 'var(--text-secondary)',
  ADMIN: 'var(--brand-accent)',
  SUPER_ADMIN: 'var(--brand-warm)',
  TECH_ADMIN: 'var(--brand-primary)',
}

const FILTERS: { value: UserRole | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Todos' },
  { value: 'CLIENT', label: 'Clientes' },
  { value: 'ADMIN', label: 'Administradores' },
  { value: 'TECH_ADMIN', label: 'Admin Técnico' },
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
]

const STATUS_FILTERS: { value: 'ALL' | 'ACTIVE' | 'INACTIVE'; label: string }[] = [
  { value: 'ALL', label: 'Todos los estados' },
  { value: 'ACTIVE', label: 'Activas' },
  { value: 'INACTIVE', label: 'Inactivas' },
]

const PROMOTABLE_ROLES: UserRole[] = ['CLIENT', 'ADMIN', 'TECH_ADMIN']

function validateTemporaryPassword(password: string): string | null {
  if (password.length < 8) return 'La contraseña temporal debe tener al menos 8 caracteres'
  if (!/[A-Z]/.test(password)) return 'La contraseña temporal debe incluir al menos una mayúscula'
  if (!/[0-9]/.test(password)) return 'La contraseña temporal debe incluir al menos un número'
  return null
}

export default function UsersPage() {
  const { data: resp, error, isLoading, mutate } = useSWR(
    '/api/users?page_size=100',
    fetcher,
  )
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<UserRole | 'ALL'>('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')
  const [query, setQuery] = useState('')
  const [resetTarget, setResetTarget] = useState<UserType | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetReason, setResetReason] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const { toast } = useToast()

  const items = resp?.items ?? []

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((u) => {
      if (filter !== 'ALL' && u.role !== filter) return false
      if (statusFilter === 'ACTIVE' && !u.is_active) return false
      if (statusFilter === 'INACTIVE' && u.is_active) return false
      if (!q) return true
      return (
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      )
    })
  }, [items, filter, statusFilter, query])

  const counts = useMemo(() => {
    const acc: Record<UserRole | 'ALL', number> = {
      ALL: items.length,
      CLIENT: 0,
      ADMIN: 0,
      SUPER_ADMIN: 0,
      TECH_ADMIN: 0,
    }
    for (const u of items) acc[u.role]++
    return acc
  }, [items])

  const statusCounts = useMemo(() => {
    return {
      active: items.filter((u) => u.is_active).length,
      inactive: items.filter((u) => !u.is_active).length,
    }
  }, [items])

  async function handleStatusChange(user: UserType, nextIsActive: boolean) {
    if (!nextIsActive) {
      const confirmed = window.confirm(
        `¿Deshabilitar la cuenta de ${user.full_name}? Se cerrarán sus sesiones activas.`,
      )
      if (!confirmed) return
    }

    setLoadingId(user.id)
    try {
      await apiFetch(`/api/users/${user.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: nextIsActive }),
      })
      toast(
        nextIsActive
          ? `Cuenta habilitada para ${user.full_name}`
          : `Cuenta deshabilitada para ${user.full_name}`,
        'success',
      )
      mutate()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al actualizar el estado de la cuenta', 'error')
    } finally {
      setLoadingId(null)
    }
  }

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

  function openPasswordReset(user: UserType) {
    setResetTarget(user)
    setResetPassword('')
    setResetReason('')
  }

  function closePasswordReset(force = false) {
    if (resetLoading && !force) return
    setResetTarget(null)
    setResetPassword('')
    setResetReason('')
  }

  async function handlePasswordReset() {
    if (!resetTarget) return

    const passwordError = validateTemporaryPassword(resetPassword)
    if (passwordError) {
      toast(passwordError, 'warning')
      return
    }

    setResetLoading(true)
    try {
      const result = await apiFetch<PasswordResetResponse>(`/api/users/${resetTarget.id}/password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_password: resetPassword,
          reason: resetReason.trim() || null,
        }),
      })

      toast(
        `Contraseña restablecida para ${resetTarget.full_name}. Sesiones cerradas: ${result.revoked_sessions}`,
        'success',
      )
      closePasswordReset(true)
      mutate()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudo restablecer la contraseña', 'error')
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <Dialog.Root
      open={Boolean(resetTarget)}
      onOpenChange={(open) => {
        if (!open) closePasswordReset()
      }}
    >
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
                administradores, {counts.SUPER_ADMIN} super admin.
                {' '}Activas: {statusCounts.active}, inactivas: {statusCounts.inactive}
              </>
            ) : (
              'Gestiona roles, estado de cuenta y restablecimiento de contraseñas'
            )}
          </p>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            El botón <strong>Habilitar/Deshabilitar</strong> aparece en usuarios CLIENTE y ADMIN.
            {' '}
            El botón <strong>Restablecer</strong> aparece en usuarios CLIENTE y ADMIN.
            {' '}Las cuentas SUPER_ADMIN se cambian desde su propia sesión.
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

        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => {
            const isActive = statusFilter === f.value
            const count =
              f.value === 'ALL'
                ? counts.ALL
                : f.value === 'ACTIVE'
                  ? statusCounts.active
                  : statusCounts.inactive
            return (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className="text-sm px-3 py-1.5 rounded-full font-medium transition-all duration-150 inline-flex items-center gap-2"
                style={{
                  background: isActive ? 'var(--surface-3)' : 'var(--surface-2)',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  border: `1px solid ${isActive ? 'var(--border-mid)' : 'var(--border-soft)'}`,
                }}
              >
                {f.label}
                <span
                  className="font-mono text-[10px] tabular-nums"
                  style={{ color: isActive ? 'var(--brand-accent)' : 'var(--text-muted)' }}
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
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors hover:bg-[var(--surface-3)]"
            style={{
              background: 'var(--surface-2)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-soft)',
            }}
          >
            Limpiar búsqueda
          </button>
        )}
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
            background: 'rgba(186, 26, 26, 0.08)',
            border: '1px solid rgba(186, 26, 26, 0.22)',
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
              : `Sin resultados con los filtros "${
                  FILTERS.find((f) => f.value === filter)?.label
                }" y "${
                  STATUS_FILTERS.find((f) => f.value === statusFilter)?.label
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
                  className={`flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--surface-2)] ${
                    !u.is_active ? 'opacity-75' : ''
                  }`}
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
                    {!u.is_active && (
                      <p
                        className="text-[11px] font-medium mt-1"
                        style={{ color: 'var(--color-error)' }}
                      >
                        Cuenta deshabilitada
                      </p>
                    )}
                    {u.must_change_password && (
                      <p
                        className="text-[11px] font-medium mt-1"
                        style={{ color: 'var(--brand-warm)' }}
                      >
                        Cambio de contraseña pendiente
                      </p>
                    )}
                  </div>

                  {/* Role chip */}
                  <span
                    className="hidden sm:inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium shrink-0"
                    style={{
                      background:
                        u.role === 'SUPER_ADMIN'
                          ? 'rgba(240, 100, 47, 0.14)'
                          : u.role === 'ADMIN'
                            ? 'rgba(167, 52, 0, 0.12)'
                            : 'var(--surface-2)',
                      color: ROLE_COLOR[u.role],
                      border: `1px solid ${
                        u.role === 'SUPER_ADMIN'
                          ? 'rgba(240, 100, 47, 0.28)'
                          : u.role === 'ADMIN'
                            ? 'rgba(167, 52, 0, 0.26)'
                            : 'var(--border-soft)'
                      }`,
                    }}
                  >
                    <RoleIcon size={12} />
                    {ROLE_LABELS[u.role]}
                  </span>

                  <span
                    className="hidden sm:inline-flex items-center text-xs px-2.5 py-1 rounded-full font-medium shrink-0"
                    style={{
                      background: u.is_active ? 'rgba(79, 97, 68, 0.13)' : 'rgba(186, 26, 26, 0.10)',
                      color: u.is_active ? 'var(--brand-primary)' : 'var(--color-error)',
                      border: `1px solid ${
                        u.is_active ? 'rgba(79, 97, 68, 0.24)' : 'rgba(186, 26, 26, 0.24)'
                      }`,
                    }}
                  >
                    {u.is_active ? 'Activa' : 'Inactiva'}
                  </span>

                  {/* Joined date */}
                  <span
                    className="hidden md:block font-mono text-[11px] tabular-nums shrink-0"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {formatDate(u.created_at)}
                  </span>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    {u.role !== 'SUPER_ADMIN' && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(u, !u.is_active)}
                        disabled={loadingId === u.id || resetLoading}
                        className="text-xs px-2.5 py-1.5 rounded-lg font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        title={u.is_active ? 'Deshabilitar cuenta' : 'Habilitar cuenta'}
                        style={{
                          background: u.is_active ? 'rgba(186, 26, 26, 0.08)' : 'rgba(79, 97, 68, 0.13)',
                          color: u.is_active ? 'var(--color-error)' : 'var(--brand-primary)',
                          border: `1px solid ${
                            u.is_active ? 'rgba(186, 26, 26, 0.24)' : 'rgba(79, 97, 68, 0.24)'
                          }`,
                        }}
                      >
                        {u.is_active ? <UserX size={12} /> : <UserCheck size={12} />}
                        {u.is_active ? 'Deshabilitar' : 'Habilitar'}
                      </button>
                    )}
                    {u.role !== 'SUPER_ADMIN' && (
                      <RoleMenu
                        currentRole={u.role}
                        disabled={loadingId === u.id || resetLoading}
                        onChange={(role) => handleRoleChange(u.id, role)}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => openPasswordReset(u)}
                      disabled={u.role === 'SUPER_ADMIN' || loadingId === u.id || resetLoading}
                      className="text-xs px-2.5 py-1.5 rounded-lg font-medium inline-flex items-center gap-1.5 transition-colors hover:bg-[var(--surface-3)] disabled:opacity-60 disabled:cursor-not-allowed"
                      title={
                        u.role === 'SUPER_ADMIN'
                          ? 'Por seguridad, la contraseña del SUPER_ADMIN se cambia desde su sesión'
                          : 'Restablecer contraseña temporal'
                      }
                      style={{
                        background: 'var(--surface-2)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border-soft)',
                      }}
                    >
                      <KeyRound
                        size={12}
                        style={{ color: u.role === 'SUPER_ADMIN' ? 'var(--text-muted)' : 'var(--brand-accent)' }}
                      />
                      {u.role === 'SUPER_ADMIN' ? 'Protegido' : 'Restablecer'}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
      </div>

      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-[60] backdrop-blur-sm data-[state=open]:animate-[fadeIn_180ms_ease-out]"
          style={{ background: 'rgba(0,0,0,0.75)' }}
        />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[70] -translate-x-1/2 -translate-y-1/2 w-[min(92vw,540px)] rounded-2xl p-6 outline-none data-[state=open]:animate-[fadeIn_180ms_ease-out]"
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border-mid)',
          }}
        >
          <Dialog.Title className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            Restablecer contraseña
          </Dialog.Title>
          <Dialog.Description className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
            Define una contraseña temporal para{' '}
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
              {resetTarget?.full_name}
            </span>
            . Al guardar, se cerrarán todas sus sesiones activas y deberá cambiarla al iniciar sesión.
          </Dialog.Description>

          <div className="mt-5 space-y-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="reset-password"
                className="text-sm font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                Contraseña temporal
              </label>
              <input
                id="reset-password"
                type="password"
                className="input-field"
                placeholder="Ejemplo: Temp2026"
                value={resetPassword}
                onChange={(event) => setResetPassword(event.target.value)}
                autoComplete="new-password"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="reset-reason"
                className="text-sm font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                Motivo (opcional)
              </label>
              <textarea
                id="reset-reason"
                rows={3}
                className="input-field resize-y"
                placeholder="Ejemplo: Solicitud del usuario por olvido"
                value={resetReason}
                onChange={(event) => setResetReason(event.target.value)}
              />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => closePasswordReset()}
              disabled={resetLoading}
              className="btn-ghost text-sm px-4 py-2 rounded-lg disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handlePasswordReset}
              disabled={resetLoading}
              className="btn-primary text-sm px-4 py-2 rounded-lg disabled:opacity-50 inline-flex items-center gap-2"
            >
              {resetLoading ? 'Restableciendo…' : 'Restablecer contraseña'}
            </button>
          </div>

          <Dialog.Close
            onClick={() => closePasswordReset()}
            disabled={resetLoading}
            className="absolute top-3 right-3 p-1.5 rounded-md transition-colors hover:bg-[var(--surface-2)] disabled:opacity-50"
            aria-label="Cerrar"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={16} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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
