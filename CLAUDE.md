# Casas de Campo — Documentación Técnica Completa

## Índice

1. [Visión General](#1-visión-general)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
3. [Base de Datos](#3-base-de-datos)
4. [Backend — FastAPI](#4-backend--fastapi)
5. [Frontend — Next.js](#5-frontend--nextjs)
6. [Servicios y Lógica de Negocio](#6-servicios-y-lógica-de-negocio)
7. [Autenticación y Autorización](#7-autenticación-y-autorización)
8. [Almacenamiento de Archivos (MinIO)](#8-almacenamiento-de-archivos-minio)
9. [Flujos Completos por Módulo](#9-flujos-completos-por-módulo)
10. [Infraestructura Docker](#10-infraestructura-docker)
11. [Variables de Entorno](#11-variables-de-entorno)

---

## 1. Visión General

**Casas de Campo** es una plataforma de alquiler de propiedades rurales/vacacionales. Permite a clientes explorar propiedades, hacer reservas y subir comprobantes de pago; a administradores gestionar sus propiedades, calendario y aprobar reservas; y a superadmins controlar todo el sistema, usuarios y contenido de la landing page.

### Stack tecnológico

| Capa           | Tecnología                                                     |
| -------------- | -------------------------------------------------------------- |
| Frontend       | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4 |
| Backend        | FastAPI (Python 3.12), SQLAlchemy 2 (async), Alembic           |
| Base de datos  | PostgreSQL 16                                                  |
| Almacenamiento | MinIO (S3-compatible)                                          |
| Auth           | JWT (access + refresh tokens via cookies httpOnly)             |
| Contenedores   | Docker Compose                                                 |

---

## 2. Arquitectura del Sistema

```
Browser
  │
  ├─► Next.js Frontend :3000
  │     │
  │     └─► /api/[...path]  ──proxy──► FastAPI Backend :8000
  │                                          │
  │                                          ├─► PostgreSQL :5432
  │                                          └─► MinIO :9000
  │
  └─► MinIO Console :9001 (solo admin)
```

### Redes Docker

- **public** (`bridge`): Frontend ↔ Backend — accesibles desde el host
- **internal** (`bridge`, `internal: true`): Backend ↔ PostgreSQL ↔ MinIO — aisladas del exterior

### Flujo de una request autenticada

1. Browser → `GET /api/properties` (con cookie `access_token`)
2. Next.js proxy (`/api/[...path]/route.ts`) → `GET http://backend:8000/properties` (forwarda cookie)
3. FastAPI verifica JWT → ejecuta lógica → responde JSON
4. Next.js devuelve la respuesta al browser (con `set-cookie` si hay tokens nuevos)

---

## 3. Base de Datos

### Diagrama de tablas

```
users
  id (UUID PK)
  email (UNIQUE)
  password_hash
  full_name
  phone
  role: CLIENT | ADMIN | SUPER_ADMIN
  is_active
  created_at

refresh_tokens
  id (UUID PK)
  user_id → users.id (CASCADE DELETE)
  token_hash (INDEX)
  expires_at
  revoked_at (NULL = activo)

properties
  id (UUID PK)
  owner_id → users.id
  name
  description
  address
  latitude / longitude
  checkin_time / checkout_time
  max_guests
  rate_adult / rate_child  (precio por noche en Bs)
  is_active
  created_at

property_images
  id (UUID PK)
  property_id → properties.id (CASCADE DELETE)
  minio_key   (path en MinIO)
  sort_order

property_calendar
  id (UUID PK)
  property_id → properties.id (CASCADE DELETE)
  date (DATE, UNIQUE por propiedad)
  status: BOOKED | BLOCKED
  blocked_reason

reservations
  id (UUID PK)
  property_id → properties.id
  client_id   → users.id
  check_in_date / check_out_date
  num_adults / num_children
  snapshot_rate_adult / snapshot_rate_child  (precio congelado al momento de reservar)
  total_amount
  status: PENDING_APPROVAL | APPROVED_WAITING_PAYMENT | CONFIRMED | REJECTED | CANCELLED
  created_at

booking_guests
  id (UUID PK)
  reservation_id → reservations.id (CASCADE DELETE)
  full_name
  id_number
  phone

payment_methods
  id (UUID PK)
  owner_id → users.id
  name
  description
  minio_key (imagen QR opcional)
  is_active

payment_vouchers
  id (UUID PK)
  reservation_id → reservations.id (CASCADE DELETE)
  minio_key (comprobante de pago)
  uploaded_at

cms_banners
  id (UUID PK)
  title / subtitle
  minio_key (imagen)
  is_visible
  sort_order

cms_static_pages
  id (UUID PK)
  slug (UNIQUE): 'terms' | 'privacy' | 'contact'
  content
  updated_at

cms_featured_properties
  id (UUID PK)
  property_id → properties.id (CASCADE DELETE)
  sort_order
```

### Invariantes importantes

- Los precios (`snapshot_rate_*`) se **congelan al crear la reserva** — si el admin cambia tarifas después, las reservas anteriores no se ven afectadas.
- `property_calendar` tiene un UNIQUE constraint por `(property_id, date)` — no puede haber dos entradas para la misma propiedad y fecha.
- `refresh_tokens.revoked_at = NULL` significa token activo. Al hacer refresh, el token viejo se revoca y se emite uno nuevo (rotación).
- El soft-delete de propiedades usa `is_active = False` — nunca se borran físicamente para preservar el historial de reservas.

---

## 4. Backend — FastAPI

### Estructura de archivos

```
backend/
├── app/
│   ├── main.py                  # App FastAPI, CORS, lifespan (init MinIO buckets)
│   ├── dependencies.py          # get_current_user, require_role
│   ├── core/
│   │   ├── config.py            # Settings via pydantic-settings (.env)
│   │   ├── database.py          # Engine async, get_db session
│   │   └── security.py          # hash_password, verify_password, JWT create/verify
│   ├── models/                  # SQLAlchemy ORM
│   │   ├── user.py
│   │   ├── refresh_token.py
│   │   ├── property.py
│   │   ├── reservation.py
│   │   ├── payment.py
│   │   └── cms.py
│   ├── schemas/                 # Pydantic v2 request/response
│   │   ├── user.py
│   │   ├── property.py
│   │   ├── reservation.py
│   │   ├── payment.py
│   │   ├── cms.py
│   │   └── finances.py
│   ├── routers/                 # Endpoints por dominio
│   │   ├── auth.py              # /auth/*
│   │   ├── users.py             # /users/*
│   │   ├── properties.py        # /properties/*
│   │   ├── calendar.py          # /properties/{id}/calendar
│   │   ├── reservations.py      # /reservations/*
│   │   ├── payments.py          # /payment-methods/*
│   │   ├── finances.py          # /finances/*
│   │   └── cms.py               # /cms/*
│   └── services/
│       ├── storage_service.py   # MinIO upload/presigned URLs
│       ├── reservation_service.py
│       ├── payment_service.py
│       └── calendar_service.py
├── alembic/                     # Migraciones DB
├── entrypoint.sh                # Corre migraciones + inicia uvicorn
├── requirements.txt
├── Dockerfile / Dockerfile.dev
```

### Prefijos de rutas

| Router       | Prefijo            | Descripción                           |
| ------------ | ------------------ | ------------------------------------- |
| auth         | `/auth`            | Login, register, refresh, logout, /me |
| users        | `/users`           | CRUD de usuarios (superadmin)         |
| properties   | `/properties`      | CRUD propiedades + imágenes           |
| calendar     | `/properties`      | Calendario por propiedad              |
| reservations | `/reservations`    | Ciclo de vida de reservas             |
| payments     | `/payment-methods` | Métodos de pago del admin             |
| finances     | `/finances`        | Reportes financieros                  |
| cms          | `/cms`             | Banners, páginas, destacados          |

---

## 5. Frontend — Next.js

### Estructura de routing (App Router)

```
src/app/
├── layout.tsx                   # Root layout: ToastProvider
├── globals.css                  # Design system (variables CSS)
├── (public)/                    # Rutas públicas sin autenticación
│   ├── layout.tsx               # Header + footer navegable
│   ├── page.tsx                 # Landing page
│   ├── properties/
│   │   ├── page.tsx             # Listado de propiedades
│   │   └── [id]/
│   │       ├── page.tsx         # Detalle de propiedad
│   │       └── booking-form.tsx # Formulario de reserva
│   ├── login/page.tsx
│   └── register/page.tsx
├── (client)/                    # Protegido: solo CLIENT
│   ├── layout.tsx               # Verifica rol CLIENT
│   └── dashboard/
│       └── reservations/
│           ├── page.tsx         # Mis reservas
│           └── [id]/page.tsx    # Detalle + pago + huéspedes
├── (admin)/                     # Protegido: ADMIN o SUPER_ADMIN
│   ├── layout.tsx
│   └── dashboard/
│       ├── properties/
│       │   ├── page.tsx         # Lista de propiedades del admin
│       │   └── [id]/page.tsx    # Crear/editar propiedad
│       ├── calendar/[id]/page.tsx
│       ├── requests/page.tsx    # Aprobar/rechazar reservas
│       ├── payments/page.tsx    # Métodos de pago
│       └── finances/page.tsx
├── (superadmin)/                # Protegido: solo SUPER_ADMIN
│   ├── layout.tsx
│   └── dashboard/
│       ├── users/page.tsx
│       ├── global-finances/page.tsx
│       └── cms/
│           ├── banners/page.tsx
│           ├── featured/page.tsx
│           └── pages/page.tsx
└── api/
    └── [...path]/route.ts       # Proxy hacia FastAPI
```

### Sistema de protección de rutas (middleware)

El archivo `middleware.ts` intercepta todas las requests y:

1. Lee la cookie `access_token`
2. Verifica el JWT y extrae el `role`
3. Redirige si el usuario no tiene el rol adecuado para la ruta

| Grupo de rutas           | Rol requerido              |
| ------------------------ | -------------------------- |
| `(client)/dashboard`     | CLIENT, ADMIN, SUPER_ADMIN |
| `(admin)/dashboard`      | ADMIN, SUPER_ADMIN         |
| `(superadmin)/dashboard` | SUPER_ADMIN                |

### API Proxy (`/api/[...path]/route.ts`)

Todas las llamadas al backend pasan por este proxy que:

- Construye la URL: `/api/auth/login` → `http://backend:8000/auth/login`
- Forwarda la cookie de autenticación del browser
- Soporta `multipart/form-data` para uploads de archivos (usa `req.blob()`)
- Forwarda `set-cookie` del backend al browser (para refrescar tokens)
- Soporta GET, POST, PUT, PATCH, DELETE

### Cliente HTTP (`src/lib/api-client.ts`)

`apiFetch<T>()` es el cliente HTTP del frontend con lógica de refresh automático:

1. Ejecuta la request con `credentials: 'include'`
2. Si recibe `401`, intenta `POST /api/auth/refresh`
3. Si el refresh falla → redirige a `/login`
4. Si el refresh tiene éxito → reintenta la request original
5. Si falla → lanza `APIError` con `status`, `code` y `message`

### Componentes principales

| Componente                  | Ubicación        | Descripción                                                        |
| --------------------------- | ---------------- | ------------------------------------------------------------------ |
| `DashboardSidebar`          | `components/`    | Sidebar colapsable con items de nav por rol, logout                |
| `AvailabilityCalendar`      | `components/`    | Calendario dual con selección de rango, fechas ocupadas/bloqueadas |
| `FileUploader`              | `components/`    | Drag & drop con progreso XHR, preview de imagen                    |
| `PropertyCard`              | `components/`    | Tarjeta de propiedad para listados públicos                        |
| `ReservationStatusBadge`    | `components/`    | Badge con color según estado de reserva                            |
| `Button`                    | `components/ui/` | Variantes: primary, forest, ghost, destructive                     |
| `Input / Textarea / Select` | `components/ui/` | Inputs con label y manejo de errores                               |
| `Toast / useToast`          | `components/ui/` | Sistema de notificaciones (éxito, error, info, warning)            |

### Sistema de diseño (CSS variables)

El diseño usa un tema oscuro forestal con variables CSS:

```css
/* Paleta principal */
--brand-primary: oklch(29% 0.07 155)    /* verde bosque oscuro */
--brand-accent:  oklch(73% 0.09 55)     /* naranja tierra */

/* Superficies (fondo → primer plano) */
--surface-0 → --surface-4

/* Texto */
--text-primary → --text-muted

/* Utilitarios globales */
.btn-primary / .btn-forest / .btn-ghost
.input-field
.card
.badge-pending / .badge-confirmed / .badge-rejected / ...
```

### Librerías de UI utilizadas

- **Radix UI**: Dialog, DropdownMenu, Select, Toast, Label, Popover, Tabs, Avatar, Separator
- **react-hook-form + zod**: Formularios con validación tipada
- **SWR**: Fetching de datos con caché y revalidación
- **lucide-react**: Iconos
- **date-fns**: Manipulación de fechas
- **class-variance-authority + clsx + tailwind-merge**: Utilidades para clases CSS

---

## 6. Servicios y Lógica de Negocio

### 6.1 `reservation_service.py`

#### `create_reservation(db, property_id, client_id, check_in, check_out, num_adults, num_children)`

1. **Verifica que la propiedad existe** y está activa

2. **Valida el rango de fechas**: `check_out > check_in`, mínimo 1 noche

3. **Detecta conflictos de disponibilidad**: Busca en `property_calendar` si hay días `BOOKED` o `BLOCKED` en el rango solicitado — lanza `422 DATES_NOT_AVAILABLE` si hay conflicto

4. **Congela los precios**: Lee `rate_adult` y `rate_child` actuales de la propiedad

5. **Calcula el monto total**:
   
   ```
   noches = (check_out - check_in).days
   total = noches × (num_adults × rate_adult + num_children × rate_child)
   ```

6. **Crea la reserva** con estado inicial `PENDING_APPROVAL`

7. **No bloquea el calendario todavía** — las fechas solo se bloquean al confirmar

#### `transition_reservation(db, reservation, new_status)`

Valida las transiciones de estado permitidas:

```
PENDING_APPROVAL → APPROVED_WAITING_PAYMENT  (admin aprueba)
PENDING_APPROVAL → REJECTED                  (admin rechaza)
APPROVED_WAITING_PAYMENT → CONFIRMED         (admin confirma pago)
PENDING_APPROVAL | APPROVED_WAITING_PAYMENT → CANCELLED  (cliente o admin)
```

Lanza `422 INVALID_TRANSITION` si la transición no es válida.

#### `confirm_reservation_with_payment(db, reservation)`

1. Llama a `transition_reservation(reservation, CONFIRMED)`
2. **Bloquea las fechas en el calendario**: Itera cada día del rango y crea entradas en `property_calendar` con `status=BOOKED`
3. Hace commit de la transacción

### 6.2 `calendar_service.py`

#### `get_calendar(db, property_id, year, month)`

Devuelve todas las entradas de `property_calendar` para el mes/año indicado de una propiedad.

#### `set_calendar_entry(db, property_id, date, status, blocked_reason)`

Crea o actualiza (upsert) una entrada en el calendario. Usado por admins para bloquear fechas manualmente (vacaciones, mantenimiento, etc.).

#### `delete_calendar_entry(db, property_id, date)`

Elimina un bloqueo manual. No puede eliminar fechas con `status=BOOKED` (esas vienen de reservas confirmadas).

### 6.3 `payment_service.py`

#### `upload_payment_voucher(db, reservation_id, client_id, file)`

1. Verifica que la reserva existe y pertenece al `client_id`
2. Verifica que la reserva está en estado `APPROVED_WAITING_PAYMENT`
3. Sube el archivo a MinIO en el bucket `payment-vouchers` con key `vouchers/{reservation_id}/{uuid}.{ext}`
4. Crea un registro en `payment_vouchers`

### 6.4 `storage_service.py`

Abstracción sobre el cliente boto3 de MinIO.

#### Buckets creados al inicio (en `lifespan`)

| Bucket             | Uso                     | Política                      |
| ------------------ | ----------------------- | ----------------------------- |
| `property-images`  | Imágenes de propiedades | Pública (lectura sin auth)    |
| `payment-vouchers` | Comprobantes de pago    | Privada (solo presigned URLs) |
| `payment-qr`       | QR de métodos de pago   | Pública                       |
| `cms-images`       | Imágenes de banners     | Pública                       |

#### Métodos principales

- `upload_file(bucket, key, data, content_type)` — sube bytes a MinIO
- `get_public_url(bucket, key)` — devuelve URL directa para buckets públicos
- `get_presigned_url(bucket, key, expires=3600)` — URL temporal firmada para buckets privados

---

## 7. Autenticación y Autorización

### Flujo de login

1. `POST /auth/login` con `{email, password}`
2. Backend verifica `bcrypt` del password
3. Genera `access_token` (JWT, expira en 15 min) con `{sub: user_id, role}`
4. Genera `refresh_token` (JWT, expira en 7 días)
5. Guarda **hash SHA-256** del refresh token en `refresh_tokens` (nunca el token en claro)
6. Setea ambos como cookies `httpOnly`, `samesite=lax`

### Rotación de refresh tokens

1. `POST /auth/refresh` con cookie `refresh_token`
2. Verifica el JWT y busca el hash en `refresh_tokens`
3. Verifica que no esté revocado ni expirado
4. Revoca el token viejo (`revoked_at = now()`)
5. Emite un nuevo par de tokens

### Dependencias de autorización (`dependencies.py`)

```python
get_current_user  # requiere access_token válido, devuelve User
require_role(UserRole.ADMIN, UserRole.SUPER_ADMIN)  # + verifica rol
```

### Matriz de permisos por endpoint

| Operación                | CLIENT      | ADMIN                  | SUPER_ADMIN |
| ------------------------ | ----------- | ---------------------- | ----------- |
| Ver propiedades públicas | ✓           | ✓                      | ✓           |
| Crear reserva            | ✓           | —                      | —           |
| Ver sus reservas         | ✓ (propias) | ✓ (de sus propiedades) | ✓ (todas)   |
| Subir voucher            | ✓ (propia)  | —                      | —           |
| Aprobar/rechazar reserva | —           | ✓ (sus props)          | ✓           |
| Confirmar pago           | —           | ✓ (sus props)          | ✓           |
| CRUD propiedades         | —           | ✓ (propias)            | ✓           |
| Gestión calendario       | —           | ✓ (sus props)          | ✓           |
| Gestión usuarios         | —           | —                      | ✓           |
| CMS (banners, páginas)   | —           | —                      | ✓           |
| Finanzas globales        | —           | —                      | ✓           |

---

## 8. Almacenamiento de Archivos (MinIO)

### Flujo de upload de imagen de propiedad

```
Admin (browser)
  → POST /api/properties/{id}/images  (multipart/form-data)
  → Next.js proxy (req.blob() preserva multipart)
  → FastAPI: valida tipo (jpeg/png/webp), tamaño (máx 8MB)
  → storage_service.upload_file(bucket, key, bytes, content_type)
  → MinIO: guarda en property-images/properties/{id}/{uuid}.ext
  → DB: INSERT property_images (property_id, minio_key, sort_order)
  → Response: {id, minio_key, url}
```

### Flujo de upload de voucher de pago

```
Cliente (browser)
  → POST /api/reservations/{id}/voucher  (multipart)
  → FastAPI: verifica reserva APPROVED_WAITING_PAYMENT
  → MinIO: guarda en payment-vouchers/vouchers/{reservation_id}/{uuid}.ext
  → DB: INSERT payment_vouchers
  → Response: {id, minio_key, url (presigned, 1h)}
```

### URLs de imágenes

- **Imágenes de propiedad**: URL pública directa `http://minio:9000/property-images/{key}`
- **Vouchers**: URL firmada con expiración de 1 hora (privadas)
- En frontend: `getImageUrl(key)` usa `NEXT_PUBLIC_MINIO_URL` (env var)

---

## 9. Flujos Completos por Módulo

### 9.1 Flujo de Reserva (completo)

```
1. CLIENTE ve propiedad → selecciona fechas en AvailabilityCalendar
   GET /api/properties/{id}/calendar?year=YYYY&month=MM
   → obtiene fechas ocupadas y bloqueadas

2. CLIENTE llena BookingForm → valida con Zod
   POST /api/reservations
   body: { property_id, check_in_date, check_out_date, num_adults, num_children }
   → Estado: PENDING_APPROVAL

3. ADMIN ve solicitud en /dashboard/requests
   GET /api/reservations?status=PENDING_APPROVAL
   → lista reservas pendientes de sus propiedades

4a. ADMIN aprueba:
    PATCH /api/reservations/{id}/approve
    → Estado: APPROVED_WAITING_PAYMENT

4b. ADMIN rechaza:
    PATCH /api/reservations/{id}/reject
    → Estado: REJECTED (fin del flujo)

5. CLIENTE ve reserva aprobada
   → sube comprobante de pago
   POST /api/reservations/{id}/voucher  (multipart, imagen del comprobante)
   → MinIO guarda el archivo
   → Estado sigue en APPROVED_WAITING_PAYMENT

6. ADMIN verifica el comprobante
   PATCH /api/reservations/{id}/confirm-payment
   → Verifica que exista voucher (422 si no hay)
   → Estado: CONFIRMED
   → Bloquea las fechas en property_calendar (status=BOOKED)

7. (Opcional) ADMIN agrega lista de huéspedes
   POST /api/reservations/{id}/guests
   body: { full_name, id_number, phone }
   → Solo permitido en reservas CONFIRMED
```

### 9.2 Gestión de Propiedades

```
ADMIN crea propiedad:
  POST /api/properties
  body: { name, description, address, lat, lng, checkin_time, checkout_time,
          max_guests, rate_adult, rate_child }
  → owner_id = current_user.id automáticamente

ADMIN sube imágenes:
  POST /api/properties/{id}/images?sort_order=0
  multipart: file (jpeg/png/webp, máx 8MB)
  → key: properties/{property_id}/{uuid}.ext en MinIO

ADMIN edita:
  PUT /api/properties/{id}
  → Solo puede editar sus propias propiedades
  → SUPER_ADMIN puede editar cualquiera

ADMIN elimina (soft delete):
  DELETE /api/properties/{id}
  → is_active = False (no se borra físicamente)
  → Deja de aparecer en listados públicos
```

### 9.3 Gestión de Calendario

```
ADMIN bloquea fechas manualmente:
  PUT /api/properties/{id}/calendar/{date}
  body: { status: "BLOCKED", blocked_reason: "Mantenimiento" }
  → Upsert en property_calendar

ADMIN desbloquea:
  DELETE /api/properties/{id}/calendar/{date}
  → Solo funciona para BLOCKED, no para BOOKED (esas vienen de reservas)

El frontend (AvailabilityCalendar) distingue visualmente:
  - BOOKED: naranja (reserva confirmada)
  - BLOCKED: gris (bloqueo manual)
  - Fechas pasadas: deshabilitadas
  - Disponibles: clicables para selección de rango
```

### 9.4 Métodos de Pago

```
ADMIN gestiona métodos de pago disponibles para sus propiedades:
  POST /payment-methods  → crea método (nombre, descripción, QR opcional)
  GET  /payment-methods  → lista métodos activos
  PUT  /payment-methods/{id}  → actualiza
  DELETE /payment-methods/{id}  → soft delete (is_active=False)

El cliente ve los métodos disponibles al momento de pagar su reserva
y sube el comprobante de la transferencia/depósito correspondiente.
```

### 9.5 Finanzas

```
Admin view (/finances):
  GET /finances/summary
  → Agrupa reservas CONFIRMED de sus propiedades
  → Calcula total recaudado por período

SuperAdmin view (/global-finances):
  GET /finances/global
  → Ve finanzas de TODOS los admins/propiedades
  → Lista detallada de reservas confirmadas con montos
```

### 9.6 CMS (Solo SuperAdmin)

```
Banners (/cms/banners):
  GET    /cms/banners      → lista banners ordenados por sort_order
  POST   /cms/banners      → crea banner (título, subtítulo, imagen)
  PUT    /cms/banners/{id} → actualiza
  DELETE /cms/banners/{id} → elimina

Propiedades Destacadas (/cms/featured):
  GET    /cms/featured           → lista propiedades destacadas
  POST   /cms/featured           → agrega propiedad a destacadas
  DELETE /cms/featured/{prop_id} → quita de destacadas

Páginas Estáticas (/cms/pages):
  GET /cms/pages/{slug}  → obtiene contenido (terms, privacy, contact)
  PUT /cms/pages/{slug}  → actualiza contenido
```

---

## 10. Infraestructura Docker

### Servicios (producción)

| Servicio | Imagen                                     | Puerto host    |
| -------- | ------------------------------------------ | -------------- |
| frontend | `project-frontend` (Node 22 Alpine)        | 3000           |
| backend  | `project-backend` (Python 3.12 slim)       | 8000           |
| db       | `postgres:16-alpine`                       | — (interno)    |
| minio    | `minio/minio:RELEASE.2024-11-07T00-52-20Z` | 9001 (consola) |

### Comandos útiles

```bash
# Levantar todos los servicios
docker compose up -d

# Ver estado y salud
docker compose ps

# Logs de un servicio
docker logs project-backend-1 -f

# Acceder a la DB
docker exec -it project-db-1 psql -U casas_user -d casas_campo

# Generar nueva migración (tras cambios en modelos)
docker exec project-backend-1 sh -c "alembic revision --autogenerate -m 'descripcion'"
# ¡Copiar el archivo al host inmediatamente!
docker cp project-backend-1:/app/alembic/versions/<archivo>.py ./backend/alembic/versions/

# Aplicar migraciones
docker exec project-backend-1 alembic upgrade head

# Levantar entorno de desarrollo
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

### Desarrollo local

El `docker-compose.dev.yml` sobreescribe:

- Frontend: volumen bind `./frontend:/app` + `--turbopack` hot reload
- Backend: volumen bind `./backend:/app` + `--reload` (via `DEBUG=true` en entrypoint.sh)
- MinIO: expone puerto 9000 para acceso desde el browser

---

## 11. Variables de Entorno

### `.env` (raíz del proyecto)

```env
# Base de datos
DB_NAME=casas_campo
DB_USER=casas_user
DB_PASSWORD=<password seguro>

# JWT
JWT_SECRET=<32 bytes hex: openssl rand -hex 32>
NEXTAUTH_SECRET=<32 bytes hex>

# MinIO
MINIO_USER=admin
MINIO_PASSWORD=<mínimo 8 chars>
```

### Variables de entorno del backend (en compose)

| Variable                                | Descripción                                     |
| --------------------------------------- | ----------------------------------------------- |
| `DATABASE_URL`                          | `postgresql+asyncpg://user:pass@db:5432/dbname` |
| `JWT_SECRET`                            | Secret para firmar JWT                          |
| `JWT_ALGORITHM`                         | `HS256`                                         |
| `ACCESS_TOKEN_EXPIRE_MINUTES`           | Default: 15                                     |
| `REFRESH_TOKEN_EXPIRE_DAYS`             | Default: 7                                      |
| `MINIO_ENDPOINT`                        | `minio:9000`                                    |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | Credenciales MinIO                              |
| `MINIO_SECURE`                          | `false` (true solo con HTTPS)                   |
| `CORS_ORIGINS`                          | `http://localhost:3000`                         |
| `DEBUG`                                 | `true` activa `--reload` en uvicorn             |

### Variables de entorno del frontend (en compose)

| Variable                | Descripción                         |
| ----------------------- | ----------------------------------- |
| `BACKEND_URL`           | `http://backend:8000` (server-side) |
| `NEXTAUTH_SECRET`       | Secret para cookies Next.js         |
| `NEXTAUTH_URL`          | URL pública del frontend            |
| `NEXT_PUBLIC_MINIO_URL` | URL pública de MinIO (client-side)  |

---

## Notas para desarrollo futuro

- **Creación de superadmin**: El registro público siempre crea `CLIENT`. Para promover a `SUPER_ADMIN`, registrar normalmente y luego: `UPDATE users SET role = 'SUPER_ADMIN' WHERE email = '...';`
- **Migraciones**: Siempre generar dentro del contenedor y copiar al host antes de reconstruir la imagen.
- **package-lock.json**: Pendiente de generar (`cd frontend && npm install`) para usar `npm ci` en Dockerfiles y tener builds reproducibles.
- **HTTPS en producción**: Cambiar `COOKIE_OPTS.secure = True` en `auth.py` y `MINIO_SECURE = true`.
- **bcrypt**: Fijado a `4.0.1` por incompatibilidad de `passlib==1.7.4` con `bcrypt>=4.1`.
- **Planes SDD**: Todos los planes/specs de features (metodología SDD) viven en `specs/NNN-nombre/` en la raíz del repo (spec.md, plan.md, research.md, tasks.md) — nunca fuera del directorio de trabajo. Incrementos existentes: 001 landing scrollytelling, 002 dashboard de disponibilidad, 003 notificaciones WhatsApp.
