'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AvailabilityCalendarProps {
  occupiedDates?: string[]
  blockedDates?: string[]
  onDateRangeSelect?: (start: string, end: string) => void
  selectedStart?: string
  selectedEnd?: string
}

const DAYS_OF_WEEK = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']
const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function buildMonthDays(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1)
  // Monday = 0 in our grid
  let startDow = firstDay.getDay() - 1
  if (startDow < 0) startDow = 6
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (Date | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  return cells
}

export function AvailabilityCalendar({
  occupiedDates = [],
  blockedDates = [],
  onDateRangeSelect,
  selectedStart: externalStart,
  selectedEnd: externalEnd,
}: AvailabilityCalendarProps) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [baseDate, setBaseDate] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  )
  const [internalStart, setInternalStart] = useState<string | null>(null)
  const [internalEnd, setInternalEnd] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)

  const selectedStart = externalStart ?? internalStart
  const selectedEnd = externalEnd ?? internalEnd

  const occupiedSet = new Set(occupiedDates)
  const blockedSet = new Set(blockedDates)

  const month1 = { year: baseDate.getFullYear(), month: baseDate.getMonth() }
  const next = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1)
  const month2 = { year: next.getFullYear(), month: next.getMonth() }

  function prevMonth() {
    setBaseDate(new Date(baseDate.getFullYear(), baseDate.getMonth() - 1, 1))
  }
  function nextMonth() {
    setBaseDate(new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1))
  }

  function handleDayClick(dateStr: string) {
    const date = new Date(dateStr)
    if (date < today) return
    if (occupiedSet.has(dateStr) || blockedSet.has(dateStr)) return

    if (!selectedStart || (selectedStart && selectedEnd)) {
      setInternalStart(dateStr)
      setInternalEnd(null)
    } else {
      if (dateStr < selectedStart) {
        setInternalStart(dateStr)
        setInternalEnd(null)
      } else {
        setInternalEnd(dateStr)
        onDateRangeSelect?.(selectedStart, dateStr)
      }
    }
  }

  function getDayStatus(dateStr: string) {
    if (occupiedSet.has(dateStr)) return 'occupied'
    if (blockedSet.has(dateStr)) return 'blocked'
    const date = new Date(dateStr)
    if (date < today) return 'past'
    return 'available'
  }

  function isInRange(dateStr: string): boolean {
    const start = selectedStart
    const end = selectedEnd || hovered
    if (!start || !end) return false
    const d = dateStr
    const [lo, hi] = start <= end ? [start, end] : [end, start]
    return d > lo && d < hi
  }

  function isRangeStart(dateStr: string) {
    return dateStr === selectedStart
  }
  function isRangeEnd(dateStr: string) {
    return dateStr === selectedEnd
  }

  function renderMonth(year: number, month: number) {
    const days = buildMonthDays(year, month)
    return (
      <div className="flex-1 min-w-0">
        <div
          className="text-center font-semibold mb-3 text-sm"
          style={{ color: 'var(--text-primary)' }}
        >
          {MONTHS_ES[month]} {year}
        </div>
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {DAYS_OF_WEEK.map((d) => (
            <div
              key={d}
              className="text-center text-xs font-medium py-1"
              style={{ color: 'var(--text-muted)' }}
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {days.map((date, i) => {
            if (!date) {
              return <div key={`empty-${i}`} />
            }
            const dateStr = toDateStr(date)
            const status = getDayStatus(dateStr)
            const inRange = isInRange(dateStr)
            const isStart = isRangeStart(dateStr)
            const isEnd = isRangeEnd(dateStr)

            return (
              <button
                key={dateStr}
                type="button"
                disabled={status === 'past' || status === 'occupied' || status === 'blocked'}
                onClick={() => handleDayClick(dateStr)}
                onMouseEnter={() => setHovered(dateStr)}
                onMouseLeave={() => setHovered(null)}
                aria-label={dateStr}
                className={cn(
                  'relative aspect-square flex items-center justify-center text-xs rounded-md transition-all duration-100',
                  status === 'past' && 'opacity-25 cursor-not-allowed',
                  status === 'occupied' && 'cursor-not-allowed rounded-md',
                  status === 'blocked' && 'cursor-not-allowed rounded-md',
                  status === 'available' &&
                    !isStart &&
                    !isEnd &&
                    !inRange &&
                    'hover:bg-[var(--surface-3)] cursor-pointer',
                  inRange &&
                    'rounded-none',
                  (isStart || isEnd) &&
                    'font-bold'
                )}
                style={{
                  ...(status === 'occupied' && {
                    background: 'rgba(224, 155, 107, 0.22)',
                    color: 'var(--brand-accent)',
                    border: '1px solid rgba(224,155,107,0.3)',
                  }),
                  ...(status === 'blocked' && {
                    background: 'rgba(120, 128, 124, 0.18)',
                    color: 'var(--text-muted)',
                  }),
                  ...(inRange && {
                    background: 'rgba(29, 71, 52, 0.35)',
                    color: 'var(--text-secondary)',
                    borderRadius: '0',
                  }),
                  ...((isStart || isEnd) && {
                    background: 'var(--brand-primary)',
                    color: 'var(--text-primary)',
                    borderRadius: 'var(--radius-md)',
                  }),
                  ...(status === 'available' && !isStart && !isEnd && !inRange && {
                    color: 'var(--text-secondary)',
                  }),
                }}
              >
                {date.getDate()}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div
      className="rounded-xl p-4 border"
      style={{
        background: 'var(--surface-1)',
        borderColor: 'var(--border-mid)',
      }}
    >
      {/* Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={prevMonth}
          className="p-1.5 rounded-lg transition-colors hover:bg-[var(--surface-2)]"
          style={{ color: 'var(--text-secondary)' }}
          aria-label="Mes anterior"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          onClick={nextMonth}
          className="p-1.5 rounded-lg transition-colors hover:bg-[var(--surface-2)]"
          style={{ color: 'var(--text-secondary)' }}
          aria-label="Mes siguiente"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Months */}
      <div className="flex flex-col md:flex-row gap-6">
        {renderMonth(month1.year, month1.month)}
        <div
          className="hidden md:block w-px"
          style={{ background: 'var(--border-soft)' }}
        />
        {renderMonth(month2.year, month2.month)}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4 pt-4" style={{ borderTop: '1px solid var(--border-soft)' }}>
        <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          <span
            className="w-3 h-3 rounded-sm inline-block"
            style={{ background: 'rgba(224, 155, 107, 0.22)', border: '1px solid rgba(224,155,107,0.3)' }}
          />
          Ocupado
        </div>
        <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          <span
            className="w-3 h-3 rounded-sm inline-block"
            style={{ background: 'rgba(120, 128, 124, 0.18)' }}
          />
          Bloqueado
        </div>
        <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          <span
            className="w-3 h-3 rounded-sm inline-block"
            style={{ background: 'var(--brand-primary)' }}
          />
          Seleccionado
        </div>
      </div>
    </div>
  )
}
