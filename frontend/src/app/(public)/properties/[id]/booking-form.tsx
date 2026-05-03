'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { CalendarDays, Users } from 'lucide-react'
import type { Property } from '@/types/index'
import { formatCurrency, getDaysBetween } from '@/lib/utils'
import { AvailabilityCalendar } from '@/components/availability-calendar'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'

const schema = z
  .object({
    check_in_date: z.string().min(1, 'Selecciona fecha de entrada'),
    check_out_date: z.string().min(1, 'Selecciona fecha de salida'),
    num_adults: z.coerce.number().min(1, 'Mínimo 1 adulto').max(20),
    num_children: z.coerce.number().min(0).max(20),
  })
  .refine((d) => d.check_out_date > d.check_in_date, {
    message: 'La fecha de salida debe ser posterior a la de entrada',
    path: ['check_out_date'],
  })

type FormValues = z.infer<typeof schema>

interface BookingFormProps {
  property: Property
  occupiedDates: string[]
  blockedDates: string[]
}

export function BookingForm({
  property,
  occupiedDates,
  blockedDates,
}: BookingFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [showCalendar, setShowCalendar] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { num_adults: 1, num_children: 0 },
  })

  const checkIn = watch('check_in_date')
  const checkOut = watch('check_out_date')
  const numAdults = watch('num_adults')
  const numChildren = watch('num_children')

  const nights =
    checkIn && checkOut && checkOut > checkIn
      ? getDaysBetween(checkIn, checkOut)
      : 0

  const total =
    nights > 0
      ? nights *
        (numAdults * Number(property.rate_adult) +
          (numChildren || 0) * Number(property.rate_child))
      : 0

  function handleDateRangeSelect(start: string, end: string) {
    setValue('check_in_date', start, { shouldValidate: true })
    setValue('check_out_date', end, { shouldValidate: true })
    setShowCalendar(false)
  }

  async function onSubmit(data: FormValues) {
    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...data, property_id: property.id }),
      })

      if (res.status === 401) {
        router.push('/login')
        return
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(
          (err as { detail?: string }).detail || 'Error al crear reserva'
        )
      }

      const reservation = await res.json()
      toast('¡Reserva solicitada correctamente!', 'success')
      router.push(`/dashboard/reservations/${reservation.id}`)
    } catch (err) {
      toast(
        err instanceof Error ? err.message : 'Error al crear reserva',
        'error'
      )
    }
  }

  return (
    <div
      className="rounded-2xl p-6"
      style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--border-mid)',
      }}
    >
      <h2
        className="text-lg font-bold mb-1"
        style={{ color: 'var(--text-primary)' }}
      >
        Solicitar Reserva
      </h2>
      <p className="text-sm mb-5" style={{ color: 'var(--text-tertiary)' }}>
        Precios fijos al momento de la solicitud
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {/* Date range */}
        <div>
          <button
            type="button"
            onClick={() => setShowCalendar(!showCalendar)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-150"
            style={{
              background: 'var(--input-bg)',
              border: '1px solid var(--input-border)',
              color: checkIn ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
          >
            <CalendarDays size={16} style={{ color: 'var(--brand-accent)' }} />
            {checkIn && checkOut ? (
              <span className="text-sm">
                {checkIn} → {checkOut} ({nights} noche{nights !== 1 ? 's' : ''})
              </span>
            ) : checkIn ? (
              <span className="text-sm">
                Entrada: {checkIn} — selecciona salida
              </span>
            ) : (
              <span className="text-sm">Seleccionar fechas</span>
            )}
          </button>
          {(errors.check_in_date || errors.check_out_date) && (
            <p className="text-xs mt-1" style={{ color: 'var(--color-error)' }}>
              {errors.check_in_date?.message || errors.check_out_date?.message}
            </p>
          )}
          <input type="hidden" {...register('check_in_date')} />
          <input type="hidden" {...register('check_out_date')} />
        </div>

        {/* Calendar picker */}
        {showCalendar && (
          <AvailabilityCalendar
            occupiedDates={occupiedDates}
            blockedDates={blockedDates}
            onDateRangeSelect={handleDateRangeSelect}
            selectedStart={checkIn}
            selectedEnd={checkOut}
          />
        )}

        {/* Guests */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              className="text-xs font-medium block mb-1.5"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Adultos
            </label>
            <div className="relative">
              <Users
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--text-muted)' }}
              />
              <input
                type="number"
                min={1}
                max={20}
                {...register('num_adults')}
                className="input-field pl-8"
              />
            </div>
            {errors.num_adults && (
              <p className="text-xs mt-1" style={{ color: 'var(--color-error)' }}>
                {errors.num_adults.message}
              </p>
            )}
          </div>
          <div>
            <label
              className="text-xs font-medium block mb-1.5"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Niños
            </label>
            <input
              type="number"
              min={0}
              max={20}
              {...register('num_children')}
              className="input-field"
            />
          </div>
        </div>

        {/* Total */}
        {total > 0 && (
          <div
            className="rounded-xl p-4"
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border-soft)',
            }}
          >
            <div className="flex justify-between text-sm mb-2">
              <span style={{ color: 'var(--text-secondary)' }}>
                {numAdults} adulto{numAdults !== 1 ? 's' : ''} × {nights} noche{nights !== 1 ? 's' : ''}
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>
                {formatCurrency(numAdults * Number(property.rate_adult) * nights)}
              </span>
            </div>
            {Number(numChildren) > 0 && (
              <div className="flex justify-between text-sm mb-2">
                <span style={{ color: 'var(--text-secondary)' }}>
                  {numChildren} niño{Number(numChildren) !== 1 ? 's' : ''} × {nights} noche{nights !== 1 ? 's' : ''}
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {formatCurrency(Number(numChildren) * Number(property.rate_child) * nights)}
                </span>
              </div>
            )}
            <div
              className="flex justify-between font-bold text-base pt-3 mt-1"
              style={{
                borderTop: '1px solid var(--border-soft)',
                color: 'var(--text-primary)',
              }}
            >
              <span>Total estimado</span>
              <span style={{ color: 'var(--brand-accent)' }}>
                {formatCurrency(total)}
              </span>
            </div>
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
              * Las tarifas se congelan al momento de la solicitud
            </p>
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={isSubmitting}
          className="w-full mt-1"
        >
          Solicitar Reserva
        </Button>

        <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
          Necesitas cuenta para reservar.{' '}
          <a
            href="/login"
            className="underline"
            style={{ color: 'var(--brand-accent)' }}
          >
            Iniciar sesión
          </a>
        </p>
      </form>
    </div>
  )
}
