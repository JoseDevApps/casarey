'use client'

import { useState, type InputHTMLAttributes } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, KeyRound } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { apiFetch } from '@/lib/api-client'
import { dashboardHomeForRole, type UserRole } from '@/lib/auth'

const schema = z
  .object({
    current_password: z.string().min(1, 'Ingresa la contraseña temporal actual'),
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

interface MeResponse {
  role: UserRole
}

export function ChangePasswordForm() {
  const router = useRouter()
  const { toast } = useToast()
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(values: FormValues) {
    try {
      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: values.current_password,
          new_password: values.new_password,
        }),
      })

      const me = await apiFetch<MeResponse>('/api/auth/me')
      toast('Contraseña actualizada correctamente', 'success')
      router.push(dashboardHomeForRole(me.role))
      router.refresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudo actualizar la contraseña', 'error')
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{ background: 'var(--surface-0)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8"
        style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--border-mid)',
        }}
      >
        <div className="mb-6">
          <span
            className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider mb-3"
            style={{ color: 'var(--brand-accent)' }}
          >
            <KeyRound size={13} /> Seguridad de cuenta
          </span>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Cambia tu contraseña
          </h1>
          <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
            Tu contraseña fue restablecida por un super admin. Debes definir una nueva para continuar.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <PasswordField
            id="current_password"
            label="Contraseña temporal actual"
            placeholder="Ingresa la contraseña temporal"
            show={showCurrent}
            onToggle={() => setShowCurrent(!showCurrent)}
            error={errors.current_password?.message}
            autoComplete="current-password"
            {...register('current_password')}
          />

          <PasswordField
            id="new_password"
            label="Nueva contraseña"
            placeholder="Mínimo 8 caracteres"
            show={showNew}
            onToggle={() => setShowNew(!showNew)}
            error={errors.new_password?.message}
            autoComplete="new-password"
            {...register('new_password')}
          />

          <PasswordField
            id="confirm_password"
            label="Confirmar nueva contraseña"
            placeholder="Repite la nueva contraseña"
            show={showConfirm}
            onToggle={() => setShowConfirm(!showConfirm)}
            error={errors.confirm_password?.message}
            autoComplete="new-password"
            {...register('confirm_password')}
          />

          <Button type="submit" variant="primary" size="lg" className="w-full mt-2" loading={isSubmitting}>
            Guardar nueva contraseña
          </Button>
        </form>
      </div>
    </div>
  )
}

interface PasswordFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string
  label: string
  placeholder: string
  show: boolean
  onToggle: () => void
  error?: string
}

function PasswordField({
  id,
  label,
  placeholder,
  show,
  onToggle,
  error,
  ...props
}: PasswordFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          placeholder={placeholder}
          className="pr-10"
          error={error}
          {...props}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2"
          style={{ color: 'var(--text-muted)' }}
          aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  )
}
