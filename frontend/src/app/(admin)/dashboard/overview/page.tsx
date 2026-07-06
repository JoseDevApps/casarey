import { AvailabilityOverview } from '@/components/availability-overview'

export const metadata = {
  title: 'Disponibilidad — Cabañas Coroico',
}

export default function OverviewPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Disponibilidad de tus cabañas
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Estado de hoy y calendario de ocupación de cada cabaña de un vistazo.
        </p>
      </div>

      <AvailabilityOverview />
    </div>
  )
}
