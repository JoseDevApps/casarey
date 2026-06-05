# PRD — Casas de Campo

**Fecha:** 2026-06-02  
**Producto:** Plataforma de alquiler de casas/cabañas rurales  
**Estado:** MVP funcional desarrollado y en preparación para producción  
**Dominio objetivo de producción:** `https://cabanas.jfibanez.com`  

## 1. Resumen ejecutivo

Casas de Campo es una plataforma web para publicar propiedades rurales o vacacionales, permitir reservas de clientes, administrar solicitudes, validar pagos, gestionar disponibilidad y controlar contenido público desde un panel administrativo.

El producto desarrollado cubre tres perfiles principales:

- **Cliente:** explora propiedades, crea reservas, verifica su cuenta, recupera contraseña, carga comprobantes y consulta sus reservas.
- **Administrador / propietario:** gestiona propiedades, imágenes, video, calendario, reservas, pagos, finanzas y plantillas de notificación por correo.
- **Superadmin:** controla usuarios, roles, estado de cuentas, restablecimiento administrativo de contraseñas, finanzas globales y contenido CMS de la landing.

La solución usa Next.js como frontend, FastAPI como backend, PostgreSQL como base de datos, MinIO como almacenamiento S3-compatible, JWT con cookies httpOnly para autenticación y SMTP para verificación/recuperación/notificaciones por correo.

## 2. Objetivos del producto

### 2.1 Objetivos principales

- Centralizar el flujo de reservas de propiedades rurales en una experiencia digital clara.
- Evitar sobre-reservas mediante calendario de disponibilidad y bloqueo al confirmar pago.
- Separar responsabilidades por rol: cliente, administrador y superadmin.
- Permitir operación sin intervención técnica diaria mediante paneles de administración.
- Incorporar comunicación por email en eventos críticos: registro, recuperación, reservas y pagos.
- Preparar el sistema para producción con variables de entorno, secretos externos y reverse proxy HTTPS.

### 2.2 Objetivos secundarios

- Mejorar la experiencia visual con un sistema de diseño forestal más claro y legible.
- Dar al administrador control sobre los mensajes enviados a sus clientes.
- Permitir reset controlado de base de datos de prueba y recreación del superadmin.
- Proteger sesiones activas cuando una cuenta se deshabilita o se restablece una contraseña.

## 3. Usuarios y permisos

### 3.1 Cliente

El cliente es el usuario final que busca alojamiento.

Capacidades desarrolladas:

- Registro público como `CLIENT`.
- Verificación de correo antes de poder iniciar sesión.
- Login y logout.
- Recuperación de contraseña por email.
- Exploración de landing, propiedades destacadas y detalle de propiedad.
- Creación de reservas.
- Visualización de sus reservas.
- Carga de comprobante de pago cuando la reserva está aprobada.
- Consulta de estado de reserva.

### 3.2 Administrador / propietario

El administrador opera una o más propiedades.

Capacidades desarrolladas:

- Gestión CRUD de sus propiedades.
- Carga, eliminación y reordenamiento de imágenes.
- Carga y eliminación de video de propiedad con procesamiento en background.
- Gestión de calendario y bloqueos manuales.
- Gestión de solicitudes de reserva.
- Aprobación, rechazo, cancelación y confirmación de pago.
- Gestión de métodos de pago y QR.
- Visualización de finanzas propias.
- Configuración del correo destino para alertas.
- Personalización de plantillas enviadas al cliente.

### 3.3 Superadmin

El superadmin administra el ecosistema completo.

Capacidades desarrolladas:

- Listado global de usuarios.
- Búsqueda y filtros por rol/estado.
- Cambio de rol entre `CLIENT` y `ADMIN`.
- Habilitación y deshabilitación de cuentas `CLIENT` y `ADMIN`.
- Revocación de sesiones al deshabilitar cuentas.
- Restablecimiento administrativo de contraseña para `CLIENT` y `ADMIN`.
- Marcado obligatorio de cambio de contraseña posterior al reset.
- Auditoría de reset administrativo.
- Acceso a finanzas globales.
- Gestión de CMS: banners, páginas estáticas y propiedades destacadas.

Restricciones:

- El rol `SUPER_ADMIN` no puede asignarse desde la UI.
- La cuenta `SUPER_ADMIN` no puede ser deshabilitada desde la UI.
- La contraseña del `SUPER_ADMIN` debe gestionarse desde su propia sesión o mediante operación controlada de backend.

