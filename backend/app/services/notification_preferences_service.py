from typing import Union
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import AdminNotificationPreference

DEFAULT_CLIENT_APPROVED_SUBJECT = "Reserva aprobada: {{propiedad_nombre}}"
DEFAULT_CLIENT_APPROVED_BODY = """Hola {{cliente_nombre}},

Tu reserva para "{{propiedad_nombre}}" fue aprobada.

Entrada: {{fecha_entrada}}
Salida: {{fecha_salida}}
Adultos: {{adultos}}
Ninos: {{ninos}}
Total reservado: Bs {{monto_total}}
Descuento aplicado: Bs {{descuento}}
Monto final: Bs {{monto_final}}

Para asegurar tu reserva, paga el anticipo de Bs {{anticipo}}.
Saldo a cancelar al llegar: Bs {{saldo}}

Puedes cargar tu comprobante del anticipo en:
{{url_panel_cliente}}

Gracias por reservar con nosotros.
"""

DEFAULT_CLIENT_REJECTED_SUBJECT = "Reserva no aprobada: {{propiedad_nombre}}"
DEFAULT_CLIENT_REJECTED_BODY = """Hola {{cliente_nombre}},

Tu solicitud de reserva para "{{propiedad_nombre}}" no fue aprobada.

Entrada solicitada: {{fecha_entrada}}
Salida solicitada: {{fecha_salida}}

Si deseas, puedes intentar con otras fechas desde:
{{url_propiedad}}

Gracias por tu comprension.
"""

DEFAULT_CLIENT_PAYMENT_RECEIVED_SUBJECT = "Comprobante recibido: {{propiedad_nombre}}"
DEFAULT_CLIENT_PAYMENT_RECEIVED_BODY = """Hola {{cliente_nombre}},

Recibimos tu comprobante de pago para la reserva en "{{propiedad_nombre}}".
Nuestro equipo lo revisara y te confirmaremos en cuanto quede validado.

Puedes seguir el estado en:
{{url_panel_cliente}}

Gracias.
"""

DEFAULT_CLIENT_PAYMENT_CONFIRMED_SUBJECT = "Pago confirmado: {{propiedad_nombre}}"
DEFAULT_CLIENT_PAYMENT_CONFIRMED_BODY = """Hola {{cliente_nombre}},

Tu pago ha sido confirmado y tu reserva ya esta activa.

Propiedad: {{propiedad_nombre}}
Entrada: {{fecha_entrada}}
Salida: {{fecha_salida}}
Anticipo confirmado: Bs {{anticipo}}
Saldo a cancelar al llegar: Bs {{saldo}}

Puedes revisar el detalle en:
{{url_panel_cliente}}

Te esperamos.
"""

DEFAULT_TEMPLATE_VALUES = {
    "client_approved_subject": DEFAULT_CLIENT_APPROVED_SUBJECT,
    "client_approved_body": DEFAULT_CLIENT_APPROVED_BODY,
    "client_rejected_subject": DEFAULT_CLIENT_REJECTED_SUBJECT,
    "client_rejected_body": DEFAULT_CLIENT_REJECTED_BODY,
    "client_payment_received_subject": DEFAULT_CLIENT_PAYMENT_RECEIVED_SUBJECT,
    "client_payment_received_body": DEFAULT_CLIENT_PAYMENT_RECEIVED_BODY,
    "client_payment_confirmed_subject": DEFAULT_CLIENT_PAYMENT_CONFIRMED_SUBJECT,
    "client_payment_confirmed_body": DEFAULT_CLIENT_PAYMENT_CONFIRMED_BODY,
}


async def get_admin_notification_preferences(
    db: AsyncSession,
    owner_id: Union[UUID, str],
) -> AdminNotificationPreference | None:
    result = await db.execute(
        select(AdminNotificationPreference).where(
            AdminNotificationPreference.owner_id == owner_id
        )
    )
    return result.scalar_one_or_none()


async def get_or_create_admin_notification_preferences(
    db: AsyncSession,
    owner_id: Union[UUID, str],
) -> AdminNotificationPreference:
    preferences = await get_admin_notification_preferences(db=db, owner_id=owner_id)
    if preferences:
        return preferences

    preferences = AdminNotificationPreference(
        owner_id=owner_id,
        notification_email=None,
        **DEFAULT_TEMPLATE_VALUES,
    )
    db.add(preferences)
    await db.flush()
    return preferences
