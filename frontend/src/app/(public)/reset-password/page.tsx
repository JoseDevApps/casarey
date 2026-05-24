'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/logo'

const schema = z
  .object({
    new_password: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .regex(/[A-Z]/, 'Debe incluir al menos una mayúscula')
      .regex(/[0-9]/, 'Debe incluir al menos un número'),
    confirm_password: z.string(),
  })
  .refine((values) => values.new_password === values.confirm_password, {
    path: ['confirm_password'],
    message: 'Las contraseñas no coinciden',
  })

type FormValues = z.infer<typeof schema>

export default function ResetPasswordPage() {
  const [token, setToken] = useState<string | null>(null)
  const [hasCheckedToken, setHasCheckedToken] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [completed, setCompleted] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    const parsedToken = new URLSearchParams(window.location.search).get('token')
    setToken(parsedToken)
    setHasCheckedToken(true)
  }, [])

  async function onSubmit(values: FormValues) {
    setServerError(null)
    if (!token) {
      setServerError('El enlace de recuperación es inválido o está incompleto.')
      return
    }

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          token,
          new_password: values.new_password,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({} as { detail?: string }))
        setServerError(err.detail || 'No se pudo restablecer la contraseña.')
        return
      }

      setCompleted(true)
    } catch {
      setServerError('Error de conexión. Intenta nuevamente.')
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: 'var(--surface-0)' }}
    >
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center" aria-label="Cabañas Coroico — inicio">
            <Logo variant="full" size={32} tone="onForest" />
          </Link>
        </div>

        <div
          className="rounded-2xl p-8"
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border-mid)',
          }}
        >
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
            Nueva contraseña
          </h1>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
            Define una contraseña nueva para tu cuenta.
          </p>

          {!hasCheckedToken ? (
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Cargando enlace de recuperación...
            </p>
          ) : completed ? (
            <div
              className="rounded-lg px-4 py-3 text-sm"
              style={{
                background: 'rgba(91, 168, 110, 0.12)',
                border: '1px solid rgba(91, 168, 110, 0.3)',
              color: 'var(--text-primary)',
              }}
            >
              Contraseña actualizada correctamente. Ya puedes iniciar sesión.
            </div>
          ) : !token ? (
            <div
              className="rounded-lg px-4 py-3 text-sm"
              style={{
                background: 'rgba(220, 80, 80, 0.1)',
                border: '1px solid rgba(220, 80, 80, 0.3)',
                color: 'var(--color-error)',
              }}
            >
              El enlace de recuperación es inválido o está incompleto.
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="new_password" className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Nueva contraseña
                </label>
                <div className="relative">
                  <Input
                    id="new_password"
                    type={showNew ? 'text' : 'password'}
                    placeholder="Mínimo 8 caracteres"
                    className="pr-10"
                    error={errors.new_password?.message}
                    autoComplete="new-password"
                    {...register('new_password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--text-muted)' }}
                    aria-label={showNew ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="confirm_password" className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Confirmar contraseña
                </label>
                <div className="relative">
                  <Input
                    id="confirm_password"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Repite la nueva contraseña"
                    className="pr-10"
                    error={errors.confirm_password?.message}
                    autoComplete="new-password"
                    {...register('confirm_password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--text-muted)' }}
                    aria-label={showConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {serverError && (
                <p className="text-xs" style={{ color: 'var(--color-error)' }}>
                  {serverError}
                </p>
              )}

              <Button type="submit" variant="primary" size="lg" className="w-full mt-1" loading={isSubmitting}>
                Guardar nueva contraseña
              </Button>
            </form>
          )}

          <p className="text-sm text-center mt-5" style={{ color: 'var(--text-tertiary)' }}>
            <Link
              href={completed ? '/login' : '/forgot-password'}
              className="font-medium transition-opacity hover:opacity-80"
              style={{ color: 'var(--brand-accent)' }}
            >
              {completed ? 'Ir a iniciar sesión' : 'Solicitar un nuevo enlace'}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
