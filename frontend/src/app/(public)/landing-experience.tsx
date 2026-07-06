'use client'

import Link from 'next/link'
import {
  CalendarDays,
  CheckCircle2,
  Smile,
  ArrowRight,
  ChevronDown,
} from 'lucide-react'
import type { Property, CmsBanner } from '@/types/index'
import { BannerCarousel } from '@/components/banner-carousel'
import { PropertyBrowser } from '@/components/property-browser'
import { Reveal } from '@/components/scrolly/reveal'
import { ScrollProgress, type SectionRef } from '@/components/scrolly/scroll-progress'

const SECTIONS: SectionRef[] = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'ambiente', label: 'El refugio' },
  { id: 'pasos', label: 'Cómo funciona' },
  { id: 'cabanas', label: 'Cabañas' },
  { id: 'reservar', label: 'Reservar' },
]

const STEPS = [
  {
    step: '01',
    icon: CalendarDays,
    title: 'Elige tus fechas',
    description:
      'Explora las propiedades disponibles y selecciona las fechas de tu estadía. El calendario muestra en tiempo real qué días están libres.',
  },
  {
    step: '02',
    icon: CheckCircle2,
    title: 'El administrador aprueba',
    description:
      'Enviamos tu solicitud de reserva. El administrador la revisa y te notifica. Una vez aprobada, recibirás las instrucciones de pago.',
  },
  {
    step: '03',
    icon: Smile,
    title: '¡Disfruta!',
    description:
      'Confirma tu pago, registra a los huéspedes y prepárate para una experiencia rural inolvidable.',
  },
]

interface LandingExperienceProps {
  banners: CmsBanner[]
  properties: Property[]
}

