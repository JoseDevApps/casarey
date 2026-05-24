import logging
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.property import Property
from app.models.reservation import Reservation
from app.models.user import User
from app.services import email_service
from app.services.notification_preferences_service import (
    DEFAULT_CLIENT_APPROVED_BODY,
    DEFAULT_CLIENT_APPROVED_SUBJECT,
    DEFAULT_CLIENT_PAYMENT_CONFIRMED_BODY,
    DEFAULT_CLIENT_PAYMENT_CONFIRMED_SUBJECT,
    DEFAULT_CLIENT_PAYMENT_RECEIVED_BODY,
    DEFAULT_CLIENT_PAYMENT_RECEIVED_SUBJECT,
    DEFAULT_CLIENT_REJECTED_BODY,
    DEFAULT_CLIENT_REJECTED_SUBJECT,
    get_admin_notification_preferences,
)

logger = logging.getLogger("app.notifications")


async def _load_reservation_context(
    db: AsyncSession,
    reservation: Reservation,
) -> tuple[Property, User, User] | None:
    property_result = await db.execute(
        select(Property).where(Property.id == reservation.property_id)
    )
    prop = property_result.scalar_one_or_none()
    if not prop:
        logger.warning("No se envio notificacion: propiedad no encontrada (%s)", reservation.property_id)
        return None

    client_result = await db.execute(select(User).where(User.id == reservation.client_id))
    client = client_result.scalar_one_or_none()
    if not client:
        logger.warning("No se envio notificacion: cliente no encontrado (%s)", reservation.client_id)
        return None

    owner_result = await db.execute(select(User).where(User.id == prop.owner_id))
    owner = owner_result.scalar_one_or_none()
    if not owner:
        logger.warning("No se envio notificacion: admin propietario no encontrado (%s)", prop.owner_id)
        return None

    return prop, client, owner


def _format_money(value) -> str:
    if value is None:
        return "0.00"
    amount = Decimal(str(value))
    return f"{amount:.2f}"


def _build_template_vars(reservation: Reservation, prop: Property, client: User) -> dict[str, object]:
    base_url = settings.FRONTEND_URL.rstrip("/")
    total_amount = Decimal(str(reservation.total_amount or 0))
    discount_amount = Decimal(str(reservation.discount_amount or 0))
    final_amount = total_amount - discount_amount

    return {
        "cliente_nombre": client.full_name,
        "cliente_email": client.email,
        "propiedad_nombre": prop.name,
        "fecha_entrada": reservation.check_in_date,
        "fecha_salida": reservation.check_out_date,
        "adultos": reservation.num_adults,
        "ninos": reservation.num_children,
        "monto_total": _format_money(total_amount),
        "descuento": _format_money(discount_amount),
        "monto_final": _format_money(final_amount),
        "estado_reserva": reservation.status.value,
        "url_panel_cliente": f"{base_url}/dashboard/reservations/{reservation.id}",
        "url_propiedad": f"{base_url}/properties/{reservation.property_id}",
    }


async def _resolve_owner_notification_email(
    db: AsyncSession,
    owner: User,
) -> str:
    preferences = await get_admin_notification_preferences(db=db, owner_id=owner.id)
    if preferences and preferences.notification_email:
        return preferences.notification_email
    return owner.email


async def notify_admin_new_reservation(db: AsyncSession, reservation: Reservation) -> None:
    context = await _load_reservation_context(db, reservation)
    if not context:
        return
    prop, client, owner = context
    to_email = await _resolve_owner_notification_email(db=db, owner=owner)

    try:
        await email_service.send_custom_email(
            to_email=to_email,
            subject=f"Nueva solicitud de reserva: {prop.name}",
            body=(
                "Hola {admin_nombre},\n\n"
                "Recibiste una nueva solicitud de reserva.\n\n"
                "Cliente: {cliente_nombre} ({cliente_email})\n"
                "Propiedad: {propiedad_nombre}\n"
                "Entrada: {fecha_entrada}\n"
                "Salida: {fecha_salida}\n"
                "Adultos: {adultos}\n"
                "Ninos: {ninos}\n"
                "Monto estimado: Bs {monto_total}\n\n"
                "Ingresa al dashboard para revisarla."
            ),
            template_vars={
                "admin_nombre": owner.full_name,
                **_build_template_vars(reservation, prop, client),
            },
        )
    except Exception:
        logger.exception(
            "Fallo al notificar nueva reserva %s al admin %s",
            reservation.id,
            owner.id,
        )


