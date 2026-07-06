# Tasks — 001 Landing Scrollytelling

| # | Tarea | Estado | Dep |
|---|---|---|---|
| T01 | research.md: decisión motion vs zero-dep | done | — |
| T02 | CSS: clases reveal, scroll-margin, progress, section-nav (globals.css) | done | T01 |
| T03 | `Reveal` (IntersectionObserver, once, reduced-motion aware) | done | T02 |
| T04 | `ScrollProgress` (barra rAF) + `SectionNav` (anclas + activa) | done | T02 |
| T05 | `LandingExperience` componiendo el relato | done | T03,T04 |
| T06 | Refactor `page.tsx` (fetch SSR → LandingExperience) | done | T05 |
| T07 | QA: build, reduced-motion, teclado, móvil | done | T06 |

## Notas de QA
- Verificado `next build` dentro del contenedor frontend.
- Reveal degrada a estático bajo prefers-reduced-motion (guard global en globals.css).
- Anclas con scroll-margin-top compensan header sticky.

---

# Incremento 002 — SPA estricta + sin link Propiedades + más amigable

Objetivo: que el cliente final navegue y decida **sin salir de `/`**, quitar el enlace
"Propiedades" del header y suavizar el tono.

| # | Tarea | Estado |
|---|---|---|
| I2-01 | `PropertyCard`: prop `onSelect` para abrir detalle in-place (botón vs Link) | done |
| I2-02 | `PropertyModal` (Radix Dialog): imágenes, tarifas, video; CTA Reservar → `/properties/[id]` | done |
| I2-03 | `PropertyBrowser`: grilla de TODAS las cabañas + búsqueda + modal | done |
| I2-04 | Landing: sección `#cabanas` usa PropertyBrowser; CTAs hero/CTA-final → ancla `#cabanas` | done |
| I2-05 | `page.tsx`: fetch `GET /properties?page_size=50` (todas) en vez de solo featured | done |
| I2-06 | Header: quitar enlaces "Inicio"/"Propiedades"; `BannerCarousel` CTA → ancla `#cabanas` | done |
| I2-07 | `scroll-behavior: smooth` (override en reduced-motion) | done |
| I2-08 | Build + verificación SSR (markers, sin link Propiedades, estado vacío) | done |

## Decisiones / Notas
- Estricto SPA = el cliente nunca sale de `/` para **explorar**; la reserva continúa en
  `/properties/[id]` vía navegación client-side de Next (sin recarga). Acordado con el usuario (opción A).
- La ruta `/properties` (listado) queda huérfana (sin enlaces) pero se conserva; `/properties/[id]`
  sigue usándose para el formulario de reserva.
- DB sin propiedades en este entorno → la home muestra el estado vacío "Pronto tendremos cabañas".
  Para ver la grilla/modal hay que crear propiedades desde un panel ADMIN.
