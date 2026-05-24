'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/logo'

const schema = z.object({
  email: z.string().email('Email inválido'),
})

type FormValues = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false)
  const [networkError, setNetworkError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(values: FormValues) {
    setNetworkError(null)
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: values.email }),
      })
      setSubmitted(true)
    } catch {
      setNetworkError('Error de conexión. Intenta nuevamente.')
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
            Recuperar contraseña
          </h1>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
            Te enviaremos un enlace para restablecer tu contraseña.
          </p>

          {submitted ? (
            <div
              className="rounded-lg px-4 py-3 text-sm"
              style={{
                background: 'rgba(91, 168, 110, 0.12)',
                border: '1px solid rgba(91, 168, 110, 0.3)',
                color: 'var(--text-primary)',
              }}
            >
              Si el correo existe en nuestra plataforma, enviaremos un enlace de recuperación.
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <Input
                id="email"
                label="Correo electrónico"
                type="email"
                placeholder="tu@email.com"
                error={errors.email?.message}
                autoComplete="email"
                {...register('email')}
              />

              {networkError && (
                <p className="text-xs" style={{ color: 'var(--color-error)' }}>
                  {networkError}
                </p>
              )}

              <Button type="submit" variant="primary" size="lg" className="w-full mt-1" loading={isSubmitting}>
                Enviar enlace
              </Button>
            </form>
          )}

          <p className="text-sm text-center mt-5" style={{ color: 'var(--text-tertiary)' }}>
            <Link
              href="/login"
              className="font-medium transition-opacity hover:opacity-80"
              style={{ color: 'var(--brand-accent)' }}
            >
              Volver a iniciar sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
