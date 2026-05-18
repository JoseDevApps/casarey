import type { Property } from '@/types/index'
import { PropertiesClient } from '@/components/properties-client'

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

      <PropertiesClient properties={properties} />
    </div>
  )
}
