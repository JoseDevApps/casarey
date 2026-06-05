'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Film, Upload, Trash2, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { getImageUrl } from '@/lib/utils'
import { apiFetch } from '@/lib/api-client'

interface PropertyVideoUploaderProps {
  propertyId: string
  videoStatus: 'PROCESSING' | 'READY' | 'FAILED' | null | undefined
  videoMinioKey: string | null | undefined
  videoPosterKey: string | null | undefined
  /** Called when the server state should be re-fetched (after upload/delete). */
  onChange: () => void
}

const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska']
const MAX_BYTES = 100 * 1024 * 1024
const POLL_MS = 3000

export function PropertyVideoUploader({
  propertyId,
  videoStatus,
  videoMinioKey,
  videoPosterKey,
  onChange,
}: PropertyVideoUploaderProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)

  // Mientras el backend transcodifica, repollear suavemente. Cuando el
  // status cambie a READY/FAILED, `onChange()` (mutate del SWR del padre)
  // refrescará y este efecto se desmonta.
  useEffect(() => {
    if (videoStatus !== 'PROCESSING') return
    const id = setInterval(onChange, POLL_MS)
    return () => clearInterval(id)
  }, [videoStatus, onChange])

  async function pickFile() {
    fileInputRef.current?.click()
  }

  async function handleUpload(file: File) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast('Formato no permitido (mp4, mov, webm o mkv)', 'error')
      return
    }
    if (file.size > MAX_BYTES) {
      toast(
        `El video pesa ${(file.size / 1024 / 1024).toFixed(0)} MB. Máximo permitido: 100 MB.`,
        'error',
      )
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/properties/${propertyId}/video`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const detail = (err as { detail?: { detail?: string } | string }).detail
        const message =
          typeof detail === 'string' ? detail : detail?.detail || 'Error al subir el video'
        throw new Error(message)
      }
      toast('Video subido. Procesando…', 'info')
      onChange()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al subir el video', 'error')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleRemove() {
    if (!confirm('¿Quitar el video de esta propiedad?')) return
    setRemoving(true)
    try {
      await apiFetch(`/api/properties/${propertyId}/video`, { method: 'DELETE' })
      toast('Video eliminado', 'success')
      onChange()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al eliminar', 'error')
    } finally {
      setRemoving(false)
    }
  }

  const posterUrl = videoPosterKey
    ? getImageUrl(videoPosterKey, 'property-videos')
    : null

  return (
    <div
      className="rounded-2xl p-6 flex flex-col gap-4"
      style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            className="font-semibold flex items-center gap-2"
            style={{ color: 'var(--text-primary)' }}
          >
            <Film size={16} style={{ color: 'var(--brand-accent)' }} />
            Video de la cabaña
          </h2>
          <p className="text-xs mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
            Un clip corto (≤100 MB). Lo comprimimos automáticamente a 720p.
          </p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleUpload(f)
        }}
      />

      {/* PROCESSING — el background task aún corre */}
      {videoStatus === 'PROCESSING' && (
        <div
          className="rounded-xl p-5 flex items-center gap-3"
          style={{
            background: 'rgba(153, 70, 42, 0.08)',
            border: '1px solid rgba(153, 70, 42, 0.22)',
          }}
        >
          <Loader2
            size={18}
            className="animate-spin shrink-0"
            style={{ color: 'var(--brand-warm)' }}
          />
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Procesando video…
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Lo comprimimos a 720p y generamos el thumbnail. Suele tardar menos de
              un minuto. Puedes seguir editando otros datos.
            </p>
          </div>
        </div>
      )}

      {/* FAILED — algo falló durante la transcodificación */}
      {videoStatus === 'FAILED' && (
        <div
          className="rounded-xl p-5 flex items-start gap-3"
          style={{
            background: 'rgba(186, 26, 26, 0.08)',
            border: '1px solid rgba(186, 26, 26, 0.22)',
          }}
        >
          <AlertCircle
            size={18}
            className="shrink-0 mt-0.5"
            style={{ color: 'var(--color-error)' }}
          />
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: 'var(--color-error)' }}>
              No pudimos procesar el video
            </p>
            <p className="text-xs mt-0.5 mb-3" style={{ color: 'var(--text-secondary)' }}>
              Probá con otro archivo o un formato distinto (mp4 funciona mejor).
            </p>
            <button
              type="button"
              onClick={pickFile}
              disabled={uploading}
              className="text-xs underline font-medium"
              style={{ color: 'var(--color-error)' }}
            >
              Subir otro video
            </button>
          </div>
        </div>
      )}

      {/* READY — video listo, mostramos preview y opciones */}
      {videoStatus === 'READY' && videoMinioKey && (
        <div className="flex flex-col gap-3">
          <div
            className="relative w-full rounded-xl overflow-hidden ring-1 ring-[var(--border-soft)]"
            style={{ aspectRatio: '16/9', background: 'var(--surface-2)' }}
          >
            {posterUrl ? (
              <Image
                src={posterUrl}
                alt="Poster del video"
                fill
                unoptimized
                sizes="(max-width: 768px) 100vw, 600px"
                className="object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Film size={32} style={{ color: 'var(--text-muted)' }} />
              </div>
            )}
            <span
              className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded-full"
              style={{
                background: 'rgba(48, 49, 46, 0.86)',
                color: 'var(--inverse-primary, var(--brand-warm))',
                backdropFilter: 'blur(4px)',
              }}
            >
              <Film size={11} />
              720p · listo
            </span>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={pickFile}
              loading={uploading}
            >
              <Upload size={13} />
              Reemplazar
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleRemove}
              loading={removing}
            >
              <Trash2 size={13} />
              Quitar
            </Button>
          </div>
        </div>
      )}

      {/* Sin video — dropzone */}
      {!videoStatus && (
        <button
          type="button"
          onClick={pickFile}
          disabled={uploading}
          className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 transition-all duration-150 disabled:opacity-50"
          style={{
            borderColor: 'var(--border-mid)',
            background: 'var(--surface-2)',
            color: 'var(--text-secondary)',
          }}
        >
          {uploading ? (
            <Loader2
              size={22}
              className="animate-spin"
              style={{ color: 'var(--brand-accent)' }}
            />
          ) : (
            <Upload size={22} style={{ color: 'var(--brand-accent)' }} />
          )}
          <span className="text-sm font-medium">
            {uploading ? 'Subiendo video…' : 'Sube un video corto'}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            MP4 / MOV / WEBM · máx 100 MB
          </span>
        </button>
      )}
    </div>
  )
}
