'use client'

import useSWR from 'swr'
import { apiFetch } from '@/lib/api-client'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp } from 'lucide-react'

interface FinanceSummaryItem {
  year: number
  month: number
  property_id: string
  property_name: string
  total: number
  reservation_count: number
}

function fetcher(url: string) {
  return apiFetch<FinanceSummaryItem[]>(url)
}

const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export default function AdminFinancesPage() {
  const { data, error, isLoading } = useSWR('/api/finances/summary', fetcher)

  const grandTotal = data?.reduce((sum, row) => sum + Number(row.total), 0) ?? 0

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Finanzas</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Ingresos mensuales calculados sobre reservas confirmadas
        </p>
      </div>

      {/* Summary card */}
      <div
        className="rounded-2xl p-6 mb-8 flex items-center gap-5"
        style={{ background: 'var(--surface-4)', border: '1px solid rgba(224,155,107,0.15)' }}
      >
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(224,155,107,0.15)' }}>
          <TrendingUp size={22} style={{ color: 'var(--brand-accent)' }} />
        </div>
        <div>
          <p className="text-sm mb-0.5" style={{ color: 'var(--text-secondary)' }}>Total histórico confirmado</p>
          <p className="text-3xl font-bold" style={{ color: 'var(--brand-accent)' }}>{formatCurrency(grandTotal)}</p>
        </div>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--surface-1)' }} />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl p-6 text-sm text-center" style={{ background: 'rgba(220,80,80,0.08)', border: '1px solid rgba(220,80,80,0.2)', color: 'var(--color-error)' }}>
          Error al cargar datos financieros.
        </div>
      )}

      {data && data.length === 0 && (
        <div className="rounded-xl p-12 text-center" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Sin reservas confirmadas aún.</p>
        </div>
      )}

      {data && data.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-mid)' }}>
                {['Período', 'Propiedad', 'Reservas', 'Total'].map((h) => (
                  <th key={h} className="text-left px-5 py-3.5 font-medium" style={{ color: 'var(--text-tertiary)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr
                  key={`${row.year}-${row.month}-${row.property_id}`}
                  style={{ borderBottom: i < data.length - 1 ? '1px solid var(--border-soft)' : 'none' }}
                  className="transition-colors hover:bg-[var(--surface-2)]"
                >
                  <td className="px-5 py-3.5 font-medium" style={{ color: 'var(--text-primary)' }}>
                    {MONTH_NAMES[(row.month - 1) % 12]} {row.year}
                  </td>
                  <td className="px-5 py-3.5" style={{ color: 'var(--text-secondary)' }}>
                    {row.property_name}
                  </td>
                  <td className="px-5 py-3.5" style={{ color: 'var(--text-tertiary)' }}>
                    {row.reservation_count}
                  </td>
                  <td className="px-5 py-3.5 font-semibold" style={{ color: 'var(--brand-accent)' }}>
                    {formatCurrency(row.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
