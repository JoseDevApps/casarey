# Tasks — 002 Dashboard de disponibilidad

| # | Tarea | Estado |
|---|---|---|
| T01 | `MiniMonthCalendar` read-only: grilla mensual coloreada por estado, hoy resaltado | done |
| T02 | `AvailabilityOverview`: fetch propiedades + calendario por propiedad (SWR), resumen de hoy, selector de mes compartido, grilla de tarjetas | done |
| T03 | Página `(admin)/dashboard/overview/page.tsx` | done |
| T04 | `(admin)/layout.tsx`: permitir SUPER_ADMIN (sidebar según rol real) | done |
| T05 | Sidebar: item "Inicio" → `/dashboard/overview` en variantes admin y superadmin | done |
| T06 | `dashboardHomeForRole` + login + redirect de `(superadmin)/layout.tsx`: ADMIN y SUPER_ADMIN → `/dashboard/overview` | done |
| T07 | Build + verificación (SSR/HTTP, AC-1..AC-8) | done |

## QA (2026-07-02)
- `next build` OK (falló 1 vez por spread de boolean en mini-month-calendar; corregido con ternario).
- ADMIN demo (`admin.demo@example.com`): login → `/dashboard/overview` 200; `GET /properties` devuelve solo las suyas (total=1); calendario con HOY bloqueado → badge "Bloqueada hoy".
- SUPER_ADMIN demo (`super.demo@example.com`): `/dashboard/overview` 200 con sidebar superadmin; ve todas las propiedades.
- Sin auth: `/dashboard/overview` redirige a `/login?redirect=...` (middleware).
- Datos demo sembrados: usuarios admin/super demo + "Cabana El Mirador" con 4 fechas BLOCKED.

## Decisiones
- Ruta única `/dashboard/overview` en el grupo `(admin)`; el layout deja pasar a
  SUPER_ADMIN y elige la variante del sidebar por rol (coincide con la matriz de
  permisos documentada: rutas admin = ADMIN y SUPER_ADMIN).
- Un solo fetch de calendario por propiedad (rango por defecto hoy→+12m) alimenta
  tanto el badge de hoy como el mini-calendario de cualquier mes navegable.
- "Hoy" se calcula en fecha local del navegador (no UTC) para evitar off-by-one.
