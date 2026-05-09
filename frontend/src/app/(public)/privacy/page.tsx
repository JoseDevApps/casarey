import { ShieldCheck } from 'lucide-react'
import { StaticPageContent } from '@/components/static-page-content'

export const revalidate = 300

export const metadata = {
  title: 'Privacidad — Cabañas Coroico',
  description:
    'Cómo cuidamos tus datos personales y los de quienes te acompañan.',
}

export default function PrivacyPage() {
  return (
    <StaticPageContent
      slug="privacy"
      title="Política de privacidad"
      lead="Qué datos recogemos, para qué los usamos y por cuánto tiempo los guardamos."
      icon={ShieldCheck}
    />
  )
}
