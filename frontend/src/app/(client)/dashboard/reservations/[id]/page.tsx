'use client'

import useSWR from 'swr'
import { use, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, CalendarDays, Users, CreditCard, Upload, X, FileText, CheckCircle2 } from 'lucide-react'
import type { Reservation, PaymentMethod, BookingGuest, Paginated } from '@/types/index'
import { apiFetch, APIError } from '@/lib/api-client'
import { formatCurrency, formatDate, getImageUrl, toBrowserUrl } from '@/lib/utils'

interface VoucherInfo {
  id: string
  reservation_id: string
  minio_key: string
  uploaded_at: string
  url: string
}
import { ReservationStatusBadge } from '@/components/reservation-status-badge'
import { VoucherViewer } from '@/components/voucher-viewer'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'

function fetcher(url: string) {
  return apiFetch<Reservation>(url)
}

function paymentsFetcher(url: string) {
  return apiFetch<{ items: PaymentMethod[]; total: number }>(url)
}

function guestsFetcher(url: string) {
  return apiFetch<Paginated<BookingGuest>>(url)
}

async function voucherFetcher(url: string): Promise<VoucherInfo | null> {
  try {
    return await apiFetch<VoucherInfo>(url)
  } catch (err) {
    // 404 = no voucher uploaded yet — render empty state, not an error
    if (err instanceof APIError && err.status === 404) return null
    throw err
  }
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
  const searchParams = useSearchParams()
  const isFresh = searchParams.get('fresh') === '1'
  const [highlightFresh, setHighlightFresh] = useState(isFresh)
  const { toast } = useToast()

  // Auto-fade the "just-created" highlight after a few seconds; it's a glance,
  // not a steady-state. The pulse animation already loops 2 cycles.
  useEffect(() => {
    if (!isFresh) return
    const t = setTimeout(() => setHighlightFresh(false), 4000)
    return () => clearTimeout(t)
  }, [isFresh])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [voucherFile, setVoucherFile] = useState<File | null>(null)
  const [voucherPreview, setVoucherPreview] = useState<string | null>(null)
  const [submittingVoucher, setSubmittingVoucher] = useState(false)

  const { data: reservation, error, mutate } = useSWR(
    `/api/reservations/${id}`,
    fetcher
  )

  const ownerId = reservation?.property?.owner_id
  const { data: paymentMethodsData } = useSWR(
    reservation?.status === 'APPROVED_WAITING_PAYMENT' && ownerId
      ? `/api/payment-methods?owner_id=${ownerId}`
      : null,
    paymentsFetcher
  )
  const paymentMethods = paymentMethodsData?.items

  const { data: guestsData } = useSWR(
    reservation?.status === 'CONFIRMED'
      ? `/api/reservations/${id}/guests`
      : null,
    guestsFetcher
  )
  const guests = guestsData?.items

  const showVoucher = reservation
    ? ['APPROVED_WAITING_PAYMENT', 'CONFIRMED'].includes(reservation.status)
    : false
  const { data: voucher, mutate: mutateVoucher } = useSWR(
    showVoucher ? `/api/reservations/${id}/voucher` : null,
    voucherFetcher
  )
  const voucherBrowserUrl = voucher ? toBrowserUrl(voucher.url) : null

  function selectFile(file: File | null) {
    if (voucherPreview) URL.revokeObjectURL(voucherPreview)
    if (!file) {
      setVoucherFile(null)
      setVoucherPreview(null)
      return
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowed.includes(file.type)) {
      toast('Tipo de archivo no permitido (jpg, png, webp o pdf)', 'error')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast('El archivo excede 10 MB', 'error')
      return
    }
    setVoucherFile(file)
    setVoucherPreview(file.type.startsWith('image/') ? URL.createObjectURL(file) : null)
  }

  async function submitVoucher() {
    if (!voucherFile) return
    setSubmittingVoucher(true)
    try {
      const formData = new FormData()
      formData.append('file', voucherFile)
      const res = await fetch(`/api/reservations/${id}/voucher`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const detail = (err as { detail?: { detail?: string } | string }).detail
        const message =
          typeof detail === 'string'
            ? detail
            : detail?.detail || 'Error al enviar comprobante'
        throw new Error(message)
      }
      toast('Comprobante enviado correctamente', 'success')
      selectFile(null)
      mutate()
      mutateVoucher()
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
          <div key={i} className="h-24 rounded-xl skeleton" style={{ background: 'var(--surface-1)' }} />
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
          {/* Header card — pulsa brevemente cuando llegamos con ?fresh=1 */}
          <div
            className="rounded-2xl p-6"
            style={{
              background: 'var(--surface-1)',
              border: highlightFresh
                ? '1px solid rgba(232, 169, 58, 0.5)'
                : '1px solid var(--border-soft)',
              animation: highlightFresh
                ? 'pulseAccent 1.4s ease-in-out 2'
                : undefined,
              transition: 'border-color 600ms ease-out',
            }}
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
              <div className="text-right">
                <span className="text-2xl font-bold" style={{ color: 'var(--brand-accent)' }}>
                  {formatCurrency(reservation.final_amount ?? reservation.total_amount)}
                </span>
                {(reservation.discount_amount ?? 0) > 0 && (
                  <p className="text-xs mt-0.5 line-through" style={{ color: 'var(--text-muted)' }}>
                    {formatCurrency(reservation.total_amount)}
                  </p>
                )}
              </div>
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
                  Tarifa congelada aplicada
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {formatCurrency(reservation.snapshot_nightly_rate)}/noche
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>
                  Regla aplicada
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {reservation.snapshot_pricing_tier === 1
                    ? '1 noche'
                    : reservation.snapshot_pricing_tier === 2
                    ? '2 noches'
                    : '3+ noches'}
                </span>
              </div>
              {(reservation.discount_amount ?? 0) > 0 && (
                <div className="flex justify-between text-sm pt-2">
                  <span style={{ color: 'var(--text-secondary)' }}>Descuento</span>
                  <span style={{ color: 'var(--color-success)' }}>
                    -{formatCurrency(reservation.discount_amount)}
                  </span>
                </div>
              )}
              <div
                className="flex justify-between font-bold pt-2 mt-1"
                style={{ borderTop: '1px solid var(--border-soft)', color: 'var(--text-primary)' }}
              >
                <span>{(reservation.discount_amount ?? 0) > 0 ? 'Total a pagar' : 'Total'}</span>
                <span style={{ color: 'var(--brand-accent)' }}>
                  {formatCurrency(reservation.final_amount ?? reservation.total_amount)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment section */}
          {reservation.status === 'APPROVED_WAITING_PAYMENT' && (
            <div
              className="rounded-2xl p-6"
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}
            >
              <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                <CreditCard size={16} className="inline mr-2" style={{ color: 'var(--brand-accent)' }} />
                Métodos de Pago
              </h2>
              {paymentMethods === undefined ? (
                <div
                  className="h-20 rounded-xl skeleton mb-6"
                  style={{ background: 'var(--surface-2)' }}
                />
              ) : paymentMethods.length === 0 ? (
                <p
                  className="text-sm mb-6 rounded-xl p-4"
                  style={{
                    background: 'var(--surface-2)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Este administrador todavía no registró métodos de pago. Contáctalo
                  para coordinar el pago.
                </p>
              ) : (
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
                        <p className="text-sm whitespace-pre-wrap mb-3" style={{ color: 'var(--text-secondary)' }}>
                          {method.description}
                        </p>
                      )}
                      {method.minio_key && (
                        <a
                          href={getImageUrl(method.minio_key, 'payment-methods')}
                          target="_blank"
                          rel="noreferrer"
                          className="block mx-auto relative w-48 h-48 rounded-lg overflow-hidden ring-1 ring-[var(--border-soft)] hover:ring-[var(--brand-accent)] transition-all duration-150"
                          style={{ background: 'white' }}
                          aria-label={`Abrir QR de ${method.name} a tamaño completo`}
                        >
                          <Image
                            src={getImageUrl(method.minio_key, 'payment-methods')}
                            alt={`QR ${method.name}`}
                            fill
                            sizes="192px"
                            className="object-contain p-2"
                          />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden"
                  onChange={(e) => selectFile(e.target.files?.[0] ?? null)}
                />

                {/* Already-uploaded voucher (persistido) */}
                {voucher && voucherBrowserUrl && !voucherFile && (
                  <div
                    className="rounded-xl p-4 mb-4"
                    style={{
                      background: 'rgba(52, 168, 83, 0.08)',
                      border: '1px solid rgba(52,168,83,0.25)',
                    }}
                  >
                    <p className="text-sm font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--color-success)' }}>
                      <CheckCircle2 size={15} />
                      Comprobante enviado · {formatDate(voucher.uploaded_at)}
                    </p>
                    <VoucherViewer
                      url={voucherBrowserUrl}
                      minioKey={voucher.minio_key}
                      variant="full"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs mt-3 underline"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Reemplazar comprobante
                    </button>
                  </div>
                )}

                <p className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
                  <Upload size={14} className="inline mr-1.5" />
                  {voucher ? 'Reemplazar comprobante' : 'Subir comprobante de pago'}
                </p>

                {voucherFile ? (
                  <div
                    className="rounded-xl p-4"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)' }}
                  >
                    {voucherPreview ? (
                      <div
                        className="relative w-full rounded-lg overflow-hidden mb-3"
                        style={{ aspectRatio: '4/3', background: 'var(--surface-3)' }}
                      >
                        <Image
                          src={voucherPreview}
                          alt="Vista previa del comprobante"
                          fill
                          unoptimized
                          sizes="(max-width: 1024px) 100vw, 600px"
                          className="object-contain"
                        />
                      </div>
                    ) : (
                      <div
                        className="rounded-lg flex items-center gap-3 p-4 mb-3"
                        style={{ background: 'var(--surface-3)' }}
                      >
                        <FileText size={28} style={{ color: 'var(--brand-accent)' }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                            {voucherFile.name}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {(voucherFile.size / 1024).toFixed(1)} KB · PDF listo para subir
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs truncate flex-1" style={{ color: 'var(--text-muted)' }}>
                        {voucherFile.name} · {(voucherFile.size / 1024).toFixed(1)} KB
                      </p>
                      <button
                        type="button"
                        onClick={() => selectFile(null)}
                        className="p-1.5 rounded-lg shrink-0"
                        style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)' }}
                        aria-label="Quitar archivo"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 transition-all duration-150"
                    style={{
                      borderColor: 'var(--border-mid)',
                      background: 'var(--surface-2)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <Upload size={20} style={{ color: 'var(--brand-accent)' }} />
                    <span className="text-sm font-medium">
                      Selecciona el comprobante
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      JPG, PNG, WEBP o PDF — máx 10 MB
                    </span>
                  </button>
                )}

                {voucherFile && (
                  <Button
                    onClick={submitVoucher}
                    loading={submittingVoucher}
                    variant="forest"
                    className="mt-4 w-full"
                  >
                    {voucher ? 'Reemplazar Comprobante' : 'Enviar Comprobante'}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Voucher visible cuando ya está confirmada */}
          {reservation.status === 'CONFIRMED' && voucher && voucherBrowserUrl && (
            <div
              className="rounded-2xl p-6"
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}
            >
              <h2 className="font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <CheckCircle2 size={16} style={{ color: 'var(--color-success)' }} />
                Comprobante de pago
              </h2>
              <VoucherViewer
                url={voucherBrowserUrl}
                minioKey={voucher.minio_key}
                variant="full"
              />
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
