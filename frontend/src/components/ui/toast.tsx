'use client'

import { createContext, useCallback, useContext, useState, ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

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

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  const dismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  const typeStyles: Record<ToastType, string> = {
    success: 'border-green-500/30 bg-green-900/30',
    error: 'border-red-500/30 bg-red-900/30',
    info: 'border-blue-500/30 bg-blue-900/30',
    warning: 'border-yellow-500/30 bg-yellow-900/30',
  }

  const typeTextStyles: Record<ToastType, string> = {
    success: 'text-green-300',
    error: 'text-red-300',
    info: 'text-blue-300',
    warning: 'text-yellow-300',
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'flex items-start gap-3 p-4 rounded-xl border text-sm shadow-lg',
              'animate-in slide-in-from-right',
              typeStyles[t.type]
            )}
            style={{ background: 'var(--surface-2)' }}
          >
            <span className={cn('flex-1', typeTextStyles[t.type])}>
              {t.message}
            </span>
            <button
              onClick={() => dismiss(t.id)}
              className="opacity-60 hover:opacity-100 transition-opacity mt-0.5"
              style={{ color: 'var(--text-secondary)' }}
              aria-label="Cerrar notificación"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
