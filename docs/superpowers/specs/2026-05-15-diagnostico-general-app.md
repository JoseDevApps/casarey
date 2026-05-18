# Diagnóstico General — Aplicación Casas de Campo

**Fecha:** 2026-05-15  
**Alcance:** Diagnóstico completo por capas (backend, frontend, infraestructura, seguridad)  
**Documentos de referencia:** `CLAUDE.md`, `flujo de app.md`, `Backlog - Aplicación de renta de casas de campo.md`, `docs/superpowers/specs/2026-05-01-casas-campo-rental-design.md`

---

## Resumen Ejecutivo

La aplicación está **bien estructurada** con una arquitectura limpia (FastAPI + Next.js 15), buen manejo de errores, autenticación JWT con rotación de refresh tokens, y transacciones atómicas en las operaciones críticas (confirmar pago + bloquear calendario). El frontend usa patrones modernos (SWR, Route Groups, Server Components).

Sin embargo, existen **hallazgos críticos** que deben resolverse antes de producción:

| # | Hallazgo | Severidad | Capa |
|---|---|---|---|
| 1 | Sin tests automatizados (0% coverage) | **Crítica** | Backend + Frontend |
| 2 | `PropertyCalendar.date` como `String` en vez de `Date` | **Alta** | Backend — Modelos |
| 3 | `package-lock.json` no versionado — builds no reproducibles | **Alta** | DevOps |
| 4 | `client.full_name` no disponible en vista admin de reservas | **Alta** | Frontend |
| 5 | `calendar_service.py` existe pero routers no lo usan | **Media** | Backend |
| 6 | `get_public_url()` genera URLs con hostname interno `minio:9000` | **Media** | Backend — Storage |
| 7 | Sin rate limiting en endpoints de auth | **Media** | Backend — Seguridad |
| 8 | `COOKIE_OPTS["secure"] = False` hardcodeado | **Baja** | Backend — Auth |
| 9 | Verificación de ownership duplicada en 3 routers | **Baja** | Backend |
| 10 | Transición PENDING_APPROVAL → CANCELLED no permitida (contra spec) | **Alta** | Backend — Reservas |
| 11 | Video transcoding sin control de concurrencia | **Media** | Backend — Video |

---

## 1. Backend (FastAPI)

### 1.1 Hallazgos críticos/altos

#### H-01: Sin tests automatizados
- **Archivos:** Todo el proyecto backend (0 archivos `test_*.py`)
- **Riesgo:** Cualquier refactor o cambio en lógica de transición de estados (reservas), cálculos financieros, o subida de archivos puede romperse sin detección
- **Recomendación:** Implementar tests unitarios para `reservation_service.py`, `payment_service.py`, `calendar_service.py`, y tests de integración para los flujos críticos (crear reserva, confirmar pago, refresh tokens)

#### H-02: `PropertyCalendar.date` como String
- **Archivo:** `backend/app/models/property.py:33`
- **Problema:** `date = Column(String, nullable=False)` almacena fechas como strings ISO en vez de `Column(Date)`
- **Consecuencias:**
  - Sin validación de formato a nivel DB
  - Comparaciones `<`, `>`, `BETWEEN` son lexicográficas (funciona con ISO pero es frágil)
  - Se pierden funciones nativas de fechas de PostgreSQL
- **Recomendación:** Migrar a `Column(Date)` con Alembic, y actualizar las queries que comparan fechas

#### H-03: `client.full_name` no accesible en requests page
- **Archivo:** `frontend/src/app/(admin)/dashboard/requests/page.tsx:189`
- **Problema:** El template referencia `res.client?.full_name`, pero `ReservationResponse` (Pydantic) no incluye un campo `client`. Solo tiene `client_id`. El fallback `client_id.slice(0, 12)` muestra un UUID truncado
- **Recomendación:** Agregar `client` (o `client_name`) al `ReservationResponse` con un join a `users` en el builder de respuestas

### 1.2 Hallazgos medios

#### M-01: `calendar_service.py` no es utilizado por los routers
- **Archivo:** `backend/app/services/calendar_service.py` (74 líneas)
- **Problema:** El servicio tiene funciones `check_availability()`, `block_dates_for_reservation()` y `date_range()`, pero `routers/calendar.py` implementa toda la lógica inline sin importar el servicio. La lógica de disponibilidad en `reservation_service.py` probablemente duplica esto también
- **Recomendación:** Refactorizar los routers y `reservation_service.py` para usar `calendar_service.py`, eliminando duplicación

