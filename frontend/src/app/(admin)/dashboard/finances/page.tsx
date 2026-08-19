'use client'

import useSWR from 'swr'
import { apiFetch } from '@/lib/api-client'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, Receipt } from 'lucide-react'

interface MonthlyIncomeSummary {
  year: number
  month: number
  property_id: string
  property_name: string
  total_income: string
  collected_income?: string
  pending_income?: string
  confirmed_reservations: number
}

interface AdminFinanceSummaryResponse {
  items: MonthlyIncomeSummary[]
  /** Facturado: monto final de las reservas confirmadas */
  total_income: string
  /** Cobrado: anticipos ya confirmados */
  collected_income?: string
  /** Por cobrar: saldos que se pagan al llegar */
  pending_income?: string
}

function fetcher(url: string) {
  return apiFetch<AdminFinanceSummaryResponse>(url)
}

const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export default function AdminFinancesPage() {
  const { data, error, isLoading } = useSWR('/api/finances/summary', fetcher)
  const items = data?.items ?? []
  const grandTotal = data ? Number(data.total_income) : 0
  const collected = data ? Number(data.collected_income ?? 0) : 0
  const pending = data ? Number(data.pending_income ?? 0) : 0
  const totalReservations = items.reduce((sum, row) => sum + row.confirmed_reservations, 0)

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Finanzas</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Ingresos mensuales calculados sobre reservas confirmadas
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div
          className="rounded-2xl p-5 flex items-center gap-4"
          style={{ background: 'var(--surface-4)', border: '1px solid rgba(224,155,107,0.15)' }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(224,155,107,0.15)' }}>
            <TrendingUp size={18} style={{ color: 'var(--brand-accent)' }} />
          </div>
          <div>
            <p className="text-xs mb-0.5" style={{ color: 'var(--text-secondary)' }}>Facturado</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--brand-accent)' }}>{formatCurrency(grandTotal)}</p>
          </div>
        </div>
        <div
          className="rounded-2xl p-5 flex items-center gap-4"
          style={{ background: 'rgba(79, 97, 68, 0.10)', border: '1px solid rgba(79, 97, 68, 0.24)' }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(79, 97, 68, 0.15)' }}>
            <TrendingUp size={18} style={{ color: 'var(--brand-primary)' }} />
          </div>
          <div>
            <p className="text-xs mb-0.5" style={{ color: 'var(--text-secondary)' }}>Cobrado (anticipos)</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--brand-primary)' }}>{formatCurrency(collected)}</p>
          </div>
        </div>
        <div
          className="rounded-2xl p-5 flex items-center gap-4"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border-mid)' }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--surface-3)' }}>
            <Receipt size={18} style={{ color: 'var(--text-secondary)' }} />
          </div>
          <div>
            <p className="text-xs mb-0.5" style={{ color: 'var(--text-secondary)' }}>Por cobrar (al llegar)</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(pending)}</p>
          </div>
        </div>
        <div
          className="rounded-2xl p-5 flex items-center gap-4"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border-mid)' }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--surface-3)' }}>
            <Receipt size={18} style={{ color: 'var(--text-secondary)' }} />
          </div>
          <div>
            <p className="text-xs mb-0.5" style={{ color: 'var(--text-secondary)' }}>Reservas confirmadas</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{totalReservations}</p>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl skeleton" style={{ background: 'var(--surface-1)' }} />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl p-6 text-sm text-center" style={{ background: 'rgba(186,26,26,0.08)', border: '1px solid rgba(186,26,26,0.22)', color: 'var(--color-error)' }}>
          Error al cargar datos financieros.
        </div>
      )}

      {data && items.length === 0 && (
        <div className="rounded-xl p-12 text-center" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-soft)' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Sin reservas confirmadas aún.</p>
        </div>
      )}

      {items.length > 0 && (
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
              {items.map((row, i) => (
                <tr
                  key={`${row.year}-${row.month}-${row.property_id}`}
                  style={{ borderBottom: i < items.length - 1 ? '1px solid var(--border-soft)' : 'none' }}
                  className="transition-colors hover:bg-[var(--surface-2)]"
                >
                  <td className="px-5 py-3.5 font-medium" style={{ color: 'var(--text-primary)' }}>
                    {MONTH_NAMES[(row.month - 1) % 12]} {row.year}
                  </td>
                  <td className="px-5 py-3.5" style={{ color: 'var(--text-secondary)' }}>
                    {row.property_name}
                  </td>
                  <td className="px-5 py-3.5" style={{ color: 'var(--text-tertiary)' }}>
                    {row.confirmed_reservations}
                  </td>
                  <td className="px-5 py-3.5 font-semibold" style={{ color: 'var(--brand-accent)' }}>
                    {formatCurrency(Number(row.total_income))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '1px solid var(--border-mid)' }}>
                <td colSpan={3} className="px-5 py-3.5 font-semibold text-right" style={{ color: 'var(--text-secondary)' }}>Total</td>
                <td className="px-5 py-3.5 font-bold text-base" style={{ color: 'var(--brand-accent)' }}>{formatCurrency(grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
