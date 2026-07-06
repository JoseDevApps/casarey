# Research — 003 WhatsApp Business Cloud API

## Restricciones de Meta que gobiernan el diseño
- Mensajes iniciados por el negocio SOLO con **plantillas pre-aprobadas** (`type=template`).
  Texto libre solo dentro de la ventana de servicio de 24 h (no aplica a nuestro caso).
- Categorías: **UTILITY** (actualizaciones transaccionales — reservas) y
  **AUTHENTICATION** (OTP; Meta genera el texto, se configura botón copy-code y expiración).
- Endpoint: `POST https://graph.facebook.com/{ver}/{PHONE_NUMBER_ID}/messages`,
  header `Authorization: Bearer {ACCESS_TOKEN}`. Respuesta incluye `messages[0].id` (wamid).
- Destinos en E.164 **sin `+`** (ej. `59171234567`).
- Parámetros de plantilla: sin saltos de línea/tabs, máx ~1024 chars, posicionales {{1}}..{{n}}.
- Errores relevantes (JSON `error.code`): 131026/131030 destinatario inválido o sin
  WhatsApp; 132001 plantilla inexistente; 132000 aridad de parámetros incorrecta;
  190 token inválido/expirado; 131048/131056 límites de tasa/spam; 10/200 permisos.
- Token: usar **token permanente de System User** (Business Settings → System Users),
  no el token temporal de 24 h del panel de desarrollador.
- Límite inicial de mensajería (tier 1): 1000 conversaciones únicas/día — suficiente.

## Por qué no otras opciones
- Twilio: onboarding más rápido pero costo por mensaje mayor y un intermediario más.
- wa.me manual: sin automatización. Descartado por el usuario.
- `phonenumbers` (lib): innecesaria para el alcance (Bolivia 8 dígitos + internacional laxo).

## Verificación actual (verificado en código)
- Verificación de cuenta: **JWT stateless por link** (`create_email_verification_token`),
  sin tabla → para OTP se necesita tabla nueva (`otp_codes`) con attempts/purpose.
- Reset: tabla `password_reset_tokens` — patrón copiado para `otp_codes`.
- `register` hace rollback si el envío falla → se preserva: solo si fallan ambos canales.
- `httpx==0.28.0` ya en requirements; sin cola (envíos inline async con try/except).

## Catálogo de plantillas a crear en Meta (idioma `es`)

| Nombre | Categoría | Cuerpo propuesto |
|---|---|---|
| `codigo_verificacion` | AUTHENTICATION | Texto fijo de Meta: "*{{1}} es tu código de verificación. Por tu seguridad, no lo compartas.*" + botón copy-code + caducidad 10 min. Sirve para verificación de cuenta Y reset. |
| `admin_nueva_reserva` | UTILITY | "Nueva solicitud de reserva en {{1}}. Cliente: {{2}} ({{3}}). Entrada: {{4}} – Salida: {{5}}. Huéspedes: {{6}} adultos, {{7}} niños. Monto estimado: Bs {{8}}. Revisa tu panel para gestionarla." |
| `admin_comprobante_subido` | UTILITY | "El cliente {{1}} subió un comprobante de pago para {{2}}. Entrada: {{3}} – Salida: {{4}}. Monto final: Bs {{5}}. Ingresa a tu panel para confirmar el pago." |
| `reserva_aprobada` | UTILITY | "Hola {{1}}, ¡tu reserva en {{2}} fue aprobada! Entrada: {{3}} – Salida: {{4}}. Monto a pagar: Bs {{5}}. Sube tu comprobante de pago desde tu panel de cliente." |
| `reserva_rechazada` | UTILITY | "Hola {{1}}, lamentamos informarte que tu solicitud de reserva en {{2}} ({{3}} – {{4}}) no pudo ser aprobada. Puedes intentar con otras fechas desde nuestro sitio." |
| `pago_recibido` | UTILITY | "Hola {{1}}, recibimos tu comprobante de pago por Bs {{2}} para tu reserva en {{3}}. Te avisaremos en cuanto sea verificado." |
| `pago_confirmado` | UTILITY | "Hola {{1}}, tu pago de Bs {{2}} para la reserva en {{3}} fue confirmado. Entrada: {{4}} – Salida: {{5}}. ¡Te esperamos!" |

Reglas de aprobación: no iniciar/terminar con variable, sin variables adyacentes, sin URLs
en el cuerpo (usar botones), fechas como texto dd/mm/aaaa. Si Meta obliga a renombrar,
solo se cambia la env var `WHATSAPP_TEMPLATE_*` correspondiente (catálogo configurable).

## Checklist F0 (manual, hacer en paralelo — camino crítico)
1. Crear/verificar Meta Business Portfolio y WhatsApp Business Account (WABA).
2. Registrar número de teléfono del negocio (o usar número de prueba para staging).
3. Crear System User admin → generar **token permanente** con permiso `whatsapp_business_messaging`.
4. Anotar `PHONE_NUMBER_ID` (WhatsApp → API Setup).
5. Crear las 7 plantillas de arriba y esperar aprobación (horas a días).
6. Cargar `WHATSAPP_*` en `.env` de producción.