#### M-02: Public URLs apuntan a hostname interno Docker
- **Archivo:** `backend/app/services/storage_service.py:104-107`
- **Problema:** `get_public_url()` retorna URLs como `http://minio:9000/property-images/foo.jpg`. El hostname `minio` solo resuelve dentro de la red Docker. El frontend compensa con un rewrite en `next.config.ts` (`/minio/:path*` → `http://minio:9000/:path*`)
- **Riesgo:** En un deploy standalone (fuera de Docker Compose), o si la URL se usa fuera del rewrite de Next.js (e.g., en emails), la URL no funcionará
- **Recomendación:** Usar una URL configurable (ej. `MINIO_PUBLIC_URL`) que apunte al proxy público de MinIO o al rewrite de Next.js, en vez de hardcodear el hostname interno

#### M-03: Video transcoding sin control de concurrencia
- **Archivo:** `backend/app/services/video_service.py`
- **Problema:** `transcode_property_video()` corre como `BackgroundTask` de FastAPI. Si 2 admins suben video simultáneamente:
  - ffmpeg corre en paralelo compitiendo por CPU (sin límite)
  - `BackgroundTask` no tiene manejo de cancelación ni timeout aplicado desde FastAPI
  - El timeout de 600s en `subprocess.run` es interno pero no hay un mechanismo para matar tasks colgadas desde afuera
- **Recomendación:** Para producción, migrar a un task queue (ARQ + Redis, o Celery). Para MVP, al menos agregar un semáforo de concurrencia

#### M-04: Transición `PENDING_APPROVAL → CANCELLED` NO permitida
- **Archivo:** `backend/app/services/reservation_service.py:10-22`
- **Problema:** El diccionario `VALID_TRANSITIONS` no incluye `PENDING_APPROVAL → CANCELLED`. Según `CLAUDE.md`, el cliente o admin debería poder cancelar una reserva en estado `PENDING_APPROVAL`. Actualmente, `transition_reservation()` lanza `422 INVALID_TRANSITION` si se intenta cancelar en ese estado
- **Consecuencia:** Un cliente no puede cancelar su reserva recién creada hasta que el admin la apruebe primero
- **Recomendación:** Agregar `ReservationStatus.CANCELLED` a la lista de transiciones permitidas desde `PENDING_APPROVAL`

### 1.3 Hallazgos bajos

#### L-01: Verificación de ownership duplicada
- **Archivos:** `routers/properties.py`, `routers/payments.py`, `routers/calendar.py`
- **Problema:** El patrón de verificar `current_user.role == ADMIN and str(prop.owner_id) != str(current_user.id)` se repite en al menos 3 routers
- **Recomendación:** Extraer a una función helper en `dependencies.py` del estilo `assert_owns_property(prop_id, current_user, db)`

#### L-02: `COOKIE_OPTS["secure"] = False` hardcodeado
- **Archivo:** `backend/app/routers/auth.py:26`
- **Riesgo:** En producción con HTTPS, las cookies se enviarían también sobre HTTP (man-in-the-middle)
- **Recomendación:** Hacer `secure` configurable vía settings, o detectar automáticamente desde el protocolo de la request

#### L-03: Finanzas — total_income como string
- **Archivo:** `backend/app/schemas/finances.py`
- **Problema:** `total_income: Decimal` en schemas, pero el frontend recibe y formatea como string/float. Posible pérdida de precisión en agregaciones grandes
- **Recomendación:** Verificar que el frontend maneje `Decimal` correctamente (convertir a Number antes de `formatCurrency`)

#### L-04: Campo `slug` en CmsStaticPage sin validación
- **Archivo:** `backend/app/models/cms.py:28`
- **Problema:** El slug es `String` sin UniqueConstraint explícito (aunque en el modelo se marcó como `unique=True`). Revisar que la constraint esté en la migración

#### L-05: No hay endpoint para listar vouchers de una reserva
- **Archivo:** `backend/app/routers/reservations.py`
- **Problema:** Solo hay `GET /{id}/voucher` que devuelve el primer voucher. Si se permiten múltiples vouchers en el futuro, no hay paginación

