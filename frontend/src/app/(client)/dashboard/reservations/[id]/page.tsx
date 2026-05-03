'use client'

import useSWR from 'swr'
import { use, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, Users, CreditCard, Upload } from 'lucide-react'
import type { Reservation, PaymentMethod, BookingGuest } from '@/types/index'
import { apiFetch } from '@/lib/api-client'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ReservationStatusBadge } from '@/components/reservation-status-badge'
import { FileUploader } from '@/components/file-uploader'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'

function fetcher(url: string) {
  return apiFetch<Reservation>(url)
}

function paymentsFetcher(url: string) {
  return apiFetch<PaymentMethod[]>(url)
}

function guestsFetcher(url: string) {
  return apiFetch<BookingGuest[]>(url)
}

const STATUS_DESCRIPTIONS: Record<string, string> = {
  PENDING_APPROVAL: 'Tu reserva está siendo revisada por el administrador. Te notificaremos pronto.',
  APPROVED_WAITING_PAYMENT: 'Tu reserva fue aprobada. Realiza el pago usando uno de los métodos disponibles y sube el comprobante.',
  CONFIRMED: 'Tu reserva está confirmada. ¡Prepárate para disfrutar!',
  REJECTED: 'Lamentablemente tu reserva fue rechazada. Puedes intentar con otras fechas.',
  CANCELLED: 'Esta reserva fue cancelada.',
}

interface Props {
  params: Promise<{ id: string }>
}

