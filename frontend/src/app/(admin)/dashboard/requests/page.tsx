'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { CheckCircle2, XCircle, CreditCard, Users, ChevronDown, Receipt } from 'lucide-react'
import type { Reservation, ReservationStatus, BookingGuest, Paginated } from '@/types/index'
import { apiFetch, APIError } from '@/lib/api-client'
import { formatCurrency, formatDate, toBrowserUrl } from '@/lib/utils'
import { ReservationStatusBadge } from '@/components/reservation-status-badge'
import { VoucherViewer } from '@/components/voucher-viewer'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'

interface VoucherInfo {
  id: string
  reservation_id: string
  minio_key: string
  uploaded_at: string
  url: string
}

const STATUS_FILTERS: { value: ReservationStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Todas' },
  { value: 'PENDING_APPROVAL', label: 'Pendientes' },
  { value: 'APPROVED_WAITING_PAYMENT', label: 'Esperando pago' },
  { value: 'CONFIRMED', label: 'Confirmadas' },
  { value: 'REJECTED', label: 'Rechazadas' },
  { value: 'CANCELLED', label: 'Canceladas' },
]

function fetcher(url: string) {
  return apiFetch<Paginated<Reservation>>(url)
}

function guestsFetcher(url: string) {
  return apiFetch<{ items: BookingGuest[]; total: number }>(url)
}

function GuestsPanel({ reservationId }: { reservationId: string }) {
  const { data, isLoading } = useSWR(`/api/reservations/${reservationId}/guests`, guestsFetcher)
  if (isLoading) return <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Cargando...</p>
  const guests = data?.items ?? []
  if (guests.length === 0)
    return <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Sin huéspedes registrados aún.</p>
  return (
    <div className="flex flex-col gap-1.5 mt-3">
      {guests.map((g) => (
        <div key={g.id} className="flex justify-between text-xs rounded-lg px-3 py-2" style={{ background: 'var(--surface-3)' }}>
          <span style={{ color: 'var(--text-primary)' }}>{g.full_name}</span>
          <span style={{ color: 'var(--text-muted)' }}>CI: {g.id_number}</span>
        </div>
      ))}
    </div>
  )
}

async function voucherFetcher(url: string): Promise<VoucherInfo | null> {
  try {
    return await apiFetch<VoucherInfo>(url)
  } catch (err) {
    if (err instanceof APIError && err.status === 404) return null
    throw err
  }
}

function VoucherPanel({ reservationId }: { reservationId: string }) {
  const { data: voucher, isLoading } = useSWR(
    `/api/reservations/${reservationId}/voucher`,
    voucherFetcher
  )

  if (isLoading) {
    return (
      <div
        className="rounded-xl mt-3 mb-1 h-32 animate-pulse"
        style={{ background: 'var(--surface-2)' }}
      />
    )
  }

  if (!voucher) {
    return (
      <div
        className="rounded-xl mt-3 mb-1 p-3 text-xs flex items-center gap-2"
        style={{
          background: 'rgba(224, 183, 107, 0.1)',
          color: 'var(--color-warning)',
          border: '1px solid rgba(224,183,107,0.25)',
        }}
      >
        <Receipt size={14} />
        El cliente aún no ha subido el comprobante de pago.
      </div>
    )
  }

  const browserUrl = toBrowserUrl(voucher.url)

  return (
    <div
      className="rounded-xl mt-3 mb-1 p-3"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)' }}
    >
      <p className="text-xs mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-tertiary)' }}>
        <Receipt size={12} />
        Comprobante recibido · {formatDate(voucher.uploaded_at)}
      </p>
      {browserUrl && (
        <div className="max-w-sm">
          <VoucherViewer
            url={browserUrl}
            minioKey={voucher.minio_key}
            variant="full"
          />
        </div>
      )}
    </div>
  )
}

