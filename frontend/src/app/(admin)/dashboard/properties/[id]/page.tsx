'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import useSWR from 'swr'
import Link from 'next/link'
import { ArrowLeft, Trash2 } from 'lucide-react'
import type { Property } from '@/types/index'
import { apiFetch } from '@/lib/api-client'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { FileUploader } from '@/components/file-uploader'
import { useToast } from '@/components/ui/toast'

const schema = z.object({
  name: z.string().min(2, 'Nombre muy corto'),
  description: z.string().optional(),
  address: z.string().optional(),
  checkin_time: z.string().min(1, 'Hora de check-in requerida'),
  checkout_time: z.string().min(1, 'Hora de check-out requerida'),
  max_guests: z.coerce.number().min(1).max(100),
  rate_adult: z.coerce.number().min(0),
  rate_child: z.coerce.number().min(0),
  is_active: z.boolean(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  params: Promise<{ id: string }>
}

export default function AdminPropertyFormPage({ params }: Props) {
  const { id } = use(params)
  const isNew = id === 'new'
  const router = useRouter()
  const { toast } = useToast()
  const [uploadedImages, setUploadedImages] = useState<string[]>([])

  const { data: property, isLoading } = useSWR(
    isNew ? null : `/api/properties/${id}`,
    (url) => apiFetch<Property>(url)
  )

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      checkin_time: '14:00',
      checkout_time: '11:00',
      max_guests: 6,
      rate_adult: 0,
      rate_child: 0,
      is_active: true,
    },
  })

  useEffect(() => {
    if (property) {
      reset({
        name: property.name,
        description: property.description ?? '',
        address: property.address ?? '',
        checkin_time: property.checkin_time,
        checkout_time: property.checkout_time,
        max_guests: property.max_guests,
        rate_adult: property.rate_adult,
        rate_child: property.rate_child,
        is_active: property.is_active,
      })
    }
  }, [property, reset])

  async function onSubmit(data: FormValues) {
    try {
      if (isNew) {
        const newProp = await apiFetch<Property>('/api/properties', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, image_keys: uploadedImages }),
        })
        toast('Propiedad creada correctamente', 'success')
        router.push(`/dashboard/properties/${newProp.id}`)
      } else {
        await apiFetch(`/api/properties/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        toast('Propiedad actualizada', 'success')
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al guardar', 'error')
    }
  }

  if (!isNew && isLoading) {
    return (
      <div className="flex flex-col gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-xl skeleton" style={{ background: 'var(--surface-1)' }} />
        ))}
      </div>
    )
  }

  return (
    <div>
      <Link
        href="/dashboard/properties"
        className="inline-flex items-center gap-2 text-sm mb-6 hover:opacity-80"
        style={{ color: 'var(--text-secondary)' }}
      >
        <ArrowLeft size={15} />
        Propiedades
      </Link>

      <h1 className="text-2xl font-bold mb-8" style={{ color: 'var(--text-primary)' }}>
        {isNew ? 'Nueva Propiedad' : 'Editar Propiedad'}
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl flex flex-col gap-6">
        <div
          className="rounded-2xl p-6 flex flex-col gap-5"
          style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}
        >
          <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            Información básica
          </h2>

          <Input
            id="name"
            label="Nombre de la propiedad"
            placeholder="Cabaña El Pino"
            error={errors.name?.message}
            {...register('name')}
          />

          <Textarea
            id="description"
            label="Descripción"
            placeholder="Describe la propiedad..."
            rows={4}
            {...register('description')}
          />

          <Input
            id="address"
            label="Dirección / Ubicación"
            placeholder="Km 45 Carretera Norte, Valle de..."
            {...register('address')}
          />
        </div>

        <div
          className="rounded-2xl p-6 flex flex-col gap-5"
          style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}
        >
          <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            Horarios y capacidad
          </h2>

          <div className="grid grid-cols-3 gap-4">
            <Input
              id="checkin_time"
              label="Check-in"
              type="time"
              error={errors.checkin_time?.message}
              {...register('checkin_time')}
            />
            <Input
              id="checkout_time"
              label="Check-out"
              type="time"
              error={errors.checkout_time?.message}
              {...register('checkout_time')}
            />
            <Input
              id="max_guests"
              label="Máx. huéspedes"
              type="number"
              min={1}
              max={100}
              error={errors.max_guests?.message}
              {...register('max_guests')}
            />
          </div>
        </div>

        <div
          className="rounded-2xl p-6 flex flex-col gap-5"
          style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}
        >
          <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            Tarifas por noche
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <Input
              id="rate_adult"
              label="Adulto (Bs)"
              type="number"
              step="0.01"
              min={0}
              error={errors.rate_adult?.message}
              {...register('rate_adult')}
            />
            <Input
              id="rate_child"
              label="Niño (Bs)"
              type="number"
              step="0.01"
              min={0}
              error={errors.rate_child?.message}
              {...register('rate_child')}
            />
          </div>
        </div>

        <div
          className="rounded-2xl p-6 flex flex-col gap-5"
          style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}
        >
          <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            Imágenes
          </h2>
          <FileUploader
            onUpload={(_, key) => setUploadedImages((prev) => [...prev, key])}
            label="Subir imagen de la propiedad"
          />
          {uploadedImages.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {uploadedImages.map((key) => (
                <div
                  key={key}
                  className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
                >
                  <span className="truncate max-w-[140px]">{key}</span>
                  <button
                    type="button"
                    onClick={() => setUploadedImages((prev) => prev.filter((k) => k !== key))}
                    style={{ color: 'var(--color-error)' }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          className="rounded-2xl p-5 flex items-center justify-between"
          style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}
        >
          <div>
            <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
              Estado de la propiedad
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Las propiedades inactivas no aparecen públicamente
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 accent-[var(--brand-accent)]"
              {...register('is_active')}
            />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Activa
            </span>
          </label>
        </div>

        <div className="flex gap-3">
          <Button type="submit" variant="primary" size="lg" loading={isSubmitting}>
            {isNew ? 'Crear Propiedad' : 'Guardar Cambios'}
          </Button>
          <Link href="/dashboard/properties">
            <Button type="button" variant="ghost" size="lg">
              Cancelar
            </Button>
          </Link>
        </div>
      </form>
    </div>
  )
}