---

## 2. Frontend (Next.js 15 / React 19)

### 2.1 Hallazgos críticos/altos

#### H-04: `res.client?.full_name` siempre undefined
- **Archivo:** `frontend/src/app/(admin)/dashboard/requests/page.tsx:189`
- [Misma issue que H-03 — documentada en backend]
- **Síntoma:** En la vista de reservas del admin, en vez del nombre del cliente aparece `cliente_id truncado` (UUID parcial)
- **Recomendación:** Corregir el backend para que el response incluya nombre del cliente, y actualizar el frontend para mostrarlo

### 2.2 Hallazgos medios

#### M-05: `getDaysBetween` implementación manual
- **Archivo:** `frontend/src/lib/utils.ts:43-47`
- **Problema:** Usa `Date.getTime()` directamente en vez de date-fns. Esto es correcto para el caso de uso, pero el proyecto ya tiene `date-fns` como dependencia. Podría usar `differenceInCalendarDays` para consistencia
- **Recomendación:** Usar `import { differenceInCalendarDays } from 'date-fns'` — mismo resultado, menos código propio

#### M-06: Property form sin campos geográficos
- **Archivo:** `frontend/src/app/(admin)/dashboard/properties/[id]/page.tsx`
- **Problema:** El modelo `Property` tiene `latitude/longitude` pero el formulario de creación/edición no expone estos campos. Se envían siempre como `null`
- **Recomendación:** Agregar campos de lat/lng al formulario (o integración con mapa)

#### M-07: SWR sin revalidación en algunas páginas
- **Archivos:** Varios `page.tsx` en dashboard
- **Problema:** La mayoría usa `useSWR(url, fetcher)` sin opciones de revalidate. Esto significa que si un admin aprueba una reserva en otra pestaña, la vista actual no se actualiza hasta recargar
- **Recomendación:** Configurar `revalidateOnFocus: true` (default) y considerar `refreshInterval` para páginas como requests

#### M-08: Error boundary no integrado en layouts
- **Archivo:** `frontend/src/components/error-boundary.tsx`
- **Problema:** Existe el componente pero no está claro que esté envuelto en los layouts de dashboard. Sin un error boundary, un crash en un componente hijo puede tumbar toda la página
- **Recomendación:** Envolver `{children}` en los layouts con `<ErrorBoundary>` (componente cliente)

### 2.3 Hallazgos bajos

#### L-06: Sin prefetch en navegación del dashboard
- **Observación:** Las páginas de dashboard usan `Link` de Next.js sin `prefetch={true}`. Con `prefetch={true}` (default en viewport), la navegación se siente instantánea
- **Recomendación:** Verificar que links del `DashboardSidebar` tengan prefetch habilitado

#### L-07: Sin `loading.tsx` en grupos de ruta
- **Observación:** La app depende de estados de carga inline (isLoading + skeletons) en cada página cliente. Las Server Components (públicas) no tienen `loading.tsx`
- **Recomendación:** Agregar archivos `loading.tsx` en los segmentos de ruta públicos y de dashboard para el streaming de Server Components

#### L-08: `globals.css` — falta `@layer base` para estilos de tipografía
- **Archivo:** `frontend/src/app/globals.css:109-113`
- **Problema:** Los estilos `h1, h2, h3, h4` con font-family serif están fuera de `@layer base` (están en base pero después del cierre del primer bloque base)

---

## 3. Infraestructura y DevOps

### 3.1 Hallazgos críticos/altos

#### H-05: `package-lock.json` no versionado
- **Archivo:** `frontend/Dockerfile:4`
- **Problema:** No existe `package-lock.json` en el repo. `Dockerfile` usa `COPY package*.json ./` seguido de `RUN npm install` en vez de `npm ci`
- **Consecuencias:**
  - Builds no reproducibles: cada `docker build` puede instalar versiones ligeramente diferentes de dependencias transitivas
  - `npm install` resuelve versiones en el momento, `npm ci` usa las versiones exactas del lockfile
- **Recomendación:** Generar `package-lock.json` localmente (`cd frontend && npm install`) y versionarlo. Luego cambiar Dockerfile a `npm ci`

