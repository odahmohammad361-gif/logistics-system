#!/usr/bin/env python3
"""Clean old seeded/sample invoice records before the invoice package rebuild.

This intentionally targets the legacy invoice tables only:
    invoices
    invoice_items

It clears nullable references first so containers, accounting, and customs
estimates are not deleted by accident.

Dry run:
    python scripts/cleanup_seeded_invoices.py

Delete legacy invoice rows:
    python scripts/cleanup_seeded_invoices.py --yes

Also delete legacy uploaded invoice files:
    python scripts/cleanup_seeded_invoices.py --yes --delete-files
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.accounting import AccountingEntry
from app.models.booking import BookingCargoLine
from app.models.customs_calculator import CustomsEstimate
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.invoice_package import InvoiceDocument


UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")


def local_upload_path(value: str | None) -> str | None:
    if not value:
        return None
    full_path = value if os.path.isabs(value) else os.path.join(UPLOAD_DIR, value)
    full_path = os.path.abspath(full_path)
    upload_root = os.path.abspath(UPLOAD_DIR)
    if not full_path.startswith(upload_root):
        return None
    return full_path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--yes", action="store_true", help="Actually delete legacy invoice rows.")
    parser.add_argument("--delete-files", action="store_true", help="Delete legacy uploaded invoice files from disk.")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        invoices = db.query(Invoice).all()
        items = db.query(InvoiceItem).all()
        linked_cargo = db.query(BookingCargoLine).filter(BookingCargoLine.invoice_id.isnot(None)).count()
        linked_accounting = db.query(AccountingEntry).filter(AccountingEntry.invoice_id.isnot(None)).count()
        linked_estimates = db.query(CustomsEstimate).filter(CustomsEstimate.invoice_id.isnot(None)).count()
        linked_documents = db.query(InvoiceDocument).filter(InvoiceDocument.legacy_invoice_id.isnot(None)).count()

        print("Legacy invoice cleanup")
        print(f"  invoices: {len(invoices)}")
        print(f"  invoice_items: {len(items)}")
        print(f"  booking cargo invoice links to clear: {linked_cargo}")
        print(f"  accounting invoice links to clear: {linked_accounting}")
        print(f"  customs estimate invoice links to clear: {linked_estimates}")
        print(f"  package document legacy links to clear: {linked_documents}")

        if not args.yes:
            print("\nDry run only. Re-run with --yes to delete legacy invoices.")
            return

        file_paths: set[str] = set()
        if args.delete_files:
            for invoice in invoices:
                for value in (invoice.stamp_image_path, invoice.document_background_path):
                    path = local_upload_path(value)
                    if path:
                        file_paths.add(path)
            for item in items:
                path = local_upload_path(item.product_image_path)
                if path:
                    file_paths.add(path)

        db.query(BookingCargoLine).filter(BookingCargoLine.invoice_id.isnot(None)).update({"invoice_id": None}, synchronize_session=False)
        db.query(AccountingEntry).filter(AccountingEntry.invoice_id.isnot(None)).update({"invoice_id": None}, synchronize_session=False)
        db.query(CustomsEstimate).filter(CustomsEstimate.invoice_id.isnot(None)).update({"invoice_id": None}, synchronize_session=False)
        db.query(InvoiceDocument).filter(InvoiceDocument.legacy_invoice_id.isnot(None)).update({"legacy_invoice_id": None}, synchronize_session=False)
        db.query(InvoiceItem).delete(synchronize_session=False)
        db.query(Invoice).delete(synchronize_session=False)
        db.commit()

        deleted_files = 0
        if args.delete_files:
            for path in sorted(file_paths):
                if os.path.exists(path):
                    os.remove(path)
                    deleted_files += 1
            print(f"  deleted files: {deleted_files}")

        print("Done. Legacy invoice rows were cleaned.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
