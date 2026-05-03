'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Plus, Pencil, Trash2, CreditCard } from 'lucide-react'
import type { PaymentMethod } from '@/types/index'
import { apiFetch } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FileUploader } from '@/components/file-uploader'
import { useToast } from '@/components/ui/toast'

function fetcher(url: string) {
  return apiFetch<PaymentMethod[]>(url)
}

interface MethodForm {
  name: string
  description: string
  minio_key: string
  is_active: boolean
}

const EMPTY_FORM: MethodForm = {
  name: '',
  description: '',
  minio_key: '',
  is_active: true,
}

export default function AdminPaymentsPage() {
  const { toast } = useToast()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<MethodForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const { data: methods, error, isLoading, mutate } = useSWR(
    '/api/payment-methods',
    fetcher
  )

  function openNew() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEdit(method: PaymentMethod) {
    setEditingId(method.id)
    setForm({
      name: method.name,
      description: method.description ?? '',
      minio_key: method.minio_key ?? '',
      is_active: method.is_active,
    })
    setShowForm(true)
  }

  function cancel() {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast('El nombre es requerido', 'warning')
      return
    }
    setSaving(true)
    try {
      if (editingId) {
        await apiFetch(`/api/payment-methods/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        toast('Método de pago actualizado', 'success')
      } else {
        await apiFetch('/api/payment-methods', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        toast('Método de pago creado', 'success')
      }
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
              <p className="text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Imagen QR (opcional)
              </p>
              <FileUploader
                onUpload={(_, key) => setForm({ ...form, minio_key: key })}
                label="Subir código QR"
                currentImageUrl={form.minio_key ? undefined : undefined}
              />
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
            <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: 'var(--surface-1)' }} />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl p-6 text-sm text-center" style={{ background: 'rgba(220,80,80,0.08)', border: '1px solid rgba(220,80,80,0.2)', color: 'var(--color-error)' }}>
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
              className="flex items-start justify-between gap-4 rounded-2xl p-5"
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}
            >
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
