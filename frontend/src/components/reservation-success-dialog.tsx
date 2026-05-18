'use client'

import * as Dialog from '@radix-ui/react-dialog'
import {
  CheckCircle2,
  ArrowRight,
  Home,
  CalendarDays,
  Users,
  MapPin,
  Ticket,
} from 'lucide-react'
import Link from 'next/link'
import { formatCurrency, formatDate, getDaysBetween } from '@/lib/utils'

interface ReservationSummary {
  id: string
  property_name: string
  check_in_date: string
  check_out_date: string
  num_adults: number
  num_children: number
  total_amount: number | string
}

interface ReservationSuccessDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reservation: ReservationSummary | null
}

export function ReservationSuccessDialog({
  open,
  onOpenChange,
  reservation,
}: ReservationSuccessDialogProps) {
  if (!reservation) return null

  const nights = getDaysBetween(
    reservation.check_in_date,
    reservation.check_out_date,
  )

  const total =
    typeof reservation.total_amount === 'string'
      ? Number(reservation.total_amount)
      : reservation.total_amount

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* ── Overlay ── */}
        <Dialog.Overlay
          className="fixed inset-0 z-[60] data-[state=open]:animate-[fadeIn_300ms_ease-out]"
          style={{ background: 'rgba(0,0,0,0.82)' }}
        />

        {/* ── Content ── */}
        <Dialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[70]
                     outline-none w-[calc(100vw-24px)] sm:w-[min(90vw,500px)]
                     data-[state=open]:animate-[dialogIn_320ms_cubic-bezier(0.22,0.61,0.36,1)]"
          aria-describedby={undefined}
        >
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border-mid)',
              boxShadow:
                '0 40px 80px -24px rgba(0,0,0,0.7), 0 0 0 1px rgba(244,236,216,0.04)',
            }}
          >
            {/* ── Top Section: Celebration ── */}
            <div
              className="relative px-6 pt-8 pb-6 text-center overflow-hidden"
              style={{
                background:
                  'linear-gradient(180deg, rgba(232,169,58,0.08) 0%, transparent 100%)',
              }}
            >
              {/* Subtle decorative line top */}
              <div
                className="absolute top-0 left-0 right-0 h-[3px]"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, var(--brand-accent), transparent)',
                }}
              />

              {/* Animated checkmark */}
              <div className="relative mb-5 inline-flex">
                <div
                  className="absolute inset-0 rounded-full animate-ping opacity-20"
                  style={{
                    background: 'var(--color-success)',
                  }}
                />
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center relative"
                  style={{
                    background: 'rgba(91,168,110,0.15)',
                    border: '2px solid rgba(91,168,110,0.3)',
                  }}
                >
                  <CheckCircle2
                    size={30}
                    style={{ color: 'var(--color-success)' }}
                    strokeWidth={2}
                    className="animate-[fadeIn_400ms_ease-out]"
                  />
                </div>
              </div>

              <Dialog.Title
                className="font-serif text-[28px] leading-tight font-bold mb-2"
                style={{ color: 'var(--text-primary)' }}
              >
                ¡Reserva enviada!
              </Dialog.Title>
              <p
                className="text-sm leading-relaxed max-w-xs mx-auto"
                style={{ color: 'var(--text-secondary)' }}
              >
                Tu solicitud ya está en manos del administrador.
                Te notificaremos cuando sea aprobada.
              </p>

              {/* Reservation ID badge */}
              <div
                className="inline-flex items-center gap-1.5 mt-4 px-3 py-1 rounded-full"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border-soft)',
                }}
              >
                <Ticket size={12} style={{ color: 'var(--text-muted)' }} />
                <span
                  className="text-xs font-mono"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {reservation.id.slice(0, 8).toUpperCase()}
                </span>
              </div>
            </div>

            {/* ── Middle Section: Receipt / Details ── */}
            <div
              className="px-6 py-5 space-y-4"
              style={{ borderTop: '1px solid var(--border-soft)' }}
            >
              {/* Property name */}
              <div className="flex items-start gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: 'var(--brand-primary)' }}
                >
                  <MapPin
                    size={16}
                    style={{ color: 'var(--brand-accent)' }}
                  />
                </div>
                <div className="min-w-0">
                  <p
                    className="text-xs font-medium uppercase tracking-wider mb-0.5"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    Propiedad
                  </p>
                  <p
                    className="font-semibold text-base truncate"
                    style={{ color: 'var(--text-primary)' }}
                    title={reservation.property_name}
                  >
                    {reservation.property_name}
                  </p>
                </div>
              </div>

              {/* Dates */}
              <div className="flex items-start gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: 'var(--brand-primary)' }}
                >
                  <CalendarDays
                    size={16}
                    style={{ color: 'var(--brand-accent)' }}
                  />
                </div>
                <div>
                  <p
                    className="text-xs font-medium uppercase tracking-wider mb-0.5"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    Fechas
                  </p>
                  <p
                    className="text-sm"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {formatDate(reservation.check_in_date)}
                    <span className="mx-1.5" style={{ color: 'var(--text-muted)' }}>
                      →
                    </span>
                    {formatDate(reservation.check_out_date)}
                  </p>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {nights} noche{nights !== 1 ? 's' : ''} de estadía
                  </p>
                </div>
              </div>

              {/* Guests */}
              <div className="flex items-start gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: 'var(--brand-primary)' }}
                >
                  <Users
                    size={16}
                    style={{ color: 'var(--brand-accent)' }}
                  />
                </div>
                <div>
                  <p
                    className="text-xs font-medium uppercase tracking-wider mb-0.5"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    Huéspedes
                  </p>
                  <p
                    className="text-sm"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {reservation.num_adults} adulto
                    {reservation.num_adults !== 1 ? 's' : ''}
                    {reservation.num_children > 0
                      ? `, ${reservation.num_children} niño${reservation.num_children !== 1 ? 's' : ''}`
                      : ''}
                  </p>
                </div>
              </div>
            </div>

            {/* ── Total ── */}
            <div
              className="px-6 py-5"
              style={{
                background: 'var(--surface-2)',
                borderTop: '1px solid var(--border-soft)',
              }}
            >
              <div className="flex items-baseline justify-between">
                <div>
                  <p
                    className="text-xs font-medium uppercase tracking-wider"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    Total estimado
                  </p>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Tarifas congeladas al momento de la solicitud
                  </p>
                </div>
                <span
                  className="font-serif text-[28px] leading-none font-bold"
                  style={{ color: 'var(--brand-accent)' }}
                >
                  {formatCurrency(total)}
                </span>
              </div>
            </div>

            {/* ── Actions ── */}
            <div
              className="px-6 py-5 flex flex-col sm:flex-row gap-2.5"
              style={{
                borderTop: '1px solid var(--border-soft)',
              }}
            >
              <Link
                href={`/dashboard/reservations/${reservation.id}?fresh=1`}
                className="flex-1 inline-flex items-center justify-center gap-2 text-sm font-semibold px-4 py-3 rounded-xl transition-all duration-150"
                style={{
                  background: 'var(--brand-accent)',
                  color: 'var(--color-bone, rgb(249,244,230))',
                }}
                onClick={() => onOpenChange(false)}
              >
                Ver detalle de reserva
                <ArrowRight size={14} />
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 text-sm font-medium px-4 py-3 rounded-xl btn-ghost"
                onClick={() => onOpenChange(false)}
              >
                <Home size={14} />
                Ir al inicio
              </Link>
            </div>

            {/* ── Next steps hint ── */}
            <div
              className="px-6 pb-5 text-center"
              style={{ background: 'var(--surface-2)' }}
            >
              <p
                className="text-xs leading-relaxed"
                style={{ color: 'var(--text-muted)' }}
              >
                Mientras tanto, puedes ver el estado de tu reserva desde tu{' '}
                <Link
                  href={`/dashboard/reservations/${reservation.id}?fresh=1`}
                  className="underline"
                  style={{ color: 'var(--brand-accent)' }}
                  onClick={() => onOpenChange(false)}
                >
                  panel de reservas
                </Link>
                .
              </p>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
