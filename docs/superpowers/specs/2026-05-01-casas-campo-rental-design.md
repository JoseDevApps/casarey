# Diseño — Aplicación de Renta de Casas de Campo

**Fecha:** 2026-05-01  
**Backlog de referencia:** `Backlog - Aplicación de renta de casas de campo.md`

---

## 1. Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui |
| Backend | FastAPI (Python) + SQLAlchemy async + Alembic |
| Base de datos | PostgreSQL 16 |
| Almacenamiento de archivos | MinIO (S3-compatible, self-hosted) |
| Autenticación | JWT: access token (15 min) + refresh token (7 días) en cookies httpOnly |
| Infraestructura | Docker Compose (monorepo) |

---

## 2. Arquitectura General

### Servicios Docker Compose

```
┌─────────────────────────────────────────────────────┐
│                   Docker Compose                    │
│                                                     │
│  ┌──────────────┐        ┌──────────────────────┐  │
│  │   frontend   │───────▶│      backend         │  │
│  │  Next.js 15  │  HTTP  │   FastAPI + Uvicorn  │  │
│  │  :3000       │        │   :8000              │  │
│  └──────────────┘        └──────────┬───────────┘  │
│                                     │               │
│                     ┌───────────────┴──────────┐   │
│                     ▼                          ▼   │
│             ┌──────────────┐      ┌──────────────┐ │
│             │  PostgreSQL  │      │    MinIO     │ │
│             │  :5432       │      │  :9000/:9001 │ │
│             └──────────────┘      └──────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Regla de red crítica

El browser **nunca llama a FastAPI directamente**. Todas las peticiones del cliente van a Next.js (Route Handlers o Server Actions). Next.js llama a FastAPI server-to-server via `http://backend:8000` en la red interna de Docker.

### Estructura del monorepo

```
project-root/
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
├── frontend/
│   ├── Dockerfile
│   └── src/
├── backend/
│   ├── Dockerfile
│   └── app/
└── docs/
    └── superpowers/specs/
```

---

## 3. Roles y RBAC

| Rol | Descripción | Restricción |
|---|---|---|
| `CLIENT` | Navega, cotiza y gestiona sus reservas | Registro abierto |
| `ADMIN` | Gestiona propiedades, aprueba reservas, verifica pagos | Promovido por SUPER_ADMIN |
| `SUPER_ADMIN` | Control total, auditoría, CMS | **Solo puede existir uno en toda la base de datos** |

La restricción de SUPER_ADMIN único se aplica en dos capas:
1. `CHECK` constraint en la tabla `users` via función PostgreSQL
2. Validación en FastAPI al registrar o promover cualquier usuario

---

## 4. Esquema de Base de Datos

### Usuarios y Autenticación

```sql
users
  id            UUID PRIMARY KEY
  email         VARCHAR UNIQUE NOT NULL
  password_hash VARCHAR NOT NULL
  full_name     VARCHAR NOT NULL
  phone         VARCHAR
  role          ENUM(CLIENT, ADMIN, SUPER_ADMIN) NOT NULL DEFAULT 'CLIENT'
  is_active     BOOLEAN DEFAULT true
  created_at    TIMESTAMPTZ DEFAULT now()

refresh_tokens
  id          UUID PRIMARY KEY
  user_id     UUID FK → users
  token_hash  VARCHAR NOT NULL
  expires_at  TIMESTAMPTZ NOT NULL
  revoked_at  TIMESTAMPTZ          -- NULL = activo
```

### Propiedades

