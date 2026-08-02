'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MessageCircle } from 'lucide-react'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'

const RESEND_COOLDOWN_S = 60

export default function VerifyCodePage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [medium, setMedium] = useState<'whatsapp' | 'email'>('email')
  const [fellBack, setFellBack] = useState(false)
  const [waLink, setWaLink] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const fromQuery = params.get('email')
    if (fromQuery) setEmail(fromQuery)
    if (params.get('channel') === 'whatsapp') setMedium('whatsapp')
    if (params.get('fallback') === '1') setFellBack(true)
    inputRef.current?.focus()

    // Click-to-chat: permite recibir el código por WhatsApp abriendo la
    // ventana de servicio de 24 h (no requiere plantilla AUTHENTICATION).
    fetch('/api/auth/whatsapp-optin', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { enabled?: boolean; link?: string } | null) => {
        if (d?.enabled && d.link) setWaLink(d.link)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const id = setInterval(() => setCooldown((c) => c - 1), 1000)
    return () => clearInterval(id)
  }, [cooldown])

  async function submitCode(value: string) {
    if (submitting || value.length !== 6 || !email) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, code: value }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as { detail?: string }))
        setError(err.detail || 'Código inválido o expirado. Vuelve a intentar.')
        setCode('')
        inputRef.current?.focus()
        return
      }
      router.push('/login?verified=1')
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  function onCodeChange(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 6)
    setCode(digits)
    setError(null)
    if (digits.length === 6) submitCode(digits)
  }

  async function resend(channel: 'whatsapp' | 'email' = 'whatsapp') {
    if (cooldown > 0 || !email) return
    setError(null)
    setInfo(null)
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, channel }),
      })
      if (res.status === 429) {
        setError('Demasiados intentos. Espera un momento antes de pedir otro código.')
        setCooldown(RESEND_COOLDOWN_S)
        return
      }
      if (!res.ok) {
        setError('No se pudo reenviar. Intenta de nuevo en unos minutos.')
        return
      }
      const data = (await res.json().catch(() => ({}))) as { channel?: string }
      const newMedium = data.channel === 'whatsapp' ? 'whatsapp' : 'email'
      setMedium(newMedium)
      setInfo(
        newMedium === 'whatsapp'
          ? 'Te enviamos un nuevo código por WhatsApp.'
          : 'Te enviamos un nuevo código a tu correo (revisa spam).'
      )
      setCooldown(RESEND_COOLDOWN_S)
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
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
          style={{ background: 'var(--surface-1)', border: '1px solid var(--border-mid)' }}
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(79, 97, 68, 0.13)' }}
          >
            <MessageCircle size={22} style={{ color: 'var(--brand-primary)' }} />
          </div>

          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
            {medium === 'whatsapp' ? 'Revisa tu WhatsApp' : 'Revisa tu correo'}
          </h1>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
            Te enviamos un código de 6 dígitos
            {medium === 'email' ? ' a tu correo' : ' por WhatsApp'}
            {email ? (
              <>
                {' '}para verificar la cuenta de <strong>{email}</strong>
              </>
            ) : null}
            . Expira en 10 minutos.
            {medium === 'email' ? ' Si no lo ves, revisa la carpeta de spam.' : ''}
          </p>

          {fellBack && !waLink && (
            <div
              className="rounded-lg px-4 py-3 mb-5 text-sm"
              style={{
                background: 'rgba(240, 100, 47, 0.10)',
                border: '1px solid rgba(240, 100, 47, 0.28)',
                color: 'var(--text-primary)',
              }}
            >
              Pediste el código por WhatsApp, pero aún no podemos entregarlo por
              ese medio. Te lo enviamos a tu correo para que puedas continuar.
            </div>
          )}

          {waLink && (
            <div
              className="rounded-xl p-4 mb-5"
              style={{
                background: 'rgba(79, 97, 68, 0.10)',
                border: '1px solid rgba(79, 97, 68, 0.24)',
              }}
            >
              <p className="text-sm mb-3" style={{ color: 'var(--text-primary)' }}>
                <strong>¿Prefieres el código por WhatsApp?</strong> Toca el botón,
                envía el mensaje que aparece y te respondemos al instante con tu
                código.
              </p>
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 w-full text-base font-semibold px-6 py-3 rounded-xl transition-all duration-150"
                style={{
                  background: 'var(--brand-primary)',
                  color: 'var(--color-bone, rgb(255,255,255))',
                }}
              >
                <MessageCircle size={17} />
                Recibir código por WhatsApp
              </a>
            </div>
          )}

          {!email && (
            <div className="mb-4">
              <label
                htmlFor="email"
                className="text-sm font-medium block mb-1.5"
                style={{ color: 'var(--text-secondary)' }}
              >
                Correo de tu cuenta
              </label>
              <input
                id="email"
                type="email"
                className="input-field"
                placeholder="tu@email.com"
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          )}

          <label htmlFor="code" className="sr-only">
            Código de verificación
          </label>
          <input
            ref={inputRef}
            id="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="••••••"
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
            className="input-field text-center text-2xl tracking-[0.5em] font-mono"
            maxLength={6}
            disabled={submitting}
          />

          {error && (
            <p className="text-sm mt-3" style={{ color: 'var(--color-error)' }}>
              {error}
            </p>
          )}
          {info && (
            <p className="text-sm mt-3" style={{ color: 'var(--color-success)' }}>
              {info}
            </p>
          )}

          <Button
            type="button"
            variant="primary"
            size="lg"
            loading={submitting}
            onClick={() => submitCode(code)}
            disabled={code.length !== 6}
            className="w-full mt-5"
          >
            Verificar cuenta
          </Button>

          <div className="mt-5 flex flex-col gap-2 text-center">
            <button
              type="button"
              onClick={() => resend(medium)}
              disabled={cooldown > 0}
              className="text-sm font-medium hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ color: 'var(--brand-accent)' }}
            >
              {cooldown > 0 ? `Reenviar código (${cooldown}s)` : 'Reenviar código'}
            </button>
            <button
              type="button"
              onClick={() => resend(medium === 'whatsapp' ? 'email' : 'whatsapp')}
              disabled={cooldown > 0}
              className="text-sm hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {medium === 'whatsapp'
                ? 'Prefiero recibirlo por correo'
                : 'Prefiero recibirlo por WhatsApp'}
            </button>
            <Link
              href="/login"
              className="text-sm hover:opacity-80 mt-1"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Volver al login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
