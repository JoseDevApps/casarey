# Spec — 005 Anticipo del 40% para reservar

Hereda la constitución de `specs/001-landing-scrollytelling/constitution.md`.

## Problema
Hoy el cliente paga el **100%** del monto para que la reserva quede confirmada. El negocio
necesita que la cabaña se asegure con un **anticipo del 40%**, y el resto se cobre después.

## Historia principal
Como CLIENTE, al reservar veo claramente cuánto debo pagar ahora (40%) y cuánto queda
pendiente (60%); subo el comprobante del anticipo y mi reserva queda confirmada.
Como ADMIN, veo cuánto se cobró y cuánto falta por cobrar de cada reserva.

## Flujo resultante (cambios marcados)

```
1. Cliente elige fechas
   → NUEVO: el formulario muestra Total / Anticipo 40% (a pagar ahora) / Saldo
2. Reserva creada                       → PENDING_APPROVAL
   → NUEVO: se congela deposit_percentage (snapshot, como las tarifas)
3. Admin aprueba (puede dar descuento)  → APPROVED_WAITING_PAYMENT
   → NUEVO: se congela deposit_amount ya con el descuento aplicado
   → CAMBIA: la notificación pide el ANTICIPO, no el total
4. Cliente sube comprobante DEL ANTICIPO
   → CAMBIA: la pantalla dice "Anticipo Bs X" en vez de "Total"
5. Admin confirma el anticipo           → CONFIRMED + bloquea calendario
   → CAMBIA: el panel muestra "saldo pendiente Bs Y"
6. NUEVO: el saldo se cobra según la modalidad elegida (ver Decisión 1)
```

**Los estados de reserva NO cambian.** `CONFIRMED` pasa a significar *"anticipo pagado,
reserva asegurada"*. Esto evita tocar la máquina de estados, el calendario y las
transiciones ya probadas.

## Cálculo (Decimal, redondeo HALF_UP a 2 decimales)
```
final_amount   = total_amount - discount_amount
deposit_amount = round(final_amount * deposit_percentage / 100)
balance_due    = final_amount - deposit_amount     # garantiza deposit + balance == final
```

## Criterios de aceptación
- AC-1: El formulario de reserva muestra Total, Anticipo (40%) y Saldo antes de enviar.
- AC-2: `deposit_percentage` se congela al crear la reserva; cambiarlo después no afecta
  reservas existentes (misma garantía que las tarifas snapshot).
- AC-3: Al aprobar con descuento, el anticipo se calcula sobre el monto final.
- AC-4: `deposit_amount + balance_due == final_amount` exactamente (sin descuadre por redondeo).
- AC-5: Las notificaciones (WhatsApp y correo) piden el **anticipo**, no el total.
- AC-6: El panel del cliente y el del admin muestran anticipo pagado y saldo pendiente.
- AC-7: Finanzas distingue **cobrado** (anticipos) de **por cobrar** (saldos).
- AC-8: Las reservas anteriores al cambio quedan como pagadas al 100% (saldo 0).

## Decisiones tomadas (2026-08-03)
1. **El 60% restante se cobra AL LLEGAR, fuera del sistema** (efectivo/QR en sitio). La
   plataforma solo controla el anticipo y muestra el saldo como información.
   → No se toca el UNIQUE de `payment_vouchers`, no hay segundo comprobante ni estados nuevos.
2. **`deposit_percentage` configurable por cabaña**, default 40.
3. **El admin puede ajustar el anticipo al aprobar** (incluye 0 = eximir), dentro del rango
   `0 <= anticipo <= final_amount`.
4. Política de cancelación/reembolso: fuera de alcance en v1 (el sistema registra el estado,
   no gestiona devoluciones).

## Criterios de aceptación adicionales
- AC-9: Al aprobar, el admin ve el anticipo sugerido (40% del monto final) y puede
  sobrescribirlo; 0 significa sin anticipo (la reserva se confirma igual).
- AC-10: Un anticipo mayor al monto final o negativo se rechaza con 422.

## Fuera de alcance
- Pasarela de pago en línea (todo sigue siendo comprobante + validación manual).
- Reembolsos automáticos.
