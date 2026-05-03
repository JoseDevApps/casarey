'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Plus, Eye, EyeOff, Trash2, GripVertical } from 'lucide-react'
import type { CmsBanner, Paginated } from '@/types/index'
import { apiFetch } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { FileUploader } from '@/components/file-uploader'

function fetcher(url: string) {
  return apiFetch<Paginated<CmsBanner>>(url)
}

function NewBannerForm({ onSuccess }: { onSuccess: () => void }) {
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [minioKey, setMinioKey] = useState('')
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title) return
    setLoading(true)
    try {
      await apiFetch('/api/cms/banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, subtitle, minio_key: minioKey }),
      })
      toast('Banner creado', 'success')
      setTitle('')
      setSubtitle('')
      setMinioKey('')
      onSuccess()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl p-6 mb-6" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-mid)' }}>
      <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Nuevo banner</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs mb-1.5" style={{ color: 'var(--text-tertiary)' }}>Título *</label>
          <input className="input-field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bienvenido a Casas de Campo" required />
        </div>
        <div>
          <label className="block text-xs mb-1.5" style={{ color: 'var(--text-tertiary)' }}>Subtítulo</label>
          <input className="input-field" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Texto secundario opcional" />
        </div>
      </div>
      <div className="mt-4">
        <label className="block text-xs mb-1.5" style={{ color: 'var(--text-tertiary)' }}>Imagen del banner</label>
        <FileUploader onUpload={(url, key) => setMinioKey(key)} accept="image/*" />
      </div>
      <Button type="submit" variant="primary" loading={loading} className="mt-4">
        <Plus size={16} /> Crear banner
      </Button>
    </form>
  )
}

export default function BannersPage() {
  const { data, error, isLoading, mutate } = useSWR('/api/cms/banners', fetcher)
  const banners = data?.items
  const { toast } = useToast()

  async function toggleVisibility(banner: CmsBanner) {
    try {
      await apiFetch(`/api/cms/banners/${banner.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...banner, is_visible: !banner.is_visible }),
      })
      mutate()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error', 'error')
    }
  }

  async function deleteBanner(id: string) {
    if (!confirm('¿Eliminar este banner?')) return
    try {
      await apiFetch(`/api/cms/banners/${id}`, { method: 'DELETE' })
      toast('Banner eliminado', 'info')
      mutate()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error', 'error')
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Banners</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Gestiona la sección hero de la landing page</p>
      </div>

      <NewBannerForm onSuccess={mutate} />

      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2].map((i) => <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: 'var(--surface-1)' }} />)}
        </div>
      )}

      {error && (
        <div className="rounded-xl p-6 text-sm text-center" style={{ background: 'rgba(220,80,80,0.08)', border: '1px solid rgba(220,80,80,0.2)', color: 'var(--color-error)' }}>
          Error al cargar banners.
        </div>
      )}

      {banners && banners.length === 0 && (
        <div className="rounded-xl p-12 text-center" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Sin banners. Crea el primero.</p>
        </div>
      )}

      {banners && banners.length > 0 && (
        <div className="flex flex-col gap-3">
          {banners.map((b) => (
            <div key={b.id} className="flex items-center gap-4 rounded-xl px-5 py-4" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}>
              <GripVertical size={16} style={{ color: 'var(--text-muted)' }} className="flex-shrink-0 cursor-grab" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{b.title}</p>
                {b.subtitle && <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{b.subtitle}</p>}
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full ${b.is_visible ? 'badge-approved' : 'badge-cancelled'}`}>
                {b.is_visible ? 'Visible' : 'Oculto'}
              </span>
              <button onClick={() => toggleVisibility(b)} className="p-1.5 rounded-lg transition-colors hover:opacity-80" style={{ color: 'var(--text-secondary)' }}>
                {b.is_visible ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
              <button onClick={() => deleteBanner(b.id)} className="p-1.5 rounded-lg transition-colors hover:opacity-80" style={{ color: 'var(--color-error)' }}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
