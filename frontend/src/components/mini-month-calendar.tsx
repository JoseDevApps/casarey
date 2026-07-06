'use client'

import { cn } from '@/lib/utils'

export type DayStatus = 'BOOKED' | 'BLOCKED'

interface MiniMonthCalendarProps {
  year: number
  /** 0-indexed (0 = enero), como Date.getMonth() */
  month: number
  /** Mapa YYYY-MM-DD → estado. Días ausentes = disponibles. */
  statusByDate: Record<string, DayStatus>
}

const DAYS_OF_WEEK = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Fecha local YYYY-MM-DD (no UTC) para evitar off-by-one por zona horaria. */
export function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Calendario mensual compacto de SOLO lectura para el dashboard de
 * disponibilidad. Colorea cada día con el mismo código que la leyenda de
 * AvailabilityCalendar (ocupado naranja / bloqueado gris / libre neutro)
 * y resalta el día de hoy.
 */
export function MiniMonthCalendar({ year, month, statusByDate }: MiniMonthCalendarProps) {
  const todayStr = localDateStr(new Date())

  // Lunes = primera columna
  const firstDay = new Date(year, month, 1)
  let startDow = firstDay.getDay() - 1
  if (startDow < 0) startDow = 6
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (number | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {DAYS_OF_WEEK.map((d, i) => (
          <div
            key={`${d}-${i}`}
            className="text-center text-[10px] font-medium py-0.5"
            style={{ color: 'var(--text-muted)' }}
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} />
          const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`
          const status = statusByDate[dateStr]
          const isToday = dateStr === todayStr
          const isPast = dateStr < todayStr

          return (
            <div
              key={dateStr}
              title={
                status === 'BOOKED'
                  ? `${dateStr} — Ocupado`
                  : status === 'BLOCKED'
                    ? `${dateStr} — Bloqueado`
                    : `${dateStr} — Libre`
              }
              className={cn(
                'aspect-square flex items-center justify-center text-[11px] rounded',
                isToday && 'font-bold ring-2 ring-[color:var(--brand-accent)]',
                isPast && !status && 'opacity-30'
              )}
              style={{
                ...(status === 'BOOKED' && {
                  background: 'rgba(224, 155, 107, 0.22)',
                  color: 'var(--brand-accent)',
                  border: '1px solid rgba(224,155,107,0.3)',
                }),
                ...(status === 'BLOCKED' && {
                  background: 'rgba(120, 128, 124, 0.18)',
                  color: 'var(--text-muted)',
                }),
                ...(status ? {} : { color: 'var(--text-secondary)' }),
              }}
            >
              {day}
            </div>
          )
        })}
      </div>
    </div>
  )
}
