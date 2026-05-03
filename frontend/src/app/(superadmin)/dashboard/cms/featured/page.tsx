'use client'

import useSWR from 'swr'
import { Star, X, Plus } from 'lucide-react'
import type { Property } from '@/types/index'
import { apiFetch } from '@/lib/api-client'
import { useToast } from '@/components/ui/toast'

interface FeaturedEntry { property_id: string; sort_order: number; property?: Property }

function fetcher(url: string) { return apiFetch<any>(url) }

export default function FeaturedPage() {
  const { data: featuredData, mutate: mutateFeatured } = useSWR('/api/cms/featured', fetcher)
  const { data: allProps } = useSWR('/api/properties', fetcher)
  const { toast } = useToast()

  const featured: FeaturedEntry[] = featuredData?.items ?? featuredData ?? []
  const featuredIds: string[] = featured.map((f: FeaturedEntry) => f.property_id)
  const notFeatured: Property[] = (allProps?.items ?? allProps ?? []).filter(
    (p: Property) => !featuredIds.includes(p.id)
  )

  async function addFeatured(propertyId: string) {
    try {
      await apiFetch('/api/cms/featured', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: propertyId }),
      })
      toast('Propiedad destacada', 'success')
      mutateFeatured()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error', 'error')
    }
  }

  async function removeFeatured(propertyId: string) {
    try {
      await apiFetch(`/api/cms/featured/${propertyId}`, { method: 'DELETE' })
      toast('Eliminada de destacadas', 'info')
      mutateFeatured()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error', 'error')
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Propiedades Destacadas</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Selecciona qué propiedades aparecen en la sección destacada de la landing page
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Currently featured */}
        <div>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--brand-accent)' }}>
            <Star size={14} /> Actualmente destacadas
          </h2>
          {featured.length === 0 && (
            <div className="rounded-xl p-8 text-center" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Ninguna propiedad destacada</p>
            </div>
          )}
          <div className="flex flex-col gap-2">
            {featured.map((f: FeaturedEntry) => (
              <div key={f.property_id} className="flex items-center justify-between gap-3 rounded-xl px-4 py-3" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}>
                <div className="flex items-center gap-2">
                  <Star size={13} style={{ color: 'var(--brand-accent)' }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {f.property?.name ?? f.property_id.slice(0, 12)}
                  </span>
                </div>
                <button onClick={() => removeFeatured(f.property_id)} className="p-1 rounded-lg transition-opacity hover:opacity-70" style={{ color: 'var(--color-error)' }}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Not yet featured */}
        <div>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-tertiary)' }}>
            <Plus size={14} /> Agregar a destacadas
          </h2>
          {notFeatured.length === 0 && (
            <div className="rounded-xl p-8 text-center" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Todas las propiedades ya están destacadas</p>
            </div>
          )}
          <div className="flex flex-col gap-2">
            {notFeatured.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl px-4 py-3" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{p.name}</span>
                <button onClick={() => addFeatured(p.id)} className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors" style={{ background: 'var(--surface-3)', color: 'var(--brand-accent)', border: '1px solid var(--border-mid)' }}>
                  <Plus size={12} /> Destacar
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