export default function ClientReservationDetailPage({ params }: Props) {
  const { id } = use(params)
  const { toast } = useToast()
  const [uploadedVoucherKey, setUploadedVoucherKey] = useState<string | null>(null)
  const [submittingVoucher, setSubmittingVoucher] = useState(false)

  const { data: reservation, error, mutate } = useSWR(
    `/api/reservations/${id}`,
    fetcher
  )

  const { data: paymentMethods } = useSWR(
    reservation?.status === 'APPROVED_WAITING_PAYMENT'
      ? '/api/payment-methods'
      : null,
    paymentsFetcher
  )

  const { data: guests } = useSWR(
    reservation?.status === 'CONFIRMED'
      ? `/api/reservations/${id}/guests`
      : null,
    guestsFetcher
  )

  async function submitVoucher() {
    if (!uploadedVoucherKey) return
    setSubmittingVoucher(true)
    try {
      await apiFetch(`/api/reservations/${id}/voucher`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voucher_key: uploadedVoucherKey }),
      })
      toast('Comprobante enviado correctamente', 'success')
      mutate()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al enviar comprobante', 'error')
    } finally {
      setSubmittingVoucher(false)
    }
  }

  if (error) {
    return (
      <div className="text-center py-16" style={{ color: 'var(--color-error)' }}>
        Error al cargar reserva.
      </div>
    )
  }

  if (!reservation) {
    return (
      <div className="flex flex-col gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: 'var(--surface-1)' }} />
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* Back */}
      <Link
        href="/dashboard/reservations"
        className="inline-flex items-center gap-2 text-sm mb-6 hover:opacity-80 transition-opacity"
        style={{ color: 'var(--text-secondary)' }}
      >
        <ArrowLeft size={15} />
        Mis Reservas
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Main info */}
        <div className="flex flex-col gap-5">
          {/* Header card */}
          <div
            className="rounded-2xl p-6"
            style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h1
                  className="text-xl font-bold mb-2"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {reservation.property?.name ?? 'Reserva'}
                </h1>
                <ReservationStatusBadge status={reservation.status} />
              </div>
              <span className="text-2xl font-bold" style={{ color: 'var(--brand-accent)' }}>
                {formatCurrency(reservation.total_amount)}
              </span>
            </div>

            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {STATUS_DESCRIPTIONS[reservation.status]}
            </p>
          </div>

          {/* Details */}
          <div
            className="rounded-2xl p-6"
            style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}
          >
            <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              Detalles de la Reserva
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                  Check-in
                </p>
                <p className="flex items-center gap-1.5 font-medium" style={{ color: 'var(--text-primary)' }}>
                  <CalendarDays size={13} />
                  {formatDate(reservation.check_in_date)}
                </p>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                  Check-out
                </p>
                <p className="flex items-center gap-1.5 font-medium" style={{ color: 'var(--text-primary)' }}>
                  <CalendarDays size={13} />
                  {formatDate(reservation.check_out_date)}
                </p>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                  Huéspedes
                </p>
                <p className="flex items-center gap-1.5 font-medium" style={{ color: 'var(--text-primary)' }}>
                  <Users size={13} />
                  {reservation.num_adults} adulto{reservation.num_adults !== 1 ? 's' : ''}
                  {reservation.num_children > 0
                    ? `, ${reservation.num_children} niño${reservation.num_children !== 1 ? 's' : ''}`
                    : ''}
                </p>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                  Solicitada
                </p>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {formatDate(reservation.created_at)}
                </p>
              </div>
            </div>

            {/* Price breakdown */}
            <div
              className="mt-4 pt-4 text-sm flex flex-col gap-2"
              style={{ borderTop: '1px solid var(--border-soft)' }}
            >
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>
                  Tarifa adulto (congelada)
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {formatCurrency(reservation.snapshot_rate_adult)}/noche
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>
                  Tarifa niño (congelada)
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {formatCurrency(reservation.snapshot_rate_child)}/noche
                </span>
              </div>
              <div
                className="flex justify-between font-bold pt-2 mt-1"
                style={{ borderTop: '1px solid var(--border-soft)', color: 'var(--text-primary)' }}
              >
                <span>Total</span>
                <span style={{ color: 'var(--brand-accent)' }}>
                  {formatCurrency(reservation.total_amount)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment section */}
          {reservation.status === 'APPROVED_WAITING_PAYMENT' && paymentMethods && (
            <div
              className="rounded-2xl p-6"
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}
            >
              <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                <CreditCard size={16} className="inline mr-2" style={{ color: 'var(--brand-accent)' }} />
                Métodos de Pago
              </h2>
              <div className="flex flex-col gap-3 mb-6">
                {paymentMethods.filter(p => p.is_active).map((method) => (
                  <div
                    key={method.id}
                    className="rounded-xl p-4"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)' }}
                  >
                    <p className="font-medium text-sm mb-1" style={{ color: 'var(--text-primary)' }}>
                      {method.name}
                    </p>
                    {method.description && (
                      <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                        {method.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <div>
                <p className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
                  <Upload size={14} className="inline mr-1.5" />
                  Subir comprobante de pago
                </p>
                <FileUploader
                  onUpload={(_, key) => setUploadedVoucherKey(key)}
                  label="Arrastra el comprobante o haz clic para seleccionar"
                />
                {uploadedVoucherKey && (
                  <Button
                    onClick={submitVoucher}
                    loading={submittingVoucher}
                    variant="forest"
                    className="mt-4 w-full"
                  >
                    Enviar Comprobante
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Guests section */}
          {reservation.status === 'CONFIRMED' && guests && guests.length > 0 && (
            <div
              className="rounded-2xl p-6"
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}
            >
              <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                <Users size={16} className="inline mr-2" style={{ color: 'var(--brand-accent)' }} />
                Huéspedes Registrados
              </h2>
              <div className="flex flex-col gap-2">
                {guests.map((guest) => (
                  <div
                    key={guest.id}
                    className="flex items-center justify-between rounded-lg px-4 py-3 text-sm"
                    style={{ background: 'var(--surface-2)' }}
                  >
                    <div>
                      <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                        {guest.full_name}
                      </p>
                      <p style={{ color: 'var(--text-muted)' }}>
                        CI: {guest.id_number}
                      </p>
                    </div>
                    {guest.phone && (
                      <p style={{ color: 'var(--text-secondary)' }}>{guest.phone}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar info */}
        <div
          className="rounded-2xl p-5 h-fit"
          style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}
        >
          <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
            ID de Reserva
          </p>
          <p className="font-mono text-xs break-all mb-4" style={{ color: 'var(--text-secondary)' }}>
            {reservation.id}
          </p>
          <Link
            href="/properties"
            className="btn-ghost text-sm w-full text-center block py-2 rounded-lg"
          >
            Explorar más propiedades
          </Link>
        </div>
      </div>
    </div>
  )
}
