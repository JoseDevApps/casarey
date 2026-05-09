import { ScrollText } from 'lucide-react'
import { StaticPageContent } from '@/components/static-page-content'

export const revalidate = 300

export const metadata = {
  title: 'Términos y condiciones — Cabañas Coroico',
  description:
    'Condiciones aplicables a las reservas y estadías en Cabañas Coroico, Yungas, Bolivia.',
}

export default function TermsPage() {
  return (
    <StaticPageContent
      slug="terms"
      title="Términos y condiciones"
      lead="Lo que puedes esperar de tu reserva, y lo que esperamos de ti."
      icon={ScrollText}
    />
  )
}
