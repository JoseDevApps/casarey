# Plan técnico — CÓMO

## Boundary
`(public)/page.tsx` (Server): fetch `cms/featured` + `cms/banners` → pasa props a
`<LandingExperience>` (Client), que orquesta scroll + render del relato.

## Árbol de componentes
```
page.tsx  (server, fetch SSR)
└── LandingExperience            'use client'
    ├── ScrollProgress           barra superior (rAF) + SectionNav (dots/anclas)
    ├── Hero (#inicio)           BannerCarousel | fallback estático + scroll-hint
    ├── Reveal (#ambiente)       manifiesto de marca
    ├── Steps (#pasos)           3 pasos con Reveal escalonado
    ├── Reveal (#cabanas)        envuelve PropertyCarousel
    └── Reveal (#reservar)       CTA band
```

## Archivos
- `frontend/src/components/scrolly/reveal.tsx` — wrapper IntersectionObserver (`once`).
- `frontend/src/components/scrolly/scroll-progress.tsx` — barra de progreso + nav de secciones.
- `frontend/src/app/(public)/landing-experience.tsx` — orquestador cliente del relato.
- `frontend/src/app/globals.css` — clases `.reveal*`, `scroll-margin`, nav/progress (CP-1).
- `frontend/src/app/(public)/page.tsx` — refactor: fetch + render de LandingExperience.

## Reglas de implementación
- Reveal: `opacity/transform` + `is-visible`, `viewport once`. Si reduced-motion → visible ya.
- scroll-margin-top: 80px (header 64px + aire) en cada `section[id]`.
- Sin nuevas dependencias (ver research.md).
- Móvil: parallax/scroll-hint desactivados <640px.

## Riesgos
- Jank móvil → sin parallax pesado; transform-only.
- CLS por imágenes → mantener `next/image` con `fill`/sizes existentes.
- Doble disparo de reveal → IntersectionObserver con `unobserve` tras primera visibilidad.