## 4. Alcance funcional desarrollado

### 4.1 Autenticación, sesiones y seguridad de cuenta

Funcionalidades:

- Registro con email, contraseña, nombre completo y teléfono opcional.
- Registro siempre crea usuarios `CLIENT`.
- Verificación obligatoria de correo electrónico antes del login.
- Login con email y contraseña.
- Cookies httpOnly para `access_token` y `refresh_token`.
- Rotación de refresh tokens.
- Logout con revocación del refresh token actual y limpieza de cookies.
- Endpoint `/auth/me` para recuperar datos de sesión.
- Protección de rutas por middleware y layouts según rol.
- Soporte de cambio de contraseña autenticado.
- Redirección obligatoria a `/change-password` cuando `must_change_password=true`.
- Recuperación de contraseña por email desde `/forgot-password` y `/reset-password`.

Criterios de aceptación:

- Un usuario no verificado no puede iniciar sesión.
- El sistema debe enviar enlace de verificación al registrar una cuenta.
- El enlace de verificación debe usar `FRONTEND_URL`, no `localhost` en producción.
- El flujo de recuperación no debe revelar si un email existe o no.
- Un token de recuperación usado o expirado no puede reutilizarse.
- Al cambiar o restablecer contraseña, las sesiones activas del usuario se revocan.
- Un usuario deshabilitado no puede iniciar sesión ni refrescar sesión.

### 4.2 Gestión de usuarios por superadmin

Funcionalidades:

- Listado de usuarios con paginación backend.
- Filtros frontend por rol: todos, clientes, administradores, superadmin.
- Filtros frontend por estado: todos, activos, inactivos.
- Búsqueda por nombre o email.
- Cambio de rol entre `CLIENT` y `ADMIN`.
- Habilitación/deshabilitación de cuentas no superadmin.
- Reset administrativo de contraseña temporal.
- Validación frontend de contraseña temporal: mínimo 8 caracteres, una mayúscula y un número.
- Motivo opcional para auditoría.
- Cierre de sesiones activas del usuario afectado.

Criterios de aceptación:

- El botón de habilitar/deshabilitar aparece solo para `CLIENT` y `ADMIN`.
- El botón de restablecer aparece solo para `CLIENT` y `ADMIN`.
- El superadmin no puede degradarse, deshabilitarse o resetearse desde esa tabla.
- Al deshabilitar una cuenta, los refresh tokens activos quedan revocados.
- Al restablecer contraseña, el usuario objetivo debe cambiarla al próximo login.

### 4.3 Landing, catálogo y CMS

Funcionalidades públicas:

- Landing page con hero, banners, propiedades destacadas y contenido institucional.
- Catálogo público de propiedades activas.
- Detalle de propiedad con imágenes, video si existe, descripción, tarifas, dirección y calendario.
- Páginas públicas de contacto, términos y privacidad.

Funcionalidades CMS:

- Gestión de banners.
- Carga de imagen para banners.
- Orden y visibilidad de banners.
- Gestión de páginas estáticas por slug.
- Gestión de propiedades destacadas.

Criterios de aceptación:

- Solo propiedades activas deben mostrarse al público.
- El superadmin puede actualizar contenido de landing sin modificar código.
- Los banners ocultos no deben mostrarse en la landing.
- Las propiedades destacadas deben mantener orden definido por CMS.

### 4.4 Propiedades

Funcionalidades:

- Crear, editar y desactivar propiedades.
- Soft delete mediante `is_active=false`.
- Campos principales: nombre, descripción, dirección, coordenadas, horarios, capacidad máxima y tarifas.
- Tarifas por noche: `rate_night_1`, `rate_night_2`, `rate_night_3`.
- Tarifa infantil.
- Carga de imágenes `jpeg`, `png`, `webp` hasta 8 MB.
- Reordenamiento de imágenes.
- Eliminación de imágenes en base de datos y MinIO.
- Carga de video `mp4`, `mov`, `webm`, `mkv` hasta 100 MB.
- Transcodificación de video en background y generación de poster.
- Eliminación de video y poster asociados.

Criterios de aceptación:

- Un administrador solo puede modificar sus propias propiedades.
- El superadmin puede modificar cualquier propiedad.
- Una propiedad desactivada no aparece en listados públicos.
- Los archivos fuera de tipo o tamaño permitido deben rechazarse con error claro.
- El video debe pasar por estado de procesamiento antes de quedar disponible.

### 4.5 Calendario y disponibilidad

Funcionalidades:

