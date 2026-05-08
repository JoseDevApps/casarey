import { notFound } from 'next/navigation'
import Image from 'next/image'
import { Clock, Users, MapPin } from 'lucide-react'
import type { Property, CalendarEntry } from '@/types/index'
import { formatCurrency, getImageUrl } from '@/lib/utils'
import { BookingForm } from './booking-form'

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

  const sortedImages = [...(property.images || [])].sort(
    (a, b) => a.sort_order - b.sort_order
  )
  const mainImage = sortedImages[0]
  const restImages = sortedImages.slice(1, 5)

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      {/* Image gallery */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-8 rounded-2xl overflow-hidden">
        <div className="relative col-span-2 row-span-2" style={{ aspectRatio: '16/9' }}>
          {mainImage ? (
            <Image
              src={getImageUrl(mainImage.minio_key)}
              alt={property.name}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 66vw"
              className="object-cover"
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: 'var(--surface-2)' }}
            >
              <span style={{ color: 'var(--text-muted)' }}>Sin imagen</span>
            </div>
          )}
        </div>
        {restImages.map((img) => (
          <div key={img.id} className="relative" style={{ aspectRatio: '4/3' }}>
            <Image
              src={getImageUrl(img.minio_key)}
              alt={`${property.name} - imagen`}
              fill
              sizes="(max-width: 768px) 50vw, 20vw"
              className="object-cover"
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-10">
        {/* Left column */}
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
              Tarifas por noche
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm mb-1" style={{ color: 'var(--text-tertiary)' }}>
                  Adultos
                </p>
                <p className="text-2xl font-bold" style={{ color: 'var(--brand-accent)' }}>
                  {formatCurrency(property.rate_adult)}
                </p>
              </div>
              <div>
                <p className="text-sm mb-1" style={{ color: 'var(--text-tertiary)' }}>
                  Niños
                </p>
                <p className="text-2xl font-bold" style={{ color: 'var(--brand-accent)' }}>
                  {formatCurrency(property.rate_child)}
                </p>
              </div>
            </div>
          </div>

          {/* Calendar section */}
          <div className="mb-4">
            <h2
              className="text-lg font-semibold mb-1"
              style={{ color: 'var(--text-primary)' }}
            >
              Disponibilidad
            </h2>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              Selecciona las fechas de tu estadía directamente en el formulario.
            </p>
          </div>
        </div>

        {/* Booking form (right column) */}
        <div className="lg:sticky lg:top-24 self-start">
          <BookingForm
            property={property}
            occupiedDates={occupiedDates}
            blockedDates={blockedDates}
          />
        </div>
      </div>
    </div>
  )
}
