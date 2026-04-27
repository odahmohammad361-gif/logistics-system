"""product_taxonomy_hs_refs

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-04-27 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


SOURCE_NOTES = "Starter operational reference. Verify final HS/rate with customs broker or official tariff before clearance."
JORDAN_TARIFF_URL = "https://www.customs.gov.jo/EN/List/Integrated_customs_tariff"
JORDAN_ASYCUDA_URL = "https://asytrade.customs.gov.jo/customs/tariff/search"
IRAQ_TARIFF_URL = "https://www.mof.gov.iq/Customs-tariff-law.aspx"


def _set_sequence(bind, table_name: str) -> None:
    if bind.dialect.name != "postgresql":
        return
    bind.execute(sa.text(
        f"SELECT setval(pg_get_serial_sequence('{table_name}', 'id'), "
        f"COALESCE((SELECT MAX(id) FROM {table_name}), 1), true)"
    ))


def upgrade() -> None:
    op.create_table(
        "product_main_categories",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("name_ar", sa.String(length=150), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code", name="uq_product_main_categories_code"),
    )
    op.create_index(op.f("ix_product_main_categories_code"), "product_main_categories", ["code"], unique=False)
    op.create_index(op.f("ix_product_main_categories_id"), "product_main_categories", ["id"], unique=False)

    op.create_table(
        "product_subcategories",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("main_category_id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("name_ar", sa.String(length=150), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["main_category_id"], ["product_main_categories.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("main_category_id", "code", name="uq_product_subcategories_parent_code"),
    )
    op.create_index(op.f("ix_product_subcategories_code"), "product_subcategories", ["code"], unique=False)
    op.create_index(op.f("ix_product_subcategories_id"), "product_subcategories", ["id"], unique=False)
    op.create_index(op.f("ix_product_subcategories_main_category_id"), "product_subcategories", ["main_category_id"], unique=False)

    op.create_table(
        "hs_code_references",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("country", sa.String(length=80), nullable=False, server_default="Jordan"),
        sa.Column("hs_code", sa.String(length=30), nullable=False),
        sa.Column("chapter", sa.String(length=10), nullable=True),
        sa.Column("description", sa.String(length=500), nullable=False),
        sa.Column("description_ar", sa.String(length=500), nullable=True),
        sa.Column("customs_unit_basis", sa.String(length=30), nullable=True),
        sa.Column("customs_estimated_value_usd", sa.Numeric(14, 4), nullable=True),
        sa.Column("customs_duty_pct", sa.Numeric(6, 2), nullable=True),
        sa.Column("sales_tax_pct", sa.Numeric(6, 2), nullable=True),
        sa.Column("other_tax_pct", sa.Numeric(6, 2), nullable=True),
        sa.Column("source_url", sa.String(length=500), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("import_allowed", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("effective_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("effective_to", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("country", "hs_code", "description", name="uq_hs_code_references_country_code_desc"),
    )
    op.create_index(op.f("ix_hs_code_references_chapter"), "hs_code_references", ["chapter"], unique=False)
    op.create_index(op.f("ix_hs_code_references_country"), "hs_code_references", ["country"], unique=False)
    op.create_index(op.f("ix_hs_code_references_hs_code"), "hs_code_references", ["hs_code"], unique=False)
    op.create_index(op.f("ix_hs_code_references_id"), "hs_code_references", ["id"], unique=False)

    op.create_table(
        "product_types",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("main_category_id", sa.Integer(), nullable=False),
        sa.Column("subcategory_id", sa.Integer(), nullable=False),
        sa.Column("hs_code_ref_id", sa.Integer(), nullable=True),
        sa.Column("code", sa.String(length=80), nullable=False),
        sa.Column("name", sa.String(length=180), nullable=False),
        sa.Column("name_ar", sa.String(length=180), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("default_customs_unit_basis", sa.String(length=30), nullable=True),
        sa.Column("default_customs_estimated_value_usd", sa.Numeric(14, 4), nullable=True),
        sa.Column("default_customs_duty_pct", sa.Numeric(6, 2), nullable=True),
        sa.Column("default_sales_tax_pct", sa.Numeric(6, 2), nullable=True),
        sa.Column("default_other_tax_pct", sa.Numeric(6, 2), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["hs_code_ref_id"], ["hs_code_references.id"]),
        sa.ForeignKeyConstraint(["main_category_id"], ["product_main_categories.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["subcategory_id"], ["product_subcategories.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("subcategory_id", "code", name="uq_product_types_subcategory_code"),
    )
    op.create_index(op.f("ix_product_types_code"), "product_types", ["code"], unique=False)
    op.create_index(op.f("ix_product_types_hs_code_ref_id"), "product_types", ["hs_code_ref_id"], unique=False)
    op.create_index(op.f("ix_product_types_id"), "product_types", ["id"], unique=False)
    op.create_index(op.f("ix_product_types_main_category_id"), "product_types", ["main_category_id"], unique=False)
    op.create_index(op.f("ix_product_types_subcategory_id"), "product_types", ["subcategory_id"], unique=False)

    op.add_column("products", sa.Column("main_category_id", sa.Integer(), nullable=True))
    op.add_column("products", sa.Column("subcategory_id", sa.Integer(), nullable=True))
    op.add_column("products", sa.Column("product_type_id", sa.Integer(), nullable=True))
    op.add_column("products", sa.Column("hs_code_ref_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_products_main_category_id", "products", "product_main_categories", ["main_category_id"], ["id"])
    op.create_foreign_key("fk_products_subcategory_id", "products", "product_subcategories", ["subcategory_id"], ["id"])
    op.create_foreign_key("fk_products_product_type_id", "products", "product_types", ["product_type_id"], ["id"])
    op.create_foreign_key("fk_products_hs_code_ref_id", "products", "hs_code_references", ["hs_code_ref_id"], ["id"])
    op.create_index(op.f("ix_products_main_category_id"), "products", ["main_category_id"], unique=False)
    op.create_index(op.f("ix_products_subcategory_id"), "products", ["subcategory_id"], unique=False)
    op.create_index(op.f("ix_products_product_type_id"), "products", ["product_type_id"], unique=False)
    op.create_index(op.f("ix_products_hs_code_ref_id"), "products", ["hs_code_ref_id"], unique=False)

    bind = op.get_bind()
    main_table = sa.table(
        "product_main_categories",
        sa.column("id", sa.Integer), sa.column("code", sa.String), sa.column("name", sa.String),
        sa.column("name_ar", sa.String), sa.column("sort_order", sa.Integer),
    )
    sub_table = sa.table(
        "product_subcategories",
        sa.column("id", sa.Integer), sa.column("main_category_id", sa.Integer), sa.column("code", sa.String),
        sa.column("name", sa.String), sa.column("name_ar", sa.String), sa.column("sort_order", sa.Integer),
    )
    hs_table = sa.table(
        "hs_code_references",
        sa.column("id", sa.Integer), sa.column("country", sa.String), sa.column("hs_code", sa.String),
        sa.column("chapter", sa.String), sa.column("description", sa.String), sa.column("description_ar", sa.String),
        sa.column("customs_unit_basis", sa.String), sa.column("customs_estimated_value_usd", sa.Numeric),
        sa.column("customs_duty_pct", sa.Numeric), sa.column("sales_tax_pct", sa.Numeric),
        sa.column("other_tax_pct", sa.Numeric), sa.column("source_url", sa.String),
        sa.column("notes", sa.Text), sa.column("import_allowed", sa.Boolean), sa.column("is_active", sa.Boolean),
    )
    type_table = sa.table(
        "product_types",
        sa.column("id", sa.Integer), sa.column("main_category_id", sa.Integer), sa.column("subcategory_id", sa.Integer),
        sa.column("hs_code_ref_id", sa.Integer), sa.column("code", sa.String), sa.column("name", sa.String),
        sa.column("name_ar", sa.String), sa.column("default_customs_unit_basis", sa.String),
        sa.column("default_customs_estimated_value_usd", sa.Numeric), sa.column("default_customs_duty_pct", sa.Numeric),
        sa.column("default_sales_tax_pct", sa.Numeric), sa.column("default_other_tax_pct", sa.Numeric),
        sa.column("sort_order", sa.Integer), sa.column("is_active", sa.Boolean),
    )

    op.bulk_insert(main_table, [
        {"id": 1, "code": "clothing", "name": "Clothing", "name_ar": "ملابس", "sort_order": 10},
        {"id": 2, "code": "electronics", "name": "Electronics", "name_ar": "إلكترونيات", "sort_order": 20},
        {"id": 3, "code": "footwear", "name": "Footwear", "name_ar": "أحذية", "sort_order": 30},
        {"id": 4, "code": "bags_luggage", "name": "Bags & Luggage", "name_ar": "حقائب وأمتعة", "sort_order": 40},
        {"id": 5, "code": "furniture", "name": "Furniture", "name_ar": "أثاث", "sort_order": 50},
        {"id": 6, "code": "home_goods", "name": "Home Goods", "name_ar": "أدوات منزلية", "sort_order": 60},
        {"id": 7, "code": "toys", "name": "Toys", "name_ar": "ألعاب", "sort_order": 70},
        {"id": 8, "code": "beauty", "name": "Beauty & Personal Care", "name_ar": "تجميل وعناية", "sort_order": 80},
        {"id": 9, "code": "tools_hardware", "name": "Tools & Hardware", "name_ar": "عدد ومعدات", "sort_order": 90},
        {"id": 10, "code": "auto_parts", "name": "Auto Parts", "name_ar": "قطع سيارات", "sort_order": 100},
        {"id": 11, "code": "sports", "name": "Sports Goods", "name_ar": "مستلزمات رياضية", "sort_order": 110},
        {"id": 12, "code": "stationery", "name": "Stationery & Office", "name_ar": "قرطاسية ومكتب", "sort_order": 120},
    ])

    op.bulk_insert(sub_table, [
        {"id": 1, "main_category_id": 1, "code": "men", "name": "Men", "name_ar": "رجالي", "sort_order": 10},
        {"id": 2, "main_category_id": 1, "code": "women", "name": "Women", "name_ar": "نسائي", "sort_order": 20},
        {"id": 3, "main_category_id": 1, "code": "children", "name": "Children", "name_ar": "أطفال", "sort_order": 30},
        {"id": 4, "main_category_id": 1, "code": "baby", "name": "Baby", "name_ar": "مواليد", "sort_order": 40},
        {"id": 5, "main_category_id": 2, "code": "mobile_accessories", "name": "Mobile Accessories", "name_ar": "إكسسوارات موبايل", "sort_order": 10},
        {"id": 6, "main_category_id": 2, "code": "lighting", "name": "Lighting", "name_ar": "إنارة", "sort_order": 20},
        {"id": 7, "main_category_id": 2, "code": "audio", "name": "Audio", "name_ar": "صوتيات", "sort_order": 30},
        {"id": 8, "main_category_id": 3, "code": "casual_shoes", "name": "Casual Shoes", "name_ar": "أحذية كاجوال", "sort_order": 10},
        {"id": 9, "main_category_id": 4, "code": "bags", "name": "Bags", "name_ar": "حقائب", "sort_order": 10},
        {"id": 10, "main_category_id": 5, "code": "home_furniture", "name": "Home Furniture", "name_ar": "أثاث منزلي", "sort_order": 10},
        {"id": 11, "main_category_id": 5, "code": "office_furniture", "name": "Office Furniture", "name_ar": "أثاث مكتبي", "sort_order": 20},
        {"id": 12, "main_category_id": 6, "code": "kitchenware", "name": "Kitchenware", "name_ar": "أدوات مطبخ", "sort_order": 10},
        {"id": 13, "main_category_id": 6, "code": "household_plastic", "name": "Household Plastic", "name_ar": "بلاستيك منزلي", "sort_order": 20},
        {"id": 14, "main_category_id": 7, "code": "general_toys", "name": "General Toys", "name_ar": "ألعاب عامة", "sort_order": 10},
        {"id": 15, "main_category_id": 8, "code": "cosmetics", "name": "Cosmetics", "name_ar": "مستحضرات تجميل", "sort_order": 10},
        {"id": 16, "main_category_id": 9, "code": "hand_tools", "name": "Hand Tools", "name_ar": "عدد يدوية", "sort_order": 10},
        {"id": 17, "main_category_id": 10, "code": "spare_parts", "name": "Spare Parts", "name_ar": "قطع غيار", "sort_order": 10},
        {"id": 18, "main_category_id": 11, "code": "fitness", "name": "Fitness", "name_ar": "لياقة", "sort_order": 10},
        {"id": 19, "main_category_id": 12, "code": "office_supplies", "name": "Office Supplies", "name_ar": "مستلزمات مكتبية", "sort_order": 10},
    ])

    jordan_refs = [
        (1, "6203.42", "62", "Men's trousers and shorts, cotton", "بناطيل وشورتات رجالية قطن", "dozen", 40, 30, 0, 0),
        (2, "6205.20", "62", "Men's shirts, cotton", "قمصان رجالية قطن", "dozen", 35, 30, 0, 0),
        (3, "6109.10", "61", "T-shirts and singlets, cotton, knitted", "تي شيرت قطن محاك", "dozen", 25, 30, 0, 0),
        (4, "6110.20", "61", "Sweaters and pullovers, cotton, knitted", "كنزات قطن محاكة", "dozen", 45, 30, 0, 0),
        (5, "6201.93", "62", "Men's jackets/anoraks, man-made fibres", "جاكيتات رجالية ألياف صناعية", "dozen", 80, 30, 0, 0),
        (6, "6204.62", "62", "Women's trousers and shorts, cotton", "بناطيل وشورتات نسائية قطن", "dozen", 40, 30, 0, 0),
        (7, "6209.20", "62", "Babies garments and clothing accessories, cotton", "ملابس وإكسسوارات مواليد قطن", "dozen", 30, 30, 0, 0),
        (8, "8504.40", "85", "Static converters and chargers", "شواحن ومحولات كهربائية", "piece", None, None, None, None),
        (9, "8544.42", "85", "Electric conductors with connectors", "أسلاك وكوابل كهربائية بموصلات", "piece", None, None, None, None),
        (10, "8539.50", "85", "LED lamps", "مصابيح LED", "piece", None, None, None, None),
        (11, "8518.30", "85", "Headphones and earphones", "سماعات رأس وأذن", "piece", None, None, None, None),
        (12, "8507.60", "85", "Lithium-ion accumulators / power banks", "بطاريات ليثيوم / باور بانك", "piece", None, None, None, None),
        (13, "3926.90", "39", "Other articles of plastics", "مصنوعات بلاستيكية أخرى", "piece", None, None, None, None),
        (14, "6402.99", "64", "Footwear with outer soles and uppers of rubber or plastics", "أحذية بنعال ووجوه من مطاط أو بلاستيك", "dozen", None, None, None, None),
        (15, "6404.19", "64", "Footwear with textile uppers", "أحذية بوجه من نسيج", "dozen", None, None, None, None),
        (16, "4202.92", "42", "Bags with outer surface of plastic sheeting or textile materials", "حقائب بسطح خارجي من بلاستيك أو نسيج", "piece", None, None, None, None),
        (17, "9403.60", "94", "Wooden furniture", "أثاث خشبي", "piece", None, None, None, None),
        (18, "9403.20", "94", "Metal furniture", "أثاث معدني", "piece", None, None, None, None),
        (19, "9401.79", "94", "Other seats with metal frames", "مقاعد أخرى بإطار معدني", "piece", None, None, None, None),
        (20, "3924.90", "39", "Household articles of plastics", "أدوات منزلية من بلاستيك", "piece", None, None, None, None),
        (21, "6912.00", "69", "Ceramic tableware and kitchenware", "أدوات مائدة ومطبخ خزفية", "piece", None, None, None, None),
        (22, "7323.93", "73", "Stainless steel table, kitchen or household articles", "أدوات مائدة ومطبخ من ستانلس ستيل", "piece", None, None, None, None),
        (23, "9503.00", "95", "Toys", "ألعاب", "piece", None, None, None, None),
        (24, "3304.99", "33", "Beauty or make-up preparations", "مستحضرات تجميل", "piece", None, None, None, None),
        (25, "3303.00", "33", "Perfumes and toilet waters", "عطور ومياه تجميل", "piece", None, None, None, None),
        (26, "8205.59", "82", "Other hand tools", "عدد يدوية أخرى", "piece", None, None, None, None),
        (27, "8708.99", "87", "Motor vehicle parts and accessories", "قطع وإكسسوارات سيارات", "piece", None, None, None, None),
        (28, "9506.91", "95", "Exercise and gymnasium equipment", "معدات تمارين ولياقة", "piece", None, None, None, None),
        (29, "9608.10", "96", "Ball point pens", "أقلام حبر جاف", "piece", None, None, None, None),
        (30, "4820.10", "48", "Registers, notebooks and similar articles", "دفاتر وسجلات وما شابه", "piece", None, None, None, None),
    ]
    hs_rows = []
    for ref in jordan_refs:
        ref_id, hs_code, chapter, desc, desc_ar, basis, value, duty, sales, other = ref
        hs_rows.append({
            "id": ref_id,
            "country": "Jordan",
            "hs_code": hs_code,
            "chapter": chapter,
            "description": desc,
            "description_ar": desc_ar,
            "customs_unit_basis": basis,
            "customs_estimated_value_usd": value,
            "customs_duty_pct": duty,
            "sales_tax_pct": sales,
            "other_tax_pct": other,
            "source_url": JORDAN_TARIFF_URL if duty is not None else JORDAN_ASYCUDA_URL,
            "notes": SOURCE_NOTES,
            "import_allowed": True,
            "is_active": True,
        })
        hs_rows.append({
            "id": 1000 + ref_id,
            "country": "Iraq",
            "hs_code": hs_code,
            "chapter": chapter,
            "description": desc,
            "description_ar": desc_ar,
            "customs_unit_basis": basis,
            "customs_estimated_value_usd": value,
            "customs_duty_pct": None,
            "sales_tax_pct": None,
            "other_tax_pct": None,
            "source_url": IRAQ_TARIFF_URL,
            "notes": "Iraq starter HS reference. Confirm duty/tax with Iraqi customs/clearance agent before clearance.",
            "import_allowed": True,
            "is_active": True,
        })
    op.bulk_insert(hs_table, hs_rows)

    op.bulk_insert(type_table, [
        {"id": 1, "main_category_id": 1, "subcategory_id": 1, "hs_code_ref_id": 1, "code": "men_trousers", "name": "Men trousers", "name_ar": "بناطيل رجالية", "default_customs_unit_basis": "dozen", "default_customs_estimated_value_usd": 40, "default_customs_duty_pct": 30, "default_sales_tax_pct": 0, "default_other_tax_pct": 0, "sort_order": 10, "is_active": True},
        {"id": 2, "main_category_id": 1, "subcategory_id": 1, "hs_code_ref_id": 2, "code": "men_shirts", "name": "Men shirts", "name_ar": "قمصان رجالية", "default_customs_unit_basis": "dozen", "default_customs_estimated_value_usd": 35, "default_customs_duty_pct": 30, "default_sales_tax_pct": 0, "default_other_tax_pct": 0, "sort_order": 20, "is_active": True},
        {"id": 3, "main_category_id": 1, "subcategory_id": 1, "hs_code_ref_id": 3, "code": "men_tshirts", "name": "Men T-shirts", "name_ar": "تي شيرت رجالي", "default_customs_unit_basis": "dozen", "default_customs_estimated_value_usd": 25, "default_customs_duty_pct": 30, "default_sales_tax_pct": 0, "default_other_tax_pct": 0, "sort_order": 30, "is_active": True},
        {"id": 4, "main_category_id": 1, "subcategory_id": 1, "hs_code_ref_id": 4, "code": "men_sweaters", "name": "Men sweaters", "name_ar": "كنزات رجالية", "default_customs_unit_basis": "dozen", "default_customs_estimated_value_usd": 45, "default_customs_duty_pct": 30, "default_sales_tax_pct": 0, "default_other_tax_pct": 0, "sort_order": 40, "is_active": True},
        {"id": 5, "main_category_id": 1, "subcategory_id": 1, "hs_code_ref_id": 5, "code": "men_jackets", "name": "Men jackets", "name_ar": "جاكيتات رجالية", "default_customs_unit_basis": "dozen", "default_customs_estimated_value_usd": 80, "default_customs_duty_pct": 30, "default_sales_tax_pct": 0, "default_other_tax_pct": 0, "sort_order": 50, "is_active": True},
        {"id": 6, "main_category_id": 1, "subcategory_id": 2, "hs_code_ref_id": 6, "code": "women_trousers", "name": "Women trousers", "name_ar": "بناطيل نسائية", "default_customs_unit_basis": "dozen", "default_customs_estimated_value_usd": 40, "default_customs_duty_pct": 30, "default_sales_tax_pct": 0, "default_other_tax_pct": 0, "sort_order": 10, "is_active": True},
        {"id": 7, "main_category_id": 1, "subcategory_id": 4, "hs_code_ref_id": 7, "code": "baby_garments", "name": "Baby garments", "name_ar": "ملابس مواليد", "default_customs_unit_basis": "dozen", "default_customs_estimated_value_usd": 30, "default_customs_duty_pct": 30, "default_sales_tax_pct": 0, "default_other_tax_pct": 0, "sort_order": 10, "is_active": True},
        {"id": 8, "main_category_id": 2, "subcategory_id": 5, "hs_code_ref_id": 8, "code": "chargers", "name": "Chargers", "name_ar": "شواحن", "default_customs_unit_basis": "piece", "default_customs_estimated_value_usd": None, "default_customs_duty_pct": None, "default_sales_tax_pct": None, "default_other_tax_pct": None, "sort_order": 10, "is_active": True},
        {"id": 9, "main_category_id": 2, "subcategory_id": 5, "hs_code_ref_id": 9, "code": "cables", "name": "Cables", "name_ar": "كوابل", "default_customs_unit_basis": "piece", "default_customs_estimated_value_usd": None, "default_customs_duty_pct": None, "default_sales_tax_pct": None, "default_other_tax_pct": None, "sort_order": 20, "is_active": True},
        {"id": 10, "main_category_id": 2, "subcategory_id": 6, "hs_code_ref_id": 10, "code": "led_lamps", "name": "LED lamps", "name_ar": "مصابيح LED", "default_customs_unit_basis": "piece", "default_customs_estimated_value_usd": None, "default_customs_duty_pct": None, "default_sales_tax_pct": None, "default_other_tax_pct": None, "sort_order": 10, "is_active": True},
        {"id": 11, "main_category_id": 2, "subcategory_id": 7, "hs_code_ref_id": 11, "code": "headphones", "name": "Headphones", "name_ar": "سماعات", "default_customs_unit_basis": "piece", "default_customs_estimated_value_usd": None, "default_customs_duty_pct": None, "default_sales_tax_pct": None, "default_other_tax_pct": None, "sort_order": 10, "is_active": True},
        {"id": 12, "main_category_id": 2, "subcategory_id": 5, "hs_code_ref_id": 12, "code": "power_banks", "name": "Power banks", "name_ar": "باور بانك", "default_customs_unit_basis": "piece", "default_customs_estimated_value_usd": None, "default_customs_duty_pct": None, "default_sales_tax_pct": None, "default_other_tax_pct": None, "sort_order": 30, "is_active": True},
        {"id": 13, "main_category_id": 3, "subcategory_id": 8, "hs_code_ref_id": 14, "code": "plastic_shoes", "name": "Rubber/plastic shoes", "name_ar": "أحذية مطاط/بلاستيك", "default_customs_unit_basis": "dozen", "default_customs_estimated_value_usd": None, "default_customs_duty_pct": None, "default_sales_tax_pct": None, "default_other_tax_pct": None, "sort_order": 10, "is_active": True},
        {"id": 14, "main_category_id": 3, "subcategory_id": 8, "hs_code_ref_id": 15, "code": "textile_shoes", "name": "Textile shoes", "name_ar": "أحذية نسيج", "default_customs_unit_basis": "dozen", "default_customs_estimated_value_usd": None, "default_customs_duty_pct": None, "default_sales_tax_pct": None, "default_other_tax_pct": None, "sort_order": 20, "is_active": True},
        {"id": 15, "main_category_id": 4, "subcategory_id": 9, "hs_code_ref_id": 16, "code": "backpacks_bags", "name": "Backpacks and bags", "name_ar": "شنط وحقائب ظهر", "default_customs_unit_basis": "piece", "default_customs_estimated_value_usd": None, "default_customs_duty_pct": None, "default_sales_tax_pct": None, "default_other_tax_pct": None, "sort_order": 10, "is_active": True},
        {"id": 16, "main_category_id": 5, "subcategory_id": 10, "hs_code_ref_id": 17, "code": "wooden_furniture", "name": "Wooden furniture", "name_ar": "أثاث خشبي", "default_customs_unit_basis": "piece", "default_customs_estimated_value_usd": None, "default_customs_duty_pct": None, "default_sales_tax_pct": None, "default_other_tax_pct": None, "sort_order": 10, "is_active": True},
        {"id": 17, "main_category_id": 5, "subcategory_id": 11, "hs_code_ref_id": 18, "code": "metal_furniture", "name": "Metal furniture", "name_ar": "أثاث معدني", "default_customs_unit_basis": "piece", "default_customs_estimated_value_usd": None, "default_customs_duty_pct": None, "default_sales_tax_pct": None, "default_other_tax_pct": None, "sort_order": 10, "is_active": True},
        {"id": 18, "main_category_id": 6, "subcategory_id": 13, "hs_code_ref_id": 20, "code": "plastic_household", "name": "Plastic household articles", "name_ar": "أدوات منزلية بلاستيك", "default_customs_unit_basis": "piece", "default_customs_estimated_value_usd": None, "default_customs_duty_pct": None, "default_sales_tax_pct": None, "default_other_tax_pct": None, "sort_order": 10, "is_active": True},
        {"id": 19, "main_category_id": 6, "subcategory_id": 12, "hs_code_ref_id": 22, "code": "stainless_kitchenware", "name": "Stainless kitchenware", "name_ar": "أدوات مطبخ ستانلس", "default_customs_unit_basis": "piece", "default_customs_estimated_value_usd": None, "default_customs_duty_pct": None, "default_sales_tax_pct": None, "default_other_tax_pct": None, "sort_order": 10, "is_active": True},
        {"id": 20, "main_category_id": 7, "subcategory_id": 14, "hs_code_ref_id": 23, "code": "toys", "name": "Toys", "name_ar": "ألعاب", "default_customs_unit_basis": "piece", "default_customs_estimated_value_usd": None, "default_customs_duty_pct": None, "default_sales_tax_pct": None, "default_other_tax_pct": None, "sort_order": 10, "is_active": True},
        {"id": 21, "main_category_id": 8, "subcategory_id": 15, "hs_code_ref_id": 24, "code": "cosmetics", "name": "Cosmetics", "name_ar": "مستحضرات تجميل", "default_customs_unit_basis": "piece", "default_customs_estimated_value_usd": None, "default_customs_duty_pct": None, "default_sales_tax_pct": None, "default_other_tax_pct": None, "sort_order": 10, "is_active": True},
        {"id": 22, "main_category_id": 9, "subcategory_id": 16, "hs_code_ref_id": 26, "code": "hand_tools", "name": "Hand tools", "name_ar": "عدد يدوية", "default_customs_unit_basis": "piece", "default_customs_estimated_value_usd": None, "default_customs_duty_pct": None, "default_sales_tax_pct": None, "default_other_tax_pct": None, "sort_order": 10, "is_active": True},
        {"id": 23, "main_category_id": 10, "subcategory_id": 17, "hs_code_ref_id": 27, "code": "auto_parts", "name": "Auto parts", "name_ar": "قطع سيارات", "default_customs_unit_basis": "piece", "default_customs_estimated_value_usd": None, "default_customs_duty_pct": None, "default_sales_tax_pct": None, "default_other_tax_pct": None, "sort_order": 10, "is_active": True},
        {"id": 24, "main_category_id": 11, "subcategory_id": 18, "hs_code_ref_id": 28, "code": "fitness_equipment", "name": "Fitness equipment", "name_ar": "معدات لياقة", "default_customs_unit_basis": "piece", "default_customs_estimated_value_usd": None, "default_customs_duty_pct": None, "default_sales_tax_pct": None, "default_other_tax_pct": None, "sort_order": 10, "is_active": True},
        {"id": 25, "main_category_id": 12, "subcategory_id": 19, "hs_code_ref_id": 29, "code": "pens", "name": "Pens", "name_ar": "أقلام", "default_customs_unit_basis": "piece", "default_customs_estimated_value_usd": None, "default_customs_duty_pct": None, "default_sales_tax_pct": None, "default_other_tax_pct": None, "sort_order": 10, "is_active": True},
        {"id": 26, "main_category_id": 12, "subcategory_id": 19, "hs_code_ref_id": 30, "code": "notebooks", "name": "Notebooks", "name_ar": "دفاتر", "default_customs_unit_basis": "piece", "default_customs_estimated_value_usd": None, "default_customs_duty_pct": None, "default_sales_tax_pct": None, "default_other_tax_pct": None, "sort_order": 20, "is_active": True},
    ])

    for table_name in ("product_main_categories", "product_subcategories", "hs_code_references", "product_types"):
        _set_sequence(bind, table_name)


def downgrade() -> None:
    op.drop_index(op.f("ix_products_hs_code_ref_id"), table_name="products")
    op.drop_index(op.f("ix_products_product_type_id"), table_name="products")
    op.drop_index(op.f("ix_products_subcategory_id"), table_name="products")
    op.drop_index(op.f("ix_products_main_category_id"), table_name="products")
    op.drop_constraint("fk_products_hs_code_ref_id", "products", type_="foreignkey")
    op.drop_constraint("fk_products_product_type_id", "products", type_="foreignkey")
    op.drop_constraint("fk_products_subcategory_id", "products", type_="foreignkey")
    op.drop_constraint("fk_products_main_category_id", "products", type_="foreignkey")
    op.drop_column("products", "hs_code_ref_id")
    op.drop_column("products", "product_type_id")
    op.drop_column("products", "subcategory_id")
    op.drop_column("products", "main_category_id")

    op.drop_index(op.f("ix_product_types_subcategory_id"), table_name="product_types")
    op.drop_index(op.f("ix_product_types_main_category_id"), table_name="product_types")
    op.drop_index(op.f("ix_product_types_id"), table_name="product_types")
    op.drop_index(op.f("ix_product_types_hs_code_ref_id"), table_name="product_types")
    op.drop_index(op.f("ix_product_types_code"), table_name="product_types")
    op.drop_table("product_types")

    op.drop_index(op.f("ix_hs_code_references_id"), table_name="hs_code_references")
    op.drop_index(op.f("ix_hs_code_references_hs_code"), table_name="hs_code_references")
    op.drop_index(op.f("ix_hs_code_references_country"), table_name="hs_code_references")
    op.drop_index(op.f("ix_hs_code_references_chapter"), table_name="hs_code_references")
    op.drop_table("hs_code_references")

    op.drop_index(op.f("ix_product_subcategories_main_category_id"), table_name="product_subcategories")
    op.drop_index(op.f("ix_product_subcategories_id"), table_name="product_subcategories")
    op.drop_index(op.f("ix_product_subcategories_code"), table_name="product_subcategories")
    op.drop_table("product_subcategories")

    op.drop_index(op.f("ix_product_main_categories_id"), table_name="product_main_categories")
    op.drop_index(op.f("ix_product_main_categories_code"), table_name="product_main_categories")
    op.drop_table("product_main_categories")