- Consulta de calendario por propiedad, año y mes.
- Bloqueo manual de fechas por administrador.
- Desbloqueo de fechas manualmente bloqueadas.
- Fechas `BOOKED` generadas por reservas confirmadas.
- Fechas `BLOCKED` generadas por bloqueo manual.

Criterios de aceptación:

- No se puede crear una reserva en fechas bloqueadas u ocupadas.
- El calendario debe distinguir fechas ocupadas, bloqueadas, pasadas y disponibles.
- Las fechas `BOOKED` no deben eliminarse manualmente como si fueran bloqueos comunes.
- El bloqueo de fechas confirmadas ocurre cuando el pago se confirma, no al crear la solicitud.

### 4.6 Reservas

Estados desarrollados:

- `PENDING_APPROVAL`
- `APPROVED_WAITING_PAYMENT`
- `CONFIRMED`
- `REJECTED`
- `CANCELLED`

Flujo principal:

1. Cliente solicita reserva.
2. Sistema valida disponibilidad.
3. Sistema congela precios al momento de crear la reserva.
4. Reserva inicia como `PENDING_APPROVAL`.
5. Admin aprueba o rechaza.
6. Si aprueba, pasa a `APPROVED_WAITING_PAYMENT`.
7. Cliente sube comprobante.
8. Admin confirma pago.
9. Reserva pasa a `CONFIRMED`.
10. Sistema bloquea fechas como `BOOKED`.

Funcionalidades:

- Creación de reserva por cliente.
- Listado de reservas por rol.
- Detalle de reserva.
- Aprobación con descuento opcional.
- Rechazo.
- Cancelación.
- Confirmación de pago con validación de comprobante existente.
- Registro y listado de huéspedes para reservas confirmadas.

Criterios de aceptación:

- El cliente solo puede ver sus propias reservas.
- El admin solo puede ver reservas de sus propiedades.
- El superadmin puede ver todas las reservas.
- La confirmación de pago debe exigir comprobante.
- Al confirmar pago, el calendario se bloquea en la misma transacción.
- El precio histórico de una reserva no cambia si luego se modifican tarifas de la propiedad.
- Las acciones críticas en frontend deben prevenir doble click accidental y mostrar estado de carga.

### 4.7 Pagos

Funcionalidades:

- CRUD de métodos de pago por administrador.
- Carga de imagen o QR para método de pago.
- Listado público de métodos activos por propietario durante flujo de pago.
- Carga de comprobante de pago por cliente.
- Almacenamiento de comprobantes en bucket privado.
- Entrega de comprobante mediante URL firmada temporal.

Criterios de aceptación:

- El cliente solo puede subir voucher en reservas propias aprobadas y pendientes de pago.
- El admin solo puede gestionar sus métodos.
- Los métodos inactivos no deben mostrarse al cliente.
- Los comprobantes no deben exponerse públicamente sin URL firmada.

### 4.8 Notificaciones por correo

SMTP desarrollado para:

- Verificación de cuenta.
- Recuperación de contraseña.
- Nueva solicitud de reserva al propietario.
- Comprobante subido al propietario.
- Confirmación de recepción de comprobante al cliente.
- Reserva aprobada al cliente.
- Reserva rechazada al cliente.
- Pago confirmado al cliente.

Configuración:

- SMTP host, puerto, usuario, contraseña, cifrado y remitente por variables de entorno.
- Soporte para SSL, TLS o STARTTLS.
- `FRONTEND_URL` define los enlaces públicos enviados por email.

Preferencias de admin:

- Correo alternativo para recibir alertas de propietario.
- Plantilla de asunto y cuerpo para reserva aprobada.
- Plantilla de asunto y cuerpo para reserva rechazada.
- Plantilla de asunto y cuerpo para comprobante recibido.
- Plantilla de asunto y cuerpo para pago confirmado.

Variables disponibles en plantillas:

- `{{cliente_nombre}}`
- `{{cliente_email}}`
- `{{propiedad_nombre}}`
- `{{fecha_entrada}}`
- `{{fecha_salida}}`
- `{{adultos}}`
- `{{ninos}}`
- `{{monto_total}}`
- `{{descuento}}`
- `{{monto_final}}`
- `{{url_panel_cliente}}`
- `{{url_propiedad}}`

Criterios de aceptación:

- Si el admin define correo de notificación, las alertas internas van a ese correo.
- Si no define correo alternativo, se usa el email de su cuenta.
- Las plantillas vacías no deben guardarse.
- El envío de notificaciones de reserva no debe romper la operación principal si falla el email.
- Los links de email deben usar el dominio público configurado.

