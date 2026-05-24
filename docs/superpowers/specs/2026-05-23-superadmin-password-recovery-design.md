# Diseño — Recuperación de contraseña gestionada por SUPER_ADMIN

**Fecha:** 2026-05-23
**Proyecto:** Casas de Campo

## Objetivo
Permitir que `SUPER_ADMIN` restablezca la contraseña de usuarios `CLIENT` y `ADMIN`, forzando cambio de contraseña al próximo inicio de sesión y cerrando sesiones activas.

## Decisiones validadas
1. Flujo híbrido (V1 sin email, V2 con enlace seguro en el futuro).
2. En V1, el superadmin define una contraseña temporal personalizada.
3. Al resetear, se deben cerrar todas las sesiones activas del usuario objetivo.

## Alcance V1 (implementado)
1. Nuevo endpoint para reset gestionado por superadmin.
2. Nuevo endpoint para cambio de contraseña autenticado.
3. Bandera de cumplimiento `must_change_password` en usuario.
4. Auditoría de resets administrativos.
5. UI en panel de superadmin para ejecutar reset.
6. Redirección obligatoria a pantalla de cambio de contraseña cuando la bandera está activa.

## Backend
### Modelo de datos
1. `users.must_change_password BOOLEAN NOT NULL DEFAULT false`.
2. Tabla `admin_password_resets`:
- `id`
- `target_user_id`
- `actor_user_id`
- `reason`
- `revoked_sessions`
- `created_at`

### Endpoints
1. `POST /users/{id}/password-reset` (solo `SUPER_ADMIN`)
- Entrada: `new_password`, `reason?`
- Reglas:
  - objetivo debe existir
  - objetivo no puede ser `SUPER_ADMIN`
  - contraseña temporal debe cumplir política
- Efectos:
  - actualiza `password_hash`
  - setea `must_change_password=true`
  - revoca `refresh_tokens` activos
  - registra auditoría

2. `POST /auth/change-password` (usuario autenticado)
- Entrada: `current_password`, `new_password`
- Reglas:
  - contraseña actual debe coincidir
  - nueva contraseña debe cumplir política
  - nueva contraseña no puede ser igual a la actual
- Efectos:
  - actualiza hash
  - setea `must_change_password=false`
  - revoca `refresh_tokens` activos

### Política de contraseña
1. Mínimo 8 caracteres.
2. Al menos una mayúscula.
3. Al menos un número.

## Frontend
1. Panel `SUPER_ADMIN` en usuarios:
- Acción `Reset pass` por fila (`CLIENT`/`ADMIN`).
- Modal para contraseña temporal y motivo opcional.
- Confirmación con cantidad de sesiones revocadas.

2. Nueva ruta pública autenticada: `/change-password`.
- Formulario para contraseña temporal + nueva contraseña.
- Al éxito, redirección a dashboard según rol.

3. Guardia en layouts de dashboard:
- Si `must_change_password=true`, redirigir a `/change-password`.

## Evolución V2
Agregar reset por enlace de email expirado reutilizando:
1. `must_change_password`
2. auditoría administrativa
3. semántica de invalidación de sesiones
