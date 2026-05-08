/**
 * Cabañas Coroico — logotipo digitalizado.
 * Trazos derivados del logo a mano alzada original (4 paths + sol).
 *
 * Uso:
 *   <Logo />                          → mark + wordmark, tonos default
 *   <Logo variant="mark" size={32} /> → solo el ícono, para favicon-like
 *   <Logo tone="onForest" />          → invertido para fondos forest
 *
 * Server component (sin "use client") — se renderiza estático y va al CDN.
 */

type LogoTone = 'default' | 'onForest' | 'monochrome'

const TONES: Record<
  LogoTone,
  { roof: string; slope: string; post: string; base: string; sun: string; word1: string; word2: string }
> = {
  // Sobre fondo claro (cream / superficies claras)
  default: {
    roof: 'var(--brand-accent)',
    slope: 'var(--brand-primary)',
    post: 'var(--brand-primary)',
    base: 'var(--brand-accent)',
    sun: 'var(--brand-warm)',
    word1: 'var(--brand-primary)',
    word2: 'var(--brand-accent)',
  },
  // Sobre fondo forest (dark mode del proyecto)
  onForest: {
    roof: 'var(--brand-warm)',
    slope: 'var(--text-primary)',
    post: 'var(--text-primary)',
    base: 'var(--brand-warm)',
    sun: 'var(--brand-warm)',
    word1: 'var(--text-primary)',
    word2: 'var(--brand-warm)',
  },
  // Una sola tinta — útil para impresión / contextos restringidos
  monochrome: {
    roof: 'currentColor',
    slope: 'currentColor',
    post: 'currentColor',
    base: 'currentColor',
    sun: 'currentColor',
    word1: 'currentColor',
    word2: 'currentColor',
  },
}

/**
 * Subgráfico de la cabaña (4 trazos + sol). Coordenadas locales: ~860×590,
 * vienen del SVG original del logo digital. Para reusar en otros tamaños,
 * envolver con `<g transform="scale(...)">`.
 */
function CabinPaths({ tone }: { tone: LogoTone }) {
  const c = TONES[tone]
  return (
    <>
      {/* Techo derecho — pincelada terracotta */}
      <path
        fill={c.roof}
        d="M 340,110 C 420,260 580,290 770,280 C 650,330 480,310 320,210 Z"
      />
      {/* Ladera izquierda — forest */}
      <path
        fill={c.slope}
        d="M 340,110 C 280,190 180,320 90,350 C 150,340 220,265 270,195 C 300,155 325,125 340,110 Z"
      />
      {/* Chimenea / poste central — forest */}
      <path
        fill={c.post}
        d="M 255,255 Q 275,240 290,230 Q 295,350 300,470 Q 280,475 265,475 Q 260,360 255,255 Z"
      />
      {/* Base horizontal — pincelada terra inferior */}
      <path
        fill={c.base}
        d="M 130,530 C 250,460 420,460 600,510 C 420,485 250,485 130,530 Z"
      />
      {/* Sol */}
      <circle cx="340" cy="60" r="22" fill={c.sun} />
    </>
  )
}

interface LogoProps {
  /** `mark` = solo cabaña; `full` = cabaña + wordmark "Cabañas Coroico". */
  variant?: 'mark' | 'full'
  /** Altura en px. El ancho se calcula manteniendo proporción del viewBox. */
  size?: number
  tone?: LogoTone
  className?: string
  /** Etiqueta accesible. Si no se pasa, usa "Cabañas Coroico". */
  ariaLabel?: string
}

export function Logo({
  variant = 'full',
  size = 32,
  tone = 'onForest',
  className,
  ariaLabel = 'Cabañas Coroico',
}: LogoProps) {
  const c = TONES[tone]

  if (variant === 'mark') {
    // Solo la cabaña. Cuadrado ~860×620; 1:1 visual con padding.
    return (
      <svg
        role="img"
        aria-label={ariaLabel}
        width={size}
        height={size}
        viewBox="0 0 860 620"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <CabinPaths tone={tone} />
      </svg>
    )
  }

  // Variante completa: cabaña a la izquierda + wordmark a la derecha.
  // viewBox ancho para que el wordmark respire — la altura efectiva sigue
  // siendo `size`, el ancho se calcula proporcional.
  const aspect = 1080 / 320
  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      height={size}
      width={size * aspect}
      viewBox="0 0 1080 320"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Cabaña a escala reducida y bajada un poco para alinear con la baseline */}
      <g transform="translate(-30 30) scale(0.42)">
        <CabinPaths tone={tone} />
      </g>

      {/* Wordmark — "Cabañas" / "Coroico" en Fraunces italic 800 */}
      <g transform="translate(380 0)">
        <text
          x="0"
          y="135"
          fontFamily="var(--font-serif), Fraunces, Georgia, serif"
          fontStyle="italic"
          fontWeight={800}
          fontSize={108}
          fill={c.word1}
          letterSpacing="-2"
        >
          Cabañas
        </text>
        <text
          x="36"
          y="240"
          fontFamily="var(--font-serif), Fraunces, Georgia, serif"
          fontStyle="italic"
          fontWeight={800}
          fontSize={108}
          fill={c.word2}
          letterSpacing="-2"
        >
          Coroico
        </text>
      </g>
    </svg>
  )
}
