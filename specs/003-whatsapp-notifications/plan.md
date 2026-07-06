# Plan — 003 Notificaciones por WhatsApp Business (SDD)

## Contexto

Los correos del sistema (verificación de cuenta, reset de contraseña y ciclo de reservas)
caen en spam y muchos clientes no los leen. Se migra a **WhatsApp Business Cloud API de
Meta** (oficial) con alcance **total**: reservas + verificación y reset vía **código OTP**.
El email queda como **fallback** (WhatsApp no configurado, usuario sin teléfono, o envío
fallido). Mercado: Bolivia (+591).

Restricción clave de Meta: mensajes iniciados por el negocio requieren **plantillas
pre-aprobadas** (UTILITY para reservas, AUTHENTICATION para OTP); texto libre prohibido.
Por eso los subject/body personalizables del admin quedan solo para el fallback email.

## Convención de ubicación de planes (corrección del usuario)

**Todos los planes SDD viven en el repo**, en `specs/NNN-nombre/`, junto a
`specs/001-landing-scrollytelling/` y `specs/002-admin-availability-dashboard/`.
El primer paso de la implementación es materializar este plan en
`specs/003-whatsapp-notifications/` (spec.md, plan.md, research.md, tasks.md) — esa es la
fuente de verdad versionada. Además se documenta la convención en `CLAUDE.md`.

## Estado actual (explorado y verificado)

- `backend/app/services/email_service.py` — smtplib sync + `asyncio.to_thread`; placeholders `{{var}}`.
- `backend/app/services/reservation_notifications_service.py` — 6 `notify_*` (2 admin
  hardcoded, 4 cliente con plantillas de `AdminNotificationPreference`); call sites en
  `routers/reservations.py` L103/188/206/274/277/360. Nunca rompen el request (try/except).
- `routers/auth.py` — verificación por **JWT link stateless** (L95/L292); reset con tabla
  `password_reset_tokens` (patrón reutilizable para OTP); register hace **rollback si
  falla el envío** (preservar semántica).
- `User.phone` opcional sin validación; `httpx==0.28.0` ya en requirements; sin cola.
- Frontend: register/verify-email/forgot/reset-password en `(public)`; plantillas email en
  `(admin)/dashboard/notifications/page.tsx`.

## Diseño técnico

### Backend (archivos nuevos)

- **`backend/app/utils/phone.py`** — `normalize_phone_e164(raw, default_country="591") -> str`
  (E.164 sin `+`, formato Meta; 8 dígitos que empiezan en 6/7 → prefijo 591; ValueError si
  inválido) + `is_valid_phone`. Sin dependencias nuevas. Usado en validadores Pydantic y
  defensivamente en el dispatcher (teléfonos legacy sucios → fallback email, no se
  reescriben datos).

- **`backend/app/services/whatsapp_service.py`** — espejo de email_service:
  - `is_enabled()`; `async send_template(to_phone, template_name, body_params, lang) -> wamid`;
    `async send_otp(to_phone, code)` (plantilla AUTHENTICATION con botón copy-code).
  - `POST graph.facebook.com/{VER}/{PHONE_NUMBER_ID}/messages` con `httpx.AsyncClient(timeout=10)`.
  - Sanitización de params (Meta rechaza saltos de línea / >1024 chars).
  - Reintentos: máx 2 con backoff (1s/3s) solo red/5xx/429. Mapeo de errores Meta:
    131026/131030 → `recipient_error` (fallback email); 132000/132001/190/permisos →
    error de config con log + fallback; `WhatsAppError(code, retryable, recipient_error)`.
  - **`WHATSAPP_DRY_RUN=true`**: loguea payload y retorna `wamid.DRYRUN` sin llamar a la API
    (permite probar todo, incluido OTP visible en logs de dev).

- **`backend/app/services/notification_dispatcher.py`** — capa única de decisión de canal:
  `NotificationMessage` (dataclass con wa_phone/wa_template/wa_params + email_to/subject/body/vars)
  y `async dispatch(message, context) -> "whatsapp"|"email"|"none"`. WhatsApp si habilitado
  y teléfono normaliza; cualquier `WhatsAppError` → fallback email; ambos fallan → log, "none"
  (conserva el contrato: las notificaciones nunca rompen el request).

