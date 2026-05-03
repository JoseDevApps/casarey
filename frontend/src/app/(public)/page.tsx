import Link from 'next/link'
import Image from 'next/image'
import { CalendarDays, CheckCircle2, Smile, MapPin, ArrowRight } from 'lucide-react'
import type { Property, CmsBanner } from '@/types/index'
import { formatCurrency, getImageUrl } from '@/lib/utils'
import { BannerCarousel } from '@/components/banner-carousel'

async function getFeaturedProperties(): Promise<Property[]> {
  try {
    const base = process.env.BACKEND_URL || 'http://localhost:8000'
    const res = await fetch(`${base}/cms/featured`, {
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    // data may be array of {property: Property} or Property[]
    return (data as Array<{ property?: Property } & Property>).map((item) =>
      item.property ?? item
    )
  } catch {
    return []
  }
}

async function getVisibleBanners(): Promise<CmsBanner[]> {
  try {
    const base = process.env.BACKEND_URL || 'http://localhost:8000'
    const res = await fetch(`${base}/cms/banners`, {
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    const items: CmsBanner[] = data?.items ?? data ?? []
    return items
      .filter((b) => b.is_visible && b.minio_key)
      .sort((a, b) => a.sort_order - b.sort_order)
  } catch {
    return []
  }
}

export default async function LandingPage() {
  const [featuredProperties, banners] = await Promise.all([
    getFeaturedProperties(),
    getVisibleBanners(),
  ])

  return (
    <>
      {/* ─── HERO (carrusel CMS o fallback estático) ─── */}
      {banners.length > 0 ? (
        <BannerCarousel banners={banners} />
      ) : (
      <section
        className="relative min-h-screen flex items-center justify-center overflow-hidden"
        style={{
          background:
            'linear-gradient(160deg, var(--surface-0) 0%, var(--brand-primary) 60%, var(--surface-0) 100%)',
        }}
      >
        {/* Subtle texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          }}
        />

        {/* Radial glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(29,71,52,0.4) 0%, transparent 70%)',
          }}
        />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center py-24">
          <div
            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-1.5 rounded-full mb-8"
            style={{
              background: 'rgba(224, 155, 107, 0.12)',
              color: 'var(--brand-accent)',
              border: '1px solid rgba(224, 155, 107, 0.2)',
            }}
          >
            <span className="w-2 h-2 rounded-full inline-block animate-pulse" style={{ background: 'var(--brand-accent)' }} />
            Reservas disponibles
          </div>

          <h1
            className="text-5xl sm:text-6xl md:text-7xl font-bold leading-[1.05] mb-6"
            style={{ color: 'var(--text-primary)' }}
          >
            Escápate
            <br />
            <span style={{ color: 'var(--brand-accent)' }}>al campo</span>
          </h1>

          <p
            className="text-lg sm:text-xl max-w-xl mx-auto mb-10 leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            Casas rurales únicas para reconectar con la naturaleza. Elige tu
            refugio, elige tus fechas, y nosotros hacemos el resto.
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/properties"
              className="inline-flex items-center gap-2 text-base font-semibold px-8 py-4 rounded-xl transition-all duration-150"
              style={{
                background: 'var(--brand-accent)',
                color: 'rgb(5,5,5)',
              }}
            >
              Explorar propiedades
              <ArrowRight size={18} />
            </Link>
            <Link
              href="/login"
              className="btn-ghost inline-flex items-center gap-2 text-base font-medium px-8 py-4 rounded-xl"
            >
              Iniciar sesión
            </Link>
          </div>

          {/* Stats */}
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
                <div className="text-sm mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* ─── FEATURED PROPERTIES ─── */}
      {featuredProperties.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <div className="mb-10">
            <p
              className="text-sm font-medium mb-2 uppercase tracking-wider"
              style={{ color: 'var(--brand-accent)' }}
            >
              Selección especial
            </p>
            <h2
              className="text-3xl sm:text-4xl font-bold"
              style={{ color: 'var(--text-primary)' }}
            >
              Propiedades Destacadas
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredProperties.map((property) => {
              const firstImage = property.images?.[0]
              const imageUrl = firstImage ? getImageUrl(firstImage.minio_key) : null
              return (
                <Link
                  key={property.id}
                  href={`/properties/${property.id}`}
                  className="block group"
                >
                  <article
                    className="overflow-hidden rounded-xl transition-all duration-200 hover:translate-y-[-2px]"
                    style={{
                      background: 'var(--surface-1)',
                      border: '1px solid var(--border-soft)',
                    }}
                  >
                    <div
                      className="relative overflow-hidden"
                      style={{ aspectRatio: '16/10' }}
                    >
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt={property.name}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div
                          className="absolute inset-0 flex items-center justify-center"
                          style={{ background: 'var(--surface-2)' }}
                        >
                          <span
                            className="text-sm"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            Sin imagen
                          </span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    </div>

                    <div className="p-5">
                      <h3
                        className="font-semibold text-base mb-1 line-clamp-1"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {property.name}
                      </h3>
                      {property.address && (
                        <div
                          className="flex items-center gap-1 text-sm mb-3"
                          style={{ color: 'var(--text-tertiary)' }}
                        >
                          <MapPin size={12} />
                          <span className="line-clamp-1">{property.address}</span>
                        </div>
                      )}
                      <div
                        className="flex items-center justify-between pt-3"
                        style={{ borderTop: '1px solid var(--border-soft)' }}
                      >
                        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          <span>Adulto: </span>
                          <span
                            className="font-semibold"
                            style={{ color: 'var(--brand-accent)' }}
                          >
                            {formatCurrency(property.rate_adult)}
                          </span>
                          <span style={{ color: 'var(--text-muted)' }}> / noche</span>
                        </div>
                        <span
                          className="text-xs font-medium flex items-center gap-1"
                          style={{ color: 'var(--brand-accent)' }}
                        >
                          Ver disponibilidad
                          <ArrowRight size={12} />
                        </span>
                      </div>
                    </div>
                  </article>
                </Link>
              )
            })}
          </div>

          <div className="text-center mt-10">
            <Link
              href="/properties"
              className="btn-ghost inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm"
            >
              Ver todas las propiedades
              <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      )}

      {/* ─── HOW IT WORKS ─── */}
      <section
        className="py-20"
        style={{ background: 'var(--surface-1)', borderTop: '1px solid var(--border-soft)', borderBottom: '1px solid var(--border-soft)' }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
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
            ].map((item, index) => (
              <div
                key={item.step}
                className="relative p-6 rounded-2xl"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border-soft)',
                }}
              >
                <div
                  className="absolute -top-3 -left-3 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    background: 'var(--brand-accent)',
                    color: 'rgb(5,5,5)',
                  }}
                >
                  {item.step}
                </div>

                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: 'var(--brand-primary)' }}
                >
                  <item.icon size={22} style={{ color: 'var(--brand-accent)' }} />
                </div>

                <h3
                  className="font-semibold text-lg mb-2"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {item.description}
                </p>

                {index < 2 && (
                  <div
                    className="hidden sm:block absolute -right-4 top-1/2 -translate-y-1/2 z-10"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <ArrowRight size={16} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA BOTTOM ─── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <div
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
            Únete a quienes ya disfrutan del descanso rural. Registrate y
            encuentra tu cabaña perfecta.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 text-base font-semibold px-8 py-4 rounded-xl transition-all duration-150"
              style={{ background: 'var(--brand-accent)', color: 'rgb(5,5,5)' }}
            >
              Crear cuenta gratis
            </Link>
            <Link
              href="/properties"
              className="btn-ghost inline-flex items-center gap-2 text-base font-medium px-8 py-4 rounded-xl"
            >
              Ver propiedades
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
