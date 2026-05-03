'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Home, Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
})

type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
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
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setServerError(
          (err as { detail?: string }).detail || 'Credenciales inválidas'
        )
        return
      }

      // TokenResponse has no role — fetch profile to get it
      const meRes = await fetch('/api/auth/me', { credentials: 'include' })
      const user = await meRes.json()
      if (user.role === 'SUPER_ADMIN') {
        router.push('/dashboard/users')
      } else if (user.role === 'ADMIN') {
        router.push('/dashboard/properties')
      } else {
        router.push('/dashboard/reservations')
      }
      router.refresh()
    } catch {
      setServerError('Error de conexión. Intenta de nuevo.')
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--surface-0)' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-2.5 font-bold text-xl">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--brand-primary)' }}
            >
              <Home size={20} style={{ color: 'var(--brand-accent)' }} />
            </div>
            <span style={{ color: 'var(--text-primary)' }}>
              Casas de <span style={{ color: 'var(--brand-accent)' }}>Campo</span>
            </span>
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
            Iniciar Sesión
          </h1>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
            Ingresa a tu cuenta para gestionar reservas
          </p>

          {serverError && (
            <div
              className="rounded-lg px-4 py-3 mb-5 text-sm"
              style={{
                background: 'rgba(220, 80, 80, 0.1)',
                border: '1px solid rgba(220, 80, 80, 0.3)',
                color: 'var(--color-error)',
              }}
            >
              {serverError}
            </div>
          )}

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
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="input-field pr-10"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-80"
                  style={{ color: 'var(--text-muted)' }}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
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

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={isSubmitting}
              className="w-full mt-2"
            >
              Iniciar Sesión
            </Button>
          </form>

          <p
            className="text-sm text-center mt-5"
            style={{ color: 'var(--text-tertiary)' }}
          >
            ¿No tienes cuenta?{' '}
            <Link
              href="/register"
              className="font-medium transition-opacity hover:opacity-80"
              style={{ color: 'var(--brand-accent)' }}
            >
              Regístrate gratis
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
