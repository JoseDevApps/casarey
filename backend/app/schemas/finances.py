from pydantic import BaseModel
from decimal import Decimal
from typing import List
from uuid import UUID


class MonthlyIncomeSummary(BaseModel):
    year: int
    month: int
    property_id: UUID
    property_name: str
    # Facturado: monto final (total - descuento) de las reservas confirmadas
    total_income: Decimal
    # Cobrado: anticipos ya confirmados
    collected_income: Decimal = Decimal(0)
    # Por cobrar: saldos que se pagan al llegar
    pending_income: Decimal = Decimal(0)
    confirmed_reservations: int


class AdminFinanceSummaryResponse(BaseModel):
    items: List[MonthlyIncomeSummary]
    total_income: Decimal
    collected_income: Decimal = Decimal(0)
    pending_income: Decimal = Decimal(0)


class GlobalAdminSummary(BaseModel):
    admin_id: UUID
    admin_name: str
    total_income: Decimal
    collected_income: Decimal = Decimal(0)
    pending_income: Decimal = Decimal(0)
    confirmed_reservations: int


class GlobalFinanceSummaryResponse(BaseModel):
    items: List[GlobalAdminSummary]
    grand_total: Decimal
    collected_total: Decimal = Decimal(0)
    pending_total: Decimal = Decimal(0)
