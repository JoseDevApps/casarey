'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, LogOut, ChevronDown, ChevronUp, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useToast } from '@/components/ui/toast'

interface UserMenuProps {
  fullName: string
  email: string
  initials: string
  roleLabel: string
  dashboardHref: string
  /**
   * `header` — trigger horizontal con chevron-down, dropdown abre debajo.
   *            Mobile colapsa a solo el avatar.
   * `sidebar` — trigger horizontal en el pie del sidebar; cuando `collapsed`
   *             es solo el avatar, dropdown abre a la derecha. Cuando expandido,
   *             dropdown abre arriba (side=top) para no salirse de la pantalla.
   */
  placement?: 'header' | 'sidebar'
  /** Solo aplica con placement="sidebar". */
  collapsed?: boolean
}

const SIDE_BY_PLACEMENT = {
  header: { side: 'bottom' as const, align: 'end' as const },
  'sidebar-expanded': { side: 'top' as const, align: 'start' as const },
  'sidebar-collapsed': { side: 'right' as const, align: 'end' as const },
}

export function UserMenu({
  fullName,
  email,
  initials,
  roleLabel,
  dashboardHref,
  placement = 'header',
  collapsed = false,
}: UserMenuProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [signingOut, setSigningOut] = useState(false)

  async function handleLogout() {
    setSigningOut(true)
    try {
      const res = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok && res.status !== 204) {
        throw new Error('No se pudo cerrar la sesión')
      }
      window.dispatchEvent(new CustomEvent('auth:changed'))
      toast('Sesión cerrada · ¡Hasta pronto!', 'success')
      // Beat para que el usuario alcance a leer antes de redirigir.
      // 600ms ≈ duración natural de "lectura confirmada" sin sentirse lento.
      await new Promise((r) => setTimeout(r, 600))
      router.replace('/')
      router.refresh()
    } catch (err) {
      setSigningOut(false)
      toast(
        err instanceof Error ? err.message : 'No se pudo cerrar la sesión',
        'error',
      )
    }
  }

  const placementKey =
    placement === 'header'
      ? 'header'
      : collapsed
        ? 'sidebar-collapsed'
        : 'sidebar-expanded'
  const { side, align } = SIDE_BY_PLACEMENT[placementKey]

  // Avatar chip — el signature se replica idéntico en los tres contextos
  const avatar = (
    <span
      aria-hidden
      className="font-mono text-xs font-semibold w-9 h-9 rounded-full flex items-center justify-center shrink-0"
      style={{
        background: 'var(--brand-accent)',
        color: 'var(--color-bone, rgb(249,244,230))',
        letterSpacing: '0.04em',
      }}
    >
      {initials}
    </span>
  )

  const triggerButton = (() => {
    if (placement === 'sidebar' && collapsed) {
      return (
        <button
          type="button"
          aria-label={`Menú de ${fullName}`}
          className="flex items-center justify-center w-full p-1 rounded-lg transition-colors hover:bg-[var(--surface-2)]"
        >
          {avatar}
        </button>
      )
    }

    const isSidebar = placement === 'sidebar'
    return (
      <button
        type="button"
        aria-label={`Menú de ${fullName}`}
        className={
          isSidebar
            ? 'flex items-center gap-2.5 w-full pl-1 pr-2 py-1.5 rounded-lg transition-colors hover:bg-[var(--surface-2)]'
            : 'flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-full transition-colors hover:bg-[var(--surface-2)]'
        }
      >
        {avatar}
        <span
          className={
            isSidebar
              ? 'flex flex-col items-start leading-tight flex-1 min-w-0'
              : 'hidden sm:flex flex-col items-start leading-tight'
          }
        >
          <span
            className="text-sm font-medium max-w-[14ch] truncate"
            style={{ color: 'var(--text-primary)' }}
          >
            {isSidebar ? fullName : fullName.split(' ')[0]}
          </span>
          <span
            className="text-[10px] font-mono uppercase tracking-wider"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {roleLabel}
          </span>
        </span>
        {isSidebar ? (
          <ChevronUp size={14} style={{ color: 'var(--text-tertiary)' }} aria-hidden />
        ) : (
          <ChevronDown
            size={14}
            className="hidden sm:block"
            style={{ color: 'var(--text-tertiary)' }}
            aria-hidden
          />
        )}
      </button>
    )
  })()

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{triggerButton}</DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side={side}
          align={align}
          sideOffset={8}
          collisionPadding={12}
          className="z-50 min-w-[240px] rounded-xl p-1.5 shadow-2xl outline-none data-[state=open]:animate-[fadeIn_140ms_ease-out]"
          style={{
            background: 'var(--surface-3)',
            border: '1px solid var(--border-mid)',
          }}
        >
          {/* User identity header */}
          <div className="px-3 py-2.5">
            <p
              className="font-serif text-base leading-tight truncate"
              style={{ color: 'var(--text-primary)' }}
            >
              {fullName}
            </p>
            <p
              className="text-xs truncate mt-0.5"
              style={{ color: 'var(--text-tertiary)' }}
              title={email}
            >
              {email}
            </p>
            <span
              className="inline-block mt-2 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{
                background: 'rgba(167, 52, 0, 0.12)',
                color: 'var(--brand-accent)',
                border: '1px solid rgba(167, 52, 0, 0.26)',
              }}
            >
              {roleLabel}
            </span>
          </div>

          <DropdownMenu.Separator
            className="h-px mx-2 my-1"
            style={{ background: 'var(--border-soft)' }}
          />

          <DropdownMenu.Item asChild>
            <Link
              href={dashboardHref}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer outline-none transition-colors data-[highlighted]:bg-[var(--surface-2)]"
              style={{ color: 'var(--text-secondary)' }}
            >
              <LayoutDashboard size={15} style={{ color: 'var(--brand-accent)' }} />
              <span className="flex-1">Mi panel</span>
              <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} aria-hidden />
            </Link>
          </DropdownMenu.Item>

          <DropdownMenu.Item
            onSelect={(e) => {
              e.preventDefault()
              handleLogout()
            }}
            disabled={signingOut}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer outline-none transition-colors data-[highlighted]:bg-[var(--surface-2)] data-[disabled]:opacity-50"
            style={{ color: 'var(--text-secondary)' }}
          >
            <LogOut size={15} style={{ color: 'var(--text-tertiary)' }} />
            {signingOut ? 'Saliendo…' : 'Cerrar sesión'}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
