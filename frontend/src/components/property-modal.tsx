'use client'

import * as Dialog from '@radix-ui/react-dialog'
import Link from 'next/link'
import { X, Users, Clock, MapPin, ArrowRight, Film } from 'lucide-react'
import type { Property } from '@/types/index'
import { formatCurrency, getImageUrl } from '@/lib/utils'
import { PropertyImageCarousel } from '@/components/property-image-carousel'

interface PropertyModalProps {
  property: Property | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Detalle de propiedad in-place (sin salir de la home). Muestra imágenes,
 * descripción, tarifas y video. El CTA "Reservar" lleva al formulario de reserva
 * existente con navegación client-side.
 */
export function PropertyModal({ property, open, onOpenChange }: PropertyModalProps) {
  if (!property) return null

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-[60] data-[state=open]:animate-[fadeIn_300ms_ease-out]"
          style={{ background: 'rgba(0,0,0,0.82)' }}
        />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[70]
                     outline-none w-[calc(100vw-24px)] sm:w-[min(92vw,760px)]
                     max-h-[92vh] overflow-y-auto rounded-2xl
                     data-[state=open]:animate-[dialogIn_320ms_cubic-bezier(0.22,0.61,0.36,1)]"
          aria-describedby={undefined}
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border-mid)',
            boxShadow:
              '0 36px 78px -44px rgba(171,54,0,0.45), 0 0 0 1px rgba(255,255,255,0.78)',
          }}
        >
          {/* Close */}
          <Dialog.Close
            className="absolute right-3 top-3 z-10 w-9 h-9 rounded-full flex items-center justify-center transition-colors"
            aria-label="Cerrar"
            style={{
              background: 'rgba(0,0,0,0.45)',
              color: 'var(--color-bone, #fff)',
              border: '1px solid rgba(255,255,255,0.18)',
            }}
          >
            <X size={18} />
          </Dialog.Close>

          <div className="p-4 sm:p-6">
            <PropertyImageCarousel
              images={property.images || []}
              propertyName={property.name}
            />

            <Dialog.Title
              className="font-serif text-2xl sm:text-3xl font-bold mb-2"
              style={{ color: 'var(--text-primary)' }}
            >
              {property.name}
            </Dialog.Title>

            {property.address && (
              <div
                className="flex items-center gap-2 mb-5 text-sm"
                style={{ color: 'var(--text-secondary)' }}
              >
                <MapPin size={15} />
                <span>{property.address}</span>
              </div>
            )}

            {/* Stats */}
            <div className="flex flex-wrap gap-2.5 mb-6">
              <span
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm"
                style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
              >
                <Users size={15} />
                Máx. {property.max_guests} huéspedes
              </span>
              <span
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm"
                style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
              >
                <Clock size={15} />
                Check-in {property.checkin_time}
              </span>
              <span
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm"
                style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
              >
                <Clock size={15} />
                Check-out {property.checkout_time}
              </span>
            </div>

            {/* Description */}
            {property.description && (
              <p
                className="text-sm leading-relaxed whitespace-pre-wrap mb-6"
                style={{ color: 'var(--text-secondary)' }}
              >
                {property.description}
              </p>
            )}

            {/* Rates */}
            <div
              className="rounded-xl p-5 mb-6"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border-soft)',
              }}
            >
              <h3
                className="text-sm font-semibold mb-4"
                style={{ color: 'var(--text-primary)' }}
              >
                Tarifas por tramo de noches
              </h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Niño', value: property.rate_child },
                  { label: '1 noche', value: property.rate_night_1 },
                  { label: '2 noches', value: property.rate_night_2 },
                  { label: '3+ noches', value: property.rate_night_3 },
                ].map((r) => (
                  <div key={r.label}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
                      {r.label}
                    </p>
                    <p
                      className="text-xl font-bold"
                      style={{ color: 'var(--brand-accent)' }}
                    >
                      {formatCurrency(r.value)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Video */}
            {property.video_status === 'READY' && property.video_minio_key && (
              <div className="mb-6">
                <h3
                  className="text-sm font-semibold mb-3 flex items-center gap-2"
                  style={{ color: 'var(--text-primary)' }}
                >
                  <Film size={15} style={{ color: 'var(--brand-accent)' }} />
                  Recorrido en video
                </h3>
                <div
                  className="relative w-full rounded-xl overflow-hidden ring-1 ring-[var(--border-soft)]"
                  style={{ aspectRatio: '16/9', background: 'var(--surface-2)' }}
                >
                  <video
                    controls
                    preload="metadata"
                    playsInline
                    poster={
                      property.video_poster_key
                        ? getImageUrl(property.video_poster_key, 'property-videos')
                        : undefined
                    }
                    src={getImageUrl(property.video_minio_key, 'property-videos')}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2.5">
              <Link
                href={`/properties/${property.id}`}
                className="flex-1 inline-flex items-center justify-center gap-2 text-base font-semibold px-6 py-3.5 rounded-xl transition-all duration-150"
                style={{
                  background: 'var(--brand-accent)',
                  color: 'var(--color-bone, rgb(249,244,230))',
                }}
                onClick={() => onOpenChange(false)}
              >
                Reservar esta cabaña
                <ArrowRight size={16} />
              </Link>
              <Dialog.Close className="btn-ghost inline-flex items-center justify-center gap-2 text-base font-medium px-6 py-3.5 rounded-xl">
                Seguir explorando
              </Dialog.Close>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
