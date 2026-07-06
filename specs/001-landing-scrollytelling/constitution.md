# Constitución — 001 Landing Scrollytelling

Principios no negociables. Cada PR de esta feature se valida contra estos gates.

## CP-1 — Design system congelado
Prohibido introducir colores, espaciados o tipografías fuera de las variables de
`frontend/src/app/globals.css`: `--brand-*`, `--surface-*`, `--text-*`, `--border-*`,
`--font-serif|sans|mono`. Cualquier nuevo estilo se expresa con esas variables.

## CP-2 — Performance
- Objetivos: LCP < 2.5s, CLS < 0.1, scroll a 60fps sin jank.
- Las animaciones solo animan `transform` y `opacity` (compositables).
- Sin dependencias pesadas nuevas salvo justificación medida en `research.md`.

## CP-3 — Accesibilidad
- Respetar `prefers-reduced-motion: reduce` → degradar a contenido estático.
- Navegación por teclado y por anclas (`#inicio`, `#pasos`, `#cabanas`, `#reservar`).
- Contraste AA (accent `rgb(167,52,0)` ya es accesible sobre superficies claras).

## CP-4 — SSR-first / progressive enhancement
El contenido (banners CMS, propiedades destacadas) se sigue obteniendo y renderizando
en el servidor. La animación es una capa encima; con JS deshabilitado el contenido es legible.

## CP-5 — No-regresión funcional
Los CTA siguen apuntando a `/properties`, `/login`, `/register`. Header, footer, auth,
dashboards y flujo de reservas no cambian. Solo se reescribe la home pública.