- **`backend/app/models/otp_code.py`** — tabla `otp_codes` (patrón de PasswordResetToken;
  la verificación actual es JWT stateless, no reutilizable): id, user_id FK CASCADE,
  `purpose` enum (VERIFY_ACCOUNT | PASSWORD_RESET), `code_hash` (sha256(code:user_id)),
  channel, `attempts`, expires_at, used_at, created_at. Registrar en `models/__init__.py`.

- **`backend/app/services/otp_service.py`** — `generate_code()` (secrets, 6 dígitos),
  `create_otp(db,user,purpose)` (invalida previos del mismo purpose), `verify_otp` (quema
  a los `OTP_MAX_ATTEMPTS`), `check_rate_limit` (cooldown 60s + máx 5/hora → 429).

### Backend (modificaciones)

- **`reservation_notifications_service.py`** — las 6 `notify_*` conservan firma `(db, reservation)`
  → **cero cambios en routers/reservations.py**. Nuevo `_build_wa_params(kind,...)` (mapeo
  posicional único, fechas dd/mm/YYYY) y `_resolve_owner_notification_phone` (preferences.
  notification_phone → owner.phone). Cada notify_* arma `NotificationMessage` (email = el
  subject/body actual, incl. personalizados) y llama `dispatch()`.

- **`routers/auth.py`**:
  - Helper `_send_verification(db,user) -> "whatsapp"|"email"`: WA+phone válido → OTP; si
    falla o no hay teléfono → flujo actual JWT-link por email. Ambos fallan → 503 + rollback.
  - `/register`: usa el helper; respuesta += `verification_channel` (el frontend decide redirect).
  - `/resend-verification`: + rate limit + helper; devuelve `{channel}`.
  - **Nuevo `POST /auth/verify-code`** `{email, code}` → `email_verified=True, phone_verified=True`;
    errores genéricos anti-enumeración.
  - `/forgot-password`: WA+phone → OTP PASSWORD_RESET; si no → link actual. **204 siempre**.
  - **Nuevo `POST /auth/reset-password-with-code`** `{email, code, new_password}` → extraer
    lógica común de `/reset-password` a `_apply_password_reset` (reuse-check, revocación de
    refresh tokens).
  - `/verify-email` y `/reset-password` (por link) quedan **intactos** como fallback legacy.

- **`schemas/user.py`** — `UserCreate.phone` **requerido** + validador normalizador;
  `UserResponse += phone_verified`; nuevos `RegisterResponse`, `VerifyCodeRequest`,
  `ResetPasswordWithCodeRequest`, `ResendVerificationResult`.

- **Preferencias admin** — `models/notification.py += notification_phone` (nullable);
  schemas += `notification_phone` (validado) y read-only `whatsapp_enabled` +
  `whatsapp_templates` (inyectados desde settings en el router, no persistidos);
  servicio y router GET/PUT extendidos.

- **Migración Alembic** (una revisión, generada dentro del contenedor y copiada al host):
  `users.phone_verified BOOL NOT NULL default false`; `admin_notification_preferences.
  notification_phone VARCHAR NULL`; `CREATE TABLE otp_codes` + índices. **No** volver
  `users.phone` NOT NULL (legacy); la obligatoriedad va en el schema de registro.

### Configuración

