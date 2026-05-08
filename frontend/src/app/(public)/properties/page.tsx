import type { Property } from '@/types/index'
import { PropertyCard } from '@/components/property-card'

async function getProperties(): Promise<Property[]> {
  try {
    const base = process.env.BACKEND_URL || 'http://localhost:8100'
    const res = await fetch(`${base}/properties?page_size=50`, {
      next: { revalidate: 60 },
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.items ?? data
  } catch {
    return []
  }
}

export const metadata = {
  title: 'Propiedades — Cabañas Coroico',
}

export default async function PropertiesPage() {
  const properties = await getProperties()

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-10">
        <p
          className="text-sm font-medium uppercase tracking-wider mb-2"
          style={{ color: 'var(--brand-accent)' }}
        >
          Disponibles ahora
        </p>
        <h1
          className="text-3xl sm:text-4xl font-bold"
          style={{ color: 'var(--text-primary)' }}
        >
          Todas las Propiedades
        </h1>
      </div>

      {properties.length === 0 ? (
        <div
          className="text-center py-20 rounded-xl"
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border-soft)',
          }}
        >
          <p className="text-lg font-medium" style={{ color: 'var(--text-secondary)' }}>
            No hay propiedades disponibles en este momento.
          </p>
          <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
            Vuelve pronto para ver nuevas opciones.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
      )}
    </div>
  )
}
