"""invoice packages

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-04-28 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "f6a7b8c9d0e1"
down_revision = "e5f6a7b8c9d0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "invoice_packages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("package_number", sa.String(length=60), nullable=False),
        sa.Column("source_type", sa.String(length=40), nullable=False, server_default="manual"),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="draft"),
        sa.Column("title", sa.String(length=250), nullable=True),
        sa.Column("client_id", sa.Integer(), nullable=True),
        sa.Column("buyer_name", sa.Text(), nullable=True),
        sa.Column("booking_id", sa.Integer(), nullable=True),
        sa.Column("booking_cargo_line_id", sa.Integer(), nullable=True),
        sa.Column("origin", sa.String(length=100), nullable=True),
        sa.Column("destination", sa.String(length=100), nullable=True),
        sa.Column("port_of_loading", sa.String(length=150), nullable=True),
        sa.Column("port_of_discharge", sa.String(length=150), nullable=True),
        sa.Column("shipping_term", sa.String(length=30), nullable=True),
        sa.Column("payment_terms", sa.Text(), nullable=True),
        sa.Column("shipping_marks", sa.Text(), nullable=True),
        sa.Column("container_no", sa.String(length=50), nullable=True),
        sa.Column("seal_no", sa.String(length=50), nullable=True),
        sa.Column("bl_number", sa.String(length=60), nullable=True),
        sa.Column("vessel_name", sa.String(length=100), nullable=True),
        sa.Column("voyage_number", sa.String(length=50), nullable=True),
        sa.Column("awb_number", sa.String(length=60), nullable=True),
        sa.Column("flight_number", sa.String(length=50), nullable=True),
        sa.Column("currency", sa.String(length=10), nullable=False, server_default="USD"),
        sa.Column("subtotal", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("discount", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("total", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("notes_ar", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("branch_id", sa.Integer(), nullable=True),
        sa.Column("created_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["booking_cargo_line_id"], ["booking_cargo_lines.id"]),
        sa.ForeignKeyConstraint(["booking_id"], ["bookings.id"]),
        sa.ForeignKeyConstraint(["branch_id"], ["branches.id"]),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"]),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("package_number"),
    )
    op.create_index(op.f("ix_invoice_packages_id"), "invoice_packages", ["id"], unique=False)
    op.create_index(op.f("ix_invoice_packages_package_number"), "invoice_packages", ["package_number"], unique=False)
    op.create_index(op.f("ix_invoice_packages_source_type"), "invoice_packages", ["source_type"], unique=False)
    op.create_index(op.f("ix_invoice_packages_status"), "invoice_packages", ["status"], unique=False)
    op.create_index(op.f("ix_invoice_packages_client_id"), "invoice_packages", ["client_id"], unique=False)
    op.create_index(op.f("ix_invoice_packages_booking_id"), "invoice_packages", ["booking_id"], unique=False)
    op.create_index(op.f("ix_invoice_packages_booking_cargo_line_id"), "invoice_packages", ["booking_cargo_line_id"], unique=False)
    op.create_index(op.f("ix_invoice_packages_branch_id"), "invoice_packages", ["branch_id"], unique=False)
    op.create_index(op.f("ix_invoice_packages_is_active"), "invoice_packages", ["is_active"], unique=False)

    op.create_table(
        "invoice_package_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("package_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=True),
        sa.Column("hs_code_ref_id", sa.Integer(), nullable=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("description_ar", sa.Text(), nullable=True),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("details_ar", sa.Text(), nullable=True),
        sa.Column("product_image_path", sa.String(length=500), nullable=True),
        sa.Column("hs_code", sa.String(length=30), nullable=True),
        sa.Column("customs_unit_basis", sa.String(length=30), nullable=True),
        sa.Column("customs_unit_quantity", sa.Numeric(14, 4), nullable=True),
        sa.Column("quantity", sa.Numeric(14, 3), nullable=False, server_default="0"),
        sa.Column("unit", sa.String(length=30), nullable=True),
        sa.Column("unit_price", sa.Numeric(14, 4), nullable=False, server_default="0"),
        sa.Column("total_price", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("cartons", sa.Numeric(14, 3), nullable=True),
        sa.Column("pcs_per_carton", sa.Numeric(14, 3), nullable=True),
        sa.Column("gross_weight", sa.Numeric(14, 3), nullable=True),
        sa.Column("net_weight", sa.Numeric(14, 3), nullable=True),
        sa.Column("cbm", sa.Numeric(14, 4), nullable=True),
        sa.Column("carton_length_cm", sa.Numeric(8, 2), nullable=True),
        sa.Column("carton_width_cm", sa.Numeric(8, 2), nullable=True),
        sa.Column("carton_height_cm", sa.Numeric(8, 2), nullable=True),
        sa.Column("volumetric_weight_kg", sa.Numeric(14, 3), nullable=True),
        sa.Column("chargeable_weight_kg", sa.Numeric(14, 3), nullable=True),
        sa.Column("source_product_snapshot_json", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["hs_code_ref_id"], ["hs_code_references.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["package_id"], ["invoice_packages.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_invoice_package_items_id"), "invoice_package_items", ["id"], unique=False)
    op.create_index(op.f("ix_invoice_package_items_package_id"), "invoice_package_items", ["package_id"], unique=False)
    op.create_index(op.f("ix_invoice_package_items_product_id"), "invoice_package_items", ["product_id"], unique=False)
    op.create_index(op.f("ix_invoice_package_items_hs_code_ref_id"), "invoice_package_items", ["hs_code_ref_id"], unique=False)
    op.create_index(op.f("ix_invoice_package_items_hs_code"), "invoice_package_items", ["hs_code"], unique=False)

    op.create_table(
        "invoice_documents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("package_id", sa.Integer(), nullable=False),
        sa.Column("legacy_invoice_id", sa.Integer(), nullable=True),
        sa.Column("document_type", sa.String(length=20), nullable=False),
        sa.Column("document_number", sa.String(length=80), nullable=False),
        sa.Column("language", sa.String(length=5), nullable=False, server_default="en"),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="draft"),
        sa.Column("issue_date", sa.Date(), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("pdf_path", sa.String(length=500), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["legacy_invoice_id"], ["invoices.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["package_id"], ["invoice_packages.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("document_number"),
    )
    op.create_index(op.f("ix_invoice_documents_id"), "invoice_documents", ["id"], unique=False)
    op.create_index(op.f("ix_invoice_documents_package_id"), "invoice_documents", ["package_id"], unique=False)
    op.create_index(op.f("ix_invoice_documents_legacy_invoice_id"), "invoice_documents", ["legacy_invoice_id"], unique=False)
    op.create_index(op.f("ix_invoice_documents_document_type"), "invoice_documents", ["document_type"], unique=False)
    op.create_index(op.f("ix_invoice_documents_document_number"), "invoice_documents", ["document_number"], unique=False)
    op.create_index(op.f("ix_invoice_documents_language"), "invoice_documents", ["language"], unique=False)
    op.create_index(op.f("ix_invoice_documents_status"), "invoice_documents", ["status"], unique=False)

    op.create_table(
        "invoice_files",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("package_id", sa.Integer(), nullable=False),
        sa.Column("document_id", sa.Integer(), nullable=True),
        sa.Column("document_type", sa.String(length=40), nullable=False),
        sa.Column("custom_file_type", sa.String(length=120), nullable=True),
        sa.Column("file_path", sa.String(length=500), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=True),
        sa.Column("content_type", sa.String(length=120), nullable=True),
        sa.Column("file_size", sa.Integer(), nullable=True),
        sa.Column("extraction_status", sa.String(length=30), nullable=False, server_default="pending"),
        sa.Column("extraction_json", sa.Text(), nullable=True),
        sa.Column("uploaded_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["document_id"], ["invoice_documents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["package_id"], ["invoice_packages.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["uploaded_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_invoice_files_id"), "invoice_files", ["id"], unique=False)
    op.create_index(op.f("ix_invoice_files_package_id"), "invoice_files", ["package_id"], unique=False)
    op.create_index(op.f("ix_invoice_files_document_id"), "invoice_files", ["document_id"], unique=False)
    op.create_index(op.f("ix_invoice_files_document_type"), "invoice_files", ["document_type"], unique=False)
    op.create_index(op.f("ix_invoice_files_extraction_status"), "invoice_files", ["extraction_status"], unique=False)

    op.create_table(
        "invoice_activity_log",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("package_id", sa.Integer(), nullable=False),
        sa.Column("action", sa.String(length=60), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("changed_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["changed_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["package_id"], ["invoice_packages.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_invoice_activity_log_id"), "invoice_activity_log", ["id"], unique=False)
    op.create_index(op.f("ix_invoice_activity_log_package_id"), "invoice_activity_log", ["package_id"], unique=False)
    op.create_index(op.f("ix_invoice_activity_log_action"), "invoice_activity_log", ["action"], unique=False)

    op.add_column("invoices", sa.Column("package_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_invoices_package_id"), "invoices", ["package_id"], unique=False)
    op.create_foreign_key("fk_invoices_package_id", "invoices", "invoice_packages", ["package_id"], ["id"], ondelete="SET NULL")

    op.add_column("invoice_items", sa.Column("hs_code_ref_id", sa.Integer(), nullable=True))
    op.add_column("invoice_items", sa.Column("customs_unit_basis", sa.String(length=30), nullable=True))
    op.add_column("invoice_items", sa.Column("customs_unit_quantity", sa.Numeric(14, 4), nullable=True))
    op.add_column("invoice_items", sa.Column("pcs_per_carton", sa.Numeric(14, 3), nullable=True))
    op.create_index(op.f("ix_invoice_items_hs_code_ref_id"), "invoice_items", ["hs_code_ref_id"], unique=False)
    op.create_foreign_key("fk_invoice_items_hs_code_ref_id", "invoice_items", "hs_code_references", ["hs_code_ref_id"], ["id"], ondelete="SET NULL")

    op.add_column("booking_cargo_lines", sa.Column("invoice_package_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_booking_cargo_lines_invoice_package_id"), "booking_cargo_lines", ["invoice_package_id"], unique=False)
    op.create_foreign_key("fk_booking_cargo_lines_invoice_package_id", "booking_cargo_lines", "invoice_packages", ["invoice_package_id"], ["id"])

    op.add_column("customs_estimates", sa.Column("invoice_package_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_customs_estimates_invoice_package_id"), "customs_estimates", ["invoice_package_id"], unique=False)
    op.create_foreign_key("fk_customs_estimates_invoice_package_id", "customs_estimates", "invoice_packages", ["invoice_package_id"], ["id"])

    op.add_column("accounting_entries", sa.Column("invoice_package_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_accounting_entries_invoice_package_id"), "accounting_entries", ["invoice_package_id"], unique=False)
    op.create_foreign_key("fk_accounting_entries_invoice_package_id", "accounting_entries", "invoice_packages", ["invoice_package_id"], ["id"])


def downgrade() -> None:
    op.drop_constraint("fk_accounting_entries_invoice_package_id", "accounting_entries", type_="foreignkey")
    op.drop_index(op.f("ix_accounting_entries_invoice_package_id"), table_name="accounting_entries")
    op.drop_column("accounting_entries", "invoice_package_id")

    op.drop_constraint("fk_customs_estimates_invoice_package_id", "customs_estimates", type_="foreignkey")
    op.drop_index(op.f("ix_customs_estimates_invoice_package_id"), table_name="customs_estimates")
    op.drop_column("customs_estimates", "invoice_package_id")

    op.drop_constraint("fk_booking_cargo_lines_invoice_package_id", "booking_cargo_lines", type_="foreignkey")
    op.drop_index(op.f("ix_booking_cargo_lines_invoice_package_id"), table_name="booking_cargo_lines")
    op.drop_column("booking_cargo_lines", "invoice_package_id")

    op.drop_constraint("fk_invoice_items_hs_code_ref_id", "invoice_items", type_="foreignkey")
    op.drop_index(op.f("ix_invoice_items_hs_code_ref_id"), table_name="invoice_items")
    op.drop_column("invoice_items", "pcs_per_carton")
    op.drop_column("invoice_items", "customs_unit_quantity")
    op.drop_column("invoice_items", "customs_unit_basis")
    op.drop_column("invoice_items", "hs_code_ref_id")

    op.drop_constraint("fk_invoices_package_id", "invoices", type_="foreignkey")
    op.drop_index(op.f("ix_invoices_package_id"), table_name="invoices")
    op.drop_column("invoices", "package_id")

    op.drop_index(op.f("ix_invoice_activity_log_action"), table_name="invoice_activity_log")
    op.drop_index(op.f("ix_invoice_activity_log_package_id"), table_name="invoice_activity_log")
    op.drop_index(op.f("ix_invoice_activity_log_id"), table_name="invoice_activity_log")
    op.drop_table("invoice_activity_log")

    op.drop_index(op.f("ix_invoice_files_extraction_status"), table_name="invoice_files")
    op.drop_index(op.f("ix_invoice_files_document_type"), table_name="invoice_files")
    op.drop_index(op.f("ix_invoice_files_document_id"), table_name="invoice_files")
    op.drop_index(op.f("ix_invoice_files_package_id"), table_name="invoice_files")
    op.drop_index(op.f("ix_invoice_files_id"), table_name="invoice_files")
    op.drop_table("invoice_files")

    op.drop_index(op.f("ix_invoice_documents_status"), table_name="invoice_documents")
    op.drop_index(op.f("ix_invoice_documents_language"), table_name="invoice_documents")
    op.drop_index(op.f("ix_invoice_documents_document_number"), table_name="invoice_documents")
    op.drop_index(op.f("ix_invoice_documents_document_type"), table_name="invoice_documents")
    op.drop_index(op.f("ix_invoice_documents_legacy_invoice_id"), table_name="invoice_documents")
    op.drop_index(op.f("ix_invoice_documents_package_id"), table_name="invoice_documents")
    op.drop_index(op.f("ix_invoice_documents_id"), table_name="invoice_documents")
    op.drop_table("invoice_documents")

    op.drop_index(op.f("ix_invoice_package_items_hs_code"), table_name="invoice_package_items")
    op.drop_index(op.f("ix_invoice_package_items_hs_code_ref_id"), table_name="invoice_package_items")
    op.drop_index(op.f("ix_invoice_package_items_product_id"), table_name="invoice_package_items")
    op.drop_index(op.f("ix_invoice_package_items_package_id"), table_name="invoice_package_items")
    op.drop_index(op.f("ix_invoice_package_items_id"), table_name="invoice_package_items")
    op.drop_table("invoice_package_items")

    op.drop_index(op.f("ix_invoice_packages_is_active"), table_name="invoice_packages")
    op.drop_index(op.f("ix_invoice_packages_branch_id"), table_name="invoice_packages")
    op.drop_index(op.f("ix_invoice_packages_booking_cargo_line_id"), table_name="invoice_packages")
    op.drop_index(op.f("ix_invoice_packages_booking_id"), table_name="invoice_packages")
    op.drop_index(op.f("ix_invoice_packages_client_id"), table_name="invoice_packages")
    op.drop_index(op.f("ix_invoice_packages_status"), table_name="invoice_packages")
    op.drop_index(op.f("ix_invoice_packages_source_type"), table_name="invoice_packages")
    op.drop_index(op.f("ix_invoice_packages_package_number"), table_name="invoice_packages")
    op.drop_index(op.f("ix_invoice_packages_id"), table_name="invoice_packages")
    op.drop_table("invoice_packages")
