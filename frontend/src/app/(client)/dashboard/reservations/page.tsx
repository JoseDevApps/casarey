'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { CalendarDays, ArrowRight } from 'lucide-react'
import type { Reservation } from '@/types/index'
import { apiFetch } from '@/lib/api-client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ReservationStatusBadge } from '@/components/reservation-status-badge'

type ReservationsResponse = { items: Reservation[]; total: number; page: number; page_size: number }

function fetcher(url: string) {
  return apiFetch<ReservationsResponse>(url)
}

export default function ClientReservationsPage() {
  const { data, error, isLoading } = useSWR('/api/reservations', fetcher)
  const reservations = data?.items

  return (
    <div>
      <div className="mb-8">
        <h1
          className="text-2xl font-bold"
          style={{ color: 'var(--text-primary)' }}
        >
          Mis Reservas
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Historial y estado de todas tus reservas
        </p>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 rounded-xl animate-pulse"
              style={{ background: 'var(--surface-1)' }}
            />
          ))}
        </div>
      )}

      {error && (
        <div
          className="rounded-xl p-6 text-sm text-center"
          style={{
            background: 'rgba(220, 80, 80, 0.08)',
            border: '1px solid rgba(220, 80, 80, 0.2)',
            color: 'var(--color-error)',
          }}
        >
          Error al cargar reservas. Intenta recargar la página.
        </div>
      )}

      {reservations && reservations.length === 0 && (
        <div
          className="rounded-xl p-12 text-center"
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border-soft)',
          }}
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: 'var(--surface-2)' }}
          >
            <CalendarDays size={24} style={{ color: 'var(--text-muted)' }} />
          </div>
          <p className="font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            No tienes reservas todavía
          </p>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            Explora nuestras propiedades y realiza tu primera reserva
          </p>
          <Link
            href="/properties"
            className="btn-primary inline-flex items-center gap-2 text-sm"
          >
            Explorar propiedades
            <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {reservations && reservations.length > 0 && (
        <div className="flex flex-col gap-3">
          {reservations.map((res) => (
            <Link
              key={res.id}
              href={`/dashboard/reservations/${res.id}`}
              className="block group"
            >
              <div
                className="rounded-xl p-5 transition-all duration-150 group-hover:border-[var(--border-mid)]"
                style={{
                  background: 'var(--surface-1)',
                  border: '1px solid var(--border-soft)',
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-2">
                      <ReservationStatusBadge status={res.status} />
                    </div>
                    <p
                      className="font-semibold text-base mb-1 line-clamp-1"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {res.property?.name ?? `Propiedad #${res.property_id.slice(0, 8)}`}
                    </p>
                    <div className="flex flex-wrap gap-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <span className="flex items-center gap-1.5">
                        <CalendarDays size={13} />
                        {formatDate(res.check_in_date)} → {formatDate(res.check_out_date)}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p
                      className="text-lg font-bold"
                      style={{ color: 'var(--brand-accent)' }}
                    >
                      {formatCurrency(res.total_amount)}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {res.num_adults} adulto{res.num_adults !== 1 ? 's' : ''}
                      {res.num_children > 0 ? `, ${res.num_children} niño${res.num_children !== 1 ? 's' : ''}` : ''}
                    </p>
                    <ArrowRight
                      size={14}
                      className="ml-auto mt-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: 'var(--text-muted)' }}
                    />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
