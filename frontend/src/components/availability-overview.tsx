'use client'

import { useState, type ElementType } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import Image from 'next/image'
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  CheckCircle2,
  Lock,
  Building2,
  ArrowRight,
} from 'lucide-react'
import type { Property, CalendarEntry, Paginated } from '@/types/index'
import { apiFetch } from '@/lib/api-client'
import { getImageUrl } from '@/lib/utils'
import {
  MiniMonthCalendar,
  localDateStr,
  type DayStatus,
} from '@/components/mini-month-calendar'

const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const WEEKDAYS_ES = [
  'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado',
]

interface OverviewData {
  properties: Property[]
  /** property_id → (YYYY-MM-DD → estado) */
  statusByProperty: Record<string, Record<string, DayStatus>>
}

/**
 * Un solo fetch orquestado: lista de propiedades (el backend ya filtra por rol:
 * ADMIN → propias, SUPER_ADMIN → todas) + calendario de cada una (rango por
 * defecto: hoy → +12 meses). Alimenta el resumen de hoy y los mini-calendarios.
 */
async function fetchOverview(): Promise<OverviewData> {
  const list = await apiFetch<Paginated<Property>>('/api/properties?page_size=100')
  const properties = list.items ?? []

  const calendars = await Promise.all(
    properties.map((p) =>
      apiFetch<CalendarEntry[]>(`/api/properties/${p.id}/calendar`).catch(
        () => [] as CalendarEntry[]
      )
    )
  )

  const statusByProperty: Record<string, Record<string, DayStatus>> = {}
  properties.forEach((p, i) => {
    const map: Record<string, DayStatus> = {}
    for (const entry of calendars[i]) {
      map[entry.date] = entry.status
    }
    statusByProperty[p.id] = map
  })

  return { properties, statusByProperty }
}

type TodayStatus = 'free' | 'booked' | 'blocked'

const TODAY_BADGE: Record<
  TodayStatus,
  { label: string; bg: string; border: string; color: string; icon: ElementType }
> = {
  free: {
    label: 'Libre hoy',
    bg: 'rgba(79, 97, 68, 0.13)',
    border: '1px solid rgba(79, 97, 68, 0.24)',
    color: 'var(--brand-primary)',
    icon: CheckCircle2,
  },
  booked: {
    label: 'Ocupada hoy',
    bg: 'rgba(224, 155, 107, 0.22)',
    border: '1px solid rgba(224, 155, 107, 0.3)',
    color: 'var(--brand-accent)',
    icon: CalendarDays,
  },
  blocked: {
    label: 'Bloqueada hoy',
    bg: 'rgba(120, 128, 124, 0.18)',
    border: '1px solid rgba(120, 128, 124, 0.28)',
    color: 'var(--text-muted)',
    icon: Lock,
  },
}

