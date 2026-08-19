# Tasks — 003 Notificaciones por WhatsApp Business

| # | Fase | Tarea | Estado |
|---|---|---|---|
| T00 | F0 | (Manual/usuario) WABA + token System User + 7 plantillas aprobadas en Meta | in_progress |
| T01 | F1 | `backend/app/utils/phone.py` (normalize_phone_e164, is_valid_phone) | pending |
| T02 | F1 | Settings `WHATSAPP_*` y `OTP_*` en config.py; docker-compose; .env.example | pending |
| T03 | F1 | Modelo `OtpCode`; `notification_phone` en AdminNotificationPreference; `phone_verified` en User; registro en models/__init__ | pending |
| T04 | F1 | Migración Alembic (phone_verified, notification_phone, otp_codes) | pending |
| T05 | F1 | Schemas: UserCreate.phone requerido+normalizado, RegisterResponse, VerifyCodeRequest, ResetPasswordWithCodeRequest, notification schemas | pending |
| T06 | F2 | `whatsapp_service.py` (send_template, send_otp, errores Meta, reintentos, dry-run) | pending |
| T07 | F2 | `notification_dispatcher.py` (NotificationMessage, dispatch con fallback) | pending |
| T08 | F2 | Refactor 6 `notify_*` (firmas intactas, _build_wa_params, _resolve_owner_notification_phone) | pending |
| T09 | F3 | `otp_service.py` (generate/create/verify/rate-limit) | pending |
| T10 | F3 | auth.py: _send_verification, register/resend, POST /verify-code, forgot, POST /reset-password-with-code, _apply_password_reset | pending |
| T11 | F1 | Preferencias: servicio + router con notification_phone y whatsapp_enabled/templates read-only | pending |
| T12 | F4 | Registro con teléfono obligatorio +591 y redirect por canal | pending |
| T13 | F4 | Página `/verify-code` (OTP 6 dígitos, resend con cooldown) | pending |
| T14 | F4 | forgot-password y reset-password modo dual (código / link) | pending |
| T15 | F4 | Panel admin notifications: sección WhatsApp + rotular email como respaldo | pending |
| T16 | F4 | Tipos y endpoints en frontend (types/index.ts, lib) | pending |
| T17 | F5 | Rebuild + migración + verificación dry-run end-to-end (AC-1..AC-8) | done |
| T18 | — | Convención de planes SDD documentada en CLAUDE.md | done |

## QA dry-run (2026-07-05) — WHATSAPP_ENABLED=true, WHATSAPP_DRY_RUN=true

Verificado end-to-end contra los contenedores:
- Migración `a8c3f1e29b57 (head)` aplicada: tabla `otp_codes` + columnas `users.phone_verified`
  y `admin_notification_preferences.notification_phone`.
- **Registro** con `phone:"71234567"` → normalizado a `59171234567`; respuesta
  `verification_channel:"whatsapp"`; log DRY-RUN muestra la plantilla `codigo_verificacion`
  con body param + botón copy-code (estructura AUTHENTICATION correcta).
- **verify-code** con código correcto → `{"verified":true}`, DB `email_verified=t`,
  `phone_verified=t`, OTP quemado. Código incorrecto → 401 INVALID_CODE, `attempts` incrementa.
- **Rate limit**: reenvío inmediato → 429.
- **forgot-password** (usuario con teléfono) → 204 + OTP PASSWORD_RESET por WhatsApp (dry-run);
  **reset-password-with-code** → 204; login con nueva contraseña 200, con la anterior 401.
- **GET /notification-preferences** → `whatsapp_enabled:true` + mapa de 7 plantillas.
- Frontend: `/register` (campo +591/WhatsApp), `/verify-code` ("Revisa tu WhatsApp",
  reenviar con cooldown) y `/reset-password` (modo código) compilan y sirven 200.
- Observabilidad: logging de `app.*` a INFO añadido en `main.py` para ver el DRY-RUN.

Pendiente para producción (requiere cuenta Meta — fuera de este entorno):
- F0: crear WABA, token permanente de System User, aprobar las 7 plantillas.
- Poner `WHATSAPP_DRY_RUN=false` + `WHATSAPP_PHONE_NUMBER_ID`/`WHATSAPP_ACCESS_TOKEN` reales.
- Regresión email real (`WHATSAPP_ENABLED=false`): la lógica cae a email; no se ejerció envío
  SMTP real en QA para no mandar correos de prueba.

## Decisiones
- Plantillas Meta viven en Meta Business Manager; el backend solo conoce sus NOMBRES
  (env vars `WHATSAPP_TEMPLATE_*`) y el mapeo posicional (en `_build_wa_params`).