export default function AdminRequestsPage() {
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | 'ALL'>('ALL')
  const [expandedGuests, setExpandedGuests] = useState<Set<string>>(new Set())
  const { toast } = useToast()

  const queryParam = statusFilter !== 'ALL' ? `?status=${statusFilter}` : ''
  const { data, error, isLoading, mutate } = useSWR(`/api/reservations${queryParam}`, fetcher)
  const reservations = data?.items

  async function handleApprove(id: string) {
    try {
      await apiFetch(`/api/reservations/${id}/approve`, { method: 'PATCH' })
      toast('Reserva aprobada', 'success')
      mutate()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error', 'error')
    }
  }

  async function handleReject(id: string) {
    try {
      await apiFetch(`/api/reservations/${id}/reject`, { method: 'PATCH' })
      toast('Reserva rechazada', 'info')
      mutate()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error', 'error')
    }
  }

  async function handleConfirmPayment(id: string) {
    try {
      await apiFetch(`/api/reservations/${id}/confirm-payment`, { method: 'PATCH' })
      toast('Pago confirmado — reserva activa', 'success')
      mutate()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error', 'error')
    }
  }

  function toggleGuests(id: string) {
    setExpandedGuests((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Reservas</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Gestiona y aprueba las solicitudes de reserva</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className="text-sm px-4 py-1.5 rounded-full font-medium transition-all duration-100"
            style={{
              background: statusFilter === f.value ? 'var(--brand-primary)' : 'var(--surface-2)',
              color: statusFilter === f.value ? 'var(--text-primary)' : 'var(--text-secondary)',
              border: '1px solid var(--border-soft)',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-xl animate-pulse" style={{ background: 'var(--surface-1)' }} />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl p-6 text-sm text-center" style={{ background: 'rgba(220,80,80,0.08)', border: '1px solid rgba(220,80,80,0.2)', color: 'var(--color-error)' }}>
          Error al cargar reservas.
        </div>
      )}

      {reservations && reservations.length === 0 && (
        <div className="rounded-xl p-12 text-center" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}>
          <p style={{ color: 'var(--text-secondary)' }}>No hay reservas con este filtro.</p>
        </div>
      )}

      {reservations && reservations.length > 0 && (
        <div className="flex flex-col gap-3">
          {reservations.map((res) => (
            <div key={res.id} className="rounded-2xl p-5" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                    <ReservationStatusBadge status={res.status} />
                  </div>
                  <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {res.property?.name ?? `Propiedad #${res.property_id.slice(0, 8)}`}
                  </p>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    Cliente: {res.client?.full_name ?? res.client_id.slice(0, 12)}
                  </p>
                  <div className="flex flex-wrap gap-4 mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    <span>{formatDate(res.check_in_date)} → {formatDate(res.check_out_date)}</span>
                    <span>{res.num_adults} adulto{res.num_adults !== 1 ? 's' : ''}{res.num_children > 0 ? `, ${res.num_children} niño${res.num_children !== 1 ? 's' : ''}` : ''}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold" style={{ color: 'var(--brand-accent)' }}>{formatCurrency(res.total_amount)}</p>
                </div>
              </div>

              {(res.status === 'APPROVED_WAITING_PAYMENT' || res.status === 'CONFIRMED') && (
                <VoucherPanel reservationId={res.id} />
              )}

              <div className="flex flex-wrap gap-2 mt-4 pt-4" style={{ borderTop: '1px solid var(--border-soft)' }}>
                {res.status === 'PENDING_APPROVAL' && (
                  <>
                    <Button variant="forest" size="sm" onClick={() => handleApprove(res.id)}>
                      <CheckCircle2 size={14} /> Aprobar
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleReject(res.id)}>
                      <XCircle size={14} /> Rechazar
                    </Button>
                  </>
                )}
                {res.status === 'APPROVED_WAITING_PAYMENT' && (
                  <Button variant="primary" size="sm" onClick={() => handleConfirmPayment(res.id)}>
                    <CreditCard size={14} /> Confirmar Pago
                  </Button>
                )}
                {res.status === 'CONFIRMED' && (
                  <button
                    onClick={() => toggleGuests(res.id)}
                    className="flex items-center gap-1.5 text-xs font-medium transition-opacity hover:opacity-80"
                    style={{ color: 'var(--brand-accent)' }}
                  >
                    <Users size={13} /> Ver huéspedes
                    <ChevronDown size={12} className={`transition-transform ${expandedGuests.has(res.id) ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>

              {res.status === 'CONFIRMED' && expandedGuests.has(res.id) && (
                <GuestsPanel reservationId={res.id} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
