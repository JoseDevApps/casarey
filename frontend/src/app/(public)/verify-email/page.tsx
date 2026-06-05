'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/logo'

type VerificationState = 'loading' | 'success' | 'error'

export default function VerifyEmailPage() {
  const [state, setState] = useState<VerificationState>('loading')
  const [message, setMessage] = useState('Verificando tu cuenta...')

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token')
    if (!token) {
      setState('error')
      setMessage('El enlace de verificación es inválido o está incompleto.')
      return
    }

    let cancelled = false

    async function verify() {
      try {
        const res = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ token }),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({} as { detail?: string }))
          if (cancelled) return
          setState('error')
          setMessage(
            err.detail || 'No se pudo verificar la cuenta. Solicita un nuevo enlace.',
          )
          return
        }

        if (cancelled) return
        setState('success')
        setMessage('Tu cuenta fue verificada correctamente. Ya puedes iniciar sesión.')
      } catch {
        if (cancelled) return
        setState('error')
        setMessage('Error de conexión al verificar la cuenta. Intenta nuevamente.')
      }
    }

    verify()
    return () => {
      cancelled = true
    }
  }, [])

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
          <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Verificación de correo
          </h1>

          <p
            className="text-sm"
            style={{
              color:
                state === 'success'
                  ? 'var(--color-success)'
                  : state === 'error'
                    ? 'var(--color-error)'
                    : 'var(--text-secondary)',
            }}
          >
            {message}
          </p>

          <div className="mt-6 flex flex-col gap-3">
            <Link
              href="/login"
              className="btn-primary text-base px-6 py-3 rounded-lg w-full text-center inline-flex items-center justify-center"
            >
              {state === 'success' ? 'Ir a iniciar sesión' : 'Volver al login'}
            </Link>

            {state === 'error' && (
              <p className="text-xs text-center" style={{ color: 'var(--text-tertiary)' }}>
                Si el enlace expiró, intenta iniciar sesión y usa el reenvío de verificación.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
