import Link from 'next/link'
import { Logo } from '@/components/logo'
import { AuthHeaderSlot } from '@/components/auth-header-slot'
import { getMe } from '@/lib/auth-server'

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const me = await getMe()

  return (
    <>
      <header
        className="sticky top-0 z-40"
        style={{
          background: 'rgba(255, 255, 255, 0.82)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--border-soft)',
        }}
      >
        <nav className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center transition-opacity hover:opacity-80"
            aria-label="Cabañas Coroico — inicio"
          >
            <Logo variant="full" size={28} />
          </Link>

          {/* Right slot — auth or user nav */}
          <div className="flex items-center gap-2">
            <AuthHeaderSlot initialUser={me} />
          </div>
        </nav>
      </header>

      <main>{children}</main>

      <footer
        className="mt-16 py-8"
        style={{
          borderTop: '1px solid var(--border-soft)',
          background: 'var(--surface-0)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            &copy; {new Date().getFullYear()} Cabañas Coroico — Yungas, Bolivia.
          </p>
          <div className="flex items-center gap-6">
            <Link
              href="/terms"
              className="text-sm transition-colors hover:opacity-80"
              style={{ color: 'var(--text-muted)' }}
            >
              Términos
            </Link>
            <Link
              href="/privacy"
              className="text-sm transition-colors hover:opacity-80"
              style={{ color: 'var(--text-muted)' }}
            >
              Privacidad
            </Link>
            <Link
              href="/contact"
              className="text-sm transition-colors hover:opacity-80"
              style={{ color: 'var(--text-muted)' }}
            >
              Contacto
            </Link>
          </div>
        </div>
      </footer>
    </>
  )
}
