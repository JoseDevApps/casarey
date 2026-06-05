'use client'

import { useRef, useState } from 'react'
import useSWR from 'swr'
import Image from 'next/image'
import { Plus, Pencil, Trash2, CreditCard, Upload, X } from 'lucide-react'
import type { PaymentMethod } from '@/types/index'
import { apiFetch } from '@/lib/api-client'
import { getImageUrl } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'

function fetcher(url: string) {
  return apiFetch<{ items: PaymentMethod[]; total: number }>(url)
}

interface MethodForm {
  name: string
  description: string
  is_active: boolean
}

const EMPTY_FORM: MethodForm = {
  name: '',
  description: '',
  is_active: true,
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5 MB (matches backend)

export default function AdminPaymentsPage() {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<MethodForm>(EMPTY_FORM)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const { data, error, isLoading, mutate } = useSWR(
    '/api/payment-methods',
    fetcher
  )
  const methods = data?.items

  function openNew() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    clearImageState()
    setShowForm(true)
  }

  function openEdit(method: PaymentMethod) {
    setEditingId(method.id)
    setForm({
      name: method.name,
      description: method.description ?? '',
      is_active: method.is_active,
    })
    clearImageState()
    setCurrentImageUrl(
      method.minio_key ? getImageUrl(method.minio_key, 'payment-methods') : null
    )
    setShowForm(true)
  }

  function clearImageState() {
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImageFile(null)
    setImagePreview(null)
    setCurrentImageUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function selectFile(file: File | null) {
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    if (!file) {
      setImageFile(null)
      setImagePreview(null)
      return
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast('Formato no permitido (jpg, png, webp)', 'error')
      return
    }
    if (file.size > MAX_IMAGE_SIZE) {
      toast('La imagen excede 5 MB', 'error')
      return
    }
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  function cancel() {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    clearImageState()
  }

  async function uploadImage(methodId: string, file: File) {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`/api/payment-methods/${methodId}/image`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      const detail = (err as { detail?: { detail?: string } | string }).detail
      const message =
        typeof detail === 'string'
          ? detail
          : detail?.detail || 'Error al subir la imagen'
      throw new Error(message)
    }
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast('El nombre es requerido', 'warning')
      return
    }
    setSaving(true)
    try {
      let methodId: string
      if (editingId) {
        await apiFetch(`/api/payment-methods/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        methodId = editingId
      } else {
        const created = await apiFetch<PaymentMethod>('/api/payment-methods', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            description: form.description || null,
          }),
        })
        methodId = created.id
      }

      if (imageFile) {
        await uploadImage(methodId, imageFile)
      }

      toast(
        editingId ? 'Método de pago actualizado' : 'Método de pago creado',
        'success'
      )
      mutate()
      cancel()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este método de pago?')) return
    try {
      await apiFetch(`/api/payment-methods/${id}`, { method: 'DELETE' })
      toast('Método eliminado', 'info')
      mutate()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error', 'error')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Métodos de Pago
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            QR, transferencias y cuentas bancarias
          </p>
        </div>
        {!showForm && (
          <Button variant="primary" size="md" onClick={openNew}>
            <Plus size={16} />
            Nuevo Método
          </Button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div
          className="rounded-2xl p-6 mb-6"
          style={{ background: 'var(--surface-1)', border: '1px solid var(--border-mid)' }}
        >
          <h2 className="font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>
            {editingId ? 'Editar Método' : 'Nuevo Método de Pago'}
          </h2>
          <div className="flex flex-col gap-4 max-w-lg">
            <Input
              id="pm_name"
              label="Nombre"
              placeholder="Transferencia QR Banco X"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Textarea
              id="pm_description"
              label="Instrucciones / descripción"
              placeholder="Número de cuenta, alias, instrucciones..."
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />

            <div>
              <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                Imagen QR (opcional)
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_IMAGE_TYPES.join(',')}
                className="hidden"
                onChange={(e) => selectFile(e.target.files?.[0] ?? null)}
              />

              {imagePreview || currentImageUrl ? (
                <div
                  className="rounded-xl p-3 flex items-center gap-3"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)' }}
                >
                  <div
                    className="relative w-20 h-20 rounded-lg overflow-hidden shrink-0"
                    style={{ background: 'var(--surface-3)' }}
                  >
                    <Image
                      src={imagePreview ?? currentImageUrl ?? ''}
                      alt="QR del método"
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {imageFile?.name ?? 'Imagen actual'}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {imageFile
                        ? `${(imageFile.size / 1024).toFixed(1)} KB · se reemplazará al guardar`
                        : 'Sin cambios'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-1.5 rounded-lg"
                      style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)' }}
                      aria-label="Cambiar imagen"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => selectFile(null)}
                      className="p-1.5 rounded-lg"
                      style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)' }}
                      aria-label="Quitar imagen"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 transition-all duration-150"
                  style={{
                    borderColor: 'var(--border-mid)',
                    background: 'var(--surface-2)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <Upload size={20} style={{ color: 'var(--brand-accent)' }} />
                  <span className="text-sm font-medium">Selecciona una imagen</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    JPG, PNG o WEBP — máx 5 MB
                  </span>
                </button>
              )}
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 accent-[var(--brand-accent)]"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Activo (visible para clientes)
              </span>
            </label>

            <div className="flex gap-3 mt-2">
              <Button variant="primary" onClick={handleSave} loading={saving}>
                {editingId ? 'Guardar Cambios' : 'Crear Método'}
              </Button>
              <Button variant="ghost" onClick={cancel}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 rounded-xl skeleton" style={{ background: 'var(--surface-1)' }} />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl p-6 text-sm text-center" style={{ background: 'rgba(186,26,26,0.08)', border: '1px solid rgba(186,26,26,0.22)', color: 'var(--color-error)' }}>
          Error al cargar métodos.
        </div>
      )}

      {methods && methods.length === 0 && !showForm && (
        <div className="rounded-xl p-12 text-center" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}>
          <CreditCard size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-secondary)' }}>No hay métodos de pago configurados.</p>
        </div>
      )}

      {methods && methods.length > 0 && (
        <div className="flex flex-col gap-3">
          {methods.map((method) => (
            <div
              key={method.id}
              className="flex items-start gap-4 rounded-2xl p-5"
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}
            >
              {method.minio_key ? (
                <div
                  className="relative w-16 h-16 rounded-lg overflow-hidden shrink-0"
                  style={{ background: 'var(--surface-2)' }}
                >
                  <Image
                    src={getImageUrl(method.minio_key, 'payment-methods')}
                    alt={`QR ${method.name}`}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div
                  className="w-16 h-16 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'var(--surface-2)' }}
                >
                  <CreditCard size={22} style={{ color: 'var(--text-muted)' }} />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {method.name}
                  </p>
                  {method.is_active ? (
                    <span className="badge-approved">Activo</span>
                  ) : (
                    <span className="badge-cancelled">Inactivo</span>
                  )}
                </div>
                {method.description && (
                  <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                    {method.description}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button variant="ghost" size="sm" onClick={() => openEdit(method)}>
                  <Pencil size={13} />
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(method.id)}>
                  <Trash2 size={13} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
