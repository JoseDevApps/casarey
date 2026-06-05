'use client'

import React from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

interface Props {
  fallback?: (error: Error, reset: () => void) => React.ReactNode
  children: React.ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info)
  }

  reset = () => this.setState({ hasError: false, error: undefined })

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset)
      }
      return (
        <div
          className="flex flex-col items-center justify-center gap-4 rounded-xl p-8 text-center"
          style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(186, 26, 26, 0.08)' }}
          >
            <AlertTriangle size={22} style={{ color: 'var(--color-error, #ba1a1a)' }} />
          </div>
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              Algo salió mal
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              {this.state.error.message || 'Ocurrió un error inesperado'}
            </p>
          </div>
          <button
            onClick={this.reset}
            className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            style={{ background: 'var(--surface-2)', color: 'var(--brand-accent)', border: '1px solid var(--border-mid)' }}
          >
            <RotateCcw size={14} />
            Reintentar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
