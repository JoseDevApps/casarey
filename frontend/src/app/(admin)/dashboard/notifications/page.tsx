'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { MailCheck, MessageCircle } from 'lucide-react'
import type { AdminNotificationPreferences } from '@/types/index'
import { apiFetch } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'

interface FormState {
  notification_email: string
  notification_phone: string
  client_approved_subject: string
  client_approved_body: string
  client_rejected_subject: string
  client_rejected_body: string
  client_payment_received_subject: string
  client_payment_received_body: string
  client_payment_confirmed_subject: string
  client_payment_confirmed_body: string
}

const PLACEHOLDERS = [
  '{{cliente_nombre}}',
  '{{cliente_email}}',
  '{{propiedad_nombre}}',
  '{{fecha_entrada}}',
  '{{fecha_salida}}',
  '{{adultos}}',
  '{{ninos}}',
  '{{monto_total}}',
  '{{descuento}}',
  '{{monto_final}}',
  '{{url_panel_cliente}}',
  '{{url_propiedad}}',
]

function fetcher(url: string) {
  return apiFetch<AdminNotificationPreferences>(url)
}

function toForm(data: AdminNotificationPreferences): FormState {
  return {
    notification_email: data.notification_email ?? '',
    notification_phone: data.notification_phone ?? '',
    client_approved_subject: data.client_approved_subject,
    client_approved_body: data.client_approved_body,
    client_rejected_subject: data.client_rejected_subject,
    client_rejected_body: data.client_rejected_body,
    client_payment_received_subject: data.client_payment_received_subject,
    client_payment_received_body: data.client_payment_received_body,
    client_payment_confirmed_subject: data.client_payment_confirmed_subject,
    client_payment_confirmed_body: data.client_payment_confirmed_body,
  }
}

interface TemplateSectionProps {
  title: string
  subtitle: string
  subjectValue: string
  bodyValue: string
  onSubjectChange: (value: string) => void
  onBodyChange: (value: string) => void
}

function TemplateSection({
  title,
  subtitle,
  subjectValue,
  bodyValue,
  onSubjectChange,
  onBodyChange,
}: TemplateSectionProps) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}
    >
      <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
        {title}
      </h2>
      <p className="text-xs mt-1 mb-4" style={{ color: 'var(--text-tertiary)' }}>
        {subtitle}
      </p>

      <div className="flex flex-col gap-3">
        <Input
          label="Asunto"
          value={subjectValue}
          onChange={(e) => onSubjectChange(e.target.value)}
          placeholder="Asunto del correo"
          maxLength={200}
        />
        <Textarea
          label="Mensaje"
          rows={7}
          value={bodyValue}
          onChange={(e) => onBodyChange(e.target.value)}
          placeholder="Contenido del correo"
          maxLength={5000}
        />
      </div>
    </div>
  )
}

