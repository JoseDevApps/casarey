import Image from 'next/image'
import Link from 'next/link'
import { MapPin } from 'lucide-react'
import type { Property } from '@/types/index'
import { formatCurrency, getImageUrl } from '@/lib/utils'

interface PropertyCardProps {
  property: Property
}

export function PropertyCard({ property }: PropertyCardProps) {
  const firstImage = property.images?.[0]
  const imageUrl = firstImage
    ? getImageUrl(firstImage.minio_key)
    : null

  return (
    <Link href={`/properties/${property.id}`} className="block group">
      <article
        className="card overflow-hidden transition-all duration-200 group-hover:border-[var(--border-mid)]"
        style={{ background: 'var(--surface-1)' }}
      >
        {/* Image */}
        <div className="relative aspect-video overflow-hidden bg-[var(--surface-2)]">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={property.name}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                Sin imagen
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col gap-2">
          <h3
            className="font-semibold text-base leading-snug line-clamp-1"
            style={{ color: 'var(--text-primary)' }}
          >
            {property.name}
          </h3>

          {property.address && (
            <div
              className="flex items-center gap-1.5 text-sm"
              style={{ color: 'var(--text-secondary)' }}
            >
              <MapPin size={13} className="shrink-0" />
              <span className="line-clamp-1">{property.address}</span>
            </div>
          )}

          <div
            className="text-sm mt-1"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <span>1 noche: </span>
            <span style={{ color: 'var(--brand-accent)' }} className="font-medium">
              {formatCurrency(property.rate_night_1)}
            </span>
            <span> &bull; Niño: </span>
            <span style={{ color: 'var(--brand-accent)' }} className="font-medium">
              {formatCurrency(property.rate_child)}
            </span>
            <span> &bull; 3+ noches: </span>
            <span style={{ color: 'var(--brand-accent)' }} className="font-medium">
              {formatCurrency(property.rate_night_3)}
            </span>
            <span> / noche</span>
          </div>

          <div
            className="btn-forest text-center text-sm mt-2"
            style={{
              background: 'var(--brand-primary)',
              color: 'var(--text-primary)',
              fontWeight: 600,
              borderRadius: 'var(--radius-md)',
              padding: '8px 16px',
            }}
          >
            Ver detalles
          </div>
        </div>
      </article>
    </Link>
  )
}
