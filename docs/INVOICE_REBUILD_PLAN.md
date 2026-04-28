# Invoice Rebuild Plan
> Last updated: 2026-04-28

The invoice system should be rebuilt as an **Invoice Package** system. Old seeded invoice samples are not important and can be cleaned before/while the rebuild starts.

Current implementation status:

- Stage 0 cleanup is available as `backend/scripts/cleanup_seeded_invoices.py`.
- Stage 1 database foundation is added through the invoice package migration.
- Stage 2 package-first backend API is started at `/api/v1/invoice-packages`.
- Stage 3 UI replacement is started: `/invoices` now opens invoice package cards and `/invoices/{id}` opens the package profile.
- Stage 4 document generation now has package PDF download output for package documents.
- Stage 5 container cargo connection is started: client cargo lines can link invoice packages and import package items.
- Stage 6 shop order connection is started: shop product orders create shop order records and invoice packages.
- Stage 7 legacy invoice UI cleanup is started: old invoice edit route now redirects away from the legacy form.

---

## Goal

Make invoices simple, understandable, and connected to:

- Clients
- Website shop orders
- Products and HS/customs references
- Containers and client cargo lines
- Clearance agent work
- Customs calculator
- Accounting entries and payments
- Uploaded external files such as PI, CI, PL, SC, CO, B/L, receipts, and other documents

---

## Stage 0 — Backup And Clean Old Seed Samples

Before rebuilding:

1. Backup/export the current invoice tables if needed.
2. Delete old seeded/sample invoice records.
3. Delete old seeded/sample invoice item records.
4. Keep this cleanup separate from the new invoice package migration so bugs are easier to find.

Current old tables to clean:

```text
invoices
invoice_items
```

If old files were uploaded for seeded invoices, also review:

```text
backend/uploads/stamps
backend/uploads/backgrounds
backend/uploads/invoice_items
```

Important:
- Do not delete real client/container/accounting records during invoice cleanup.
- If a container or accounting row references an old invoice, clear or migrate the reference first.

---

## Stage 1 — New Clean Database

Create new invoice package foundation. Initial tables are now added:

```text
invoice_packages
invoice_package_items
invoice_documents
invoice_files
invoice_activity_log
```

Main rule:

```text
Invoice Package = the case file
PI / CI / PL / SC / CO / B/L = documents inside the package
```

---

## Stage 2 — New Backend API

New API should be package-first. Initial endpoints are now added:

```text
GET    /api/v1/invoice-packages
POST   /api/v1/invoice-packages
GET    /api/v1/invoice-packages/{id}
PATCH  /api/v1/invoice-packages/{id}
POST   /api/v1/invoice-packages/{id}/items
PATCH  /api/v1/invoice-packages/{id}/items/{item_id}
DELETE /api/v1/invoice-packages/{id}/items/{item_id}
POST   /api/v1/invoice-packages/{id}/documents/generate
GET    /api/v1/invoice-packages/{id}/documents/{document_id}/pdf
POST   /api/v1/invoice-packages/{id}/files
```

Old invoice API can stay temporarily, but the new UI should stop depending on the old large form.

---

## Stage 3 — New UI

Replace the current complicated create/edit modal with:

```text
Invoice Packages Page
  -> cards/table
  -> filters by client, source, status, document type

Invoice Package Profile
  -> Overview
  -> Client
  -> Items
  -> Packing
  -> Shipping
  -> Documents
  -> Files/OCR
  -> Accounting
  -> History
```

Use simple table-style item editing instead of one huge form.

Initial UI status:

- `/invoices` shows invoice package cards with source/status/client/totals.
- `/invoices/{id}` shows profile tabs for overview, items, shipping, documents, files, accounting, and history.
- The old legacy invoice edit page still exists for compatibility while the package UI is completed.

---

## Stage 4 — Document Codes And Translations

Database stores stable document codes:

```text
PI
CI
PL
SC
CO
BL
OTHER
```

English UI:

```text
PI = Proforma Invoice
CI = Commercial Invoice
PL = Packing List
SC = Sales Contract
CO = Certificate of Origin
BL = Bill of Lading
```

Arabic UI:

```text
PI = فاتورة مبدئية
CI = فاتورة تجارية
PL = قائمة تعبئة
SC = عقد بيع
CO = شهادة منشأ
BL = بوليصة شحن
```

Current status:

- Generated package document records can now be downloaded as print-ready PDFs in English or Arabic.
- The PDF renderer uses the invoice package items, package shipping fields, linked client/manual buyer, and company settings.

---

## Stage 5 — Connections To Other Sections

Use `invoice_package_id` wherever another section needs invoice data:

```text
booking_cargo_lines -> invoice_package_id
customs_estimates -> invoice_package_id
accounting_entries -> invoice_package_id
shop orders later -> invoice_package_id
```

Containers should read:

- Client
- Goods/items
- Packing list values
- Uploaded documents
- Invoice package files

Current status:

- Container client cargo lines expose `invoice_package_id` and package number/status.
- A container cargo card can create a linked invoice package directly when none exists.
- The cargo edit form can select a matching invoice package and import its item rows into the cargo goods list.
- The cargo card links directly back to the package profile.
- Container ZIP export now includes linked invoice package JSON snapshots.

Customs and clearance should read:

- Goods description
- HS code / HS reference
- Quantity and customs unit
- Cartons, weights, CBM
- Product value

Accounting should read:

- Client
- Invoice total
- Payment status
- Receipts
- Linked package/document number

---

## Stage 6 — Shop Order Connection

When a website customer buys through the shop later:

```text
shop customer/order
  -> internal client
  -> invoice package
  -> PI first
  -> later CI / PL / SC from same package
```

Current status:

- `shop_orders` and `shop_order_items` store website order requests.
- `POST /api/v1/shop/orders?token=...` creates a shop order and an invoice package with source `shop_order`.
- `GET /api/v1/shop/orders?token=...` lists the customer shop orders.
- The shop product page can submit an order request from a logged-in shop customer.
- If the shop customer email already exists as an internal client, the invoice package links to that client; otherwise it is created as a manual buyer package.

---

## Stage 7 — Old System Cleanup

After the new package system works:

1. Hide old invoice create/edit UI.
2. Keep old records readable only if needed.
3. Migrate useful old records into packages if any are worth keeping.
4. Drop old invoice tables only after containers, customs, and accounting no longer rely on them.

Current status:

- `/invoices` and `/invoices/{id}` use the invoice package UI.
- `/invoices/{id}/edit` redirects to `/invoices` so staff do not enter the old large invoice editor by accident.
- Legacy invoice API/tables are still kept for reading and compatibility until the package system is fully tested.

---

## Arabic Summary / ملخص عربي

النظام الجديد يجب أن يعتمد على فكرة:

```text
ملف فاتورة واحد = Invoice Package
والملف يحتوي بداخله على PI / CI / PL / SC / CO / B/L
```

قبل البدء يجب تنظيف عينات الفواتير القديمة التي تم إدخالها من seed:

```text
invoices
invoice_items
```

ثم بناء النظام الجديد وربطه مع:

- العملاء
- المتجر
- المنتجات
- الحاويات
- التخليص
- حاسبة الجمارك
- الحسابات
- الملفات المرفوعة

الاختصارات تبقى في قاعدة البيانات كرموز ثابتة مثل `PI`, `CI`, `PL`, أما الواجهة تعرضها بالعربي في الصفحة العربية وبالإنجليزي في الصفحة الإنجليزية.
