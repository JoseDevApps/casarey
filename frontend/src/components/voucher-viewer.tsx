'use client'

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import Image from 'next/image'
import { ExternalLink, FileText, X, ZoomIn } from 'lucide-react'

interface VoucherViewerProps {
  /** Browser-reachable URL (already passed through `toBrowserUrl`). */
  url: string
  /** MinIO key (used to detect file extension). */
  minioKey: string
  /** Layout: full = stretch to container, thumb = fixed thumbnail. */
  variant?: 'full' | 'thumb'
  /** Optional caption shown only on hover for full variant. */
  alt?: string
}

export function VoucherViewer({
  url,
  minioKey,
  variant = 'full',
  alt = 'Comprobante de pago',
}: VoucherViewerProps) {
  const [open, setOpen] = useState(false)
  const isPdf = minioKey.toLowerCase().endsWith('.pdf')

  if (isPdf) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg"
        style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }}
      >
        <FileText size={16} style={{ color: 'var(--brand-accent)' }} />
        <span className="font-medium">Abrir comprobante (PDF)</span>
        <ExternalLink size={12} style={{ color: 'var(--text-muted)' }} />
      </a>
    )
  }

  const trigger =
    variant === 'thumb' ? (
      <button
        type="button"
        className="relative w-32 h-32 rounded-lg overflow-hidden ring-1 ring-[var(--border-soft)] hover:ring-[var(--brand-accent)] transition-all duration-150 group"
        style={{ background: 'var(--surface-3)' }}
        aria-label="Ampliar comprobante"
      >
        <Image
          src={url}
          alt={alt}
          fill
          unoptimized
          sizes="128px"
          className="object-cover"
        />
        <span
          className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors duration-150"
        >
          <ZoomIn
            size={20}
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-150"
            style={{ color: 'white' }}
          />
        </span>
      </button>
    ) : (
      <button
        type="button"
        className="block w-full relative rounded-lg overflow-hidden ring-1 ring-[var(--border-soft)] hover:ring-[var(--brand-accent)] transition-all duration-150 group"
        style={{ aspectRatio: '4/3', background: 'var(--surface-3)' }}
        aria-label="Ampliar comprobante"
      >
        <Image
          src={url}
          alt={alt}
          fill
          unoptimized
          sizes="(max-width: 1024px) 100vw, 600px"
          className="object-contain"
        />
        <span
          className="absolute bottom-2 right-2 inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-150"
          style={{ background: 'rgba(5,5,5,0.75)', color: 'white' }}
        >
          <ZoomIn size={12} /> Ampliar
        </span>
      </button>
    )

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-[60] backdrop-blur-sm data-[state=open]:animate-[fadeIn_180ms_ease-out]"
          style={{ background: 'rgba(0,0,0,0.85)' }}
        />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[70] -translate-x-1/2 -translate-y-1/2 w-[min(95vw,1100px)] h-[min(92vh,900px)] outline-none data-[state=open]:animate-[fadeIn_220ms_ease-out]"
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">Comprobante de pago ampliado</Dialog.Title>

          <Dialog.Close
            className="absolute -top-2 -right-2 z-10 p-2 rounded-full ring-1 ring-white/20 hover:bg-white/10 transition-colors"
            style={{ background: 'rgba(5,5,5,0.85)', color: 'white' }}
            aria-label="Cerrar"
          >
            <X size={18} />
          </Dialog.Close>

          <div className="relative w-full h-full rounded-xl overflow-hidden" style={{ background: '#0a0a0a' }}>
            <Image
              src={url}
              alt={alt}
              fill
              unoptimized
              sizes="95vw"
              className="object-contain"
              priority
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
