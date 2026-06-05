import type { Metadata } from 'next'
import { Literata, DM_Sans, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { ToastProvider } from '@/components/ui/toast'

// Tipografía Yungas Morning Radiance: Literata editorial + DM Sans funcional.
// next/font autohospeda las fuentes en build time → sin requests a Google
// en el cliente, sin layout shift, perf óptima en Vercel/CDN.
const literata = Literata({
  subsets: ['latin'],
  variable: '--font-literata',
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  weight: ['400', '500'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Cabañas Coroico — Refugio en los Yungas',
  description:
    'Reserva cabañas con vista a los Yungas. Naturaleza, descanso y la calidez de Coroico.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="es"
      className={`${literata.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
