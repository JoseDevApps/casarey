'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, MessageCircle, Mail } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/logo'

type VerificationChannel = 'whatsapp' | 'email'

const PHONE_CLEAN = /[\s\-().]/g
// Celular boliviano (8 dígitos, empieza en 6/7) o internacional (10-15 dígitos)
const PHONE_RE = /^(?:[67]\d{7}|\+?\d{10,15})$/

const schema = z
  .object({
    full_name: z.string().min(2, 'Nombre muy corto').max(100),
    email: z.string().email('Email inválido'),
    phone: z
      .string()
      .min(1, 'El teléfono es obligatorio — ahí te llegan las notificaciones')
      .refine((v) => PHONE_RE.test(v.replace(PHONE_CLEAN, '')), {
        message: 'Ingresa tu celular de 8 dígitos (ej. 71234567) o formato internacional',
      }),
    password: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .regex(/[A-Z]/, 'Debe tener al menos una mayúscula')
      .regex(/[0-9]/, 'Debe tener al menos un número'),
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: 'Las contraseñas no coinciden',
    path: ['confirm_password'],
  })

type FormValues = z.infer<typeof schema>

export default function RegisterPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [channel, setChannel] = useState<VerificationChannel>('whatsapp')
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormValues) {
    setServerError(null)
    try {
      const { confirm_password: _, ...payload } = data
      // Normaliza: celular local de 8 dígitos → prefijo 591; quita '+' y separadores
      const cleaned = payload.phone.replace(PHONE_CLEAN, '').replace(/^\+/, '')
      const phone = /^[67]\d{7}$/.test(cleaned) ? `591${cleaned}` : cleaned

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...payload,
          phone,
          verification_channel: channel,
          role: 'CLIENT',
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setServerError(
          (err as { detail?: string }).detail || 'Error al registrarse'
        )
        return
      }

      const created = (await res.json().catch(() => ({}))) as {
        verification_channel?: string
      }
      // Siempre llega un código de 6 dígitos; el medio varía (WhatsApp o correo).
      // Si el usuario pidió WhatsApp y salió por correo, avisamos del desvío.
      const medium = created.verification_channel === 'whatsapp' ? 'whatsapp' : 'email'
      const fallback = channel === 'whatsapp' && medium === 'email' ? '&fallback=1' : ''
      router.push(
        `/verify-code?email=${encodeURIComponent(payload.email)}&channel=${medium}${fallback}`
      )
    } catch {
      setServerError('Error de conexión. Intenta de nuevo.')
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: 'var(--surface-0)' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center" aria-label="Cabañas Coroico — inicio">
            <Logo variant="full" size={32} />
          </Link>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border-mid)',
          }}
        >
          <h1
            className="text-2xl font-bold mb-1"
            style={{ color: 'var(--text-primary)' }}
          >
            Crear Cuenta
          </h1>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
            Regístrate como cliente para hacer reservas
          </p>

          {serverError && (
            <div
              className="rounded-lg px-4 py-3 mb-5 text-sm"
              style={{
                background: 'rgba(186, 26, 26, 0.08)',
                border: '1px solid rgba(186, 26, 26, 0.24)',
                color: 'var(--color-error)',
              }}
            >
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <Input
              id="full_name"
              label="Nombre completo"
              type="text"
              placeholder="Juan Pérez"
              error={errors.full_name?.message}
              autoComplete="name"
              {...register('full_name')}
            />

            <Input
              id="email"
              label="Correo electrónico"
              type="email"
              placeholder="tu@email.com"
              error={errors.email?.message}
              autoComplete="email"
              {...register('email')}
            />

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="phone"
                className="text-sm font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                WhatsApp
              </label>
              <div className="flex items-stretch gap-2">
                <span
                  className="inline-flex items-center px-3 rounded-lg text-sm font-medium shrink-0"
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border-mid)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  +591
                </span>
                <input
                  id="phone"
                  type="tel"
                  placeholder="71234567"
                  autoComplete="tel"
                  className="input-field flex-1"
                  {...register('phone')}
                />
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Te enviaremos el código de verificación y las novedades de tus
                reservas por WhatsApp. ¿Número de otro país? Escríbelo completo
                con código de país.
              </p>
              {errors.phone && (
                <p className="text-xs" style={{ color: 'var(--color-error)' }}>
                  {errors.phone.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="text-sm font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
                  className="input-field pr-10"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-80"
                  style={{ color: 'var(--text-muted)' }}
                  aria-label="Toggle password"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs" style={{ color: 'var(--color-error)' }}>
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="confirm_password"
                className="text-sm font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                Confirmar contraseña
              </label>
              <div className="relative">
                <input
                  id="confirm_password"
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Repite tu contraseña"
                  autoComplete="new-password"
                  className="input-field pr-10"
                  {...register('confirm_password')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-80"
                  style={{ color: 'var(--text-muted)' }}
                  aria-label="Toggle confirm password"
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.confirm_password && (
                <p className="text-xs" style={{ color: 'var(--color-error)' }}>
                  {errors.confirm_password.message}
                </p>
              )}
            </div>

            {/* Selector de canal de verificación */}
            <div className="flex flex-col gap-1.5">
              <span
                className="text-sm font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                ¿Cómo quieres verificar tu cuenta?
              </span>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, hint: 'Código al instante' },
                  { value: 'email', label: 'Correo', icon: Mail, hint: 'Código a tu correo' },
                ] as const).map((opt) => {
                  const active = channel === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setChannel(opt.value)}
                      aria-pressed={active}
                      className="flex flex-col items-start gap-0.5 rounded-xl px-3.5 py-3 transition-all duration-150 text-left"
                      style={{
                        background: active ? 'rgba(79, 97, 68, 0.10)' : 'var(--surface-2)',
                        border: active
                          ? '1.5px solid var(--brand-primary)'
                          : '1px solid var(--border-soft)',
                      }}
                    >
                      <span
                        className="flex items-center gap-1.5 text-sm font-semibold"
                        style={{ color: active ? 'var(--brand-primary)' : 'var(--text-primary)' }}
                      >
                        <opt.icon size={15} />
                        {opt.label}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {opt.hint}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={isSubmitting}
              className="w-full mt-2"
            >
              Crear Cuenta
            </Button>
          </form>

          <p
            className="text-sm text-center mt-5"
            style={{ color: 'var(--text-tertiary)' }}
          >
            ¿Ya tienes cuenta?{' '}
            <Link
              href="/login"
              className="font-medium hover:opacity-80"
              style={{ color: 'var(--brand-accent)' }}
            >
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
