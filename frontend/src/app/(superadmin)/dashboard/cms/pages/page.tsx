'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { FileText, Save } from 'lucide-react'
import { apiFetch } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'

interface StaticPage { id: string; slug: string; content: string }

const PAGES = [
  { slug: 'terms', label: 'Términos y Condiciones' },
  { slug: 'privacy', label: 'Política de Privacidad' },
  { slug: 'contact', label: 'Información de Contacto' },
]

function PageEditor({ slug, label }: { slug: string; label: string }) {
  const { data, mutate } = useSWR<StaticPage>(`/api/cms/pages/${slug}`, (url: string) => apiFetch<StaticPage>(url))
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (data) setContent(data.content)
  }, [data])

  async function handleSave() {
    setLoading(true)
    try {
      await apiFetch(`/api/cms/pages/${slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      toast(`${label} guardado`, 'success')
      mutate()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl p-6" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText size={16} style={{ color: 'var(--brand-accent)' }} />
          <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</h2>
        </div>
        <Button variant="forest" size="sm" onClick={handleSave} loading={loading}>
          <Save size={14} /> Guardar
        </Button>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={12}
        className="input-field resize-y font-mono text-xs leading-relaxed"
        placeholder={`Contenido de ${label}...`}
        style={{ minHeight: '200px' }}
      />
    </div>
  )
}

export default function StaticPagesPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Páginas estáticas</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Edita los textos legales y de contacto del sitio
        </p>
      </div>
      <div className="flex flex-col gap-6">
        {PAGES.map((p) => (
          <PageEditor key={p.slug} slug={p.slug} label={p.label} />
        ))}
      </div>
    </div>
  )
}
