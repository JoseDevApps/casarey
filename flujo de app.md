# Flujo de la Aplicación — Casas de Campo

Este documento describe **paso a paso** cómo viaja una request desde el navegador del usuario hasta la base de datos y de vuelta, por cada servicio del sistema. Está organizado por dominio funcional.

## Índice

1. [Anatomía de un request](#1-anatomía-de-un-request)
2. [Arranque de la app (lifespan)](#2-arranque-de-la-app-lifespan)
3. [Autenticación](#3-autenticación)
4. [Propiedades](#4-propiedades)
5. [Calendario](#5-calendario)
6. [Reservas — ciclo completo](#6-reservas--ciclo-completo)
7. [Comprobantes y métodos de pago](#7-comprobantes-y-métodos-de-pago)
8. [Finanzas](#8-finanzas)
9. [Usuarios (super admin)](#9-usuarios-super-admin)
10. [CMS (super admin)](#10-cms-super-admin)
11. [Almacenamiento (MinIO)](#11-almacenamiento-minio)

---

## 1. Anatomía de un request

```
┌───────────┐   1. fetch/click    ┌──────────────────────────┐
│  Browser  │ ───────────────────► │  Next.js (frontend:3000) │
└───────────┘                      │                          │
      ▲                            │  • middleware.ts         │
      │                            │  • Server Component      │
      │ 6. HTML/JSON               │  • API proxy             │
      │                            │    /api/[...path]/       │
      │                            └────────┬─────────────────┘
      │                                     │ 2. fetch interno
      │                                     ▼
      │                            ┌──────────────────────────┐
      │                            │ FastAPI (backend:8000)   │
      │                            │                          │
      │                            │  • Dependencies          │
      │                            │  • Router                │
      │                            │  • Service               │
      │                            └─────┬─────────┬──────────┘
      │                                  │ 3. SQL  │ 4. S3 API
      │                                  ▼         ▼
      │                            ┌──────────┐ ┌──────────┐
      │                            │ Postgres │ │  MinIO   │
      │                            │   :5432  │ │  :9000   │
      │                            └──────────┘ └──────────┘
```

### Capas en orden

| # | Capa | Archivo / Componente | Responsabilidad |
|---|------|----------------------|-----------------|
| 1 | **Middleware** | `frontend/src/middleware.ts` | Verifica cookie `access_token`, redirige a `/login` si falta para rutas protegidas |
| 2 | **Server Component (layout)** | `(client)/layout.tsx`, `(admin)/layout.tsx`, `(superadmin)/layout.tsx` | Llama a `/auth/me`, valida rol, redirige al dashboard correcto. **Marcado `force-dynamic`** para no cachear |
| 3 | **Client Component (page)** | `dashboard/.../page.tsx` | Renderiza UI, hace SWR a `/api/...` |
| 4 | **API Proxy** | `frontend/src/app/api/[...path]/route.ts` | Reescribe `/api/X` → `http://backend:8000/X`, reenvía cookies y multipart |
| 5 | **Dependency** | `backend/app/dependencies.py` | `get_current_user`, `require_role(...)` — extrae JWT, busca user en DB |
| 6 | **Router** | `backend/app/routers/*.py` | Valida input (Pydantic), llama servicio, devuelve respuesta |
| 7 | **Service** | `backend/app/services/*.py` | Lógica de negocio, transacciones DB, llamadas a MinIO |
| 8 | **Modelo ORM** | `backend/app/models/*.py` | Mapeo a tablas Postgres (SQLAlchemy 2 async) |

---

## 2. Arranque de la app (lifespan)

### Backend (al iniciar uvicorn)

```python
# backend/app/main.py
@asynccontextmanager
async def lifespan(app):
    storage_service.ensure_buckets()    # Crea buckets en MinIO si no existen
    yield                                # App vive aquí
```

`ensure_buckets()` (en `storage_service.py`):
1. Conecta a MinIO con `boto3` usando `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`
2. Para cada bucket (`property-images`, `payment-methods`, `payment-vouchers`):
   - `client.head_bucket(Bucket=...)` → si 404 → `client.create_bucket(...)`
3. Aplica política `s3:GetObject` pública a `property-images` y `payment-methods`

### Backend — entrypoint.sh

```sh
alembic upgrade head      # Aplica migraciones pendientes
uvicorn app.main:app ...  # Arranca el servidor
```

Si `DEBUG=true`, agrega `--reload` para hot-reload en dev.

---

## 3. Autenticación

### 3.1 Registro de usuario (CLIENT)

```
Browser:  /register  →  formulario  →  POST /api/auth/register
                                              │
proxy ──────────────────────────────────────► POST http://backend:8000/auth/register
backend/app/routers/auth.py::register
  ├─ SELECT id FROM users WHERE email = ?         (validar email único)
  ├─ if exists → 409 EMAIL_TAKEN
  ├─ hash_password(body.password)                 (bcrypt)
  ├─ INSERT INTO users (email, password_hash,
  │                     full_name, phone,
  │                     role='CLIENT')
  └─ COMMIT  →  return UserResponse
```

**Decisión clave:** el rol siempre se inicia como `CLIENT`. Para promover, hay que hacer `UPDATE` directo en la DB o usar el endpoint de superadmin.

### 3.2 Login

```
Browser:  /login → submit  →  POST /api/auth/login  { email, password }
                                              │
proxy ──────────────────────────────────────► POST /auth/login
backend/app/routers/auth.py::login
  ├─ SELECT * FROM users WHERE email = ?
  ├─ if not user OR !verify_password(...) → 401 INVALID_CREDENTIALS
  ├─ if !user.is_active                  → 403 ACCOUNT_DISABLED
  ├─ access_token  = create_access_token({sub: user.id, role: user.role})
  ├─ refresh_token = create_refresh_token({sub: user.id})
  ├─ INSERT INTO refresh_tokens
  │     (user_id, token_hash=sha256(refresh), expires_at=now+7d)
  ├─ response.set_cookie("access_token",  access_token,  HttpOnly, SameSite=lax, Max-Age=900)
  ├─ response.set_cookie("refresh_token", refresh_token, HttpOnly, SameSite=lax, Max-Age=604800)
  └─ return TokenResponse  { access_token, refresh_token, token_type: "bearer" }

proxy ── reenvía DOS Set-Cookie headers al browser ──► Browser (cookies se almacenan)

Browser (login/page.tsx):
  ├─ fetch('/api/auth/me', { credentials: 'include' })   ← envía cookies
  │   proxy → backend GET /auth/me → UserResponse { role, full_name, ... }
  └─ if role===SUPER_ADMIN → router.push('/dashboard/users')
     else if ADMIN         → '/dashboard/properties'
     else                  → '/dashboard/reservations'
```

### 3.3 Petición autenticada genérica (ej. `GET /auth/me`)

```
backend/app/dependencies.py::get_current_user
  ├─ Cookie(default=None) → access_token (extraído por FastAPI)
  ├─ if !access_token → 401 NOT_AUTHENTICATED
  ├─ payload = verify_token(access_token)         (decodifica JWT con JWT_SECRET)
  ├─ SELECT * FROM users WHERE id = payload.sub AND is_active = TRUE
  ├─ if no user → 401 USER_NOT_FOUND
  └─ return User
```

`require_role(UserRole.ADMIN, UserRole.SUPER_ADMIN)` envuelve a `get_current_user` y verifica adicionalmente:
```python
if current_user.role not in roles:
    raise 403 INSUFFICIENT_PERMISSIONS
```

### 3.4 Refresh de tokens (rotación)

`apiFetch()` en el cliente detecta 401 → llama `POST /api/auth/refresh` → reintenta:

```
proxy → POST /auth/refresh  (con cookie refresh_token)
backend/app/routers/auth.py::refresh
  ├─ verify_token(refresh_token)
  ├─ token_hash = sha256(refresh_token)
  ├─ SELECT * FROM refresh_tokens
  │    WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > now()
  ├─ if not found → 401 INVALID_REFRESH
  ├─ UPDATE refresh_tokens SET revoked_at = now() WHERE id = ?  ← revoca el viejo
  ├─ Crea nuevo access + nuevo refresh
  ├─ INSERT INTO refresh_tokens (nuevo hash, expires_at = now+7d)
  ├─ set_cookie ambos tokens nuevos
  └─ return TokenResponse
```

Si el refresh falla, `api-client.ts` redirige al usuario a `/login`.

### 3.5 Logout

```
POST /api/auth/logout
  ├─ token_hash = sha256(refresh_token de la cookie)
  ├─ UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = ?
  ├─ response.delete_cookie("access_token")
  └─ response.delete_cookie("refresh_token")
```

---

## 4. Propiedades

### 4.1 Listado público (landing / `/properties`)

```
Browser GET /properties (page público)
  └─ <PropertyList />  →  SWR  →  GET /api/properties?page=1&page_size=20
                                          │
proxy → GET /properties?page=1&page_size=20
backend/app/routers/properties.py::list_properties
  ├─ SELECT count(*) FROM properties WHERE is_active = TRUE     ← total
  ├─ SELECT * FROM properties
  │    WHERE is_active = TRUE
  │    ORDER BY created_at DESC
  │    OFFSET ? LIMIT ?
  ├─ for each property:
  │     SELECT * FROM property_images WHERE property_id = ? ORDER BY sort_order
  │     for each image:
  │         url = http://minio:9000/property-images/<minio_key>   (público)
  └─ return PropertyListResponse { items: [...], total, page, page_size }

Browser → renderiza grilla con <PropertyCard image_url={url} ... />
```

> **Nota:** N+1 — una query por propiedad para sus imágenes. Aceptable para 20 props/página; se podría optimizar con `selectinload` si crece.

### 4.2 Detalle de propiedad

```
GET /api/properties/{id}  →  GET /properties/{id}
  ├─ SELECT * FROM properties WHERE id = ? AND is_active = TRUE
  ├─ if not found → 404 PROPERTY_NOT_FOUND
  ├─ SELECT * FROM property_images WHERE property_id = ? ORDER BY sort_order
  └─ return PropertyResponse  { ...prop, images: [{url, ...}] }
```

### 4.3 Crear propiedad (admin/superadmin)

```
Browser dashboard form  →  POST /api/properties  { name, ..., rate_adult, rate_child }
proxy → POST /properties
backend/app/routers/properties.py::create_property
  ├─ require_role(ADMIN, SUPER_ADMIN)       ← inyecta current_user
  ├─ INSERT INTO properties (
  │     owner_id = current_user.id,
  │     name, description, address,
  │     latitude, longitude, checkin_time, checkout_time,
  │     max_guests, rate_adult, rate_child,
  │     is_active = TRUE
  │   )
  ├─ COMMIT
  └─ return PropertyResponse (sin imágenes aún)
```

### 4.4 Subir imagen de propiedad

```
Browser <FileUploader file=...>  →  POST /api/properties/{id}/images?sort_order=0
                                     (multipart/form-data)
proxy:
  ├─ detecta Content-Type: multipart/form-data
  ├─ usa req.blob() para preservar el binario
  └─ reenvía a backend con misma Cookie

backend/app/routers/properties.py::upload_property_image
  ├─ require_role(ADMIN, SUPER_ADMIN)
  ├─ SELECT * FROM properties WHERE id = ?
  ├─ if !prop                                 → 404
  ├─ if ADMIN y owner_id != current_user.id   → 403 FORBIDDEN
  ├─ valida content-type ∈ {jpeg, png, webp}
  ├─ valida size ≤ 8 MB
  ├─ key = "properties/{property_id}/{uuid4}.{ext}"
  ├─ storage_service.upload_file(BUCKET_PROPERTY_IMAGES, key, bytes, ct)
  │     └─ boto3.put_object(Bucket, Key, Body, ContentType)
  ├─ INSERT INTO property_images (property_id, minio_key=key, sort_order)
  ├─ COMMIT
  └─ return PropertyImageResponse { id, minio_key, sort_order, url=public_url }
```

### 4.5 Editar propiedad

```
PUT /api/properties/{id}  { name?, rate_adult?, ... }
  ├─ SELECT prop
  ├─ if ADMIN y owner_id != current_user.id → 403
  ├─ for field in body.model_dump(exclude_unset=True):
  │     setattr(prop, field, value)
  ├─ COMMIT
  └─ return PropertyResponse (con imágenes recargadas)
```

> **Importante:** las reservas anteriores **no** cambian de tarifa porque las reservas tienen `snapshot_rate_*` congelados al momento de creación.

### 4.6 Eliminar propiedad (soft delete)

```
DELETE /api/properties/{id}
  ├─ SELECT prop
  ├─ check ownership
  ├─ UPDATE properties SET is_active = FALSE WHERE id = ?
  └─ COMMIT  (HTTP 204)
```

Las propiedades soft-deleted desaparecen de listados públicos pero se preservan para historial de reservas.

---

## 5. Calendario

### 5.1 Consultar calendario de un mes

```
Browser <AvailabilityCalendar/>  →  SWR  →  GET /api/properties/{id}/calendar?year=2026&month=5
proxy → GET /properties/{id}/calendar?year=2026&month=5
backend/app/routers/calendar.py::get_calendar
  ├─ SELECT * FROM properties WHERE id = ?    (verifica exista)
  ├─ Construye date_strings = ["2026-05-01", ..., "2026-05-31"]
  ├─ SELECT * FROM property_calendar
  │    WHERE property_id = ? AND date IN (date_strings)
  └─ return CalendarMonthResponse {
         entries: [{date, status, blocked_reason}, ...]
     }
```

El frontend cruza estas entradas con el rango seleccionado para deshabilitar días.

### 5.2 Bloquear fechas (admin)

```
Admin <CalendarManager>  →  POST /api/properties/{id}/calendar/block
                            body: { dates: ["2026-06-15","2026-06-16"], reason: "Mantenimiento" }
proxy → POST /properties/{id}/calendar/block
backend/app/routers/calendar.py::block_dates
  ├─ require_role(ADMIN, SUPER_ADMIN)
  ├─ SELECT prop  +  check ownership
  ├─ valida formato YYYY-MM-DD para cada fecha
  ├─ SELECT * FROM property_calendar
  │    WHERE property_id = ? AND date IN (body.dates)
  ├─ Para cada fecha NO existente:
  │     INSERT INTO property_calendar
  │       (property_id, date, status='BLOCKED', blocked_reason=reason)
  └─ COMMIT  →  { detail: "X fecha(s) bloqueada(s)", created: X }
```

### 5.3 Desbloquear una fecha

```
DELETE /api/properties/{id}/calendar/2026-06-15
  ├─ SELECT entry WHERE property_id = ? AND date = ?
  ├─ if !entry → 404 DATE_NOT_FOUND
  ├─ if entry.status == BOOKED → 422 CANNOT_UNBLOCK_BOOKED
  │    (las fechas BOOKED solo se liberan cancelando la reserva)
  └─ DELETE FROM property_calendar WHERE id = ?
     COMMIT (204)
```

---

## 6. Reservas — ciclo completo

### Estados y transiciones válidas

```
                  ┌─────────────────────────┐
                  │  PENDING_APPROVAL       │  ← Cliente crea
                  └────────┬──────┬─────────┘
                  approve  │      │  reject
                           ▼      ▼
        ┌──────────────────┐    ┌──────────┐
        │ APPROVED_WAITING │    │ REJECTED │ (terminal)
        │   _PAYMENT       │    └──────────┘
        └──┬─────────────┬─┘
           │             │
   confirm-payment    cancel
           ▼             ▼
       ┌──────────┐  ┌───────────┐
       │ CONFIRMED│  │ CANCELLED │ (terminal)
       └──────────┘  └───────────┘
       (terminal — bloquea calendario)
```

### 6.1 Cliente crea reserva

```
Cliente <BookingForm>  →  POST /api/reservations
                         body: { property_id, check_in_date, check_out_date,
                                 num_adults, num_children }
proxy → POST /reservations
backend/app/routers/reservations.py::create_reservation
  ├─ require_role(CLIENT)
  └─ reservation_service.create_reservation(...)
       ├─ async with db.begin():               ← transacción atómica
       ├─ pg_advisory_xact_lock(hash(property_id))    ← serializa intentos para esta prop
       ├─ SELECT * FROM properties
       │    WHERE id = ? AND is_active = TRUE
       ├─ check_availability(db, property_id, check_in, check_out):
       │    ├─ dates = lista de fechas en el rango
       │    ├─ SELECT 1 FROM property_calendar
       │    │    WHERE property_id = ? AND date IN (dates)        ← BOOKED/BLOCKED
       │    │    → si existe: NO disponible
       │    └─ SELECT 1 FROM reservations
       │         WHERE property_id = ?
       │           AND status IN (PENDING, APPROVED, CONFIRMED)
       │           AND check_in_date < check_out
       │           AND check_out_date > check_in
       │         → si existe overlap: NO disponible
       ├─ if !available  → 409 DATES_UNAVAILABLE
       ├─ valida check_out > check_in
       ├─ nights = (check_out - check_in).days
       ├─ total = (rate_adult * num_adults + rate_child * num_children) * nights
       ├─ INSERT INTO reservations
       │    (property_id, client_id, check_in_date, check_out_date,
       │     num_adults, num_children,
       │     snapshot_rate_adult,    ← congelado
       │     snapshot_rate_child,    ← congelado
       │     total_amount,
       │     status='PENDING_APPROVAL')
       └─ FLUSH  (commit al salir del with)

  return ReservationResponse
```

> **Por qué advisory lock:** dos clientes no pueden reservar las mismas fechas a la vez sin que uno de los dos fracase. El lock es por-propiedad (`hash(property_id)`), así no bloquea otras propiedades.

### 6.2 Listar reservas (auto-filtrado por rol)

```
GET /api/reservations?status=PENDING_APPROVAL&page=1
proxy → GET /reservations?status=...
backend/app/routers/reservations.py::list_reservations
  ├─ require auth (cualquier rol)
  ├─ filters = []
  ├─ if status_filter: filters.append(Reservation.status == ?)
  ├─ if CLIENT:        filters.append(Reservation.client_id == current_user.id)
  ├─ elif ADMIN:
  │     SELECT id FROM properties WHERE owner_id = current_user.id
  │     filters.append(Reservation.property_id IN (esos ids))
  ├─ # SUPER_ADMIN sin filtro extra: ve todo
  ├─ SELECT count(*) FROM reservations WHERE filters → total
  ├─ SELECT * FROM reservations WHERE filters
  │    ORDER BY created_at DESC OFFSET ? LIMIT ?
  └─ return ReservationListResponse { items, total, page, page_size }
```

### 6.3 Aprobar reserva

```
PATCH /api/reservations/{id}/approve
proxy → PATCH /reservations/{id}/approve
backend/app/routers/reservations.py::approve_reservation
  ├─ require_role(ADMIN, SUPER_ADMIN)
  ├─ _get_reservation_for_admin(...):
  │     ├─ SELECT * FROM reservations WHERE id = ?
  │     ├─ if ADMIN: SELECT 1 FROM properties
  │     │     WHERE id = reservation.property_id
  │     │       AND owner_id = current_user.id
  │     │     → si no existe: 403 FORBIDDEN
  ├─ reservation_service.transition_reservation(reservation, APPROVED_WAITING_PAYMENT)
  │     └─ valida transición ∈ VALID_TRANSITIONS[PENDING_APPROVAL]
  │        if no: 422 INVALID_TRANSITION
  │     UPDATE: reservation.status = APPROVED_WAITING_PAYMENT
  ├─ COMMIT  →  refresh
  └─ return ReservationResponse
```

`reject_reservation` y `cancel_reservation` son análogos (con su transición correspondiente).

### 6.4 Cliente sube comprobante

```
Cliente <FileUploader> en detalle de reserva  →  POST /api/reservations/{id}/voucher (multipart)
proxy → POST /reservations/{id}/voucher
backend/app/routers/reservations.py::upload_voucher
  ├─ require_role(CLIENT)
  └─ payment_service.upload_payment_voucher(...)
       ├─ SELECT reservation WHERE id = ?
       ├─ if !reservation                                → 404
       ├─ if client_id != current_user.id                → 403 FORBIDDEN
       ├─ if status != APPROVED_WAITING_PAYMENT           → 422 INVALID_STATUS
       ├─ valida content-type ∈ {jpeg, png, webp, pdf}
       ├─ valida size ≤ 10 MB
       ├─ key = "vouchers/{reservation_id}/{uuid4}.{ext}"
       ├─ storage_service.upload_file(BUCKET_PAYMENT_VOUCHERS, key, bytes, ct)
       ├─ # ¿Ya existía un voucher? → reemplaza
       ├─ SELECT * FROM payment_vouchers WHERE reservation_id = ?
       ├─ if existing:
       │     storage_service.delete_file(BUCKET, existing.minio_key)
       │     UPDATE payment_vouchers SET minio_key = ? WHERE id = ?
       │     return existing
       └─ else:
             INSERT INTO payment_vouchers (reservation_id, minio_key=key)

  ├─ COMMIT
  ├─ url = get_presigned_url(BUCKET, key, expires=3600)    ← URL firmada 1h
  └─ return PaymentVoucherResponse { id, minio_key, uploaded_at, url }
```

### 6.5 Admin confirma pago (TRANSICIÓN ATÓMICA)

```
PATCH /api/reservations/{id}/confirm-payment
proxy → PATCH /reservations/{id}/confirm-payment
backend/app/routers/reservations.py::confirm_payment
  ├─ require_role(ADMIN, SUPER_ADMIN)
  ├─ _get_reservation_for_admin(...)        (verifica propiedad / rol)
  ├─ SELECT 1 FROM payment_vouchers WHERE reservation_id = ?
  ├─ if no voucher  → 422 MISSING_VOUCHER
  └─ reservation_service.confirm_reservation_with_payment(reservation):
       ├─ async with db.begin():
       ├─ if status != APPROVED_WAITING_PAYMENT → 422 INVALID_STATUS
       ├─ reservation.status = CONFIRMED
       ├─ block_dates_for_reservation(property_id, check_in, check_out):
       │     for d in date_range(check_in, check_out):
       │         INSERT INTO property_calendar
       │           (property_id, date=d, status='BOOKED')
       ├─ FLUSH  (commit al salir del with)
       │
       │  Si una INSERT al calendario falla (UNIQUE constraint),
       │  TODA la transacción se revierte (status no cambia).
       └─ return reservation
```

> **Garantía:** o se confirma la reserva Y se bloquea el calendario, o nada cambia. No puede haber reservas CONFIRMED sin entradas BOOKED ni viceversa.

### 6.6 Cancelar reserva

```
PATCH /api/reservations/{id}/cancel
  ├─ get_current_user
  ├─ SELECT reservation
  ├─ if CLIENT y client_id != current_user.id  → 403
  │  if ADMIN y la prop no es suya             → 403
  ├─ transition_reservation(CANCELLED)
  │   ├─ valida transición legal:
  │   │     PENDING_APPROVAL → CANCELLED
  │   │     APPROVED_WAITING_PAYMENT → CANCELLED
  │   │     (CONFIRMED no se puede cancelar; sería terminal)
  │   └─ reservation.status = CANCELLED
  └─ COMMIT
```

> Como `CONFIRMED → CANCELLED` no es una transición válida, una reserva con calendario `BOOKED` queda permanente. Si en el futuro se requiere cancelar reservas confirmadas, hay que añadir lógica para liberar el calendario.

### 6.7 Lista de huéspedes (post-confirmación)

```
POST /api/reservations/{id}/guests  { full_name, id_number, phone }
  ├─ require_role(ADMIN, SUPER_ADMIN)
  ├─ _get_reservation_for_admin(...)
  ├─ if reservation.status != CONFIRMED → 422 INVALID_STATUS
  ├─ INSERT INTO booking_guests (reservation_id, full_name, id_number, phone)
  └─ COMMIT
```

```
GET /api/reservations/{id}/guests
  ├─ get_current_user + _assert_can_access_reservation(...)
  ├─ SELECT * FROM booking_guests WHERE reservation_id = ?
  └─ return GuestListResponse
```

---

## 7. Comprobantes y métodos de pago

### 7.1 Métodos de pago (admin)

```
GET    /api/payment-methods
       └─ SELECT * FROM payment_methods
            WHERE owner_id = current_user.id AND is_active = TRUE
            ORDER BY id

POST   /api/payment-methods  { name, description }
       └─ INSERT INTO payment_methods (owner_id, name, description, is_active=TRUE)

PUT    /api/payment-methods/{id}  { name?, description?, is_active? }
       └─ check ownership  →  setattr  →  COMMIT

DELETE /api/payment-methods/{id}
       └─ UPDATE payment_methods SET is_active = FALSE WHERE id = ?  (soft delete)
```

### 7.2 Subir QR del método de pago

```
POST /api/payment-methods/{id}/image  (multipart: file)
backend/app/routers/payments.py::upload_method_image
  └─ payment_service.upload_payment_method_image(...)
       ├─ SELECT method WHERE id = ?
       ├─ if owner_id != current_user.id → 403
       ├─ valida tipo y tamaño (jpeg/png/webp ≤ 5MB)
       ├─ key = "methods/{method_id}/{uuid4}.{ext}"
       ├─ storage_service.upload_file(BUCKET_PAYMENT_METHODS, key, bytes, ct)
       ├─ if method.minio_key:                        ← borra antiguo
       │     storage_service.delete_file(BUCKET, method.minio_key)
       ├─ method.minio_key = key
       └─ FLUSH

  COMMIT  →  return PaymentMethodResponse (con url pública)
```

### 7.3 Voucher (cliente) — ya cubierto en §6.4

---

## 8. Finanzas

### 8.1 Resumen del admin (sus propiedades)

```
GET /api/finances/summary?year=2026
proxy → GET /finances/summary?year=2026
backend/app/routers/finances.py::admin_finance_summary
  ├─ require_role(ADMIN, SUPER_ADMIN)
  └─ ÚNICA query agregada:
       SELECT
         EXTRACT(year  FROM check_in_date::date) AS year,
         EXTRACT(month FROM check_in_date::date) AS month,
         p.id, p.name,
         SUM(r.total_amount)        AS total_income,
         COUNT(r.id)                AS confirmed_reservations
       FROM reservations r
       JOIN properties   p ON p.id = r.property_id
       WHERE r.status = 'CONFIRMED'
         AND p.owner_id = :current_user_id
         AND (year_filter)
       GROUP BY year, month, p.id, p.name
       ORDER BY year DESC, month DESC
```

Devuelve filas `{year, month, property_name, total_income, confirmed_reservations}` + `total_income` global del admin.

### 8.2 Resumen global (super admin)

```
GET /api/finances/global?year=2026
backend/app/routers/finances.py::global_finance_summary
  ├─ require_role(SUPER_ADMIN)
  └─ Query agregada por admin:
       SELECT
         u.id        AS admin_id,
         u.full_name AS admin_name,
         SUM(r.total_amount)  AS total_income,
         COUNT(r.id)          AS confirmed_reservations
       FROM users u
       JOIN properties p   ON p.owner_id = u.id
       JOIN reservations r ON r.property_id = p.id
       WHERE r.status = 'CONFIRMED' AND (year_filter)
       GROUP BY u.id, u.full_name
       ORDER BY SUM(r.total_amount) DESC
```

Devuelve un ranking de admins por ingresos confirmados.

---

## 9. Usuarios (super admin)

### 9.1 Listar todos

```
GET /api/users?page=1&page_size=20
proxy → GET /users?page=1&page_size=20
backend/app/routers/users.py::list_users
  ├─ require_role(SUPER_ADMIN)
  ├─ SELECT count(*) FROM users
  ├─ SELECT * FROM users
  │    ORDER BY created_at DESC OFFSET ? LIMIT ?
  └─ return UserListResponse { items, total, page, page_size }
```

### 9.2 Cambiar rol (CLIENT ↔ ADMIN)

```
PATCH /api/users/{id}/role  { role: "ADMIN" }
proxy → PATCH /users/{id}/role
backend/app/routers/users.py::update_user_role
  ├─ require_role(SUPER_ADMIN)
  ├─ SELECT user WHERE id = ?
  ├─ if !user                       → 404
  ├─ if body.role == 'SUPER_ADMIN'  → 422 SUPER_ADMIN_RESTRICTED
  │  (no se puede crear otro super admin por API)
  ├─ if user.role == 'SUPER_ADMIN'  → 422 SUPER_ADMIN_IMMUTABLE
  │  (no se puede degradar al super admin existente)
  ├─ user.role = body.role
  ├─ COMMIT
  └─ return UserResponse
```

---

## 10. CMS (super admin)

### 10.1 Banners de la landing

```
GET    /api/cms/banners                      ← público (sin auth)
       └─ SELECT * FROM cms_banners ORDER BY sort_order, id

POST   /api/cms/banners  { title, subtitle, sort_order, is_visible }
       └─ INSERT INTO cms_banners (...) (sin imagen aún)

POST   /api/cms/banners/{id}/image  (multipart)
       ├─ valida tipo/tamaño
       ├─ if banner.minio_key existente: storage_service.delete_file(...)
       ├─ key = "banners/{banner_id}/{uuid4}.{ext}"
       ├─ storage_service.upload_file(BUCKET_PROPERTY_IMAGES, key, ...)
       │    (re-usa el bucket de imágenes de propiedades — público)
       ├─ banner.minio_key = key
       └─ COMMIT  →  return banner con image_url

PUT    /api/cms/banners/{id}  { title?, subtitle?, is_visible?, sort_order? }
       └─ setattr fields  →  COMMIT

DELETE /api/cms/banners/{id}
       ├─ if banner.minio_key: storage_service.delete_file(...)
       ├─ DELETE FROM cms_banners WHERE id = ?
       └─ COMMIT
```

### 10.2 Páginas estáticas (terms, privacy, contact)

```
GET /api/cms/pages/terms                ← público
  └─ SELECT * FROM cms_static_pages WHERE slug = 'terms'

PUT /api/cms/pages/terms  { content }   ← require_role(ADMIN, SUPER_ADMIN)
  ├─ SELECT * FROM cms_static_pages WHERE slug = ?
  ├─ if exists:
  │     UPDATE cms_static_pages SET content = ? WHERE id = ?
  ├─ else:
  │     INSERT INTO cms_static_pages (slug, content)
  ├─ COMMIT
  └─ return CmsStaticPageResponse
```

### 10.3 Propiedades destacadas

```
GET    /api/cms/featured                                    ← público
       └─ SELECT * FROM cms_featured_properties ORDER BY sort_order

POST   /api/cms/featured  { property_id, sort_order }
       ├─ SELECT 1 FROM cms_featured_properties WHERE property_id = ?
       │     → si existe: 409 ALREADY_FEATURED
       └─ INSERT INTO cms_featured_properties (property_id, sort_order)

DELETE /api/cms/featured/{property_id}
       └─ DELETE FROM cms_featured_properties WHERE property_id = ?
```

---

## 11. Almacenamiento (MinIO)

### Buckets y políticas

| Bucket | Política | Contenido | Path interno |
|--------|----------|-----------|--------------|
| `property-images` | **Pública** (lectura sin auth) | Imágenes de propiedades + banners CMS | `properties/{prop_id}/{uuid}.ext` ; `banners/{banner_id}/{uuid}.ext` |
| `payment-methods` | **Pública** | QR de métodos de pago | `methods/{method_id}/{uuid}.ext` |
| `payment-vouchers` | **Privada** (presigned URL) | Comprobantes de pago de clientes | `vouchers/{reservation_id}/{uuid}.ext` |

### Cómo se sirve cada tipo

```
PROPIEDAD / BANNER / QR (público)
  Backend devuelve url = "http://minio:9000/property-images/<key>"
  (en frontend se reescribe con NEXT_PUBLIC_MINIO_URL para apuntar a host:9000)

VOUCHER (privado)
  Backend genera presigned URL con boto3.generate_presigned_url(... ExpiresIn=3600)
  → URL temporal con firma SigV4 que MinIO valida para servirlo
```

### Operaciones disponibles

| Función | Llamada boto3 | Cuándo se usa |
|---------|---------------|---------------|
| `upload_file(bucket, key, bytes, ct)` | `put_object(Bucket, Key, Body, ContentType)` | Subir imagen/voucher |
| `delete_file(bucket, key)` | `delete_object(Bucket, Key)` | Reemplazar voucher, eliminar imagen al borrar entidad |
| `get_public_url(bucket, key)` | URL construida — no llama a MinIO | Para buckets públicos |
| `get_presigned_url(bucket, key, expires)` | `generate_presigned_url("get_object", ...)` | Voucher privado |
| `ensure_buckets()` | `head_bucket` + `create_bucket` + `put_bucket_policy` | Solo en lifespan startup |

---

## Resumen de transacciones críticas

Estas son las operaciones donde la **atomicidad** importa:

| Operación | Por qué es transaccional |
|-----------|--------------------------|
| **Crear reserva** | Lock advisory por propiedad + check de disponibilidad + INSERT — evita race conditions entre dos clientes que reservan las mismas fechas |
| **Confirmar pago** | `status=CONFIRMED` + `INSERT property_calendar BOOKED × N días` deben ocurrir juntos. Si una INSERT viola UNIQUE, todo se revierte |
| **Refresh de tokens** | `revoked_at = now()` en el viejo + `INSERT` del nuevo + `set_cookie` deben verse atómicos desde el cliente para evitar quedar sin sesión |

Todo lo demás se ejecuta con autocommit en queries individuales.