#### H-06: `alembic.ini` existe pero usa `sqlalchemy.url` que se sobreescribe
- **Archivo:** `backend/alembic/env.py:32`
- **Problema:** El `sqlalchemy.url` en alembic.ini se sobreescribe con `settings.DATABASE_URL` desde pydantic, lo cual es correcto. Sin embargo, `fileConfig()` en `env.py:29` intenta leer la sección `[loggers]` de `alembic.ini`

### 3.2 Hallazgos medios

#### M-09: MinIO expuesto en red pública en dev
- **Archivo:** `docker-compose.dev.yml:39-46`
- **Problema:** En desarrollo, MinIO está conectado a las redes `internal` Y `public`. El puerto 9100 se mapea para acceso del browser, pero teóricamente otros servicios en la red pública Docker podrían alcanzar la API de MinIO
- **Recomendación:** Es aceptable para dev, pero documentar que en producción solo debe estar en `internal` (como ya está en `docker-compose.yml`)

#### M-10: No hay `Dockerfile` para producción con multi-stage optimizado
- **Archivo:** `backend/Dockerfile`
- **Problema:** El Dockerfile de backend usa single-stage build (instala build tools como gcc y las mantiene en la imagen final). Para producción, multi-stage reduciría el tamaño de imagen
- **Recomendación:** Separar en builder stage (pip install) y runtime stage (solo Python + dependencias)

### 3.3 Hallazgos bajos

#### L-09: `wget` en healthcheck de frontend
- **Archivo:** `docker-compose.yml:18`
- **Problema:** El healthcheck del frontend usa `wget` (sin `-q` y `-O-` no juntos en Alpine). La sintaxis actual `wget -qO-` es correcta en BusyBox wget, pero frágil
- **Recomendación:** Usar `curl -f http://localhost:3000/` o verificar que wget funcione en la imagen Alpine de Node 22

---

## 4. Seguridad

### 4.1 Hallazgos medios

#### M-11: Sin rate limiting en endpoints de autenticación
- **Archivos:** `backend/app/routers/auth.py` — `/login`, `/register`, `/refresh`
- **Riesgo:** Fuerza bruta sobre login/register. Sin límite de intentos, un atacante puede probar contraseñas indefinidamente
- **Recomendación:** Implementar rate limiting (slowapi o middleware personalizado) en los endpoints de auth: máximo 5 intentos por IP en 15 minutos

#### M-12: `allow_credentials=True` con CORS
- **Archivo:** `backend/app/main.py:28-32`
- **Análisis:** La configuración actual permite credenciales con orígenes específicos (`CORS_ORIGINS` desde settings). Siempre que CORS_ORIGINS no sea `*`, es correcto. En producción, asegurar que CORS_ORIGINS incluya solo el dominio del frontend

### 4.2 Hallazgos bajos

#### L-10: Secrets en `.env` son placeholders obvios
- **Archivo:** `.env`
- **Problema:** `JWT_SECRET=change_in_production_use_openssl_rand_hex_32`
- **Riesgo:** Bajo porque el `.env` está en `.gitignore`. Pero si alguien despliega sin cambiar esto, es crítico
- **Recomendación:** Agregar una validación en el startup del backend que revise que JWT_SECRET no contenga "change_in_production" y lance un error si no se ha cambiado

---

## 5. Gaps Funcionales vs Especificación

### 5.1 Documentados vs Implementados

Revisión del backlog (`Backlog - Aplicación de renta de casas de campo.md`) contra código:

