'use client'

import { useState, useRef } from 'react'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { PropertyCard } from './property-card'
import type { Property } from '@/types/index'

interface PropertiesClientProps {
  properties: Property[]
}

export function PropertiesClient({ properties }: PropertiesClientProps) {
  const [search, setSearch] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const filtered = properties.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const scroll = (dir: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current
      scrollRef.current.scrollTo({
        left:
          dir === 'left'
            ? scrollLeft - clientWidth / 1.5
            : scrollLeft + clientWidth / 1.5,
        behavior: 'smooth',
      })
    }
  }

  return (
    <>
      {/* ─── Search Bar ─── */}
      <div className="relative mb-8">
        <Search
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: 'var(--text-muted)' }}
        />
        <input
          type="text"
          placeholder="Buscar por nombre..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-12"
        />
      </div>

      {filtered.length === 0 ? (
        <div
          className="text-center py-20 rounded-xl"
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border-soft)',
          }}
        >
          <p className="text-lg font-medium" style={{ color: 'var(--text-secondary)' }}>
            {properties.length === 0
              ? 'No hay propiedades disponibles en este momento.'
              : `No se encontraron propiedades para "${search}"`}
          </p>
          <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
            {properties.length === 0
              ? 'Vuelve pronto para ver nuevas opciones.'
              : 'Intenta con otro término de búsqueda.'}
          </p>
        </div>
      ) : (
        <>
          {/* ─── Mobile: Carousel ─── */}
          <div className="relative md:hidden">
            <button
              onClick={() => scroll('left')}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white shadow-md border border-gray-200 text-gray-600 hover:text-black transition-all"
              aria-label="Anterior"
            >
              <ChevronLeft size={20} />
            </button>

            <div
              ref={scrollRef}
              className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2"
            >
              {filtered.map((property) => (
                <div
                  key={property.id}
                  className="snap-start shrink-0 w-[280px] sm:w-[320px]"
                >
                  <PropertyCard property={property} />
                </div>
              ))}
            </div>

            <button
              onClick={() => scroll('right')}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white shadow-md border border-gray-200 text-gray-600 hover:text-black transition-all"
              aria-label="Siguiente"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* ─── Desktop: Grid ─── */}
          <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        </>
      )}
    </>
  )
}