export function LandingExperience({
  banners,
  properties,
}: LandingExperienceProps) {
  return (
    <div className="scrolly-root">
      <ScrollProgress sections={SECTIONS} />

      {/* ─── HERO (#inicio) ─── */}
      <section id="inicio" className="relative">
        {banners.length > 0 ? (
          <BannerCarousel banners={banners} />
        ) : (
          <div
            className="relative min-h-screen flex items-center justify-center overflow-hidden"
            style={{
              background:
                'linear-gradient(160deg, var(--surface-0) 0%, var(--surface-4) 54%, var(--surface-1) 100%)',
            }}
          >
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
              }}
            />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'linear-gradient(180deg, rgba(240,100,47,0.08) 0%, transparent 58%)',
              }}
            />
            <Reveal className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center py-24">
              <div
                className="inline-flex items-center gap-2 text-sm font-medium px-4 py-1.5 rounded-full mb-8"
                style={{
                  background: 'rgba(224, 155, 107, 0.12)',
                  color: 'var(--brand-accent)',
                  border: '1px solid rgba(224, 155, 107, 0.2)',
                }}
              >
                <span
                  className="w-2 h-2 rounded-full inline-block animate-pulse"
                  style={{ background: 'var(--brand-accent)' }}
                />
                Reservas disponibles
              </div>

              <h1
                className="font-serif italic text-5xl sm:text-6xl md:text-7xl font-extrabold leading-[1.02] mb-6"
                style={{ color: 'var(--text-primary)' }}
              >
                Cabañas
                <br />
                <span style={{ color: 'var(--brand-accent)' }}>en Coroico</span>
              </h1>

              <p
                className="text-lg sm:text-xl max-w-xl mx-auto mb-10 leading-relaxed"
                style={{ color: 'var(--text-secondary)' }}
              >
                Refugios entre los Yungas de La Paz. Elige tus fechas, llega con la
                niebla matutina y deja que el bosque haga el resto.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a
                  href="#cabanas"
                  className="inline-flex items-center gap-2 text-base font-semibold px-8 py-4 rounded-xl transition-all duration-150"
                  style={{
                    background: 'var(--brand-accent)',
                    color: 'var(--color-bone, rgb(249,244,230))',
                  }}
                >
                  Ver cabañas
                  <ArrowRight size={18} />
                </a>
                <Link
                  href="/login"
                  className="btn-ghost inline-flex items-center gap-2 text-base font-medium px-8 py-4 rounded-xl"
                >
                  Iniciar sesión
                </Link>
              </div>

              <div
                className="flex flex-wrap justify-center gap-8 mt-16 pt-10"
                style={{ borderTop: '1px solid var(--border-soft)' }}
              >
                {[
                  { value: '100%', label: 'Atención personalizada' },
                  { value: '24h', label: 'Respuesta garantizada' },
                  { value: 'Bs', label: 'Precios transparentes' },
                ].map((stat) => (
                  <div key={stat.label} className="text-center">
                    <div
                      className="text-2xl font-bold"
                      style={{ color: 'var(--brand-accent)' }}
                    >
                      {stat.value}
                    </div>
                    <div
                      className="text-sm mt-0.5"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        )}

        {/* Scroll-hint hacia la siguiente sección */}
        <button
          type="button"
          onClick={() =>
            document
              .getElementById('ambiente')
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
          aria-label="Continuar"
          className="hidden sm:flex absolute bottom-6 left-1/2 -translate-x-1/2 z-20 scroll-hint flex-col items-center"
          style={{ color: 'var(--brand-accent)' }}
        >
          <ChevronDown size={26} />
        </button>
      </section>

      {/* ─── MANIFIESTO (#ambiente) ─── */}
      <section
        id="ambiente"
        className="py-28"
        style={{
          background: 'var(--surface-0)',
          borderTop: '1px solid var(--border-soft)',
        }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <Reveal
            as="p"
            className="text-sm font-medium uppercase tracking-wider mb-4"
            style={{ color: 'var(--brand-accent)' }}
          >
            Entre la niebla de los Yungas
          </Reveal>
          <Reveal
            as="h2"
            delay={120}
            className="font-serif italic text-3xl sm:text-4xl md:text-5xl font-bold leading-[1.15]"
            style={{ color: 'var(--text-primary)' }}
          >
            Un refugio donde el bosque
            <br className="hidden sm:block" /> marca el ritmo del día.
          </Reveal>
          <Reveal
            as="p"
            delay={240}
            className="mt-8 text-lg leading-relaxed max-w-2xl mx-auto"
            style={{ color: 'var(--text-secondary)' }}
          >
            Despierta con el canto de las aves, recorre senderos de café y descansa
            bajo el cielo estrellado de Coroico. Cada cabaña es una pausa lejos del
            ruido, pensada para reconectar.
          </Reveal>
        </div>
      </section>

      {/* ─── CÓMO FUNCIONA (#pasos) ─── */}
      <section
        id="pasos"
        className="py-20"
        style={{
          background: 'var(--surface-1)',
          borderTop: '1px solid var(--border-soft)',
          borderBottom: '1px solid var(--border-soft)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <Reveal className="text-center mb-12">
            <p
              className="text-sm font-medium uppercase tracking-wider mb-2"
              style={{ color: 'var(--brand-accent)' }}
            >
              Simple y transparente
            </p>
            <h2
              className="text-3xl sm:text-4xl font-bold"
              style={{ color: 'var(--text-primary)' }}
            >
              ¿Cómo funciona?
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {STEPS.map((item, index) => (
              <Reveal
                key={item.step}
                delay={index * 140}
                className="relative p-6 rounded-2xl"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border-soft)',
                }}
              >
                <div
                  className="absolute -top-3 -left-3 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-mono"
                  style={{
                    background: 'var(--brand-accent)',
                    color: 'var(--color-bone, rgb(249,244,230))',
                  }}
                >
                  {item.step}
                </div>

                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: 'var(--brand-primary)' }}
                >
                  <item.icon size={22} style={{ color: 'var(--color-bone, rgb(255,255,255))' }} />
                </div>

                <h3
                  className="font-semibold text-lg mb-2"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {item.title}
                </h3>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {item.description}
                </p>

                {index < STEPS.length - 1 && (
                  <div
                    className="hidden sm:block absolute -right-4 top-1/2 -translate-y-1/2 z-10"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <ArrowRight size={16} />
                  </div>
                )}
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CABAÑAS (#cabanas) — explorables sin salir de la home ─── */}
      <section id="cabanas" className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <Reveal className="mb-10">
          <p
            className="text-sm font-medium mb-2 uppercase tracking-wider"
            style={{ color: 'var(--brand-accent)' }}
          >
            Elegí tu refugio
          </p>
          <h2
            className="text-3xl sm:text-4xl font-bold"
            style={{ color: 'var(--text-primary)' }}
          >
            Nuestras cabañas
          </h2>
          <p className="mt-3 text-base max-w-xl" style={{ color: 'var(--text-secondary)' }}>
            Tocá una cabaña para ver fotos, tarifas y detalles. Cuando te decidas,
            reservás en un par de pasos.
          </p>
        </Reveal>
        <Reveal>
          <PropertyBrowser properties={properties} />
        </Reveal>
      </section>

      {/* ─── CTA FINAL (#reservar) ─── */}
      <section id="reservar" className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <Reveal
          className="rounded-2xl p-10 text-center"
          style={{
            background: 'var(--surface-4)',
            border: '1px solid rgba(224, 155, 107, 0.15)',
          }}
        >
          <h2
            className="text-3xl font-bold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            ¿Listo para tu escapada?
          </h2>
          <p className="mb-8 text-base" style={{ color: 'var(--text-secondary)' }}>
            Únete a quienes ya disfrutan del descanso rural. Registrate y encuentra
            tu cabaña perfecta.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 text-base font-semibold px-8 py-4 rounded-xl transition-all duration-150"
              style={{
                background: 'var(--brand-accent)',
                color: 'var(--color-bone, rgb(249,244,230))',
              }}
            >
              Crear cuenta gratis
            </Link>
            <a
              href="#cabanas"
              className="btn-ghost inline-flex items-center gap-2 text-base font-medium px-8 py-4 rounded-xl"
            >
              Ver cabañas
            </a>
          </div>
        </Reveal>
      </section>
    </div>
  )
}
