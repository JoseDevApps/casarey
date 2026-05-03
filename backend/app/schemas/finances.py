from pydantic import BaseModel
from decimal import Decimal
from typing import List
from uuid import UUID


class MonthlyIncomeSummary(BaseModel):
    year: int
    month: int
    property_id: UUID
    property_name: str
    total_income: Decimal
    confirmed_reservations: int


class AdminFinanceSummaryResponse(BaseModel):
    items: List[MonthlyIncomeSummary]
    total_income: Decimal


class GlobalAdminSummary(BaseModel):
    admin_id: UUID
    admin_name: str
    total_income: Decimal
    confirmed_reservations: int


class GlobalFinanceSummaryResponse(BaseModel):
    items: List[GlobalAdminSummary]
    grand_total: Decimal
