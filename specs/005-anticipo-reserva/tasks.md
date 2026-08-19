# Tasks — 005 Anticipo del 40%

| # | Fase | Tarea | Estado |
|---|---|---|---|
| T01 | F1 | Modelos: `properties.deposit_percentage`, `reservations.deposit_percentage/_amount` | done |
| T02 | F1 | Migración `c7e4a91f2db8` + backfill de históricas a 100% (saldo 0) | done |
| T03 | F2 | `compute_deposit()` (Decimal HALF_UP) + snapshot del % al crear | done |
| T04 | F2 | Anticipo al aprobar con `deposit_override` validado (0..final) | done |
| T05 | F2 | Schemas: `ApproveRequest.deposit_amount`, response con `balance_due` | done |
| T06 | F3 | WhatsApp: `reserva_aprobada`/`pago_recibido`/`pago_confirmado` usan el anticipo | done |
| T07 | F3 | Correo: variables `{{anticipo}}` y `{{saldo}}` + plantillas por defecto | done |
| T08 | F4 | Formulario de reserva: Total / Anticipo (%) / Saldo al llegar | done |
| T09 | F4 | Panel cliente: anticipo a pagar / pagado + saldo pendiente | done |
| T10 | F4 | Aprobación admin: campo "Anticipo (Bs)" precargado y editable | done |
| T11 | F4 | Propiedades: campo "% de anticipo" (0-100, default 40) | done |
| T12 | F5 | Finanzas: facturado / cobrado / por cobrar (corrige descuento ignorado) | done |
| T13 | F6 | Build, migración y QA end-to-end | done |

## QA (2026-08-04) — verificado contra los contenedores

| Criterio | Evidencia |
|---|---|
| AC-2 snapshot del % | Reserva nueva: `deposit_percentage=40.00`, `deposit_amount=null` hasta aprobar |
| AC-3 anticipo sobre el final | Total 1860 − desc 60 = **1800** → anticipo **720.00** |
| AC-4 sin descuadre | 720.00 + 1080.00 = 1800.00 == final ✅ |
| AC-5 notificación | WhatsApp `reserva_aprobada` enviado con el anticipo (Bs 720), no el total |
| AC-7 finanzas | facturado **3160** = cobrado **2080** + por cobrar **1080** |
| AC-8 históricas | Reserva previa: `deposit_percentage=100`, saldo **0.00** |
| AC-9 eximir | override `0` → anticipo 0.00, saldo = final, reserva aprobada igual |
| AC-10 validación | override 99999 → **422 INVALID_DEPOSIT** |

Ciclo completo con anticipo: comprobante subido (201) → confirmación → `CONFIRMED`
con anticipo 720 y saldo 1080 reflejado en finanzas.

## Notas
- Un error de tipo (`balance_due` opcional) hizo fallar el primer build del frontend;
  corregido con `?? 0`. Los builds en background pueden reportar éxito sin construir:
  verificar siempre `docker images ... {{.CreatedSince}}`.
- El saldo se cobra al llegar, fuera del sistema (decisión del negocio): no hay segundo
  comprobante ni estados nuevos.
