# Research — Decisiones técnicas

## Librería de animación: ¿Framer Motion vs. zero-dependency?
**Decisión: zero-dependency (IntersectionObserver + CSS scroll-driven).**

| Criterio | Framer Motion (`motion`) | IO + CSS (elegido) |
|---|---|---|
| Peso bundle | ~+30KB gzip | 0 KB |
| Compat React 19 / Next 15 | requiere verificación | nativo |
| SSR (CP-4) | islas client extra | contenido SSR intacto |
| Reduced motion (CP-3) | manual por componente | guard global ya existe en globals.css |
| Riesgo instalación en Docker | rebuild de imagen + lockfile ausente | ninguno |

Conclusión: para reveals al entrar en viewport, barra de progreso y un parallax sutil,
IntersectionObserver + `requestAnimationFrame` + variables CSS son suficientes y cumplen
CP-2/CP-4 mejor. Si en el futuro se pide scroll-linked pinning complejo, reevaluar `motion`.

## Scroll suave
`scroll-behavior: smooth` nativo en el contenedor + `scroll-margin-top` para compensar el
header sticky (h-16 = 64px). Sin librería de inercia (Lenis) para evitar dependencia y
respetar reduced-motion sin código extra.

## Animación performante
Solo `transform` (`translateY`, `scale`) y `opacity`. El reveal usa una sola clase que
togglea `is-visible`. La barra de progreso y el scroll-hint del hero usan rAF, no listeners
de scroll sin throttle.

## Boundary Server/Client
`page.tsx` permanece Server Component (fetch SSR de banners + featured). Un único componente
cliente `LandingExperience` recibe los datos por props y orquesta la narrativa. Los carruseles
existentes (`BannerCarousel`, `PropertyCarousel`) ya son client y se anidan sin cambios.
