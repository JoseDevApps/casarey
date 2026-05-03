import type { ReservationStatus } from '@/types/index'

const STATUS_LABELS: Record<ReservationStatus, string> = {
  PENDING_APPROVAL: 'Pendiente aprobación',
  APPROVED_WAITING_PAYMENT: 'Esperando pago',
  CONFIRMED: 'Confirmada',
  REJECTED: 'Rechazada',
  CANCELLED: 'Cancelada',
}

const STATUS_CLASS: Record<ReservationStatus, string> = {
  PENDING_APPROVAL: 'badge-pending',
  APPROVED_WAITING_PAYMENT: 'badge-approved',
  CONFIRMED: 'badge-confirmed',
  REJECTED: 'badge-rejected',
  CANCELLED: 'badge-cancelled',
}

interface Props {
  status: ReservationStatus
}

export function ReservationStatusBadge({ status }: Props) {
  return (
    <span className={STATUS_CLASS[status]}>{STATUS_LABELS[status]}</span>
  )
}
