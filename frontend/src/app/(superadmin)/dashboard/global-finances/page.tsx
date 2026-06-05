'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { TrendingUp, Globe, Receipt, Users as UsersIcon } from 'lucide-react'
import { apiFetch } from '@/lib/api-client'
import { formatCurrency } from '@/lib/utils'
import { initialsOf } from '@/lib/auth'

interface GlobalAdminSummary {
  admin_id: string
  admin_name: string
  total_income: string
  confirmed_reservations: number
}

interface GlobalFinanceResponse {
  items: GlobalAdminSummary[]
  grand_total: string
}

function fetcher(url: string) {
  return apiFetch<GlobalFinanceResponse>(url)
}

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS: (number | 'ALL')[] = [
  'ALL',
  CURRENT_YEAR,
  CURRENT_YEAR - 1,
  CURRENT_YEAR - 2,
]

export default function GlobalFinancesPage() {
  const [year, setYear] = useState<number | 'ALL'>('ALL')
  const url =
    year === 'ALL' ? '/api/finances/global' : `/api/finances/global?year=${year}`
  const { data, error, isLoading, mutate } = useSWR(url, fetcher)

  const items = data?.items ?? []
  const grandTotal = data ? Number(data.grand_total) : 0
  const totalReservations = useMemo(
    () => items.reduce((sum, row) => sum + row.confirmed_reservations, 0),
    [items],
  )
  const sorted = useMemo(
    () => [...items].sort((a, b) => Number(b.total_income) - Number(a.total_income)),
    [items],
  )

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ color: 'var(--text-primary)' }}
          >
            Auditoría financiera
          </h1>
          <p
            className="text-sm mt-1"
            style={{ color: 'var(--text-secondary)' }}
          >
            {data ? (
              <>
                <span style={{ color: 'var(--text-primary)' }}>{items.length}</span>{' '}
                administrador{items.length !== 1 ? 'es' : ''} con reservas confirmadas
                {' · '}
                <span style={{ color: 'var(--text-primary)' }}>{totalReservations}</span>{' '}
                reserva{totalReservations !== 1 ? 's' : ''} en total
              </>
            ) : (
              'Vista de auditoría — todos los administradores'
            )}
          </p>
        </div>

        {/* Year filter chips */}
        <div className="flex flex-wrap gap-2">
          {YEAR_OPTIONS.map((y) => {
            const isActive = year === y
            return (
              <button
                key={String(y)}
                onClick={() => setYear(y)}
                className="text-xs font-mono px-3 py-1.5 rounded-full font-medium transition-all duration-150 tabular-nums tracking-wider"
                style={{
                  background: isActive ? 'var(--brand-primary)' : 'var(--surface-2)',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  border: `1px solid ${isActive ? 'var(--border-mid)' : 'var(--border-soft)'}`,
                }}
              >
                {y === 'ALL' ? 'TODOS' : y}
              </button>
            )
          })}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div
          className="rounded-2xl p-5 flex items-center gap-4"
          style={{
            background: 'var(--surface-4)',
            border: '1px solid rgba(167, 52, 0, 0.18)',
          }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(167, 52, 0, 0.14)' }}
          >
            <TrendingUp size={18} style={{ color: 'var(--brand-accent)' }} />
          </div>
          <div>
            <p
              className="text-[10px] font-mono uppercase tracking-wider mb-0.5"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Total plataforma
            </p>
            <p
              className="font-serif text-2xl"
              style={{ color: 'var(--brand-accent)' }}
            >
              {formatCurrency(grandTotal)}
            </p>
          </div>
        </div>

        <div
          className="rounded-2xl p-5 flex items-center gap-4"
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border-soft)',
          }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--surface-3)' }}
          >
            <UsersIcon size={18} style={{ color: 'var(--brand-warm)' }} />
          </div>
          <div>
            <p
              className="text-[10px] font-mono uppercase tracking-wider mb-0.5"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Administradores activos
            </p>
            <p
              className="font-serif text-2xl"
              style={{ color: 'var(--text-primary)' }}
            >
              {items.length}
            </p>
          </div>
        </div>

        <div
          className="rounded-2xl p-5 flex items-center gap-4"
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border-soft)',
          }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--surface-3)' }}
          >
            <Receipt size={18} style={{ color: 'var(--text-secondary)' }} />
          </div>
          <div>
            <p
              className="text-[10px] font-mono uppercase tracking-wider mb-0.5"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Reservas confirmadas
            </p>
            <p
              className="font-serif text-2xl"
              style={{ color: 'var(--text-primary)' }}
            >
              {totalReservations}
            </p>
          </div>
        </div>
      </div>

      {/* States */}
      {isLoading && (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
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
          No pudimos cargar la auditoría.{' '}
          <button
            onClick={() => mutate()}
            className="underline font-medium"
            style={{ color: 'var(--color-error)' }}
          >
            Reintentar
          </button>
        </div>
      )}

      {data && items.length === 0 && !isLoading && (
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
            <Globe size={20} style={{ color: 'var(--text-muted)' }} />
          </div>
          <p
            className="font-serif text-lg mb-1"
            style={{ color: 'var(--text-primary)' }}
          >
            {year === 'ALL'
              ? 'Sin reservas confirmadas todavía'
              : `Sin actividad en ${year}`}
          </p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {year === 'ALL'
              ? 'Cuando un administrador confirme su primera reserva, aparecerá aquí.'
              : 'Prueba con otro año o consulta el histórico completo.'}
          </p>
        </div>
      )}

      {sorted.length > 0 && (
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border-soft)',
          }}
        >
          <ul>
            {sorted.map((row, i) => {
              const isLast = i === sorted.length - 1
              const totalNum = Number(row.total_income)
              const share = grandTotal > 0 ? (totalNum / grandTotal) * 100 : 0
              return (
                <li
                  key={row.admin_id}
                  className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--surface-2)]"
                  style={{
                    borderBottom: isLast ? 'none' : '1px solid var(--border-soft)',
                  }}
                >
                  {/* Rank — most-earning admin first */}
                  <span
                    className="font-mono text-[11px] tabular-nums w-6 text-right shrink-0"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {(i + 1).toString().padStart(2, '0')}
                  </span>

                  {/* Avatar — signature chip */}
                  <span
                    aria-hidden
                    className="font-mono text-xs font-semibold w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      background: 'var(--brand-accent)',
                      color: 'var(--color-bone, rgb(249,244,230))',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {initialsOf(row.admin_name)}
                  </span>

                  {/* Identity + share bar */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-medium leading-tight truncate mb-1.5"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {row.admin_name}
                    </p>
                    <div className="flex items-center gap-2">
                      <div
                        className="flex-1 h-1 rounded-full overflow-hidden max-w-[200px]"
                        style={{ background: 'var(--surface-3)' }}
                        aria-label={`${share.toFixed(1)}% del total`}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${share}%`,
                            background: 'var(--brand-accent)',
                          }}
                        />
                      </div>
                      <span
                        className="font-mono text-[10px] tabular-nums tracking-wider shrink-0"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        {share.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Reservation count */}
                  <div className="hidden sm:flex flex-col items-end shrink-0">
                    <span
                      className="font-mono text-sm tabular-nums"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {row.confirmed_reservations}
                    </span>
                    <span
                      className="text-[10px] font-mono uppercase tracking-wider"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      reserva{row.confirmed_reservations !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Total income */}
                  <div className="text-right shrink-0 min-w-[110px]">
                    <p
                      className="font-serif text-lg tabular-nums"
                      style={{ color: 'var(--brand-accent)' }}
                    >
                      {formatCurrency(totalNum)}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>

          {/* Footer total */}
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{
              background: 'var(--surface-2)',
              borderTop: '1px solid var(--border-mid)',
            }}
          >
            <span
              className="text-xs font-mono uppercase tracking-wider"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Total {year !== 'ALL' ? `${year}` : 'histórico'}
            </span>
            <span
              className="font-serif text-xl tabular-nums"
              style={{ color: 'var(--brand-accent)' }}
            >
              {formatCurrency(grandTotal)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
