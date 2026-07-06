'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { MessageCircle, Mail } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/logo'

type Channel = 'whatsapp' | 'email'

const schema = z.object({
  email: z.string().email('Email inválido'),
})

type FormValues = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [channel, setChannel] = useState<Channel>('whatsapp')
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
        body: JSON.stringify({ email: values.email, channel }),
      })
      // Modo código: la misma pantalla de reset acepta el código de WhatsApp
      // o, si llegó un enlace al correo, ese enlace abre la misma página.
      router.push(
        `/reset-password?email=${encodeURIComponent(values.email)}&channel=${channel}`
      )
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
            <Logo variant="full" size={32} />
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
            Si tu cuenta existe, te enviaremos un código de 6 dígitos para
            restablecer tu contraseña.
          </p>

          {(
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

              {/* Selector de canal */}
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  ¿Dónde quieres recibirlo?
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, hint: 'Código de 6 dígitos' },
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

              {networkError && (
                <p className="text-xs" style={{ color: 'var(--color-error)' }}>
                  {networkError}
                </p>
              )}

              <Button type="submit" variant="primary" size="lg" className="w-full mt-1" loading={isSubmitting}>
                Enviar código
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