async def notify_client_reservation_approved(db: AsyncSession, reservation: Reservation) -> None:
    context = await _load_reservation_context(db, reservation)
    if not context:
        return
    prop, client, owner = context
    preferences = await get_admin_notification_preferences(db=db, owner_id=owner.id)
    subject = (
        preferences.client_approved_subject
        if preferences
        else DEFAULT_CLIENT_APPROVED_SUBJECT
    )
    body = preferences.client_approved_body if preferences else DEFAULT_CLIENT_APPROVED_BODY

    try:
        await email_service.send_custom_email(
            to_email=client.email,
            subject=subject,
            body=body,
            template_vars=_build_template_vars(reservation, prop, client),
        )
    except Exception:
        logger.exception(
            "Fallo al notificar aprobacion de reserva %s al cliente %s",
            reservation.id,
            client.id,
        )


async def notify_client_reservation_rejected(db: AsyncSession, reservation: Reservation) -> None:
    context = await _load_reservation_context(db, reservation)
    if not context:
        return
    prop, client, owner = context
    preferences = await get_admin_notification_preferences(db=db, owner_id=owner.id)
    subject = (
        preferences.client_rejected_subject
        if preferences
        else DEFAULT_CLIENT_REJECTED_SUBJECT
    )
    body = preferences.client_rejected_body if preferences else DEFAULT_CLIENT_REJECTED_BODY

    try:
        await email_service.send_custom_email(
            to_email=client.email,
            subject=subject,
            body=body,
            template_vars=_build_template_vars(reservation, prop, client),
        )
    except Exception:
        logger.exception(
            "Fallo al notificar rechazo de reserva %s al cliente %s",
            reservation.id,
            client.id,
        )


async def notify_admin_voucher_uploaded(db: AsyncSession, reservation: Reservation) -> None:
    context = await _load_reservation_context(db, reservation)
    if not context:
        return
    prop, client, owner = context
    to_email = await _resolve_owner_notification_email(db=db, owner=owner)

    try:
        await email_service.send_custom_email(
            to_email=to_email,
            subject=f"Comprobante subido: {prop.name}",
            body=(
                "Hola {admin_nombre},\n\n"
                "El cliente {cliente_nombre} subio un comprobante de pago.\n\n"
                "Reserva: {propiedad_nombre}\n"
                "Entrada: {fecha_entrada}\n"
                "Salida: {fecha_salida}\n"
                "Monto final: Bs {monto_final}\n\n"
                "Revisa la solicitud en tu panel para confirmar el pago."
            ),
            template_vars={
                "admin_nombre": owner.full_name,
                **_build_template_vars(reservation, prop, client),
            },
        )
    except Exception:
        logger.exception(
            "Fallo al notificar comprobante de reserva %s al admin %s",
            reservation.id,
            owner.id,
        )


async def notify_client_payment_received(db: AsyncSession, reservation: Reservation) -> None:
    context = await _load_reservation_context(db, reservation)
    if not context:
        return
    prop, client, owner = context
    preferences = await get_admin_notification_preferences(db=db, owner_id=owner.id)
    subject = (
        preferences.client_payment_received_subject
        if preferences
        else DEFAULT_CLIENT_PAYMENT_RECEIVED_SUBJECT
    )
    body = (
        preferences.client_payment_received_body
        if preferences
        else DEFAULT_CLIENT_PAYMENT_RECEIVED_BODY
    )

    try:
        await email_service.send_custom_email(
            to_email=client.email,
            subject=subject,
            body=body,
            template_vars=_build_template_vars(reservation, prop, client),
        )
    except Exception:
        logger.exception(
            "Fallo al notificar recepcion de pago de reserva %s al cliente %s",
            reservation.id,
            client.id,
        )


async def notify_client_payment_confirmed(db: AsyncSession, reservation: Reservation) -> None:
    context = await _load_reservation_context(db, reservation)
    if not context:
        return
    prop, client, owner = context
    preferences = await get_admin_notification_preferences(db=db, owner_id=owner.id)
    subject = (
        preferences.client_payment_confirmed_subject
        if preferences
        else DEFAULT_CLIENT_PAYMENT_CONFIRMED_SUBJECT
    )
    body = (
        preferences.client_payment_confirmed_body
        if preferences
        else DEFAULT_CLIENT_PAYMENT_CONFIRMED_BODY
    )

    try:
        await email_service.send_custom_email(
            to_email=client.email,
            subject=subject,
            body=body,
            template_vars=_build_template_vars(reservation, prop, client),
        )
    except Exception:
        logger.exception(
            "Fallo al notificar confirmacion de pago de reserva %s al cliente %s",
            reservation.id,
            client.id,
        )
