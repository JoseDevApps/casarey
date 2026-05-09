'use client'

import { createContext, useCallback, useContext, useState, ReactNode } from 'react'
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DURATION: Record<ToastType, number> = {
  success: 4500,
  info: 3500,
  warning: 5000,
  error: 6500, // errors deserve longer reading time
}

const TONE: Record<
  ToastType,
  { bg: string; ring: string; iconBg: string; iconColor: string; icon: typeof CheckCircle2 }
> = {
  success: {
    bg: 'rgba(91, 168, 110, 0.10)',
    ring: 'rgba(91, 168, 110, 0.32)',
    iconBg: 'rgba(91, 168, 110, 0.18)',
    iconColor: 'var(--color-success)',
    icon: CheckCircle2,
  },
  error: {
    bg: 'rgba(217, 99, 78, 0.10)',
    ring: 'rgba(217, 99, 78, 0.34)',
    iconBg: 'rgba(217, 99, 78, 0.20)',
    iconColor: 'var(--color-error)',
    icon: AlertCircle,
  },
  info: {
    bg: 'rgba(140, 180, 200, 0.10)',
    ring: 'rgba(140, 180, 200, 0.30)',
    iconBg: 'rgba(140, 180, 200, 0.18)',
    iconColor: 'var(--color-info)',
    icon: Info,
  },
  warning: {
    bg: 'rgba(232, 169, 58, 0.10)',
    ring: 'rgba(232, 169, 58, 0.32)',
    iconBg: 'rgba(232, 169, 58, 0.20)',
    iconColor: 'var(--brand-warm)',
    icon: AlertTriangle,
  },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = Math.random().toString(36).slice(2)
      setToasts((prev) => [...prev, { id, message, type }])
      setTimeout(() => dismiss(id), DURATION[type])
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        // aria-live + role for screen readers; non-focus stealing
        role="region"
        aria-live="polite"
        aria-label="Notificaciones"
        className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2.5 max-w-[360px] pointer-events-none"
      >
        {toasts.map((t) => {
          const tone = TONE[t.type]
          const Icon = tone.icon
          return (
            <div
              key={t.id}
              role={t.type === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl backdrop-blur-md animate-[slideInRight_220ms_cubic-bezier(0.22,0.61,0.36,1)]"
              style={{
                background: 'var(--surface-2)',
                backgroundImage: `linear-gradient(${tone.bg}, ${tone.bg})`,
                border: `1px solid ${tone.ring}`,
                boxShadow:
                  '0 12px 32px -12px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(244, 236, 216, 0.04)',
              }}
            >
              {/* Icon disc — same signature as the brand chip */}
              <span
                aria-hidden
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{ background: tone.iconBg }}
              >
                <Icon size={15} style={{ color: tone.iconColor }} />
              </span>

              <p
                className="flex-1 text-sm leading-snug pt-0.5"
                style={{ color: 'var(--text-primary)' }}
              >
                {t.message}
              </p>

              <button
                onClick={() => dismiss(t.id)}
                className="shrink-0 p-1 -m-1 rounded transition-opacity opacity-50 hover:opacity-100"
                style={{ color: 'var(--text-tertiary)' }}
                aria-label="Cerrar notificación"
              >
                <X size={13} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