```sql
properties
  id             UUID PRIMARY KEY
  owner_id       UUID FK → users (role=ADMIN)
  name           VARCHAR NOT NULL
  description    TEXT
  address        VARCHAR
  latitude       DECIMAL(9,6)
  longitude      DECIMAL(9,6)
  checkin_time   TIME NOT NULL
  checkout_time  TIME NOT NULL
  max_guests     INTEGER NOT NULL
  rate_adult     DECIMAL(10,2) NOT NULL   -- 120 Bs (tarifa base)
  rate_child     DECIMAL(10,2) NOT NULL   -- 60 Bs (tarifa base)
  is_active      BOOLEAN DEFAULT true
  created_at     TIMESTAMPTZ DEFAULT now()

property_images
  id          UUID PRIMARY KEY
  property_id UUID FK → properties
  minio_key   VARCHAR NOT NULL            -- path en MinIO bucket property-images
  sort_order  INTEGER DEFAULT 0

property_calendar                        -- SPARSE: solo filas no-AVAILABLE
  id              UUID PRIMARY KEY
  property_id     UUID FK → properties
  date            DATE NOT NULL
  status          ENUM(BOOKED, BLOCKED) NOT NULL  -- ausencia de fila = AVAILABLE
  blocked_reason  VARCHAR                          -- solo cuando BLOCKED
  UNIQUE(property_id, date)

-- Convención de fechas: las filas cubren [check_in_date, check_out_date).
-- El día check_out_date NO se bloquea (es día de salida, disponible para nuevo check-in).
```

### Reservas (Máquina de Estados)

```sql
reservations
  id                   UUID PRIMARY KEY
  property_id          UUID FK → properties
  client_id            UUID FK → users
  check_in_date        DATE NOT NULL
  check_out_date       DATE NOT NULL
  num_adults           INTEGER NOT NULL
  num_children         INTEGER DEFAULT 0
  snapshot_rate_adult  DECIMAL(10,2) NOT NULL   -- INMUTABLE: precio al cotizar
  snapshot_rate_child  DECIMAL(10,2) NOT NULL   -- INMUTABLE: precio al cotizar
  total_amount         DECIMAL(10,2) NOT NULL   -- calculado y guardado
  status               ENUM(
                         PENDING_APPROVAL,
                         APPROVED_WAITING_PAYMENT,
                         CONFIRMED,
                         REJECTED,
                         CANCELLED
                       ) DEFAULT 'PENDING_APPROVAL'
  created_at           TIMESTAMPTZ DEFAULT now()
  updated_at           TIMESTAMPTZ DEFAULT now()

booking_guests
  id             UUID PRIMARY KEY
  reservation_id UUID FK → reservations  -- solo cuando status = CONFIRMED
  full_name      VARCHAR NOT NULL
  id_number      VARCHAR NOT NULL
  phone          VARCHAR
```

### Pagos

```sql
payment_methods
  id          UUID PRIMARY KEY
  owner_id    UUID FK → users (role=ADMIN)
  name        VARCHAR NOT NULL            -- "Banco BCP", "QR Tigo"
  description TEXT
  minio_key   VARCHAR                     -- imagen QR en bucket payment-methods
  is_active   BOOLEAN DEFAULT true

payment_vouchers
  id             UUID PRIMARY KEY
  reservation_id UUID FK → reservations UNIQUE  -- un comprobante por reserva
  minio_key      VARCHAR NOT NULL               -- en bucket payment-vouchers (privado)
  uploaded_at    TIMESTAMPTZ DEFAULT now()
```

### CMS

```sql
cms_banners
  id         UUID PRIMARY KEY
  title      VARCHAR NOT NULL
  subtitle   VARCHAR
  minio_key  VARCHAR                     -- imagen del banner
  is_visible BOOLEAN DEFAULT true
  sort_order INTEGER DEFAULT 0

cms_static_pages
  id      UUID PRIMARY KEY
  slug    VARCHAR UNIQUE NOT NULL        -- 'terms', 'privacy', 'contact'
  content TEXT NOT NULL

cms_featured_properties
  property_id UUID FK → properties
  sort_order  INTEGER DEFAULT 0
  PRIMARY KEY (property_id)
```

### Buckets MinIO

| Bucket | Contenido | Acceso |
|---|---|---|
| `property-images` | Fotos de propiedades | Público (read) |
| `payment-methods` | QR codes y datos bancarios | Público (read) |
| `payment-vouchers` | Comprobantes de clientes | Privado (solo backend) |

---

## 5. Máquina de Estados de Reservas

