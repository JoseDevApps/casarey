import Link from 'next/link'
import { Logo } from '@/components/logo'
import { UserMenu } from '@/components/user-menu'
import {
  getMe,
  dashboardHomeForRole,
  initialsOf,
  roleLabel,
} from '@/lib/auth-server'

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
          background: 'rgba(8, 18, 13, 0.92)',
          backdropFilter: 'blur(12px)',
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
            <Logo variant="full" size={28} tone="onForest" />
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

          {/* Right slot — auth or user nav */}
          <div className="flex items-center gap-2">
            {me ? (
              <UserMenu
                fullName={me.full_name}
                email={me.email}
                initials={initialsOf(me.full_name)}
                roleLabel={roleLabel(me.role)}
                dashboardHref={dashboardHomeForRole(me.role)}
                placement="header"
              />
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden sm:inline-flex items-center text-sm px-3 py-2 rounded-lg font-medium transition-colors hover:bg-[var(--surface-2)]"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Iniciar sesión
                </Link>
                <Link
                  href="/register"
                  className="inline-flex items-center text-sm px-4 py-2 rounded-lg font-semibold transition-colors"
                  style={{
                    background: 'var(--brand-accent)',
                    color: 'var(--color-bone, rgb(249,244,230))',
                  }}
                >
                  Crear cuenta
                </Link>
              </>
            )}
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