- **`core/config.py`**: `WHATSAPP_ENABLED=false`, `WHATSAPP_DRY_RUN=false`,
  `WHATSAPP_API_VERSION=v21.0`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`,
  `WHATSAPP_DEFAULT_COUNTRY_CODE=591`, `WHATSAPP_TEMPLATE_LANG=es`, 7 vars
  `WHATSAPP_TEMPLATE_*` (nombres de plantilla configurables), `OTP_EXPIRE_MINUTES=10`,
  `OTP_MAX_ATTEMPTS=5`, `OTP_RESEND_COOLDOWN_SECONDS=60`, `OTP_MAX_SENDS_PER_HOUR=5`.
- **`docker-compose.yml`** (backend.environment, junto a SMTP_*): mismas vars con patrón
  `"${VAR:-default}"`. **`.env.example`**: bloque documentado (token permanente de System
  User, no el temporal de 24h).
- Sin cambios en requirements.txt.

### Plantillas Meta (crear en Business Manager, idioma `es`)

| Nombre | Categoría | Variables posicionales |
|---|---|---|
| `codigo_verificacion` | AUTHENTICATION (copy-code, expira 10 min) | {{1}}=código (sirve para verificación Y reset) |
| `admin_nueva_reserva` | UTILITY | propiedad, cliente, email, entrada, salida, adultos, niños, monto_total |
| `admin_comprobante_subido` | UTILITY | cliente, propiedad, entrada, salida, monto_final |
| `reserva_aprobada` | UTILITY | cliente, propiedad, entrada, salida, monto_final |
| `reserva_rechazada` | UTILITY | cliente, propiedad, entrada, salida |
| `pago_recibido` | UTILITY | cliente, monto_final, propiedad |
| `pago_confirmado` | UTILITY | cliente, monto_final, propiedad, entrada, salida |

Textos completos propuestos en el research.md del spec. Reglas de aprobación: sin URLs en
el cuerpo, sin variables adyacentes, fechas dd/mm/aaaa.

### Frontend

1. **`(public)/register/page.tsx`** — teléfono **obligatorio**: prefijo fijo `+591` + 8
   dígitos (`^[67]\d{7}$`), con opción "otro país" (internacional libre). Según
   `verification_channel`: whatsapp → `/verify-code?email=...`; email → mensaje actual.
2. **Nueva `(public)/verify-code/page.tsx`** — input 6 dígitos auto-submit → `/api/auth/verify-code`;
   "Reenviar código" con cooldown 60s; enlace "¿No tienes WhatsApp? Reenviar por correo";
   éxito → `/login`.
3. **`forgot-password`** — tras 204 redirige a `/reset-password?email=...` en modo código,
   texto neutro ("código por WhatsApp o enlace al correo").
4. **`reset-password`** — modo dual: `?token=` → flujo actual; sin token → formulario
   `{código + nueva contraseña}` contra `/auth/reset-password-with-code`.
5. **`(admin)/dashboard/notifications/page.tsx`** — nueva sección "WhatsApp": badge
   habilitado/deshabilitado, campo `notification_phone`, tabla read-only de plantillas
   ("se gestionan en Meta Business Manager"). La sección actual pasa a "Plantillas de
   correo (canal de respaldo)".
6. Tipos y endpoints nuevos en `frontend/src/lib/` y `types/index.ts`.

## Fases de implementación

- **F0 (humana, camino crítico, en paralelo)**: crear WABA + número en Meta, System User
  con token permanente, registrar las 7 plantillas y esperar aprobación.
- **F1 Fundaciones** (sin Meta): utils/phone, settings, compose/.env.example, modelos
  (OtpCode, notification_phone, phone_verified), migración, schemas.
- **F2 Canal + dispatcher** (dry-run): whatsapp_service, dispatcher, refactor de los 6
  notify_*. Regresión cero: con `WHATSAPP_ENABLED=false` todo sale por email como hoy.
- **F3 Auth OTP** (dry-run): otp_service, cambios en auth.py, endpoints nuevos.
- **F4 Frontend**: puntos 1-6.
- **F5 Integración real** (requiere F0): credenciales, dry-run off, staging con números de
  prueba de Meta, validar los 7 envíos, producción.

## Riesgos principales

- Plantilla rechazada/pausada → nombres por env var (re-crear sin deploy) + fallback email.
- Número sin WhatsApp (131026) → recipient_error → fallback email inmediato.
- Token Meta expirado (190) → usar token permanente de System User; ante 190 el sistema
  degrada a email, no cae.
- Usuarios legacy sin teléfono → flujos por link intactos; phone sigue nullable en DB.
- Abuso OTP → cooldown + cap horario + quema por intentos + hash + anti-enumeración.
- Rollback de registro: solo si fallan ambos canales.

## Verificación

1. **F1**: migración up/down en contenedor; unit test mental de normalización (591...).
2. **F2**: `WHATSAPP_ENABLED=false` → crear/aprobar reserva demo y confirmar email idéntico
   a hoy (log). Luego `WHATSAPP_ENABLED=true, WHATSAPP_DRY_RUN=true` → logs muestran
   plantilla+params correctos por evento y canal "whatsapp".
3. **F3**: registro demo con teléfono → código visible en log dry-run → `POST /verify-code`
   → `email_verified/phone_verified=true` en DB. Rate limit: 2º resend inmediato → 429.
   Sin teléfono → cae a email-link (flujo actual).
4. **F4**: e2e en browser contra backend dry-run (registro → verify-code → login;
   forgot → reset con código).
5. **F5**: envíos reales a número de prueba de Meta (manual, requiere credenciales del usuario).
6. Rebuild backend+frontend con `docker compose up -d --build` y healthchecks verdes.
