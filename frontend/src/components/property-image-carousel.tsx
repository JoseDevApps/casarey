'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { PropertyImage } from '@/types/index'
import { getImageUrl } from '@/lib/utils'

interface PropertyImageCarouselProps {
  images: PropertyImage[]
  propertyName: string
}

export function PropertyImageCarousel({ images, propertyName }: PropertyImageCarouselProps) {
  const sortedImages = useMemo(
    () => [...(images || [])].sort((a, b) => a.sort_order - b.sort_order),
    [images]
  )
  const [index, setIndex] = useState(0)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)

  if (sortedImages.length === 0) {
    return (
      <div
        className="rounded-2xl overflow-hidden mb-8 flex items-center justify-center"
        style={{ background: 'var(--surface-2)', minHeight: '360px' }}
      >
        <span style={{ color: 'var(--text-muted)' }}>Sin imágenes</span>
      </div>
    )
  }

  const total = sortedImages.length
  const active = sortedImages[index]

  function goTo(nextIndex: number) {
    setIndex((nextIndex + total) % total)
  }

  function next() {
    goTo(index + 1)
  }

  function prev() {
    goTo(index - 1)
  }

  function onTouchStart(clientX: number) {
    setTouchStartX(clientX)
  }

  function onTouchEnd(clientX: number) {
    if (touchStartX === null) return
    const delta = touchStartX - clientX
    if (Math.abs(delta) < 50) {
      setTouchStartX(null)
      return
    }
    if (delta > 0) next()
    else prev()
    setTouchStartX(null)
  }

  return (
    <div className="mb-8">
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{ background: 'var(--surface-2)' }}
        onTouchStart={(e) => onTouchStart(e.touches[0].clientX)}
        onTouchEnd={(e) => onTouchEnd(e.changedTouches[0].clientX)}
      >
        <div className="relative" style={{ aspectRatio: '16/9' }}>
          <Image
            key={active.id}
            src={getImageUrl(active.minio_key)}
            alt={`${propertyName} - imagen ${index + 1}`}
            fill
            priority={index === 0}
            sizes="(max-width: 768px) 100vw, 80vw"
            className="object-cover"
          />
        </div>

        {total > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Imagen anterior"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center"
              style={{
                background: 'rgba(0,0,0,0.45)',
                color: 'var(--text-primary)',
                border: '1px solid rgba(255,255,255,0.18)',
              }}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Imagen siguiente"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center"
              style={{
                background: 'rgba(0,0,0,0.45)',
                color: 'var(--text-primary)',
                border: '1px solid rgba(255,255,255,0.18)',
              }}
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}

        <div
          className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full text-xs"
          style={{
            background: 'rgba(0,0,0,0.55)',
            color: 'var(--text-primary)',
            border: '1px solid rgba(255,255,255,0.18)',
          }}
        >
          {index + 1}/{total}
        </div>
      </div>

      {total > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {sortedImages.map((img, i) => {
            const isActive = i === index
            return (
              <button
                key={img.id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Ir a imagen ${i + 1}`}
                className="relative shrink-0 rounded-lg overflow-hidden"
                style={{
                  width: '92px',
                  height: '64px',
                  border: isActive ? '2px solid var(--brand-accent)' : '1px solid var(--border-soft)',
                  opacity: isActive ? 1 : 0.75,
                }}
              >
                <Image
                  src={getImageUrl(img.minio_key)}
                  alt={`${propertyName} miniatura ${i + 1}`}
                  fill
                  sizes="92px"
                  className="object-cover"
                />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
