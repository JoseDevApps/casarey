# Plan técnico — 005 Anticipo del 40%

## Estado actual relevante (verificado en código)

| Punto | Hallazgo |
|---|---|
| `reservations` | tiene `total_amount` y `discount_amount`; `final_amount` se calcula al vuelo |
| `payment_vouchers.reservation_id` | **UNIQUE** → hoy solo cabe UN comprobante por reserva |
| `payment_service.upload_payment_voucher` | si ya existe, **reemplaza** el archivo |
| Descuento | se aplica en la aprobación (`transition_reservation`), no al crear |
| `finances.py` L45/94/101 | suma `Reservation.total_amount` — **ignora el descuento** (inconsistencia previa) |
| Plantillas Meta | `reserva_aprobada` y `pago_confirmado` ya aprobadas; su `{{n}}` de monto pasaría a ser el anticipo |
| Calendario | se bloquea en `confirm_reservation_with_payment` (no cambia) |

## Cambios por capa

### Base de datos (1 migración)
```
properties.deposit_percentage   NUMERIC(5,2) NOT NULL DEFAULT 40
reservations.deposit_percentage NUMERIC(5,2) NOT NULL DEFAULT 40   -- snapshot al crear
reservations.deposit_amount     NUMERIC(10,2) NULL                 -- se fija al aprobar
```
**Backfill obligatorio** (AC-8): reservas existentes → `deposit_percentage = 100`,
`deposit_amount = total_amount - discount_amount`. Así su saldo queda en 0 y no
distorsionan finanzas.

### Backend
- `reservation_service.create_reservation`: copia `prop.deposit_percentage` al snapshot.
- `reservation_service.transition_reservation`: al pasar a `APPROVED_WAITING_PAYMENT`,
  tras fijar el descuento, calcula y persiste `deposit_amount`. Acepta un
  `deposit_override: Decimal | None` — si viene, se usa ese monto (validado
  `0 <= override <= final_amount`, 422 si no); si es None, se aplica el % snapshot.
- `ApproveRequest` (schema) += `deposit_amount: Optional[Decimal]` para el override del admin.
- Nuevo helper `pricing.compute_deposit(final_amount, pct)` — única fuente de verdad del
  redondeo, usada por backend y expuesta al frontend vía schema.
- `schemas/reservation.py`: `ReservationResponse` += `deposit_percentage`,
  `deposit_amount`, `balance_due` (calculados en el response, no duplicados en DB).
- `properties`: schema + router admiten `deposit_percentage` (validado 0–100).
- `reservation_notifications_service._build_wa_params`: el parámetro de monto de
  `reserva_aprobada` y `pago_confirmado` pasa a ser **el anticipo**; los cuerpos de correo
  (plantillas del admin) suman las variables `{{anticipo}}` y `{{saldo}}`.

### Frontend
- `booking-form.tsx`: desglose Total / **Anticipo (40%) a pagar ahora** / Saldo.
- `(client)/dashboard/reservations/[id]`: la caja de pago pide el anticipo; tras confirmar
  muestra "Saldo pendiente Bs Y".
- `(admin)/dashboard/requests`: al aprobar, campo **"Anticipo a cobrar"** precargado con el
  40% sugerido y editable (0 = eximir); badge con anticipo y saldo en la lista.
- `(admin)` propiedades: campo "% de anticipo" (default 40).
- `finances` y `global-finances`: separar **Cobrado** vs **Por cobrar**.

### Plantillas de Meta
**No requieren recrearse.** El texto de `reserva_aprobada` ("Monto a pagar: Bs {{5}}") sigue
siendo correcto mapeando `{{5}} = deposit_amount`. Si más adelante se quiere el desglose
explícito (anticipo + saldo) hay que **crear plantillas nuevas y esperar aprobación de Meta**
— se deja fuera de v1 para no bloquear el despliegue.

## Riesgos y mitigación
| Riesgo | Mitigación |
|---|---|
| Descuadre por redondeo | `balance = final - deposit` (nunca se redondea dos veces); test de AC-4 |
| Reservas "en vuelo" al desplegar (aprobadas sin `deposit_amount`) | `deposit_amount` nullable + fallback: si es NULL se trata como 100% (comportamiento actual) |
| Finanzas infla ingresos | Se corrige junto: usar `final_amount` y separar cobrado/por cobrar |
| Cliente confundido por montos distintos en correo vs pantalla | Un solo cálculo en backend; el correo usa el mismo valor |
| Descuento aplicado después del anticipo mostrado en el formulario | El formulario muestra estimado; el valor firme se fija al aprobar y se comunica ahí |

## Fases
- **F1 Datos**: migración + backfill + snapshot en creación. *(sin cambio visible)*
- **F2 Cálculo y flujo**: helper de anticipo, aprobación, schemas/responses.
- **F3 Notificaciones**: params WhatsApp + plantillas de correo con anticipo/saldo.
- **F4 Frontend**: formulario, panel cliente, panel admin, campo % en propiedades.
- **F5 Finanzas**: cobrado vs por cobrar (corrige además el descuento ignorado).
- **F6 QA**: AC-1..AC-8 + reserva demo end-to-end con notificaciones reales.

Estimación: F1–F4 el grueso; F5 es independiente y puede ir después si urge desplegar.
