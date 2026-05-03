'use client'

import { useState, useRef, DragEvent, ChangeEvent } from 'react'
import Image from 'next/image'
import { Upload, X, ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileUploaderProps {
  onUpload?: (url: string, key: string) => void
  accept?: string
  label?: string
  currentImageUrl?: string
  className?: string
}

export function FileUploader({
  onUpload,
  accept = 'image/*',
  label = 'Arrastra una imagen o haz clic para seleccionar',
  currentImageUrl,
  className,
}: FileUploaderProps) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [preview, setPreview] = useState<string | null>(currentImageUrl || null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function uploadFile(file: File) {
    setUploading(true)
    setProgress(0)
    setError(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      // Simulate progress with XHR for real progress events
      const xhr = new XMLHttpRequest()
      await new Promise<void>((resolve, reject) => {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100))
          }
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText)
              const previewUrl = URL.createObjectURL(file)
              setPreview(previewUrl)
              onUpload?.(data.url, data.key)
              resolve()
            } catch {
              reject(new Error('Respuesta inválida del servidor'))
            }
          } else {
            reject(new Error(`Error al subir: ${xhr.statusText}`))
          }
        }
        xhr.onerror = () => reject(new Error('Error de red'))
        xhr.open('POST', '/api/uploads')
        xhr.send(formData)
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir archivo')
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
  }

  function clearPreview() {
    setPreview(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {preview ? (
        <div className="relative rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border-mid)', aspectRatio: '16/9' }}>
          <Image src={preview} alt="Preview" fill className="object-cover" />
          <button
            type="button"
            onClick={clearPreview}
            className="absolute top-2 right-2 p-1 rounded-full"
            style={{ background: 'rgba(5,5,5,0.8)', color: 'var(--text-primary)' }}
            aria-label="Eliminar imagen"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={cn(
            'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 cursor-pointer transition-all duration-150',
            dragging && 'scale-[1.02]'
          )}
          style={{
            borderColor: dragging ? 'var(--brand-accent)' : 'var(--border-mid)',
            background: dragging ? 'rgba(224, 155, 107, 0.05)' : 'var(--surface-1)',
          }}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-3 w-full max-w-[200px]">
              <div
                className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: 'var(--brand-accent)' }}
              />
              <div className="w-full rounded-full h-1.5 overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%`, background: 'var(--brand-accent)' }}
                />
              </div>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Subiendo... {progress}%
              </span>
            </div>
          ) : (
            <>
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: 'var(--surface-2)' }}
              >
                <ImageIcon size={22} style={{ color: 'var(--text-tertiary)' }} />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  {label}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  PNG, JPG, WEBP — máx. 10 MB
                </p>
              </div>
              <div
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
                style={{ background: 'var(--surface-3)', color: 'var(--brand-accent)' }}
              >
                <Upload size={12} />
                Seleccionar archivo
              </div>
            </>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs" style={{ color: 'var(--color-error)' }}>
          {error}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
        aria-hidden="true"
      />
    </div>
  )
}