export default function AdminNotificationsPage() {
  const { toast } = useToast()
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)

  const { data, error, isLoading, mutate } = useSWR(
    '/api/notification-preferences',
    fetcher
  )

  useEffect(() => {
    if (data) setForm(toForm(data))
  }, [data])

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  async function handleSave() {
    if (!form) return

    const requiredFields: (keyof FormState)[] = [
      'client_approved_subject',
      'client_approved_body',
      'client_rejected_subject',
      'client_rejected_body',
      'client_payment_received_subject',
      'client_payment_received_body',
      'client_payment_confirmed_subject',
      'client_payment_confirmed_body',
    ]

    const missingField = requiredFields.find((field) => !form[field].trim())
    if (missingField) {
      toast('Completa todos los asuntos y mensajes antes de guardar.', 'warning')
      return
    }

    setSaving(true)
    try {
      const saved = await apiFetch<AdminNotificationPreferences>(
        '/api/notification-preferences',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...form,
            notification_email: form.notification_email.trim() || null,
            notification_phone: form.notification_phone.trim() || null,
          }),
        }
      )
      setForm(toForm(saved))
      mutate(saved, { revalidate: false })
      toast('Plantillas de notificación actualizadas.', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (error) {
    return (
      <div
        className="rounded-xl p-6 text-sm text-center"
        style={{
          background: 'rgba(186,26,26,0.08)',
          border: '1px solid rgba(186,26,26,0.22)',
          color: 'var(--color-error)',
        }}
      >
        Error al cargar la configuración de notificaciones.
      </div>
    )
  }

  if (isLoading || !form) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-36 rounded-xl skeleton"
            style={{ background: 'var(--surface-1)' }}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="mb-2">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Notificaciones
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Tus clientes reciben las novedades por WhatsApp; el correo funciona
          como canal de respaldo.
        </p>
      </div>

      {/* ─── WhatsApp (canal principal) ─── */}
      <div
        className="rounded-2xl p-5"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MessageCircle size={16} style={{ color: 'var(--brand-primary)' }} />
            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
              WhatsApp
            </p>
          </div>
          <span
            className="text-xs font-medium px-2.5 py-1 rounded-full"
            style={
              data?.whatsapp_enabled
                ? {
                    background: 'rgba(79, 97, 68, 0.13)',
                    border: '1px solid rgba(79, 97, 68, 0.24)',
                    color: 'var(--brand-primary)',
                  }
                : {
                    background: 'rgba(120, 128, 124, 0.18)',
                    border: '1px solid rgba(120, 128, 124, 0.28)',
                    color: 'var(--text-muted)',
                  }
            }
          >
            {data?.whatsapp_enabled ? 'Habilitado' : 'No configurado'}
          </span>
        </div>

        <Input
          label="WhatsApp para alertas del propietario (opcional)"
          type="tel"
          placeholder="Si lo dejas vacío, se usa el teléfono de tu cuenta"
          value={form.notification_phone}
          onChange={(e) => updateField('notification_phone', e.target.value)}
        />

        <div className="mt-4">
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-tertiary)' }}>
            Plantillas de WhatsApp (se gestionan y aprueban en Meta Business
            Manager — aquí solo se muestran los nombres configurados)
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(data?.whatsapp_templates ?? {}).map(([key, name]) => (
              <span
                key={key}
                className="text-xs px-2.5 py-1 rounded-full font-mono"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border-soft)',
                  color: 'var(--text-secondary)',
                }}
                title={key}
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Email (canal de respaldo) ─── */}
      <div
        className="rounded-2xl p-5"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <MailCheck size={16} style={{ color: 'var(--brand-accent)' }} />
          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
            Correo para alertas del propietario (canal de respaldo)
          </p>
        </div>
        <Input
          label="Correo destino (opcional)"
          type="email"
          placeholder="Si lo dejas vacío, se usa tu correo de usuario"
          value={form.notification_email}
          onChange={(e) => updateField('notification_email', e.target.value)}
        />
      </div>

      <div
        className="rounded-2xl p-5"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)' }}
      >
        <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
          Variables disponibles para las plantillas de correo (canal de respaldo)
        </p>
        <div className="flex flex-wrap gap-2">
          {PLACEHOLDERS.map((item) => (
            <span
              key={item}
              className="text-xs px-2.5 py-1 rounded-full"
              style={{
                background: 'var(--surface-3)',
                border: '1px solid var(--border-soft)',
                color: 'var(--text-secondary)',
              }}
            >
              {item}
            </span>
          ))}
        </div>
      </div>

      <TemplateSection
        title="Reserva aprobada"
        subtitle="Correo al cliente cuando apruebas su solicitud."
        subjectValue={form.client_approved_subject}
        bodyValue={form.client_approved_body}
        onSubjectChange={(value) => updateField('client_approved_subject', value)}
        onBodyChange={(value) => updateField('client_approved_body', value)}
      />

      <TemplateSection
        title="Reserva rechazada"
        subtitle="Correo al cliente cuando rechazas su solicitud."
        subjectValue={form.client_rejected_subject}
        bodyValue={form.client_rejected_body}
        onSubjectChange={(value) => updateField('client_rejected_subject', value)}
        onBodyChange={(value) => updateField('client_rejected_body', value)}
      />

      <TemplateSection
        title="Comprobante recibido"
        subtitle="Correo al cliente cuando sube su comprobante de pago."
        subjectValue={form.client_payment_received_subject}
        bodyValue={form.client_payment_received_body}
        onSubjectChange={(value) => updateField('client_payment_received_subject', value)}
        onBodyChange={(value) => updateField('client_payment_received_body', value)}
      />

      <TemplateSection
        title="Pago confirmado"
        subtitle="Correo al cliente cuando confirmas el pago."
        subjectValue={form.client_payment_confirmed_subject}
        bodyValue={form.client_payment_confirmed_body}
        onSubjectChange={(value) => updateField('client_payment_confirmed_subject', value)}
        onBodyChange={(value) => updateField('client_payment_confirmed_body', value)}
      />

      <div className="sticky bottom-0 pb-2">
        <div
          className="rounded-xl p-3 flex justify-end"
          style={{ background: 'var(--surface-0)' }}
        >
          <Button variant="primary" onClick={handleSave} loading={saving}>
            Guardar configuración
          </Button>
        </div>
      </div>
    </div>
  )
}
