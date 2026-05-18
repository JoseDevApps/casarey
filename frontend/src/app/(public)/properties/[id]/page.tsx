import { notFound } from 'next/navigation'
import { Clock, Users, MapPin, Film } from 'lucide-react'
import type { Property, CalendarEntry } from '@/types/index'
import { formatCurrency, getImageUrl } from '@/lib/utils'
import { BookingForm } from './booking-form'
import { PropertyImageCarousel } from '@/components/property-image-carousel'

async function getProperty(id: string): Promise<Property | null> {
  try {
    const base = process.env.BACKEND_URL || 'http://localhost:8100'
    const res = await fetch(`${base}/properties/${id}`, {
      next: { revalidate: 60 },
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

async function getCalendar(id: string): Promise<CalendarEntry[]> {
  try {
    const base = process.env.BACKEND_URL || 'http://localhost:8100'
    const res = await fetch(`${base}/properties/${id}/calendar`, {
      next: { revalidate: 60 },
    })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const property = await getProperty(id)
  return {
    title: property ? `${property.name} — Cabañas Coroico` : 'Propiedad',
  }
}

export default async function PropertyDetailPage({ params }: Props) {
  const { id } = await params
  const [property, calendar] = await Promise.all([
    getProperty(id),
    getCalendar(id),
  ])

  if (!property) notFound()

  const occupiedDates = calendar
    .filter((e) => e.status === 'BOOKED')
    .map((e) => e.date)

  const blockedDates = calendar
    .filter((e) => e.status === 'BLOCKED')
    .map((e) => e.date)

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <PropertyImageCarousel images={property.images || []} propertyName={property.name} />

      <div className="flex flex-col gap-10">
        <div>
          <h1
            className="text-3xl sm:text-4xl font-bold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            {property.name}
          </h1>


          {property.address && (
            <div
              className="flex items-center gap-2 mb-5 text-sm"
              style={{ color: 'var(--text-secondary)' }}
            >
              <MapPin size={15} />
              <span>{property.address}</span>
            </div>
          )}

          {/* Quick stats */}
          <div className="flex flex-wrap gap-3 mb-6">
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
              style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
            >
              <Users size={15} />
              Máx. {property.max_guests} huéspedes
            </div>
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
              style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
            >
              <Clock size={15} />
              Check-in: {property.checkin_time}
            </div>
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
              style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
            >
              <Clock size={15} />
              Check-out: {property.checkout_time}
            </div>
          </div>

          {/* Description */}
          {property.description && (
            <div className="mb-8">
              <h2
                className="text-lg font-semibold mb-3"
                style={{ color: 'var(--text-primary)' }}
              >
                Descripción
              </h2>
              <p
                className="text-sm leading-relaxed whitespace-pre-wrap"
                style={{ color: 'var(--text-secondary)' }}
              >
                {property.description}
               </p>
             </div>
            )}
 
            <div className="mb-8 max-w-2xl">
              <BookingForm
                property={property}
                occupiedDates={occupiedDates}
                blockedDates={blockedDates}
              />
            </div>
 
            {/* Rates */}
            <div
             className="rounded-xl p-5 mb-8"
            style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border-soft)',
            }}
          >
            <h2
              className="text-base font-semibold mb-4"
              style={{ color: 'var(--text-primary)' }}
            >
              Tarifas por tramo de noches
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-sm mb-1" style={{ color: 'var(--text-tertiary)' }}>
                  Niño (cualquier tramo)
                </p>
                <p className="text-2xl font-bold" style={{ color: 'var(--brand-accent)' }}>
                  {formatCurrency(property.rate_child)}
                </p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: 'var(--text-tertiary)' }}>
                  Estancia de 1 noche
                </p>
                <p className="text-2xl font-bold" style={{ color: 'var(--brand-accent)' }}>
                  {formatCurrency(property.rate_night_1)}
                </p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: 'var(--text-tertiary)' }}>
                  Estancia de 2 noches
                </p>
                <p className="text-2xl font-bold" style={{ color: 'var(--brand-accent)' }}>
                  {formatCurrency(property.rate_night_2)}
                </p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: 'var(--text-tertiary)' }}>
                  Estancia de 3+ noches
                </p>
                <p className="text-2xl font-bold" style={{ color: 'var(--brand-accent)' }}>
                  {formatCurrency(property.rate_night_3)}
                </p>
              </div>
            </div>
          </div>

          {/* Video — solo si está READY. preload="metadata" baja sólo la
              cabecera (~30 KB); el clip completo se descarga cuando el
              visitante pulse play. Cero data quemada hasta que la pidan. */}
          {property.video_status === 'READY' && property.video_minio_key && (
            <div className="mb-8">
              <h2
                className="text-lg font-semibold mb-3 flex items-center gap-2"
                style={{ color: 'var(--text-primary)' }}
              >
                <Film size={16} style={{ color: 'var(--brand-accent)' }} />
                Recorrido en video
              </h2>
              <div
                className="relative w-full rounded-2xl overflow-hidden ring-1 ring-[var(--border-soft)]"
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
        </div>
      </div>
    </div>
  )
}
