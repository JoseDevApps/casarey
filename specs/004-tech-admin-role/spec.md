# Spec — 004 Rol Administrador Técnico (TECH_ADMIN)

Hereda la constitución de `specs/001-landing-scrollytelling/constitution.md`.

## Problema
Se necesita un rol operativo que supervise la disponibilidad de TODAS las cabañas
(como el inicio del SUPER_ADMIN) y gestione bloqueos de calendario de cualquier cabaña
(mantenimiento, limpieza, reservas privadas), sin poder tocar reservas, pagos, finanzas,
usuarios ni CMS.

## Historia principal
Como ADMINISTRADOR TÉCNICO, al entrar a mi dashboard veo la disponibilidad de todas las
cabañas (hoy + calendario mensual) y desde cada una puedo bloquear/desbloquear fechas.

## Criterios de aceptación
- AC-1: Existe el rol `TECH_ADMIN`; el SUPER_ADMIN puede asignarlo desde el panel Usuarios.
- AC-2: TECH_ADMIN al loguearse aterriza en `/dashboard/overview` y ve TODAS las cabañas
  activas (igual que SUPER_ADMIN).
- AC-3: TECH_ADMIN puede bloquear y desbloquear fechas del calendario de CUALQUIER cabaña
  (página de gestión `/dashboard/calendar/[id]` y endpoints block/unblock).
- AC-4: TECH_ADMIN NO puede: aprobar/rechazar reservas, confirmar pagos, CRUD de
  propiedades, finanzas, usuarios, CMS ni preferencias de notificación (403 en todos).
- AC-5: Su sidebar muestra solo "Inicio" (overview); la gestión de bloqueo se accede desde
  el botón "Gestionar" de cada tarjeta.

## Matriz de permisos (delta)
| Operación | TECH_ADMIN |
|---|---|
| Ver todas las propiedades activas (listado) | ✓ (lectura) |
| Ver calendario de cualquier propiedad | ✓ |
| Bloquear/desbloquear fechas de cualquier propiedad | ✓ |
| Todo lo demás (reservas, pagos, finanzas, usuarios, CMS, CRUD propiedades) | — |

## Fuera de alcance
- Página propia de listado de propiedades para TECH_ADMIN (usa el overview).
- Notificaciones dirigidas al TECH_ADMIN.
