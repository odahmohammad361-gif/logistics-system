from __future__ import annotations
from typing import Optional
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict


class ProductPhotoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    file_path: str
    is_main: bool
    sort_order: int


class SupplierShort(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    name: str
    market_location: Optional[str] = None


class ProductMainCategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    name: str
    name_ar: Optional[str] = None
    description: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True


class ProductSubcategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    main_category_id: int
    code: str
    name: str
    name_ar: Optional[str] = None
    description: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True


class HSCodeReferenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    country: str
    hs_code: str
    chapter: Optional[str] = None
    description: str
    description_ar: Optional[str] = None
    customs_unit_basis: Optional[str] = None
    customs_estimated_value_usd: Optional[Decimal] = None
    customs_duty_pct: Optional[Decimal] = None
    sales_tax_pct: Optional[Decimal] = None
    other_tax_pct: Optional[Decimal] = None
    source_url: Optional[str] = None
    notes: Optional[str] = None
    import_allowed: bool = True
    is_active: bool = True


class ProductTypeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    main_category_id: int
    subcategory_id: int
    hs_code_ref_id: Optional[int] = None
    code: str
    name: str
    name_ar: Optional[str] = None
    description: Optional[str] = None
    default_customs_unit_basis: Optional[str] = None
    default_customs_estimated_value_usd: Optional[Decimal] = None
    default_customs_duty_pct: Optional[Decimal] = None
    default_sales_tax_pct: Optional[Decimal] = None
    default_other_tax_pct: Optional[Decimal] = None
    sort_order: int = 0
    is_active: bool = True
    hs_code_ref: Optional[HSCodeReferenceResponse] = None


class ProductReferenceDataResponse(BaseModel):
    main_categories: list[ProductMainCategoryResponse]
    subcategories: list[ProductSubcategoryResponse]
    product_types: list[ProductTypeResponse]
    hs_codes: list[HSCodeReferenceResponse]


class ProductMainCategoryCreate(BaseModel):
    code: str
    name: str
    name_ar: Optional[str] = None
    description: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True


class ProductMainCategoryUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    name_ar: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class ProductSubcategoryCreate(BaseModel):
    main_category_id: int
    code: str
    name: str
    name_ar: Optional[str] = None
    description: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True


class ProductSubcategoryUpdate(BaseModel):
    main_category_id: Optional[int] = None
    code: Optional[str] = None
    name: Optional[str] = None
    name_ar: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class HSCodeReferenceCreate(BaseModel):
    country: str = "Jordan"
    hs_code: str
    chapter: Optional[str] = None
    description: str
    description_ar: Optional[str] = None
    customs_unit_basis: Optional[str] = None
    customs_estimated_value_usd: Optional[Decimal] = None
    customs_duty_pct: Optional[Decimal] = None
    sales_tax_pct: Optional[Decimal] = None
    other_tax_pct: Optional[Decimal] = None
    source_url: Optional[str] = None
    notes: Optional[str] = None
    import_allowed: bool = True
    is_active: bool = True


class HSCodeReferenceUpdate(BaseModel):
    country: Optional[str] = None
    hs_code: Optional[str] = None
    chapter: Optional[str] = None
    description: Optional[str] = None
    description_ar: Optional[str] = None
    customs_unit_basis: Optional[str] = None
    customs_estimated_value_usd: Optional[Decimal] = None
    customs_duty_pct: Optional[Decimal] = None
    sales_tax_pct: Optional[Decimal] = None
    other_tax_pct: Optional[Decimal] = None
    source_url: Optional[str] = None
    notes: Optional[str] = None
    import_allowed: Optional[bool] = None
    is_active: Optional[bool] = None


class ProductTypeCreate(BaseModel):
    main_category_id: int
    subcategory_id: int
    hs_code_ref_id: Optional[int] = None
    code: str
    name: str
    name_ar: Optional[str] = None
    description: Optional[str] = None
    default_customs_unit_basis: Optional[str] = None
    default_customs_estimated_value_usd: Optional[Decimal] = None
    default_customs_duty_pct: Optional[Decimal] = None
    default_sales_tax_pct: Optional[Decimal] = None
    default_other_tax_pct: Optional[Decimal] = None
    sort_order: int = 0
    is_active: bool = True


class ProductTypeUpdate(BaseModel):
    main_category_id: Optional[int] = None
    subcategory_id: Optional[int] = None
    hs_code_ref_id: Optional[int] = None
    code: Optional[str] = None
    name: Optional[str] = None
    name_ar: Optional[str] = None
    description: Optional[str] = None
    default_customs_unit_basis: Optional[str] = None
    default_customs_estimated_value_usd: Optional[Decimal] = None
    default_customs_duty_pct: Optional[Decimal] = None
    default_sales_tax_pct: Optional[Decimal] = None
    default_other_tax_pct: Optional[Decimal] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class ProductCreate(BaseModel):
    code: str
    name: str
    name_ar: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    description_ar: Optional[str] = None
    supplier_id: Optional[int] = None
    main_category_id: Optional[int] = None
    subcategory_id: Optional[int] = None
    product_type_id: Optional[int] = None
    hs_code_ref_id: Optional[int] = None
    price_cny: Decimal
    price_usd: Optional[Decimal] = None
    hs_code: Optional[str] = None
    origin_country: Optional[str] = None
    customs_category: Optional[str] = None
    customs_unit_basis: Optional[str] = None
    customs_estimated_value_usd: Optional[Decimal] = None
    customs_duty_pct: Optional[Decimal] = None
    sales_tax_pct: Optional[Decimal] = None
    other_tax_pct: Optional[Decimal] = None
    customs_notes: Optional[str] = None
    pcs_per_carton: int = 250
    cbm_per_carton: Decimal = Decimal("0.20")
    min_order_cartons: int = 1
    gross_weight_kg_per_carton: Optional[Decimal] = None
    net_weight_kg_per_carton: Optional[Decimal] = None
    carton_length_cm: Optional[Decimal] = None
    carton_width_cm: Optional[Decimal] = None
    carton_height_cm: Optional[Decimal] = None
    is_active: bool = True
    is_featured: bool = False


class ProductUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    name_ar: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    description_ar: Optional[str] = None
    supplier_id: Optional[int] = None
    main_category_id: Optional[int] = None
    subcategory_id: Optional[int] = None
    product_type_id: Optional[int] = None
    hs_code_ref_id: Optional[int] = None
    price_cny: Optional[Decimal] = None
    price_usd: Optional[Decimal] = None
    hs_code: Optional[str] = None
    origin_country: Optional[str] = None
    customs_category: Optional[str] = None
    customs_unit_basis: Optional[str] = None
    customs_estimated_value_usd: Optional[Decimal] = None
    customs_duty_pct: Optional[Decimal] = None
    sales_tax_pct: Optional[Decimal] = None
    other_tax_pct: Optional[Decimal] = None
    customs_notes: Optional[str] = None
    pcs_per_carton: Optional[int] = None
    cbm_per_carton: Optional[Decimal] = None
    min_order_cartons: Optional[int] = None
    gross_weight_kg_per_carton: Optional[Decimal] = None
    net_weight_kg_per_carton: Optional[Decimal] = None
    carton_length_cm: Optional[Decimal] = None
    carton_width_cm: Optional[Decimal] = None
    carton_height_cm: Optional[Decimal] = None
    is_active: Optional[bool] = None
    is_featured: Optional[bool] = None


class ProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    name_ar: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    description_ar: Optional[str] = None
    supplier: Optional[SupplierShort] = None
    main_category_id: Optional[int] = None
    subcategory_id: Optional[int] = None
    product_type_id: Optional[int] = None
    hs_code_ref_id: Optional[int] = None
    main_category: Optional[ProductMainCategoryResponse] = None
    subcategory: Optional[ProductSubcategoryResponse] = None
    product_type: Optional[ProductTypeResponse] = None
    hs_code_ref: Optional[HSCodeReferenceResponse] = None
    price_cny: Decimal
    price_usd: Optional[Decimal] = None
    hs_code: Optional[str] = None
    origin_country: Optional[str] = None
    customs_category: Optional[str] = None
    customs_unit_basis: Optional[str] = None
    customs_estimated_value_usd: Optional[Decimal] = None
    customs_duty_pct: Optional[Decimal] = None
    sales_tax_pct: Optional[Decimal] = None
    other_tax_pct: Optional[Decimal] = None
    customs_notes: Optional[str] = None
    pcs_per_carton: int
    cbm_per_carton: Decimal
    min_order_cartons: int
    gross_weight_kg_per_carton: Optional[Decimal] = None
    net_weight_kg_per_carton: Optional[Decimal] = None
    carton_length_cm: Optional[Decimal] = None
    carton_width_cm: Optional[Decimal] = None
    carton_height_cm: Optional[Decimal] = None
    is_active: bool
    is_featured: bool
    photos: list[ProductPhotoResponse] = []
    created_at: datetime
    updated_at: datetime


class ProductListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    results: list[ProductResponse]
