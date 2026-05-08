'use client'

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react'
import type { CmsBanner } from '@/types/index'
import { getImageUrl } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface BannerCarouselProps {
  banners: CmsBanner[]
  intervalMs?: number
}

export function BannerCarousel({ banners, intervalMs = 6000 }: BannerCarouselProps) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  const total = banners.length
  const goTo = useCallback((i: number) => setIndex(((i % total) + total) % total), [total])
  const next = useCallback(() => goTo(index + 1), [goTo, index])
  const prev = useCallback(() => goTo(index - 1), [goTo, index])

  useEffect(() => {
    if (paused || total <= 1) return
    const id = setInterval(() => setIndex((i) => (i + 1) % total), intervalMs)
    return () => clearInterval(id)
  }, [paused, total, intervalMs])

  if (total === 0) return null

  return (
    <section
      className="relative min-h-[80vh] sm:min-h-screen flex items-center justify-center overflow-hidden"
      style={{ background: 'var(--surface-0)' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Slides */}
      {banners.map((banner, i) => {
        const isActive = i === index
        const imageUrl = banner.minio_key ? getImageUrl(banner.minio_key) : null
        return (
          <div
            key={banner.id}
            className={cn(
              'absolute inset-0 transition-opacity duration-700 ease-in-out',
              isActive ? 'opacity-100' : 'opacity-0 pointer-events-none'
            )}
            aria-hidden={!isActive}
          >
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={banner.title}
                fill
                priority={i === 0}
                sizes="100vw"
                className="object-cover"
              />
            ) : (
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(160deg, var(--surface-0) 0%, var(--brand-primary) 60%, var(--surface-0) 100%)',
                }}
              />
            )}
            {/* Dark overlay for text legibility */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.75) 100%)',
              }}
            />
          </div>
        )
      })}

      {/* Content of active slide */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center py-24">
        <div
          className="inline-flex items-center gap-2 text-sm font-medium px-4 py-1.5 rounded-full mb-8"
          style={{
            background: 'rgba(224, 155, 107, 0.15)',
            color: 'var(--brand-accent)',
            border: '1px solid rgba(224, 155, 107, 0.25)',
          }}
        >
          <span
            className="w-2 h-2 rounded-full inline-block animate-pulse"
            style={{ background: 'var(--brand-accent)' }}
          />
          Reservas disponibles
        </div>

        <h1
          className="text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.05] mb-6"
          style={{ color: 'var(--text-primary)' }}
        >
          {banners[index].title}
        </h1>

        {banners[index].subtitle && (
          <p
            className="text-lg sm:text-xl max-w-xl mx-auto mb-10 leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            {banners[index].subtitle}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/properties"
            className="inline-flex items-center gap-2 text-base font-semibold px-8 py-4 rounded-xl transition-all duration-150"
            style={{ background: 'var(--brand-accent)', color: 'var(--color-bone, rgb(249,244,230))' }}
          >
            Ver cabañas
            <ArrowRight size={18} />
          </Link>
          <Link
            href="/login"
            className="btn-ghost inline-flex items-center gap-2 text-base font-medium px-8 py-4 rounded-xl"
          >
            Iniciar sesión
          </Link>
        </div>
      </div>

      {/* Prev/Next arrows */}
      {total > 1 && (
        <>
          <button
            onClick={prev}
            aria-label="Banner anterior"
            className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full items-center justify-center transition-opacity hover:opacity-100 opacity-70"
            style={{
              background: 'rgba(0,0,0,0.45)',
              color: 'var(--text-primary)',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={next}
            aria-label="Banner siguiente"
            className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full items-center justify-center transition-opacity hover:opacity-100 opacity-70"
            style={{
              background: 'rgba(0,0,0,0.45)',
              color: 'var(--text-primary)',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            <ChevronRight size={20} />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {total > 1 && (
        <div className="absolute bottom-8 left-0 right-0 z-20 flex justify-center gap-2">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Ir al banner ${i + 1}`}
              className="rounded-full transition-all duration-200"
              style={{
                width: i === index ? '28px' : '8px',
                height: '8px',
                background: i === index ? 'var(--brand-accent)' : 'rgba(255,255,255,0.4)',
              }}
            />
          ))}
        </div>
      )}
    </section>
  )
}