- Los subject/body personalizables del admin siguen operando el canal email (respaldo).
- `users.phone` sigue nullable en DB (legacy); la obligatoriedad se impone en el registro.
- Una sola plantilla AUTHENTICATION sirve para verificación y reset.

## Incremento — Elección de canal por el usuario (2026-07-05)

El usuario ELIGE el canal de verificación/reset (WhatsApp o correo), no se impone WhatsApp.

| # | Tarea | Estado |
|---|---|---|
| C01 | `UserCreate.verification_channel`, `ResendRequest.channel`, `ForgotPasswordRequest.channel` | done |
| C02 | `_send_verification(channel)` respeta la elección; register/resend/forgot la propagan | done |
| C03 | Frontend: selector WhatsApp/Correo en registro y forgot-password | done |
| C04 | verify-code: "Reenviar por WhatsApp" y "Prefiero verificar por correo" | done |
| C05 | reset-password: sin token + channel=email → pantalla "revisa tu correo" | done |

### QA (dry-run, backend+frontend reconstruidos SIN caché)
- Registro `verification_channel:"email"` → respuesta `channel:email`, **sin** OTP; SMTP 201.
- Registro `verification_channel:"whatsapp"` → `channel:whatsapp`, OTP WhatsApp creado.
- `forgot-password channel:email` → 204, **sin** OTP de reset (usa link email);
  `channel:whatsapp` → 204, OTP `PASSWORD_RESET` WhatsApp.
- Frontend: selector de canal presente en `/register`, `/forgot-password`, `/verify-code`.

## Incremento — OTP por correo mientras no haya WhatsApp Business (2026-07-06)

Pedido del usuario: "mientras no tenga WhatsApp Business, envíalo por correo".

- `whatsapp_service.can_deliver()`: WhatsApp puede ENTREGAR de verdad (credenciales Meta
  reales y sin dry-run). Mientras sea False, **todo código y notificación sale por correo**;
  al cargar credenciales y apagar dry-run, WhatsApp toma el relevo automáticamente sin
  tocar código.
- `email_service.send_otp_email(to, name, code, purpose)`: el mismo código de 6 dígitos,
  entregado por email (verify/reset).
- `_send_verification` y `forgot-password`: siempre generan CÓDIGO; medio = WhatsApp solo
  si `can_deliver()` y hay teléfono válido, si no correo. Los enlaces legacy
  (`/verify-email`, `/reset-password?token=`) siguen siendo válidos para correos antiguos,
  pero ya no se emiten nuevos enlaces.
- Dispatcher de reservas: usa `can_deliver()` → notificaciones por email real hasta F0.
- Frontend unificado en torno al código: register/login/forgot siempre llevan a la pantalla
  de código; textos según medio ("Revisa tu WhatsApp" / "Revisa tu correo").

### QA
- Registro eligiendo WhatsApp sin WA operativo → respuesta `channel:email`, OTP en DB con
  `channel=email`, log `Código OTP (verify) enviado por correo` (SMTP real OK).
- forgot-password → log `Código OTP (reset) enviado por correo`.
- Códigos reales entregados al Gmail del usuario (cuenta de prueba jfibanezquiroz@gmail.com).
- Frontend reconstruido: hints "Código a tu correo", pantalla verify-code con medio dinámico.

## F0 — Estado de integración con Meta (2026-07-17)

- Token permanente de System User **verificado** (scopes messaging+management, no caduca).
  Cargado en `.env` local (gitignored). App: ClientesCabanas.
- Phone ID `1206584079201016` = **número de PRUEBA de Meta** (+1 555-671-8857): solo envía
  a la lista de destinatarios permitidos del panel (máx 5). Para producción: registrar
  número real → nuevo PHONE_NUMBER_ID.
- El system user no tenía la WABA asignada; se **autoasignó por API**
  (`POST /{waba}/assigned_users?tasks=MANAGE,MANAGE_TEMPLATES` → success).
- **6 plantillas UTILITY creadas por API** (reserva_aprobada, reserva_rechazada,
  pago_recibido, pago_confirmado, admin_nueva_reserva, admin_comprobante_subido)
  → **APPROVED** por Meta (verificado 2026-07-17, rejected_reason NONE). Envío real de
  `reserva_aprobada` con sus 5 parámetros: `accepted` por la API.
- **AUTHENTICATION bloqueada** (error 2388185): requiere VERIFICACIÓN DEL NEGOCIO en Meta.
  El intento de OTP como UTILITY (`codigo_acceso`) fue RECHAZADO al instante (política).
  → Mientras tanto los OTP siguen saliendo por correo (fallback automático, sin cambios).