| ID | Historia | Estado | Notas |
|---|---|---|---|
| Auth-01 | Registro de cliente | ✅ Implementado | |
| Auth-02 | Login por rol | ✅ Implementado | |
| Admin-01 | Listar usuarios (SA) | ✅ Implementado | |
| Admin-02 | Modificar roles (SA) | ✅ Implementado | |
| Admin-03 | Bloquear SUPER_ADMIN duplicado | ⚠️ **No implementado** | No hay check que impida crear otro SA vía DB directa |
| Cat-01 | Landing con tarjetas | ✅ Implementado | |
| Cat-02 | Detalle + calendario en tiempo real | ✅ Implementado | |
| Prop-01 | CRUD propiedades | ✅ Implementado | |
| Prop-02 | Tarifas diferenciadas | ✅ Implementado | |
| Prop-03 | Calendario dinámico + bloqueo manual | ✅ Implementado | |
| Res-01 | Cotizar + snapshot precios | ✅ Implementado | |
| Res-02 | Aprobar/rechazar solicitudes | ✅ Implementado | |
| Res-03 | Registrar huéspedes post-confirmación | ✅ Implementado | |
| Pay-01 | CRUD métodos de pago + QR | ✅ Implementado | |
| Pay-02 | Validar comprobantes + transacción atómica | ✅ Implementado | |
| Fin-01 | Finanzas por admin | ✅ Implementado | |
| Fin-02 | Finanzas globales (SA) | ✅ Implementado | |
| CMS-01 | Panel CMS | ✅ Implementado | |
| CMS-02 | Banners | ✅ Implementado | |
| CMS-03 | Páginas estáticas | ✅ Implementado | |
| CMS-04 | Propiedades destacadas | ✅ Implementado | |

### 5.2 Gaps detectados

1. **Admin-03**: No hay un check en `users.py` ni en `scripts/create_superadmin.py` que impida la existencia de más de un SUPER_ADMIN activo. El script `create_superadmin.py` debería verificar si ya existe un SA antes de crear otro.

---

## 6. Buenas Prácticas y Aciertos

A pesar de los hallazgos, el proyecto tiene fortalezas notables:

1. **Arquitectura limpia**: Separación clara en routers → services → models, con schemas Pydantic para validación
2. **Manejo de errores consistente**: `AppError` con código y detalles, handlers globales para HTTPException y ValidationError
3. **Refresh token rotation**: Implementación segura con SHA-256 hashing de tokens almacenados
4. **Transacciones atómicas**: Confirmar pago + bloquear calendario ocurren en la misma transacción — si una INSERT al calendario viola UNIQUE, todo se revierte
5. **Video transcoding pipeline**: Pipeline completo con ffmpeg (raw → 720p H.264 AAC + poster JPEG), limpieza de raw, y manejo de errores con estado FAILED
6. **Frontend con Server Components**: Uso de RSC para landing pages públicas y layouts, client components solo para interactividad
7. **Sistema de diseño**: Tema oscuro forestal completo con variables CSS, animaciones consistentes, y componentes Radix UI bien integrados
8. **Middleware de autenticación**: Protección de rutas con redirect a login + role-based layouts
9. **Documentación técnica**: CLAUDE.md completo, flujo de app.md detallado, backlog especificado

---

## 7. Recomendaciones Priorizadas

### Impostergables (antes de producción)

1. Generar y versionar `package-lock.json` → cambiar Dockerfile a `npm ci`
2. Agregar tests para flujos críticos (reservas, pagos, auth)
3. Validar que `JWT_SECRET` no sea placeholder al iniciar backend
4. Implementar rate limiting en endpoints de auth

### Alta prioridad (sprint actual)

5. Migrar `PropertyCalendar.date` de String a Date
6. Agregar `client.full_name` al `ReservationResponse`
7. Refactorizar `calendar_service.py` para que los routers lo usen (eliminar duplicación)
8. Verificar el advisory lock en `create_reservation`

### Prioridad media

9. Hacer `COOKIE_OPTS["secure"]` configurable
10. Agregar control de concurrencia en video transcoding
11. Extraer helper de verificación de ownership a `dependencies.py`
12. Configurar `MINIO_PUBLIC_URL` configurable

### Baja prioridad / deuda técnica

13. Agregar error boundaries en layouts de dashboard
14. Agregar campos lat/lng al formulario de propiedades
15. Agregar `loading.tsx` en segmentos de ruta
16. Multi-stage build para backend Dockerfile
17. Verificar/mejorar revalidación SWR en páginas de dashboard

---

## Archivos Revisados

Para este diagnóstico se revisaron **~50 archivos** incluyendo:

- Backend: 39 archivos Python (routers, services, models, schemas, core)
- Frontend: 42 archivos TypeScript/TSX (páginas, componentes, lib, middleware)
- Infraestructura: 4 Dockerfiles, 2 docker-compose, alembic
- Documentación: CLAUDE.md, flujo de app.md, backlog.md
