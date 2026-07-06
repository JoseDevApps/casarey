# Spec — 001 Landing Scrollytelling (QUÉ y POR QUÉ)

## Problema
La home actual (`(public)/page.tsx`) es una pila estática de secciones. Queremos una
experiencia de **una sola página con narrativa scroll-driven** que refuerce la marca
rural-forestal de Coroico y guíe al visitante desde "qué es" hasta "reservá".

## Alcance
- IN: reescritura de la home pública como recorrido de una sola página con scrollytelling.
- OUT: backend, nuevos endpoints, rediseño de paleta, dashboards, flujo de reservas.

## Historia principal
Como visitante, al entrar a la home vivo un recorrido visual continuo; cada sección se
revela al hacer scroll, puedo saltar a cualquier sección por anclas y convertir en
cualquier momento.

## Secciones del relato (reusan contenido actual)
1. **Hero** (`#inicio`) — banner CMS o fallback estático; entrada + scroll-hint.
2. **Manifiesto** (`#ambiente`) — frase de marca que se revela.
3. **Cómo funciona** (`#pasos`) — los 3 pasos, revelados en secuencia (stagger).
4. **Propiedades destacadas** (`#cabanas`) — carrusel existente con entrada.
5. **CTA final** (`#reservar`) — banda de conversión.

## Criterios de aceptación
- AC-1: Al hacer scroll, cada sección entra con animación **una sola vez**; el contenido
  es visible aunque JS falle (SSR).
- AC-2: Con `prefers-reduced-motion: reduce` no hay parallax ni reveals; todo aparece estático.
- AC-3: La navegación de secciones hace scroll suave al ancla y resalta la sección activa.
- AC-4: En móvil (≤640px) no hay jank; los efectos pesados se simplifican.
- AC-5: Una barra de progreso superior refleja el avance de lectura de la página.
- AC-6: Los CTA conservan sus destinos (`/properties`, `/login`, `/register`).