### 4.9 Finanzas

Funcionalidades admin:

- Resumen mensual de ingresos confirmados por propiedad.
- Filtro opcional por año.
- Total acumulado de ingresos del administrador.

Funcionalidades superadmin:

- Resumen global por administrador.
- Total global de reservas confirmadas.
- Filtro opcional por año.

Criterios de aceptación:

- Solo reservas `CONFIRMED` cuentan para finanzas.
- Los cálculos se basan en montos guardados históricamente en reservas.
- Un admin no puede consultar finanzas de otro admin.
- El superadmin puede consultar resumen global.

### 4.10 UX/UI y sistema de diseño

Desarrollos y mejoras:

- Sistema visual forestal con variables CSS.
- Ajuste de `--surface-0` a `#10231A` para hacer la interfaz más clara sin perder identidad.
- Header público con estado de usuario sincronizado después de login/logout.
- Menú de usuario con iniciales, rol y navegación a dashboard.
- Logout con refresh de UI para evitar mostrar usuario previo.
- Estados de carga, skeletons, toasts y mensajes de error en dashboards.
- Botones con estado `disabled/loading` en acciones críticas.
- Formularios con validación usando `react-hook-form` y `zod`.

Criterios de aceptación:

- La cabecera pública debe reflejar correctamente el estado de sesión después de login/logout.
- La UI debe evitar acciones duplicadas mientras una operación está en curso.
- Los mensajes deben ser claros para usuarios no técnicos.
- La paleta debe mantener contraste suficiente en superficies oscuras.

## 5. Arquitectura técnica

### 5.1 Frontend

- Next.js 15 con App Router.
- React 19.
- TypeScript.
- Tailwind CSS v4.
- Route groups para rutas públicas, cliente, admin y superadmin.
- Proxy interno `/api/[...path]` hacia FastAPI.
- SWR para fetching en paneles.
- Radix UI para diálogos, dropdowns y componentes accesibles.

### 5.2 Backend

- FastAPI.
- SQLAlchemy async.
- Alembic para migraciones.
- Pydantic v2 para schemas.
- Servicios separados para reservas, pagos, almacenamiento, email, calendario y preferencias.
- Manejadores globales de errores para respuestas consistentes.
- Middleware de headers de seguridad.
- Trusted hosts configurable.

### 5.3 Base de datos

- PostgreSQL 16.
- Tablas principales:
  - `users`
  - `refresh_tokens`
  - `password_reset_tokens`
  - `admin_password_resets`
  - `admin_notification_preferences`
  - `properties`
  - `property_images`
  - `property_calendar`
  - `reservations`
  - `booking_guests`
  - `payment_methods`
  - `payment_vouchers`
  - `cms_banners`
  - `cms_static_pages`
  - `cms_featured_properties`

### 5.4 Almacenamiento

- MinIO compatible S3.
- Buckets públicos para imágenes de propiedades, QR y CMS.
- Buckets privados para comprobantes y video raw.
- URLs firmadas para archivos privados.
- Healthchecks en Docker Compose.

### 5.5 Infraestructura

- Docker Compose con servicios:
  - `frontend`
  - `backend`
  - `db`
  - `minio`
- Red pública para frontend/backend.
- Red interna para DB/MinIO.
- Apache2 reverse proxy previsto en producción.
- Variables de entorno externas para secretos.

## 6. Variables de entorno y secretos

El producto requiere que los secretos no sean versionados en Git. Deben configurarse en `.env` del servidor o en un gestor de secretos.

Secretos requeridos:

- `DB_PASSWORD`
- `JWT_SECRET`
- `NEXTAUTH_SECRET`
- `MINIO_PASSWORD`
- `SMTP_PASSWORD`

Variables públicas/configurables:

- `NEXTAUTH_URL`
- `FRONTEND_URL`
- `CORS_ORIGINS`
- `NEXT_PUBLIC_MINIO_URL`
- `COOKIE_SECURE`
- `COOKIE_SAMESITE`
- `COOKIE_DOMAIN`
- `TRUSTED_HOSTS`
- `HSTS_ENABLED`

Criterios de aceptación:

- `.env` no debe subirse al repositorio.
- `.env.example` solo debe contener placeholders.
- En producción, `FRONTEND_URL` y `NEXTAUTH_URL` deben apuntar al dominio público.
- En producción con HTTPS, `COOKIE_SECURE=true`.
- Si Apache termina TLS, backend/frontend deben recibir configuración coherente para cookies y CORS.

