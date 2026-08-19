'use client'

import { use, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import useSWR from 'swr'
import Link from 'next/link'
import { ArrowLeft, ChevronLeft, ChevronRight, ImagePlus, Trash2 } from 'lucide-react'
import type { Property, PropertyImage } from '@/types/index'
import { apiFetch } from '@/lib/api-client'
import { getImageUrl } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { FileUploader } from '@/components/file-uploader'
import { PropertyVideoUploader } from '@/components/property-video-uploader'
import { useToast } from '@/components/ui/toast'

const schema = z.object({
  name: z.string().min(2, 'Nombre muy corto'),
  description: z.string().optional(),
  address: z.string().optional(),
  checkin_time: z.string().min(1, 'Hora de check-in requerida'),
  checkout_time: z.string().min(1, 'Hora de check-out requerida'),
  max_guests: z.coerce.number().min(1).max(100),
  rate_child: z.coerce.number().min(0),
  rate_night_1: z.coerce.number().min(0),
  rate_night_2: z.coerce.number().min(0),
  rate_night_3: z.coerce.number().min(0),
  deposit_percentage: z.coerce.number().min(0).max(100),
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
  const [isUploadingExisting, setIsUploadingExisting] = useState(false)
  const [isReordering, setIsReordering] = useState(false)
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null)
  const existingImageInputRef = useRef<HTMLInputElement>(null)

  const { data: property, isLoading, mutate } = useSWR(
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
      rate_child: 0,
      rate_night_1: 0,
      rate_night_2: 0,
      rate_night_3: 0,
      deposit_percentage: 40,
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
        rate_child: property.rate_child,
        rate_night_1: property.rate_night_1,
        rate_night_2: property.rate_night_2,
        rate_night_3: property.rate_night_3,
        deposit_percentage: property.deposit_percentage ?? 40,
        is_active: property.is_active,
      })
    }
  }, [property, reset])

  const sortedExistingImages = [...(property?.images || [])].sort(
    (a, b) => a.sort_order - b.sort_order
  )

  async function uploadImageForExistingProperty(file: File) {
    if (!property) return
    setIsUploadingExisting(true)
    try {
      const nextSortOrder = sortedExistingImages.length
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(
        `/api/properties/${property.id}/images?sort_order=${nextSortOrder}`,
        {
          method: 'POST',
          credentials: 'include',
          body: formData,
        }
      )

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const detail = (err as { detail?: string }).detail
        throw new Error(detail || 'Error al subir imagen')
      }

      toast('Imagen agregada', 'success')
      mutate()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al subir imagen', 'error')
    } finally {
      setIsUploadingExisting(false)
      if (existingImageInputRef.current) existingImageInputRef.current.value = ''
    }
  }

  async function reorderExistingImages(nextOrder: PropertyImage[]) {
    if (!property) return
    setIsReordering(true)
    try {
      await apiFetch(`/api/properties/${property.id}/images/reorder`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_ids: nextOrder.map((img) => img.id) }),
      })
      mutate()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al reordenar imágenes', 'error')
    } finally {
      setIsReordering(false)
    }
  }

  async function moveImage(imageId: string, direction: 'left' | 'right') {
    const current = [...sortedExistingImages]
    const from = current.findIndex((img) => img.id === imageId)
    if (from < 0) return
    const to = direction === 'left' ? from - 1 : from + 1
    if (to < 0 || to >= current.length) return

    const [item] = current.splice(from, 1)
    current.splice(to, 0, item)
    await reorderExistingImages(current)
  }

  async function deleteExistingImage(imageId: string) {
    if (!property) return
    setDeletingImageId(imageId)
    try {
      await apiFetch(`/api/properties/${property.id}/images/${imageId}`, {
        method: 'DELETE',
      })
      toast('Imagen eliminada', 'success')
      mutate()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al eliminar imagen', 'error')
    } finally {
      setDeletingImageId(null)
    }
  }

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
        // Backend usa PUT para reemplazo completo del recurso (con
        // exclude_unset=True, así que aceptar campos parciales también).
        // PATCH devuelve 405 — la convención del API es PUT para recursos,
        // PATCH solo para sub-acciones específicas (approve, reject, cancel).
        await apiFetch(`/api/properties/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        toast('Propiedad actualizada', 'success')
        mutate()
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              id="rate_child"
              label="Niño (Bs)"
              type="number"
              step="0.01"
              min={0}
              error={errors.rate_child?.message}
              {...register('rate_child')}
            />
            <Input
              id="rate_night_1"
              label="Noche 1 (Bs)"
              type="number"
              step="0.01"
              min={0}
              error={errors.rate_night_1?.message}
              {...register('rate_night_1')}
            />
            <Input
              id="rate_night_2"
              label="Noche 2 (Bs)"
              type="number"
              step="0.01"
              min={0}
              error={errors.rate_night_2?.message}
              {...register('rate_night_2')}
            />
            <Input
              id="rate_night_3"
              label="Noche 3+ (Bs)"
              type="number"
              step="0.01"
              min={0}
              error={errors.rate_night_3?.message}
              {...register('rate_night_3')}
            />
          </div>

          <div className="mt-4">
            <Input
              id="deposit_percentage"
              label="Anticipo para reservar (%)"
              type="number"
              step="1"
              min={0}
              max={100}
              error={errors.deposit_percentage?.message}
              {...register('deposit_percentage')}
            />
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
              Porcentaje que el cliente paga por adelantado para asegurar la
              cabaña. El saldo se cobra al llegar. 0 = sin anticipo.
            </p>
          </div>
        </div>

        <div
          className="rounded-2xl p-6 flex flex-col gap-5"
          style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}
        >
          <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            Imágenes
          </h2>
          {isNew ? (
            <>
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
            </>
          ) : (
            <>
              <input
                ref={existingImageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) uploadImageForExistingProperty(file)
                }}
              />

              <div className="flex items-center justify-between gap-3 rounded-xl p-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)' }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    Galería de la propiedad
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Puedes agregar, eliminar y reordenar fotos para el carrusel público.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="forest"
                  size="sm"
                  loading={isUploadingExisting}
                  onClick={() => existingImageInputRef.current?.click()}
                >
                  <ImagePlus size={14} /> Agregar foto
                </Button>
              </div>

              {sortedExistingImages.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Esta propiedad todavía no tiene imágenes cargadas.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {sortedExistingImages.map((img, idx) => (
                    <div
                      key={img.id}
                      className="rounded-xl p-3"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)' }}
                    >
                      <div className="relative rounded-lg overflow-hidden mb-2" style={{ aspectRatio: '16/10' }}>
                        <Image
                          src={getImageUrl(img.minio_key)}
                          alt={`Imagen ${idx + 1}`}
                          fill
                          unoptimized
                          sizes="(max-width: 640px) 100vw, 50vw"
                          className="object-cover"
                        />
                        <span
                          className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(0,0,0,0.55)', color: 'var(--text-primary)' }}
                        >
                          #{idx + 1}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                          {img.minio_key}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={idx === 0 || isReordering}
                            onClick={() => moveImage(img.id, 'left')}
                            title="Mover a la izquierda"
                          >
                            <ChevronLeft size={13} />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={idx === sortedExistingImages.length - 1 || isReordering}
                            onClick={() => moveImage(img.id, 'right')}
                            title="Mover a la derecha"
                          >
                            <ChevronRight size={13} />
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            loading={deletingImageId === img.id}
                            onClick={() => deleteExistingImage(img.id)}
                            title="Eliminar imagen"
                          >
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
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

      {/* El video solo aplica a propiedades ya creadas (necesita el id
          real para que el endpoint del backend escriba en MinIO bajo
          properties/{id}/...). En "Nueva Propiedad" se oculta. */}
      {!isNew && property && (
        <div className="max-w-2xl mt-6">
          <PropertyVideoUploader
            propertyId={property.id}
            videoStatus={property.video_status}
            videoMinioKey={property.video_minio_key}
            videoPosterKey={property.video_poster_key}
            onChange={() => mutate()}
          />
        </div>
      )}
    </div>
  )
}
