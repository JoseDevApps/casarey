'use client'

import React, { useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PropertyCard } from './property-card'
import type { Property } from '@/types/index'
import { cn } from '@/lib/utils'

interface PropertyCarouselProps {
  properties: Property[]
}

export function PropertyCarousel({ properties }: PropertyCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current
      const scrollTo = direction === 'left'
        ? scrollLeft - clientWidth / 1.5
        : scrollLeft + clientWidth / 1.5
      
      scrollRef.current.scrollTo({
        left: scrollTo,
        behavior: 'smooth',
      })
    }
  }

  if (properties.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 text-center">
        <p style={{ color: 'var(--text-muted)' }}>
          No hay propiedades destacadas en este momento.
        </p>
      </div>
    )
  }


  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
      <div className="mb-10">
        <p
          className="text-sm font-medium mb-2 uppercase tracking-wider"
          style={{ color: 'var(--brand-accent)' }}
        >
          Descubre nuestro paraíso
        </p>
        <h2
          className="text-3xl sm:text-4xl font-bold"
          style={{ color: 'var(--text-primary)' }}
        >
          Propiedades Recomendadas
        </h2>
      </div>

      <div className="relative group">
        {/* Navigation Buttons */}
        <button
          onClick={() => scroll('left')}
          className="absolute -left-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white shadow-lg border border-gray-200 text-gray-600 hover:text-black transition-all opacity-0 group-hover:opacity-100 hidden sm:flex"
          aria-label="Previous"
        >
          <ChevronLeft size={24} />
        </button>
        
        <button
          onClick={() => scroll('right')}
          className="absolute -right-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white shadow-lg border border-gray-200 text-gray-600 hover:text-black transition-all opacity-0 group-hover:opacity-100 hidden sm:flex"
          aria-label="Next"
        >
          <ChevronRight size={24} />
        </button>

        {/* Carousel Container */}
        <div
          ref={scrollRef}
          className="flex gap-6 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-4"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {properties.map((property) => (
            <div 
              key={property.id} 
              className="snap-start shrink-0 w-[280px] sm:w-[340px]"
            >
              <PropertyCard property={property} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