```
PENDING_APPROVAL
    ├──[admin aprueba]──▶ APPROVED_WAITING_PAYMENT
    └──[admin rechaza]──▶ REJECTED (terminal)

APPROVED_WAITING_PAYMENT
    ├──[admin aprueba voucher]──▶ CONFIRMED  ← transacción atómica
    └──[admin/cliente cancela]──▶ CANCELLED (terminal)

CONFIRMED
    └──[habilita] registro de booking_guests
```

`REJECTED` y `CANCELLED` son estados terminales: no se pueden revertir.

### Transacción atómica en confirmación de pago (Pay-02)

Al aprobar un comprobante de pago:

```python
async with db.begin():
    reservation.status = "CONFIRMED"
    for date in date_range(check_in, check_out):
        calendar_entry.status = "BOOKED"
    # Si algo falla → rollback automático. Nunca queda en estado inconsistente.
```

---

## 6. Anti-Overbooking y Condiciones de Carrera

### El problema

Dos usuarios pueden consultar disponibilidad simultáneamente, ver las mismas fechas libres, y crear dos reservas solapadas para la misma propiedad.

### Solución en dos capas

**Capa 1 — Bloqueo suave por reservas activas:**

`check_availability()` considera las fechas como ocupadas si existe cualquier reserva en estado `[PENDING_APPROVAL, APPROVED_WAITING_PAYMENT, CONFIRMED]` con fechas solapadas. Las fechas no necesitan estar `BOOKED` en el calendario para considerarse indisponibles.

**Capa 2 — Advisory Lock de PostgreSQL:**

La verificación de disponibilidad y la creación de la reserva ocurren dentro de una única transacción con `pg_advisory_xact_lock` keyed en el `property_id`. Esto serializa todos los intentos concurrentes para la misma propiedad:

```python
async def create_reservation(db, property_id, ...):
    async with db.begin():
        await db.execute(
            text("SELECT pg_advisory_xact_lock(:lock_id)"),
            {"lock_id": hash(str(property_id)) % 2**31}
        )
        conflicts = await _check_overlapping_active_reservations(
            db, property_id, check_in, check_out
        )
        if conflicts:
            raise HTTPException(409, "Fechas no disponibles")
        reservation = Reservation(snapshot_rate_adult=..., ...)
        db.add(reservation)
```

| Riesgo | Solución |
|---|---|
| Dos usuarios reservan mismas fechas simultáneamente | Advisory lock serializa por propiedad |
| Admin aprueba dos reservas solapadas en PENDING | Capa 1: PENDING ya bloquea las fechas |
| Crash entre confirmación y actualización de calendario | Transacción atómica (Pay-02) |

---

## 7. Autenticación JWT

### Flujo

1. `POST /api/auth/login` → Route Handler en Next.js
2. Route Handler llama a FastAPI → recibe `{access_token, refresh_token}`
3. Next.js guarda ambos tokens en cookies `httpOnly` (inaccesibles al JS del browser)
4. Peticiones siguientes: cookie viaja automáticamente
5. Si FastAPI devuelve `401` → `api-client.ts` llama automáticamente a `/api/auth/refresh`
6. Si refresh también falla → redirige a `/login`
7. `middleware.ts` de Next.js verifica cookie en cada request y redirige según rol

### Redirección post-login

| Rol | Ruta |
|---|---|
| `CLIENT` | `/dashboard/reservations` |
| `ADMIN` | `/dashboard/properties` |
| `SUPER_ADMIN` | `/dashboard/users` |

---

## 8. Estructura del Backend (FastAPI)

