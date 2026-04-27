from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, field_validator

from app.models.accounting import AccountingDirection, AccountingStatus, BankLineMatchStatus


class AccountingClientShort(BaseModel):
    id: int
    client_code: str
    name: str
    name_ar: Optional[str] = None

    model_config = {"from_attributes": True}


class AccountingInvoiceShort(BaseModel):
    id: int
    invoice_number: str
    total: Decimal
    currency: str

    model_config = {"from_attributes": True}


class AccountingBookingShort(BaseModel):
    id: int
    booking_number: str
    mode: str
    container_size: Optional[str] = None
    container_no: Optional[str] = None

    model_config = {"from_attributes": True}


class AccountingNamedShort(BaseModel):
    id: int
    name: str
    name_ar: Optional[str] = None

    model_config = {"from_attributes": True}


class AccountingAttachmentResponse(BaseModel):
    id: int
    document_type: str
    file_path: str
    original_filename: Optional[str] = None
    content_type: Optional[str] = None
    file_size: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AccountingEntryBase(BaseModel):
    direction: AccountingDirection
    entry_date: date
    amount: Decimal
    currency: str = "USD"
    payment_method: str
    category: str
    counterparty_type: Optional[str] = None
    counterparty_name: Optional[str] = None
    reference_no: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    client_id: Optional[int] = None
    invoice_id: Optional[int] = None
    booking_id: Optional[int] = None
    shipping_agent_id: Optional[int] = None
    clearance_agent_id: Optional[int] = None
    supplier_id: Optional[int] = None
    tax_rate_pct: Optional[Decimal] = None
    tax_amount: Optional[Decimal] = None
    has_official_tax_invoice: bool = False
    branch_id: Optional[int] = None

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Amount must be greater than zero")
        return v

    @field_validator("currency", "payment_method", "category")
    @classmethod
    def required_text(cls, v: str) -> str:
        text = (v or "").strip()
        if not text:
            raise ValueError("This field is required")
        return text


class AccountingEntryCreate(AccountingEntryBase):
    status: AccountingStatus = AccountingStatus.POSTED


class AccountingEntryUpdate(BaseModel):
    status: Optional[AccountingStatus] = None
    entry_date: Optional[date] = None
    amount: Optional[Decimal] = None
    currency: Optional[str] = None
    payment_method: Optional[str] = None
    category: Optional[str] = None
    counterparty_type: Optional[str] = None
    counterparty_name: Optional[str] = None
    reference_no: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    client_id: Optional[int] = None
    invoice_id: Optional[int] = None
    booking_id: Optional[int] = None
    shipping_agent_id: Optional[int] = None
    clearance_agent_id: Optional[int] = None
    supplier_id: Optional[int] = None
    tax_rate_pct: Optional[Decimal] = None
    tax_amount: Optional[Decimal] = None
    has_official_tax_invoice: Optional[bool] = None
    branch_id: Optional[int] = None

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None and v <= 0:
            raise ValueError("Amount must be greater than zero")
        return v


class AccountingEntryResponse(BaseModel):
    id: int
    entry_number: str
    direction: AccountingDirection
    status: AccountingStatus
    entry_date: date
    amount: Decimal
    currency: str
    payment_method: str
    category: str
    counterparty_type: Optional[str] = None
    counterparty_name: Optional[str] = None
    reference_no: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    client: Optional[AccountingClientShort] = None
    invoice: Optional[AccountingInvoiceShort] = None
    booking: Optional[AccountingBookingShort] = None
    shipping_agent: Optional[AccountingNamedShort] = None
    clearance_agent: Optional[AccountingNamedShort] = None
    supplier: Optional[AccountingNamedShort] = None
    tax_rate_pct: Optional[Decimal] = None
    tax_amount: Optional[Decimal] = None
    has_official_tax_invoice: bool
    attachments: list[AccountingAttachmentResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AccountingEntryListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    results: list[AccountingEntryResponse]


class AccountingSummaryResponse(BaseModel):
    money_in: Decimal
    money_out: Decimal
    balance: Decimal
    needs_review: int
    recent_count: int


class BankStatementImportResponse(BaseModel):
    id: int
    bank_name: Optional[str] = None
    account_name: Optional[str] = None
    account_no: Optional[str] = None
    statement_from: Optional[date] = None
    statement_to: Optional[date] = None
    original_filename: Optional[str] = None
    file_path: str
    currency: str
    line_count: int
    status: str
    notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class BankStatementImportListResponse(BaseModel):
    total: int
    results: list[BankStatementImportResponse]


class BankStatementLineResponse(BaseModel):
    id: int
    statement_id: int
    transaction_date: date
    direction: AccountingDirection
    amount: Decimal
    currency: str
    description: Optional[str] = None
    reference_no: Optional[str] = None
    balance: Optional[Decimal] = None
    match_status: BankLineMatchStatus
    matched_entry_id: Optional[int] = None
    matched_entry: Optional[AccountingEntryResponse] = None
    match_confidence: Optional[int] = None
    match_reason: Optional[str] = None

    model_config = {"from_attributes": True}


class BankStatementLineListResponse(BaseModel):
    total: int
    results: list[BankStatementLineResponse]


class BankStatementUploadResponse(BaseModel):
    statement: BankStatementImportResponse
    total_lines: int
    matched: int
    possible: int
    unmatched: int


class AccountingCategoryTotal(BaseModel):
    direction: AccountingDirection
    category: str
    amount: Decimal
    count: int


class AccountingTaxAlert(BaseModel):
    id: int
    entry_number: str
    entry_date: date
    amount: Decimal
    currency: str
    category: str
    counterparty_name: Optional[str] = None
    description: Optional[str] = None
    reason: str


class AccountingReportSummaryResponse(BaseModel):
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    currency: str
    money_in: Decimal
    money_out: Decimal
    net: Decimal
    tax_on_income: Decimal
    tax_on_expenses: Decimal
    tax_net: Decimal
    needs_review_count: int
    missing_official_invoice_count: int
    missing_official_invoice_amount: Decimal
    unmatched_bank_lines: int
    category_totals: list[AccountingCategoryTotal]
    tax_alerts: list[AccountingTaxAlert]