## 7. Operación y mantenimiento

### 7.1 Reset de base de datos de prueba

Se desarrolló script para resetear una base de datos de prueba y recrear el superadmin.

Capacidades:

- Levanta `db` y `minio`.
- Espera disponibilidad de PostgreSQL.
- Elimina y recrea schema `public`.
- Recrea backend/frontend para aplicar migraciones.
- Crea o promueve un superadmin.
- Permite pasar email, password y nombre por flags o variables de entorno.

Criterios de aceptación:

- Debe requerir confirmación interactiva salvo uso explícito de `--yes`.
- Debe mostrar los usuarios resultantes al finalizar.
- No debe usarse en base de datos productiva sin respaldo y aprobación explícita.

### 7.2 Creación/promoción de superadmin

Se desarrolló script backend para crear o promover un usuario a `SUPER_ADMIN`.

Criterios de aceptación:

- Si el email existe, lo promueve y actualiza contraseña.
- Si el email no existe, crea el usuario superadmin.
- Marca la cuenta como activa y verificada.
- No debe guardar la contraseña en logs ni documentación.

## 8. Requisitos no funcionales

### 8.1 Seguridad

- Cookies httpOnly.
- Refresh token rotation.
- Hash de refresh tokens en base de datos.
- Contraseñas hasheadas.
- CORS restringible por env.
- Trusted hosts configurable.
- Security headers configurables.
- HSTS configurable para producción.
- URLs firmadas para comprobantes privados.
- Revocación de sesiones en cambios sensibles.

### 8.2 Rendimiento

- Frontend SSR/Next.js con proxy interno.
- Paginación en listados de usuarios, reservas y propiedades.
- Procesamiento de video en background.
- Healthchecks para servicios Docker.
- MinIO separado de la base de datos para no cargar archivos en PostgreSQL.

### 8.3 Disponibilidad

- Servicios Docker con `restart: unless-stopped`.
- Healthchecks en frontend, backend, db y minio.
- Backend no bloquea startup si MinIO tarda en inicializar buckets.

### 8.4 Usabilidad

- Paneles separados por rol.
- Acciones críticas con confirmación cuando corresponde.
- Feedback mediante toasts.
- Formularios con validación client-side y errores backend legibles.
- Diseño responsive y paleta unificada.

## 9. Métricas de éxito sugeridas

- Porcentaje de registros verificados por email.
- Tiempo promedio desde solicitud hasta aprobación.
- Tiempo promedio desde aprobación hasta carga de comprobante.
- Tasa de reservas confirmadas vs rechazadas.
- Cantidad de reservas por propiedad.
- Ingreso confirmado mensual por administrador.
- Errores de envío SMTP por tipo de evento.
- Tasa de recuperación de contraseña completada.

## 10. Riesgos y pendientes recomendados antes de producción

- Agregar tests automatizados para auth, reservas, pagos, email y permisos.
- Implementar rate limiting en login, registro, recuperación y reenvío de verificación.
- Revisar que `PropertyCalendar.date` use tipo `Date` si aún está como string.
- Generar y versionar `package-lock.json` para builds reproducibles con `npm ci`.
- Validar en startup que secretos no contengan placeholders.
- Revisar política de único `SUPER_ADMIN` a nivel de operación o constraint.
- Configurar backups de PostgreSQL y MinIO.
- Configurar monitoreo de logs y alertas de salud.
- Revisar concurrencia de procesamiento de video si habrá varios admins subiendo videos simultáneamente.
- Confirmar configuración final de Apache reverse proxy, headers y HTTPS.

## 11. Criterio de producción mínima

El producto puede considerarse listo para una primera puesta en producción controlada cuando:

- El dominio público carga la landing por HTTPS.
- Login, registro, verificación y recuperación usan URLs del dominio público.
- Las cookies usan configuración segura para HTTPS.
- Los secretos reales están en `.env` del servidor y no en Git.
- `docker compose ps` muestra todos los servicios healthy.
- Se puede crear una reserva completa de prueba: solicitud, aprobación, voucher, confirmación y bloqueo de calendario.
- Los correos de los eventos críticos llegan correctamente.
- El superadmin puede gestionar usuarios sin exponer acciones peligrosas sobre su propia cuenta.
- Existe respaldo inicial o procedimiento de recuperación para PostgreSQL y MinIO.