```
backend/app/
├── main.py                     -- FastAPI app, CORS, registro de routers
├── core/
│   ├── config.py               -- settings desde .env (pydantic-settings)
│   ├── security.py             -- JWT create/verify, bcrypt hashing
│   └── database.py             -- SQLAlchemy async engine + session factory
├── models/                     -- SQLAlchemy ORM (1 archivo por dominio)
│   ├── user.py
│   ├── property.py
│   ├── reservation.py
│   ├── payment.py
│   └── cms.py
├── schemas/                    -- Pydantic schemas (request/response)
│   ├── user.py
│   ├── property.py
│   ├── reservation.py
│   ├── payment.py
│   └── cms.py
├── routers/                    -- Un router por dominio de negocio
│   ├── auth.py                 -- /auth/register, /auth/login, /auth/refresh, /auth/logout
│   ├── users.py                -- /users (Super Admin: lista + cambio de roles)
│   ├── properties.py           -- /properties (CRUD Admin + listado público)
│   ├── calendar.py             -- /properties/{id}/calendar, /block
│   ├── reservations.py         -- /reservations (cotizar, aprobar, rechazar, confirmar)
│   ├── payments.py             -- /payments/methods, /payments/vouchers
│   ├── finances.py             -- /finances/summary (Admin), /finances/global (Super Admin)
│   └── cms.py                  -- /cms/banners, /cms/pages, /cms/featured
├── services/                   -- Lógica de negocio desacoplada de los routers
│   ├── reservation_service.py  -- máquina de estados + snapshot de precios + advisory lock
│   ├── payment_service.py      -- transacción atómica CONFIRMED + BOOKED
│   ├── storage_service.py      -- upload/delete/presigned URLs en MinIO (boto3)
│   └── calendar_service.py     -- verificar disponibilidad, bloquear fechas manualmente
└── dependencies.py             -- get_current_user, require_role("ADMIN"), require_role("SUPER_ADMIN")
```

### Librerías clave

| Librería | Propósito |
|---|---|
| `sqlalchemy[asyncio]` | ORM asíncrono |
| `alembic` | Migraciones de base de datos |
| `python-jose[cryptography]` | JWT |
| `passlib[bcrypt]` | Hash de contraseñas |
| `boto3` | Cliente MinIO (S3-compatible) |
| `pydantic-settings` | Configuración desde `.env` |

---

## 9. Estructura del Frontend (Next.js App Router)

```
frontend/src/
├── app/
│   ├── (public)/                       -- Layout sin autenticación
│   │   ├── page.tsx                    -- Landing Page (Cat-01)
│   │   ├── properties/[id]/page.tsx    -- Detalle + calendario disponibilidad (Cat-02)
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   │
│   ├── (client)/                       -- Layout con auth, role=CLIENT
│   │   └── dashboard/
│   │       ├── reservations/page.tsx   -- Mis reservas
│   │       └── reservations/[id]/      -- Detalle + subir comprobante
│   │
│   ├── (admin)/                        -- Layout con auth, role=ADMIN
│   │   └── dashboard/
│   │       ├── properties/             -- CRUD propiedades (Prop-01, Prop-02)
│   │       ├── calendar/[id]/          -- Calendario dinámico (Prop-03)
│   │       ├── reservations/           -- Aprobar/rechazar (Res-02, Res-03)
│   │       ├── payments/               -- Métodos de pago (Pay-01, Pay-02)
│   │       └── finances/               -- Ingresos mensuales (Fin-01)
│   │
│   ├── (superadmin)/                   -- Layout con auth, role=SUPER_ADMIN
│   │   └── dashboard/
│   │       ├── users/                  -- Lista + cambio de roles (Admin-01, Admin-02)
│   │       ├── cms/banners/            -- Hero Section (CMS-02)
│   │       ├── cms/pages/              -- Términos, privacidad, contacto (CMS-03)
│   │       ├── cms/featured/           -- Propiedades destacadas (CMS-04)
│   │       └── finances/               -- Vista global auditoría (Fin-02)
│   │
│   └── api/                            -- Route Handlers (proxy a FastAPI)
│       ├── auth/[...]/route.ts
│       ├── properties/[...]/route.ts
│       ├── reservations/[...]/route.ts
│       └── uploads/route.ts
│
├── lib/
│   ├── api-client.ts                   -- fetch wrapper con auto-refresh de token
│   ├── auth.ts                         -- helpers JWT (lectura de cookies httpOnly)
│   └── utils.ts
│
└── components/
    ├── ui/                             -- shadcn/ui base components
    ├── property-card.tsx
    ├── availability-calendar.tsx       -- días BOOKED en rojo, BLOCKED en gris
    ├── reservation-status-badge.tsx
    └── file-uploader.tsx               -- subida de archivos a MinIO vía backend
```

---

## 10. Manejo de Errores

### Backend

