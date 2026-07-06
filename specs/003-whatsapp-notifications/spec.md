# Spec — 003 Notificaciones por WhatsApp Business (QUÉ y POR QUÉ)

Hereda la constitución de `specs/001-landing-scrollytelling/constitution.md`.

## Problema
Los correos del sistema (verificación de cuenta, reset de contraseña y notificaciones del
ciclo de reservas) caen frecuentemente en spam: muchos clientes nunca los leen y las
reservas se traban. En Bolivia el canal universal es WhatsApp.

## Decisiones del usuario
- Proveedor: **Meta WhatsApp Business Cloud API** (oficial).
- Alcance: **todo a WhatsApp**, incluida verificación de cuenta y reset de contraseña (OTP).
- El email queda como **canal de respaldo** (fallback).
- **El usuario ELIGE el canal** de verificación/reset (WhatsApp o correo) — no se impone
  WhatsApp. WhatsApp es el default recomendado; el email sigue disponible a elección.

## Historias
- Como CLIENTE, al registrarme recibo un **código de 6 dígitos por WhatsApp** para
  verificar mi cuenta, sin depender del correo.
- Como CLIENTE, recibo por WhatsApp las novedades de mi reserva (aprobada, rechazada,
  comprobante recibido, pago confirmado).
- Como ADMIN, recibo por WhatsApp las nuevas solicitudes de reserva y los comprobantes
  subidos, en el número que yo configure.
- Como CLIENTE sin WhatsApp (o si el envío falla), sigo recibiendo todo por correo como hoy.

## Criterios de aceptación
- AC-1: Registro exige teléfono (+591 por defecto) y permite **elegir el canal de
  verificación** (WhatsApp o correo). Si elige WhatsApp (y está habilitado) recibe OTP y
  verifica en `/verify-code`; `email_verified` y `phone_verified` quedan true. Si elige
  correo, recibe el link de verificación (flujo JWT) y verifica por `/verify-email`.
- AC-2: Si WhatsApp está deshabilitado, sin teléfono, se elige correo, o el envío por
  WhatsApp falla → el flujo por email (link JWT) opera sin cambios. El registro solo falla
  (503 + rollback) si fallan AMBOS canales.
- AC-3: Reset de contraseña: el usuario **elige canal** en `/forgot-password`. WhatsApp →
  OTP + formulario código+contraseña (`/reset-password-with-code`); correo → link
  (`/reset-password?token=`). `/forgot-password` responde 204 siempre (anti-enumeración).
- AC-4: Las 6 notificaciones de reserva salen por WhatsApp (plantillas Meta) cuando el
  destinatario tiene teléfono válido; si no, por email con las plantillas actuales
  (incluidas las personalizadas del admin).
- AC-5: Ningún envío de notificación rompe el request que lo dispara (contrato actual).
- AC-6: OTP: expira en 10 min, máx 5 intentos (luego se quema), cooldown de reenvío 60 s,
  máx 5 envíos/hora por usuario+propósito, códigos almacenados hasheados.
- AC-7: `WHATSAPP_DRY_RUN=true` permite probar todo el flujo sin cuenta Meta (payloads en logs).
- AC-8: El panel admin de notificaciones muestra estado de WhatsApp, permite configurar
  `notification_phone` y aclara que las plantillas WhatsApp se gestionan en Meta; las
  plantillas editables actuales quedan rotuladas como canal de respaldo (email).

## Fuera de alcance
- Webhook de estados de entrega de Meta; cola de mensajes persistente; edición de
  plantillas Meta desde el panel; migración de datos de teléfonos legacy.