export function AvailabilityOverview() {
  const { data, isLoading, error } = useSWR('availability-overview', fetchOverview)

  // Selector de mes compartido: 0 = mes actual, máx +11 (rango cubierto por el fetch)
  const [monthOffset, setMonthOffset] = useState(0)
  const now = new Date()
  const viewed = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
  const todayStr = localDateStr(now)

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="skeleton rounded-2xl h-72"
            style={{ background: 'var(--surface-2)' }}
          />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div
        className="text-center py-14 rounded-xl"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}
      >
        <p style={{ color: 'var(--text-secondary)' }}>
          No se pudo cargar la disponibilidad. Intenta recargar la página.
        </p>
      </div>
    )
  }

  const properties = data?.properties ?? []
  const statusByProperty = data?.statusByProperty ?? {}

  if (properties.length === 0) {
    return (
      <div
        className="text-center py-16 rounded-xl"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}
      >
        <Building2
          size={32}
          className="mx-auto mb-3"
          style={{ color: 'var(--text-muted)' }}
        />
        <p className="text-lg font-medium" style={{ color: 'var(--text-secondary)' }}>
          Aún no hay cabañas registradas
        </p>
        <p className="text-sm mt-2 mb-6" style={{ color: 'var(--text-muted)' }}>
          Crea tu primera propiedad para ver aquí su disponibilidad.
        </p>
        <Link
          href="/dashboard/properties"
          className="inline-flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-xl"
          style={{
            background: 'var(--brand-accent)',
            color: 'var(--color-bone, rgb(249,244,230))',
          }}
        >
          Ir a Propiedades
          <ArrowRight size={14} />
        </Link>
      </div>
    )
  }

  const todayStatusOf = (propertyId: string): TodayStatus => {
    const s = statusByProperty[propertyId]?.[todayStr]
    if (s === 'BOOKED') return 'booked'
    if (s === 'BLOCKED') return 'blocked'
    return 'free'
  }

  const counts = properties.reduce(
    (acc, p) => {
      acc[todayStatusOf(p.id)]++
      return acc
    },
    { free: 0, booked: 0, blocked: 0 } as Record<TodayStatus, number>
  )

  return (
    <div className="flex flex-col gap-6">
      {/* ─── Resumen de HOY (fecha local del navegador) ─── */}
      <p
        className="text-sm font-medium uppercase tracking-wider -mb-2"
        style={{ color: 'var(--brand-accent)' }}
      >
        Hoy, {WEEKDAYS_ES[now.getDay()]} {now.getDate()} de{' '}
        {MONTHS_ES[now.getMonth()].toLowerCase()} de {now.getFullYear()}
      </p>
      <div className="flex flex-wrap gap-3">
        {(['free', 'booked', 'blocked'] as TodayStatus[]).map((key) => {
          const badge = TODAY_BADGE[key]
          return (
            <div
              key={key}
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl"
              style={{ background: badge.bg, border: badge.border }}
            >
              <badge.icon size={16} style={{ color: badge.color }} />
              <span className="text-2xl font-bold" style={{ color: badge.color }}>
                {counts[key]}
              </span>
              <span className="text-sm" style={{ color: badge.color }}>
                {key === 'free' ? 'libres hoy' : key === 'booked' ? 'ocupadas hoy' : 'bloqueadas hoy'}
              </span>
            </div>
          )
        })}
      </div>

      {/* ─── Selector de mes compartido ─── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMonthOffset((o) => Math.max(0, o - 1))}
            disabled={monthOffset === 0}
            className="p-1.5 rounded-lg transition-colors hover:bg-[var(--surface-2)] disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ color: 'var(--text-secondary)' }}
            aria-label="Mes anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <span
            className="text-base font-semibold min-w-[160px] text-center"
            style={{ color: 'var(--text-primary)' }}
          >
            {MONTHS_ES[viewed.getMonth()]} {viewed.getFullYear()}
          </span>
          <button
            type="button"
            onClick={() => setMonthOffset((o) => Math.min(11, o + 1))}
            disabled={monthOffset === 11}
            className="p-1.5 rounded-lg transition-colors hover:bg-[var(--surface-2)] disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ color: 'var(--text-secondary)' }}
            aria-label="Mes siguiente"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Leyenda */}
        <div className="hidden sm:flex flex-wrap gap-4">
          <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            <span
              className="w-3 h-3 rounded-sm inline-block"
              style={{ background: 'rgba(224, 155, 107, 0.22)', border: '1px solid rgba(224,155,107,0.3)' }}
            />
            Ocupado
          </span>
          <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            <span
              className="w-3 h-3 rounded-sm inline-block"
              style={{ background: 'rgba(120, 128, 124, 0.18)' }}
            />
            Bloqueado
          </span>
          <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            <span
              className="w-3 h-3 rounded-sm inline-block ring-2 ring-[color:var(--brand-accent)]"
              style={{ background: 'var(--surface-1)' }}
            />
            Hoy
          </span>
        </div>
      </div>

      {/* ─── Tarjetas por cabaña ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {properties.map((property) => {
          const status = todayStatusOf(property.id)
          const badge = TODAY_BADGE[status]
          const statusMap = statusByProperty[property.id] ?? {}
          const firstImage = property.images?.[0]

          // Días ocupados del mes visible (dato rápido para el admin)
          const monthPrefix = `${viewed.getFullYear()}-${String(viewed.getMonth() + 1).padStart(2, '0')}-`
          const bookedInMonth = Object.entries(statusMap).filter(
            ([d, s]) => s === 'BOOKED' && d.startsWith(monthPrefix)
          ).length

          return (
            <div
              key={property.id}
              className="rounded-2xl p-5 flex flex-col gap-4"
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}
            >
              {/* Encabezado: foto + nombre + badge de hoy */}
              <div className="flex items-center gap-3">
                <div
                  className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0"
                  style={{ background: 'var(--surface-2)' }}
                >
                  {firstImage ? (
                    <Image
                      src={getImageUrl(firstImage.minio_key)}
                      alt={property.name}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  ) : (
                    <Building2
                      size={18}
                      className="absolute inset-0 m-auto"
                      style={{ color: 'var(--text-muted)' }}
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3
                    className="font-semibold text-sm leading-snug line-clamp-1"
                    style={{ color: 'var(--text-primary)' }}
                    title={property.name}
                  >
                    {property.name}
                  </h3>
                  <span
                    className="inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                    style={{ background: badge.bg, border: badge.border, color: badge.color }}
                  >
                    <badge.icon size={11} />
                    {badge.label}
                  </span>
                </div>
              </div>

              {/* Mini calendario del mes */}
              <MiniMonthCalendar
                year={viewed.getFullYear()}
                month={viewed.getMonth()}
                statusByDate={statusMap}
              />

              {/* Pie: ocupación del mes + gestión */}
              <div
                className="flex items-center justify-between pt-3"
                style={{ borderTop: '1px solid var(--border-soft)' }}
              >
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {bookedInMonth === 0
                    ? 'Sin reservas este mes'
                    : `${bookedInMonth} día${bookedInMonth !== 1 ? 's' : ''} ocupado${bookedInMonth !== 1 ? 's' : ''}`}
                </span>
                <Link
                  href={`/dashboard/calendar/${property.id}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold hover:opacity-80"
                  style={{ color: 'var(--brand-accent)' }}
                >
                  Gestionar
                  <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
