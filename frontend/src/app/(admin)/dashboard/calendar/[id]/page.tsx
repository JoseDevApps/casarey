'use client'

import { use, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { ArrowLeft, Lock, Trash2 } from 'lucide-react'
import type { CalendarEntry, Property } from '@/types/index'
import { apiFetch } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AvailabilityCalendar } from '@/components/availability-calendar'
import { useToast } from '@/components/ui/toast'
import { formatDate } from '@/lib/utils'

interface Props {
  params: Promise<{ id: string }>
}

export default function AdminCalendarPage({ params }: Props) {
  const { id } = use(params)
  const { toast } = useToast()
  const [blockStart, setBlockStart] = useState('')
  const [blockEnd, setBlockEnd] = useState('')
  const [blockReason, setBlockReason] = useState('')
  const [blocking, setBlocking] = useState(false)

  const { data: property } = useSWR(
    `/api/properties/${id}`,
    (url) => apiFetch<Property>(url)
  )

  const { data: calendar, mutate } = useSWR(
    `/api/properties/${id}/calendar`,
    (url) => apiFetch<CalendarEntry[]>(url)
  )

  const occupiedDates = (calendar ?? [])
    .filter((e) => e.status === 'BOOKED')
    .map((e) => e.date)

  const blockedDates = (calendar ?? [])
    .filter((e) => e.status === 'BLOCKED')
    .map((e) => e.date)

  /**
   * Expande un rango inclusivo `[start, end]` en YYYY-MM-DD a la lista de
   * fechas que el backend espera. UTC para evitar off-by-one por zona
   * horaria local.
   */
  function expandDateRange(start: string, end: string): string[] {
    const dates: string[] = []
    const [sy, sm, sd] = start.split('-').map(Number)
    const [ey, em, ed] = end.split('-').map(Number)
    const cursor = new Date(Date.UTC(sy, sm - 1, sd))
    const last = new Date(Date.UTC(ey, em - 1, ed))
    if (cursor > last) return []
    while (cursor <= last) {
      dates.push(cursor.toISOString().slice(0, 10))
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
    return dates
  }

  async function handleBlock() {
    if (!blockStart) {
      toast('Selecciona al menos una fecha de inicio', 'warning')
      return
    }
    const endDate = blockEnd || blockStart
    if (endDate < blockStart) {
      toast('La fecha fin debe ser igual o posterior a la fecha inicio', 'warning')
      return
    }
    const dates = expandDateRange(blockStart, endDate)
    if (dates.length === 0) {
      toast('Rango de fechas inválido', 'warning')
      return
    }

    setBlocking(true)
    try {
      await apiFetch(`/api/properties/${id}/calendar/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dates,
          reason: blockReason || undefined,
        }),
      })
      toast(
        dates.length === 1
          ? 'Fecha bloqueada correctamente'
          : `${dates.length} fechas bloqueadas correctamente`,
        'success',
      )
      mutate()
      setBlockStart('')
      setBlockEnd('')
      setBlockReason('')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al bloquear fechas', 'error')
    } finally {
      setBlocking(false)
    }
  }

  async function handleUnblock(date: string) {
    try {
      // Backend usa REST canonical: DELETE /calendar/{date} con la fecha en
      // el path, sin body (no `POST /calendar/unblock`).
      await apiFetch(`/api/properties/${id}/calendar/${date}`, {
        method: 'DELETE',
      })
      toast('Fecha desbloqueada', 'success')
      mutate()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error al desbloquear', 'error')
    }
  }

  return (
    <div>
      <Link
        href="/dashboard/properties"
        className="inline-flex items-center gap-2 text-sm mb-6 hover:opacity-80"
        style={{ color: 'var(--text-secondary)' }}
      >
        <ArrowLeft size={15} />
        Propiedades
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Calendario
        </h1>
        {property && (
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {property.name}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Calendar view */}
        <div>
          <AvailabilityCalendar
            occupiedDates={occupiedDates}
            blockedDates={blockedDates}
            onDateRangeSelect={(start, end) => {
              setBlockStart(start)
              setBlockEnd(end ?? '')
            }}
          />
        </div>

        {/* Block form + list */}
        <div className="flex flex-col gap-4">
          {/* Block form */}
          <div
            className="rounded-2xl p-5"
            style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}
          >
            <h2
              className="font-semibold mb-4 flex items-center gap-2"
              style={{ color: 'var(--text-primary)' }}
            >
              <Lock size={15} style={{ color: 'var(--brand-accent)' }} />
              Bloquear Fechas
            </h2>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
              Selecciona un rango en el calendario o introduce las fechas manualmente.
            </p>

            <div className="flex flex-col gap-3">
              <Input
                id="block_start"
                label="Fecha inicio"
                type="date"
                value={blockStart}
                onChange={(e) => setBlockStart(e.target.value)}
              />
              <Input
                id="block_end"
                label="Fecha fin (opcional)"
                type="date"
                value={blockEnd}
                onChange={(e) => setBlockEnd(e.target.value)}
              />
              <div>
                <label className="text-sm font-medium block mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Motivo (opcional)
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Mantenimiento, reserva privada..."
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="forest"
                onClick={handleBlock}
                loading={blocking}
                className="w-full mt-1"
              >
                <Lock size={14} />
                Bloquear
              </Button>
            </div>
          </div>

          {/* Blocked dates list */}
          {blockedDates.length > 0 && (
            <div
              className="rounded-2xl p-5"
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}
            >
              <h2 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                Fechas Bloqueadas
              </h2>
              <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                {(calendar ?? [])
                  .filter((e) => e.status === 'BLOCKED')
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((entry) => (
                    <div
                      key={entry.date}
                      className="flex items-center justify-between text-sm rounded-lg px-3 py-2"
                      style={{ background: 'var(--surface-2)' }}
                    >
                      <div>
                        <span style={{ color: 'var(--text-primary)' }}>
                          {formatDate(entry.date)}
                        </span>
                        {entry.blocked_reason && (
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {entry.blocked_reason}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleUnblock(entry.date)}
                        className="hover:opacity-80 transition-opacity"
                        style={{ color: 'var(--color-error)' }}
                        title="Desbloquear"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
