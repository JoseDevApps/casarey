# Tasks — 004 Rol Administrador Técnico

| # | Tarea | Estado |
|---|---|---|
| T01 | Backend: `UserRole.TECH_ADMIN` + migración (`ALTER TYPE userrole ADD VALUE`) | done |
| T02 | Backend: block/unblock de calendario permiten TECH_ADMIN (cualquier propiedad) | done |
| T03 | Frontend: tipo UserRole, roleLabel "Admin Técnico", dashboardHome → overview, redirect login | done |
| T04 | Frontend: variante de sidebar `techadmin` (solo Inicio); layouts (admin/superadmin/client) | done |
| T05 | Frontend: panel Usuarios — asignar/filtrar/mostrar TECH_ADMIN | done |
| T06 | Rebuild + migración + QA (AC-1..AC-5) | done |

## QA (2026-07-17) — usuario de prueba `tecnico.demo@example.com` / `Tecnico#2026`
- Migración `b5d1c7f38a92 (head)`: enum userrole = CLIENT, ADMIN, SUPER_ADMIN, TECH_ADMIN.
- AC-1: promoción a TECH_ADMIN vía SQL/panel OK. AC-2: login 200 → `/dashboard/overview`
  200 y `GET /properties` devuelve TODAS las activas.
- AC-3: block en cabaña ajena → "1 fecha(s) bloqueada(s)"; unblock → 204.
- AC-4: finanzas 403, crear propiedad 403, usuarios 403.
- AC-5: sidebar variante techadmin (solo Inicio) compilada y desplegada.

## Decisiones
- `GET /properties` ya devuelve todas las activas para cualquier rol que no sea ADMIN
  (el filtro por owner solo aplica a ADMIN) → TECH_ADMIN ve todo sin cambios.
- El check de propiedad en block/unblock solo restringe a ADMIN → TECH_ADMIN opera sobre
  cualquier cabaña con solo añadirlo al require_role.
- Los demás routers usan require_role(ADMIN, SUPER_ADMIN) o (SUPER_ADMIN) → TECH_ADMIN
  queda excluido automáticamente (AC-4 sin cambios adicionales).
