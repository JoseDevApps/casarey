# Spec — 002 Dashboard de disponibilidad (ADMIN / SUPER_ADMIN)

Hereda la constitución de `specs/001-landing-scrollytelling/constitution.md` (CP-1..CP-5).

## Problema
Al entrar al dashboard, el admin aterriza en un CRUD de propiedades y el superadmin en
gestión de usuarios. Ninguno ve de un vistazo **qué cabañas están libres/ocupadas HOY**
ni un calendario de ocupación entendible sin clics adicionales.

## Historia principal
Como ADMIN (o SUPER_ADMIN), al entrar a mi dashboard veo primero mis cabañas (todas, si
soy superadmin) con su estado de **hoy** (libre / ocupada / bloqueada) y un **calendario
mensual visual** por cabaña, para decidir de un vistazo sin navegar.

## Alcance
- IN: nueva vista inicial `/dashboard/overview` compartida por ADMIN y SUPER_ADMIN;
  estado de hoy + mini-calendario mensual por propiedad; redirecciones de login/sidebar.
- OUT: cambios de backend (los endpoints existentes bastan), edición de calendario aquí
  (se enlaza a la página de gestión existente), vista CLIENT.

## Criterios de aceptación
- AC-1: ADMIN al loguearse aterriza en `/dashboard/overview` y ve SOLO sus propiedades.
- AC-2: SUPER_ADMIN al loguearse aterriza en `/dashboard/overview` y ve TODAS las propiedades.
- AC-3: Cada cabaña muestra un badge de estado de HOY: Libre (verde), Ocupada (naranja),
  Bloqueada (gris) — mismos colores que la leyenda del calendario existente.
- AC-4: Cada cabaña muestra un mini-calendario del mes con los días coloreados por estado
  y el día de hoy resaltado; hay leyenda visible.
- AC-5: Un selector de mes (‹ ›) cambia el mes de TODOS los mini-calendarios a la vez,
  desde el mes actual hasta +11 meses (rango que cubre el endpoint por defecto).
- AC-6: Un resumen superior indica cuántas cabañas están libres/ocupadas/bloqueadas hoy.
- AC-7: Cada tarjeta enlaza a la gestión completa (`/dashboard/calendar/{id}`).
- AC-8: Sin propiedades → estado vacío con CTA a crear propiedad (solo ADMIN).

## Datos (endpoints existentes)
- `GET /properties?page_size=100` — el backend ya filtra: ADMIN → propias, SUPER_ADMIN → todas.
- `GET /properties/{id}/calendar` — sin params devuelve hoy → +12 meses (BOOKED/BLOCKED).
