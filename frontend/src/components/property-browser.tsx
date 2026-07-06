'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import { PropertyCard } from './property-card'
import { PropertyModal } from './property-modal'
import type { Property } from '@/types/index'

interface PropertyBrowserProps {
  properties: Property[]
}

/**
 * Explorador de cabañas embebido en la home. Muestra todas las propiedades en
 * grilla y abre el detalle en un modal (sin salir de /). Es la pieza que vuelve
 * la landing un SPA: el cliente final navega y decide sin cambiar de ruta.
 */
export function PropertyBrowser({ properties }: PropertyBrowserProps) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Property | null>(null)
  const [open, setOpen] = useState(false)

  const filtered = properties.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleSelect = (property: Property) => {
    setSelected(property)
    setOpen(true)
  }

  if (properties.length === 0) {
    return (
      <div
        className="text-center py-16 rounded-xl"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}
      >
        <p className="text-lg font-medium" style={{ color: 'var(--text-secondary)' }}>
          Pronto tendremos cabañas disponibles
        </p>
        <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
          Vuelve pronto para descubrir nuevos refugios en Coroico.
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Búsqueda */}
      <div className="relative mb-8 max-w-md">
        <Search
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: 'var(--text-muted)' }}
        />
        <input
          type="text"
          placeholder="Busca tu cabaña por nombre..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-12"
          aria-label="Buscar cabañas"
        />
      </div>

      {filtered.length === 0 ? (
        <div
          className="text-center py-14 rounded-xl"
          style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}
        >
          <p className="text-base font-medium" style={{ color: 'var(--text-secondary)' }}>
            No encontramos cabañas para “{search}”
          </p>
          <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
            Prueba con otro nombre.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              onSelect={handleSelect}
            />
          ))}
        </div>
      )}

      <PropertyModal property={selected} open={open} onOpenChange={setOpen} />
    </>
  )
}