Un handler global en `main.py` formatea todos los errores uniformemente:

```json
{ "detail": "Fechas no disponibles", "code": "DATES_UNAVAILABLE" }
```

| Situación | HTTP |
|---|---|
| Fechas ocupadas al cotizar | 409 Conflict |
| Transición de estado inválida | 422 Unprocessable |
| Fallo en transacción atómica Pay-02 | 500 + rollback automático |
| Token expirado | 401 → frontend hace refresh |
| Intento de crear segundo SUPER_ADMIN | 403 Forbidden |
| Archivo demasiado grande | 413 |

### Frontend

- `error.tsx` por segmento de ruta captura errores de render
- `api-client.ts` intercepta 401 → intenta refresh → si falla, redirige a `/login`
- Formularios con `react-hook-form` + `zod` para validación client-side

---

## 11. Estrategia de Testing

### Backend — pytest + pytest-asyncio

| Capa | Qué testear |
|---|---|
| `services/` | Todas las transiciones de la máquina de estados (válidas e inválidas) |
| `services/` | Advisory lock: test concurrente con `asyncio.gather` |
| `services/` | Transacción atómica Pay-02: simular fallo a mitad de transacción |
| `routers/` | Endpoints con roles incorrectos devuelven 403 |
| `models/` | Constraint SUPER_ADMIN único en DB |

Base de datos de test: **PostgreSQL real en Docker** (no mocks). Los advisory locks y transacciones ACID requieren el motor real para ser probados correctamente.

### Frontend — Playwright (E2E)

| Flujo | Descripción |
|---|---|
| Flujo completo de reserva | Cliente cotiza → Admin aprueba → Cliente sube voucher → Admin confirma |
| Bloqueo de rol | Cliente no puede acceder a `/dashboard/properties` |
| Refresh token automático | Token expirado → auto-refresh → continúa sin logout forzado |

---

## 12. Docker Compose

### `docker-compose.yml`

```yaml
services:
  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    environment:
      BACKEND_URL: http://backend:8000
    depends_on: [backend]

  backend:
    build: ./backend
    ports: ["8000:8000"]
    environment:
      DATABASE_URL: postgresql+asyncpg://${DB_USER}:${DB_PASSWORD}@db:5432/${DB_NAME}
      MINIO_ENDPOINT: minio:9000
      JWT_SECRET: ${JWT_SECRET}
      ACCESS_TOKEN_EXPIRE_MINUTES: 15
      REFRESH_TOKEN_EXPIRE_DAYS: 7
    depends_on: [db, minio]
    command: >
      sh -c "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"

  db:
    image: postgres:16-alpine
    volumes: [postgres_data:/var/lib/postgresql/data]
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    ports: ["9001:9001"]
    volumes: [minio_data:/data]
    environment:
      MINIO_ROOT_USER: ${MINIO_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_PASSWORD}

volumes:
  postgres_data:
  minio_data:
```

### `.env.example`

```
JWT_SECRET=cambiar_en_produccion
DB_NAME=casas
DB_USER=casas_user
DB_PASSWORD=cambiar_en_produccion
MINIO_USER=admin
MINIO_PASSWORD=cambiar_en_produccion
```

---

## 13. Trazabilidad Backlog → Diseño

| Historia | Cubierta en |
|---|---|
| Auth-01, Auth-02 | Sección 7 (JWT), router `auth.py` |
| Admin-01, Admin-02, Admin-03 | RBAC Sección 3, router `users.py`, constraint SUPER_ADMIN |
| Cat-01, Cat-02 | Rutas públicas frontend, `properties.py`, `calendar.py` |
| Prop-01, Prop-02, Prop-03 | Router `properties.py`, `calendar.py`, schema `properties` |
| Res-01, Res-02, Res-03 | Sección 5 (máquina de estados), `reservation_service.py` |
| Pay-01, Pay-02 | Router `payments.py`, `payment_service.py`, transacción atómica |
| Fin-01, Fin-02 | Router `finances.py`, snapshot inmutable en `reservations` |
| CMS-01..04 | Router `cms.py`, tablas `cms_*`, rutas `(superadmin)` |
