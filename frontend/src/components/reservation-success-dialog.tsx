'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { CheckCircle2, ArrowRight, Home, CalendarDays, Users } from 'lucide-react'
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

/**
 * Sober celebration moment — like a printed receipt on cream paper.
 * Shows after a successful reservation POST. Auto-doesn't dismiss; the
 * user chooses when to leave (matches the calmness of the brand).
 */
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

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-[60] backdrop-blur-sm data-[state=open]:animate-[fadeIn_220ms_ease-out]"
          style={{ background: 'rgba(0,0,0,0.78)' }}
        />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[70] w-[min(92vw,460px)] outline-none data-[state=open]:animate-[dialogIn_280ms_cubic-bezier(0.22,0.61,0.36,1)]"
          aria-describedby={undefined}
        >
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border-mid)',
              boxShadow:
                '0 32px 64px -24px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(244, 236, 216, 0.04)',
            }}
          >
            {/* Top success accent — sun glow on a forest band */}
            <div
              className="px-7 pt-7 pb-5 text-center relative overflow-hidden"
              style={{
                background:
                  'radial-gradient(ellipse 60% 80% at 50% 0%, rgba(232, 169, 58, 0.22), transparent 70%)',
              }}
            >
              <div
                className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center"
                style={{
                  background: 'rgba(91, 168, 110, 0.16)',
                  border: '1px solid rgba(91, 168, 110, 0.32)',
                }}
              >
                <CheckCircle2
                  size={26}
                  style={{ color: 'var(--color-success)' }}
                  strokeWidth={2}
                />
              </div>
              <Dialog.Title
                className="font-serif text-2xl mb-1.5"
                style={{ color: 'var(--text-primary)' }}
              >
                ¡Reserva enviada!
              </Dialog.Title>
              <p
                className="text-sm leading-relaxed"
                style={{ color: 'var(--text-secondary)' }}
              >
                Tu solicitud ya está con el administrador.
                <br />
                Te avisaremos cuando la apruebe.
              </p>
            </div>

            {/* Receipt body */}
            <div
              className="px-7 py-5"
              style={{ borderTop: '1px solid var(--border-soft)' }}
            >
              <p
                className="font-serif text-base mb-3 truncate"
                style={{ color: 'var(--text-primary)' }}
                title={reservation.property_name}
              >
                {reservation.property_name}
              </p>
              <dl className="flex flex-col gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <CalendarDays
                    size={13}
                    className="shrink-0"
                    style={{ color: 'var(--text-tertiary)' }}
                  />
                  <dt className="sr-only">Fechas</dt>
                  <dd style={{ color: 'var(--text-secondary)' }}>
                    {formatDate(reservation.check_in_date)}
                    {' → '}
                    {formatDate(reservation.check_out_date)}
                    <span
                      className="ml-1.5 font-mono text-xs"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      · {nights} noche{nights !== 1 ? 's' : ''}
                    </span>
                  </dd>
                </div>
                <div className="flex items-center gap-2">
                  <Users
                    size={13}
                    className="shrink-0"
                    style={{ color: 'var(--text-tertiary)' }}
                  />
                  <dt className="sr-only">Huéspedes</dt>
                  <dd style={{ color: 'var(--text-secondary)' }}>
                    {reservation.num_adults} adulto
                    {reservation.num_adults !== 1 ? 's' : ''}
                    {reservation.num_children > 0
                      ? `, ${reservation.num_children} niño${reservation.num_children !== 1 ? 's' : ''}`
                      : ''}
                  </dd>
                </div>
              </dl>

              <div
                className="flex items-baseline justify-between mt-4 pt-4"
                style={{ borderTop: '1px dashed var(--border-soft)' }}
              >
                <span
                  className="text-xs font-mono uppercase tracking-wider"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  Total estimado
                </span>
                <span
                  className="font-serif text-2xl"
                  style={{ color: 'var(--brand-accent)' }}
                >
                  {formatCurrency(reservation.total_amount)}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div
              className="px-7 py-5 flex flex-col sm:flex-row gap-2.5"
              style={{
                background: 'var(--surface-2)',
                borderTop: '1px solid var(--border-soft)',
              }}
            >
              <Link
                href={`/dashboard/reservations/${reservation.id}?fresh=1`}
                className="flex-1 inline-flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
                style={{
                  background: 'var(--brand-accent)',
                  color: 'var(--color-bone, rgb(249,244,230))',
                }}
              >
                Ver detalle
                <ArrowRight size={14} />
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors btn-ghost"
              >
                <Home size={14} />
                Inicio
              </Link>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
