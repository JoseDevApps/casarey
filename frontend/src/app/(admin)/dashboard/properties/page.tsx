'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { Plus, Pencil, Users, MapPin } from 'lucide-react'
import type { Property, Paginated } from '@/types/index'
import { apiFetch } from '@/lib/api-client'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'

function fetcher(url: string) {
  return apiFetch<Paginated<Property>>(url)
}

export default function AdminPropertiesPage() {
  const { data, error, isLoading } = useSWR('/api/properties', fetcher)
  const properties = data?.items

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Propiedades
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Gestiona las propiedades disponibles
          </p>
        </div>
        <Link href="/dashboard/properties/new">
          <Button variant="primary" size="md">
            <Plus size={16} />
            Nueva Propiedad
          </Button>
        </Link>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: 'var(--surface-1)' }} />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl p-6 text-sm text-center" style={{ background: 'rgba(220,80,80,0.08)', border: '1px solid rgba(220,80,80,0.2)', color: 'var(--color-error)' }}>
          Error al cargar propiedades.
        </div>
      )}

      {properties && properties.length === 0 && (
        <div className="rounded-xl p-12 text-center" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}>
          <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>No hay propiedades registradas.</p>
          <Link href="/dashboard/properties/new" className="btn-primary inline-flex items-center gap-2 text-sm mt-4">
            <Plus size={14} /> Crear primera propiedad
          </Link>
        </div>
      )}

      {properties && properties.length > 0 && (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}
        >
          {/* Table header */}
          <div
            className="grid grid-cols-[1fr_140px_140px_100px_100px] gap-4 px-5 py-3 text-xs font-medium uppercase tracking-wider"
            style={{ borderBottom: '1px solid var(--border-soft)', color: 'var(--text-muted)' }}
          >
            <span>Propiedad</span>
            <span>Tarifa Adulto</span>
            <span>Tarifa Niño</span>
            <span>Estado</span>
            <span>Acciones</span>
          </div>

          {properties.map((property, idx) => (
            <div
              key={property.id}
              className="grid grid-cols-[1fr_140px_140px_100px_100px] gap-4 px-5 py-4 items-center text-sm"
              style={{
                borderBottom: idx < properties.length - 1 ? '1px solid var(--border-soft)' : 'none',
              }}
            >
              <div className="min-w-0">
                <p className="font-semibold line-clamp-1" style={{ color: 'var(--text-primary)' }}>
                  {property.name}
                </p>
                {property.address && (
                  <p className="flex items-center gap-1 text-xs mt-0.5 line-clamp-1" style={{ color: 'var(--text-muted)' }}>
                    <MapPin size={11} /> {property.address}
                  </p>
                )}
                <p className="flex items-center gap-1 text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  <Users size={11} /> Máx. {property.max_guests}
                </p>
              </div>
              <span style={{ color: 'var(--brand-accent)' }}>{formatCurrency(property.rate_adult)}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{formatCurrency(property.rate_child)}</span>
              <span>
                {property.is_active ? (
                  <span className="badge-approved">Activa</span>
                ) : (
                  <span className="badge-cancelled">Inactiva</span>
                )}
              </span>
              <div className="flex items-center gap-2">
                <Link href={`/dashboard/properties/${property.id}`}>
                  <Button variant="ghost" size="sm">
                    <Pencil size={13} />
                  </Button>
                </Link>
                <Link href={`/dashboard/calendar/${property.id}`}>
                  <Button variant="ghost" size="sm" title="Ver calendario">
                    Cal
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