- `WHATSAPP_DRY_RUN=false` activo; `can_deliver()=True` verificado en el backend.
- Pendiente usuario: (1) aprobación de las 6 UTILITY, (2) agregar su número a la lista de
  prueba del panel, (3) verificación del negocio (desbloquea plantilla AUTH para OTP),
  (4) producción: número real. El `.env` del SERVIDOR debe recibir las mismas vars
  WHATSAPP_* a mano (no viajan por git).

## Incremento — OTP por WhatsApp vía ventana de servicio (click-to-chat)

Problema: la plantilla AUTHENTICATION (`codigo_verificacion`) no se puede crear hasta que
Meta verifique el negocio (error 2388185); por eso el OTP caía siempre a correo
(error de envío 132001 "Template name does not exist").

Solución sin esperar la verificación: **ventana de servicio de 24 h**. El usuario abre
WhatsApp desde la app (enlace `wa.me` prellenado) y envía un mensaje; eso abre la ventana,
dentro de la cual Meta permite **texto libre sin plantilla**. El webhook responde con el
código. Las conversaciones de servicio son **gratuitas**.

| Componente | Archivo |
|---|---|
| Envío de texto libre | `whatsapp_service.send_text()` |
| Webhook (handshake + mensajes entrantes) | `routers/whatsapp_webhook.py` → `/webhooks/whatsapp` |
| Enlace click-to-chat | `GET /auth/whatsapp-optin` |
| Botón en la pantalla del código | `(public)/verify-code/page.tsx` |
| Aviso de desvío a correo | idem (`?fallback=1`) |

Seguridad: valida `X-Hub-Signature-256` con `WHATSAPP_APP_SECRET` (si está configurado);
`hub.verify_token` en el handshake; rate limit del OTP reutilizado.

Nuevas env vars: `WHATSAPP_BUSINESS_NUMBER`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`.

### QA (2026-08-02)
- Handshake: token correcto → devuelve challenge 200; token incorrecto → 403.
- `GET /auth/whatsapp-optin` → `{enabled:true, link:"https://wa.me/15556718857?text=..."}`.
- Mensaje entrante simulado (payload real de Meta) → **código entregado por WhatsApp**
  como texto libre (`WhatsApp enviado ... template=None`, log "Código de verificación
  enviado por WhatsApp").
- Casos cubiertos: sin cuenta → mensaje explicativo; ya verificada → aviso; rate limit → aviso.

### PENDIENTE para que funcione con usuarios reales
El webhook necesita **URL pública HTTPS**: configurar en Meta → App → WhatsApp →
Configuración → Webhooks: `https://<dominio>/api/webhooks/whatsapp` (o el puerto del
backend), con el mismo `WHATSAPP_VERIFY_TOKEN`, y suscribir el campo `messages`.
En local no es alcanzable por Meta (probado con simulación del payload).

### Nota de entorno (importante para futuros rebuilds)
El reloj de Docker Desktop tiene skew severo y BuildKit puede **no reemplazar la imagen ni
recrear el contenedor** con `docker compose up -d --build`. Para cambios de backend/frontend
usar: `docker compose build --no-cache <svc>` (vía PowerShell, no el Bash de la sesión que
perdió coreutils) y luego `docker compose up -d --force-recreate --no-deps <svc>`; verificar
con `docker images ... --format {{.CreatedSince}}` que la imagen sea reciente.

## F0 COMPLETADO — OTP por WhatsApp operativo (2026-08-05)

- `business_verification_status: verified` (el usuario completó la verificación en Meta).
- Plantilla `codigo_verificacion` (AUTHENTICATION, es) creada por API → **APPROVED al
  instante** (id 1295836305830127). Body con recomendación de seguridad, footer de
  caducidad 10 min y botón COPY_CODE.
- Envío real verificado y **registro end-to-end**: alta de usuario con
  `verification_channel=whatsapp` → respuesta `whatsapp` → log
  `WhatsApp enviado | template=codigo_verificacion`. Sin fallback a correo.
- **Cero cambios de código**: `WHATSAPP_TEMPLATE_OTP` ya apuntaba a `codigo_verificacion`;
  el dispatcher intentaba WhatsApp primero y solo caía a correo por el 132001.
- El botón click-to-chat queda como respaldo (ya no es necesario).

Pendiente para clientes reales: registrar el número de producción (el actual es el de
prueba de Meta, limitado a 5 destinatarios autorizados).
