'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { Phone, User as UserIcon, ShieldCheck, X } from 'lucide-react'
import type { User } from '@/types/index'
import { apiFetch } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'

/** 59171524843 -> +591 71524843 */
function formatPhone(phone?: string | null): string {
  if (!phone) return ''
  const d = phone.replace(/\D/g, '')
  if (d.startsWith('591') && d.length === 11) return `+591 ${d.slice(3)}`
  return `+${d}`
}

const PHONE_CLEAN = /[\s\-().]/g
const PHONE_RE = /^(?:[67]\d{7}|\+?\d{10,15})$/

export default function PerfilPage() {
  const { toast } = useToast()
  const { data: me, mutate } = useSWR('/api/auth/me', (u: string) => apiFetch<User>(u))

  const [fullName, setFullName] = useState('')
  const [savingName, setSavingName] = useState(false)

  // Cambio de teléfono
  const [newPhone, setNewPhone] = useState('')
  const [password, setPassword] = useState('')
  const [sending, setSending] = useState(false)
  const [code, setCode] = useState('')
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (me) setFullName(me.full_name)
  }, [me])

  async function saveName() {
    setSavingName(true)
    try {
      await apiFetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName }),
      })
      toast('Nombre actualizado', 'success')
      mutate()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudo guardar', 'error')
    } finally {
      setSavingName(false)
    }
  }

  async function requestPhoneChange() {
    const cleaned = newPhone.replace(PHONE_CLEAN, '').replace(/^\+/, '')
    if (!PHONE_RE.test(cleaned)) {
      toast('Ingresa un celular válido (8 dígitos o formato internacional)', 'warning')
      return
    }
    if (!password) {
      toast('Ingresa tu contraseña actual para confirmar el cambio', 'warning')
      return
    }
    const phone = /^[67]\d{7}$/.test(cleaned) ? `591${cleaned}` : cleaned

    setSending(true)
    try {
      await apiFetch('/api/auth/change-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_phone: phone, current_password: password }),
      })
      toast('Te enviamos un código al número nuevo', 'success')
      setPassword('')
      setNewPhone('')
      mutate()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudo iniciar el cambio', 'error')
    } finally {
      setSending(false)
    }
  }

  async function confirmPhone() {
    if (code.replace(/\D/g, '').length !== 6) {
      toast('El código tiene 6 dígitos', 'warning')
      return
    }
    setConfirming(true)
    try {
      await apiFetch('/api/auth/verify-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.replace(/\D/g, '') }),
      })
      toast('Número actualizado y verificado', 'success')
      setCode('')
      mutate()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Código inválido', 'error')
    } finally {
      setConfirming(false)
    }
  }

  async function cancelChange() {
    try {
      await apiFetch('/api/auth/change-phone', { method: 'DELETE' })
      toast('Cambio cancelado', 'info')
      setCode('')
      mutate()
    } catch {
      toast('No se pudo cancelar', 'error')
    }
  }

  if (!me) {
    return (
      <div className="flex flex-col gap-4">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-40 rounded-2xl skeleton"
            style={{ background: 'var(--surface-1)' }}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="mb-1">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Mi perfil
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Actualiza tus datos y el número donde recibes las notificaciones.
        </p>
      </div>

      {/* ─── Datos personales ─── */}
      <div
        className="rounded-2xl p-5"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}
      >
        <h2
          className="font-semibold mb-4 flex items-center gap-2"
          style={{ color: 'var(--text-primary)' }}
        >
          <UserIcon size={16} style={{ color: 'var(--brand-accent)' }} />
          Datos personales
        </h2>
        <div className="flex flex-col gap-3">
          <Input
            id="full_name"
            label="Nombre completo"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <div>
            <label
              className="text-sm font-medium block mb-1.5"
              style={{ color: 'var(--text-secondary)' }}
            >
              Correo electrónico
            </label>
            <input className="input-field" value={me.email} disabled readOnly />
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
              El correo es tu identificador de acceso y no puede cambiarse.
            </p>
          </div>
          <Button
            variant="primary"
            onClick={saveName}
            loading={savingName}
            disabled={fullName.trim() === me.full_name}
            className="self-start mt-1"
          >
            Guardar cambios
          </Button>
        </div>
      </div>

      {/* ─── WhatsApp ─── */}
      <div
        className="rounded-2xl p-5"
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}
      >
        <h2
          className="font-semibold mb-1 flex items-center gap-2"
          style={{ color: 'var(--text-primary)' }}
        >
          <Phone size={16} style={{ color: 'var(--brand-accent)' }} />
          WhatsApp
        </h2>
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
          Aquí recibes los códigos de acceso y las novedades de tus reservas.
        </p>

        <div
          className="rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-3"
          style={{ background: 'var(--surface-2)' }}
        >
          <div>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Número actual
            </p>
            <p className="font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
              {formatPhone(me.phone) || 'Sin número'}
            </p>
          </div>
          {me.phone_verified && (
            <span
              className="text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5"
              style={{ background: 'rgba(79, 97, 68, 0.13)', color: 'var(--brand-primary)' }}
            >
              <ShieldCheck size={12} />
              Verificado
            </span>
          )}
        </div>

        {me.pending_phone ? (
          <div
            className="rounded-xl p-4"
            style={{
              background: 'rgba(240, 100, 47, 0.10)',
              border: '1px solid rgba(240, 100, 47, 0.28)',
            }}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Confirma tu número nuevo
                </p>
                <p className="text-sm font-mono mt-0.5" style={{ color: 'var(--brand-accent)' }}>
                  {formatPhone(me.pending_phone)}
                </p>
                <p className="text-xs mt-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Te enviamos un código de 6 dígitos. Hasta que lo confirmes, tus
                  notificaciones siguen llegando al número actual.
                </p>
              </div>
              <button
                type="button"
                onClick={cancelChange}
                title="Cancelar cambio"
                aria-label="Cancelar cambio de número"
                className="shrink-0 hover:opacity-70"
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="------"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                aria-label="Código de verificación"
                className="input-field text-center text-lg tracking-[0.4em] font-mono"
              />
              <Button variant="primary" onClick={confirmPhone} loading={confirming}>
                Confirmar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="new_phone"
                className="text-sm font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                Nuevo número
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
                  id="new_phone"
                  type="tel"
                  placeholder="71234567"
                  className="input-field flex-1"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                />
              </div>
            </div>
            <Input
              id="current_password"
              label="Tu contraseña actual"
              type="password"
              placeholder="Para confirmar que eres tú"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Pedimos tu contraseña porque este número recibe los códigos para
              recuperar la cuenta.
            </p>
            <Button
              variant="primary"
              onClick={requestPhoneChange}
              loading={sending}
              className="self-start mt-1"
            >
              Enviar código al número nuevo
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
