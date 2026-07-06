'use client'

import { useEffect, useState } from 'react'

export interface SectionRef {
  id: string
  label: string
}

interface ScrollProgressProps {
  sections: SectionRef[]
}

/**
 * Barra de progreso de lectura (fija arriba) + navegación de secciones por
 * anclas (dots a la derecha) con resaltado de la sección activa.
 * Usa requestAnimationFrame para el scroll y IntersectionObserver para la activa.
 */
export function ScrollProgress({ sections }: ScrollProgressProps) {
  const [active, setActive] = useState<string>(sections[0]?.id ?? '')

  // Barra de progreso vía rAF (sin listeners de scroll sin throttle)
  useEffect(() => {
    let frame = 0
    const update = () => {
      const doc = document.documentElement
      const max = doc.scrollHeight - doc.clientHeight
      const progress = max > 0 ? Math.min(window.scrollY / max, 1) : 0
      doc.style.setProperty('--scroll-progress', String(progress))
      frame = 0
    }
    const onScroll = () => {
      if (frame === 0) frame = window.requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  // Sección activa
  useEffect(() => {
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null)
    if (els.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id)
        }
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 }
    )
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [sections])

  const go = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      <div className="scroll-progress" aria-hidden="true" />
      <nav className="section-nav" aria-label="Secciones de la página">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            className="section-nav__dot"
            aria-current={active === s.id}
            aria-label={`Ir a ${s.label}`}
            title={s.label}
            onClick={() => go(s.id)}
          />
        ))}
      </nav>
    </>
  )
}
