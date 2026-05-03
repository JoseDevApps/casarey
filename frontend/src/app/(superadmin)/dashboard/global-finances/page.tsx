'use client'

import useSWR from 'swr'
import { apiFetch } from '@/lib/api-client'
import { formatCurrency } from '@/lib/utils'
import { Globe, TrendingUp } from 'lucide-react'

interface GlobalFinanceItem {
  year: number
  month: number
  admin_id: string
  admin_name: string
  property_id: string
  property_name: string
  total: number
  reservation_count: number
}

function fetcher(url: string) {
  return apiFetch<GlobalFinanceItem[]>(url)
}

const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export default function GlobalFinancesPage() {
  const { data, error, isLoading } = useSWR('/api/finances/global', fetcher)

  const grandTotal = data?.reduce((sum, row) => sum + Number(row.total), 0) ?? 0
  const totalReservations = data?.reduce((sum, row) => sum + row.reservation_count, 0) ?? 0

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Finanzas Globales</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Vista de auditoría — todos los administradores y propiedades
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="rounded-2xl p-5 flex items-center gap-4" style={{ background: 'var(--surface-4)', border: '1px solid rgba(224,155,107,0.15)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(224,155,107,0.15)' }}>
            <TrendingUp size={18} style={{ color: 'var(--brand-accent)' }} />
          </div>
          <div>
            <p className="text-xs mb-0.5" style={{ color: 'var(--text-secondary)' }}>Total plataforma</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--brand-accent)' }}>{formatCurrency(grandTotal)}</p>
          </div>
        </div>
        <div className="rounded-2xl p-5 flex items-center gap-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-mid)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--surface-3)' }}>
            <Globe size={18} style={{ color: 'var(--text-secondary)' }} />
          </div>
          <div>
            <p className="text-xs mb-0.5" style={{ color: 'var(--text-secondary)' }}>Reservas confirmadas</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{totalReservations}</p>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: 'var(--surface-1)' }} />)}
        </div>
      )}

      {error && (
        <div className="rounded-xl p-6 text-sm text-center" style={{ background: 'rgba(220,80,80,0.08)', border: '1px solid rgba(220,80,80,0.2)', color: 'var(--color-error)' }}>
          Error al cargar finanzas globales.
        </div>
      )}

      {data && data.length === 0 && (
        <div className="rounded-xl p-12 text-center" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Sin datos financieros aún.</p>
        </div>
      )}

      {data && data.length > 0 && (
        <div className="rounded-2xl overflow-auto" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}>
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-mid)' }}>
                {['Período', 'Administrador', 'Propiedad', 'Reservas', 'Total'].map((h) => (
                  <th key={h} className="text-left px-5 py-3.5 font-medium" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={`${row.year}-${row.month}-${row.property_id}`} style={{ borderBottom: i < data.length - 1 ? '1px solid var(--border-soft)' : 'none' }}>
                  <td className="px-5 py-3.5 font-medium" style={{ color: 'var(--text-primary)' }}>
                    {MONTH_NAMES[(row.month - 1) % 12]} {row.year}
                  </td>
                  <td className="px-5 py-3.5" style={{ color: 'var(--text-secondary)' }}>{row.admin_name}</td>
                  <td className="px-5 py-3.5" style={{ color: 'var(--text-secondary)' }}>{row.property_name}</td>
                  <td className="px-5 py-3.5 text-center" style={{ color: 'var(--text-tertiary)' }}>{row.reservation_count}</td>
                  <td className="px-5 py-3.5 font-semibold" style={{ color: 'var(--brand-accent)' }}>{formatCurrency(row.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '1px solid var(--border-mid)' }}>
                <td colSpan={4} className="px-5 py-3.5 font-semibold text-right" style={{ color: 'var(--text-secondary)' }}>Total</td>
                <td className="px-5 py-3.5 font-bold text-base" style={{ color: 'var(--brand-accent)' }}>{formatCurrency(grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
