# Invoice Rebuild Plan
> Last updated: 2026-04-28

Plan changed: the active invoice workflow is now the **client profile invoice generator**. The standalone invoice/invoice-package section is removed from the main UI to avoid duplicate workflows.

Current implementation status:

- Stage 0 cleanup is available as `backend/scripts/cleanup_seeded_invoices.py` and now targets only old seeded invoice numbers like `PI-2026-0001`, not active client-profile invoices like `PI-JO0001-2026-0001`.
- Client profile invoices remain active through `backend/app/api/v1/invoices.py`.
- Standalone `/invoices` UI routes now redirect to `/clients`.
- The invoice-package frontend pages, service, and API route were removed from the active application surface.
- Invoice-package tables/models may remain in the database for existing stored records, but staff should not use them as a working section.
- Container cargo lines should link/import normal client invoices through `invoice_id`.

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

Before rebuilding or testing cleanup:

1. Backup/export the current invoice tables if needed.
2. Delete only old seeded/sample invoice records that match the old seed number format.
3. Delete only invoice item records that belong to those seeded invoices.
4. Keep this cleanup separate from other container/customs/accounting changes so bugs are easier to find.

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
- The cleanup script is a dry run by default and should not be used to remove active client invoices.

---

## Stage 1 — New Clean Database

Earlier work created internal package tables. After the plan change, those tables are kept only as stored/internal records unless we later decide to migrate them or remove them with a dedicated cleanup migration.

```text
invoice_packages
invoice_package_items
invoice_documents
invoice_files
invoice_activity_log
```

Current main rule:

```text
Client profile invoice = source of truth
PI / CI / PL / SC = invoice types generated from the client profile
```

---

## Stage 2 — New Backend API

The package-first API is no longer active in the application router. The active invoice API is:

```text
GET    /api/v1/invoices
POST   /api/v1/invoices
GET    /api/v1/invoices/{id}
PATCH  /api/v1/invoices/{id}
DELETE /api/v1/invoices/{id}
GET    /api/v1/invoices/{id}/pdf
POST   /api/v1/invoices/{id}/stamp
POST   /api/v1/invoices/{id}/background
POST   /api/v1/invoices/import-excel
```

The client profile uses this API directly.

---

## Stage 3 — Active Client Profile UI

The active invoice UI lives inside each client profile:

```text
Client Profile
  -> invoices panel
  -> create/edit invoice modal
  -> invoice items
  -> packing/shipping fields
  -> PDF preview/download
  -> stamp/background upload
```

The standalone invoice section was removed from the main navigation to avoid duplicate workflows.

Current UI status:

- `/clients/{id}` is the place to create, edit, download, and delete invoices.
- `/invoices`, `/invoices/{id}`, and `/invoices/{id}/edit` redirect to `/clients`.
- Deleted standalone package pages are not part of the active UI.

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

- Generated client invoices can now be downloaded as print-ready PDFs in English or Arabic.
- The PDF renderer uses invoice items, invoice shipping fields, linked client/manual buyer, company settings, stamp, and optional document background.

---

## Stage 5 — Connections To Other Sections

Use `invoice_id` wherever another section needs client invoice data:

```text
booking_cargo_lines -> invoice_id
customs_estimates -> invoice_id
accounting_entries -> invoice_id
```

Containers should read:

- Client
- Goods/items
- Packing list values
- Uploaded documents
- Client invoice records

Current status:

- Container client cargo lines expose `invoice_id` and invoice number.
- The cargo edit form can select a matching client invoice and import its item rows into the cargo goods list.
- Invoice package creation/selection was removed from the container UI.

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
- Linked invoice/document number

---

## Stage 6 — Shop Order Connection

When a website customer buys through the shop later:

```text
shop customer/order
  -> internal client
  -> shop order record
  -> staff creates/updates client invoice from client profile when needed
```

Current status:

- `shop_orders` and `shop_order_items` store website order requests.
- `POST /api/v1/shop/orders?token=...` creates a shop order request.
- `GET /api/v1/shop/orders?token=...` lists the customer shop orders.
- The shop product page can submit an order request from a logged-in shop customer.
- If the shop customer email already exists as an internal client, staff can use that client profile to generate PI / CI / PL / SC.

---

## Stage 7 — Old System Cleanup

Cleanup rule:

1. Keep the client-profile invoice generator.
2. Keep old stored records readable only if needed.
3. Do not expose the standalone package section in the UI.
4. Drop internal package tables only in a future dedicated migration if nothing still references them.

Current status:

- `/invoices`, `/invoices/{id}`, and `/invoices/{id}/edit` redirect to `/clients`.
- Client invoices are created, edited, previewed, downloaded, and deleted inside the client profile.
- Legacy client invoice API/tables remain active because they are the working client invoice generator.

---

## Arabic Summary / ملخص عربي

بعد تغيير الخطة، النظام الفعلي يعتمد على فكرة:

```text
فاتورة العميل تدار من داخل ملف العميل
والفاتورة نفسها يمكن أن تكون PI / CI / PL / SC
ولا يوجد قسم فواتير مستقل في القائمة الرئيسية
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
