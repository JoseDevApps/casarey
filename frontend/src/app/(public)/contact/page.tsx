import { Mail } from 'lucide-react'
import { StaticPageContent } from '@/components/static-page-content'

export const revalidate = 300

export const metadata = {
  title: 'Contacto — Cabañas Coroico',
  description:
    'Coordina tu reserva, pregunta por disponibilidad o llega caminando — aquí están todas las formas de hablar con nosotros.',
}

export default function ContactPage() {
  return (
    <StaticPageContent
      slug="contact"
      title="Contacto"
      lead="Estamos en los Yungas. Te respondemos rápido."
      icon={Mail}
    />
  )
}
