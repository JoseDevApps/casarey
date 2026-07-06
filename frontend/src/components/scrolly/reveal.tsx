'use client'

import { useEffect, useRef, type ElementType, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface RevealProps {
  children: ReactNode
  /** Elemento HTML a renderizar. Default: div */
  as?: ElementType
  /** Retardo de entrada en ms (para stagger) */
  delay?: number
  className?: string
  /** Atributos extra (id, style, etc.) */
  [key: string]: unknown
}

/**
 * Envuelve contenido y lo revela (opacity + translateY) la primera vez que
 * entra en el viewport. Progressive enhancement: el contenido siempre está en
 * el DOM (SSR); solo la animación se añade en cliente. Respeta prefers-reduced-motion
 * vía CSS (.reveal en globals.css).
 */
export function Reveal({
  children,
  as: Tag = 'div',
  delay = 0,
  className,
  ...rest
}: RevealProps) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Si el navegador no soporta IO, mostramos directo.
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('is-visible')
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const target = entry.target as HTMLElement
            if (delay > 0) {
              window.setTimeout(() => target.classList.add('is-visible'), delay)
            } else {
              target.classList.add('is-visible')
            }
            observer.unobserve(target)
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [delay])

  return (
    <Tag ref={ref} className={cn('reveal', className)} {...rest}>
      {children}
    </Tag>
  )
}
