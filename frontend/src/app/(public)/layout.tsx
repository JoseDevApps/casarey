import Link from 'next/link'
import { Home } from 'lucide-react'

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <header
        className="sticky top-0 z-40"
        style={{
          background: 'rgba(5, 5, 5, 0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border-soft)',
        }}
      >
        <nav className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2.5 font-bold text-lg transition-opacity hover:opacity-80"
            style={{ color: 'var(--text-primary)' }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--brand-primary)' }}
            >
              <Home size={16} style={{ color: 'var(--brand-accent)' }} />
            </div>
            <span>
              Casa del {' '}
              <span style={{ color: 'var(--brand-accent)' }}>Rey</span>
            </span>
          </Link>

          {/* Nav links */}
          <div className="hidden sm:flex items-center gap-1">
            <Link
              href="/"
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 hover:bg-[var(--surface-2)]"
              style={{ color: 'var(--text-secondary)' }}
            >
              Inicio
            </Link>
            <Link
              href="/properties"
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 hover:bg-[var(--surface-2)]"
              style={{ color: 'var(--text-secondary)' }}
            >
              Propiedades
            </Link>
          </div>

          {/* Auth buttons */}
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="btn-primary text-sm px-4 py-2 rounded-lg font-semibold"
              style={{
                background: 'var(--brand-accent)',
                color: 'rgb(5,5,5)',
              }}
            >
              Iniciar Sesión
            </Link>
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
            &copy; {new Date().getFullYear()} Casas de Campo. Todos los derechos
            reservados.
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
