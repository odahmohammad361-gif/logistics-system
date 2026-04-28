# System Tree And Connection Map
> Last updated: 2026-04-28
> Purpose: explain how the business sections connect so development changes can be followed after each pull/commit.

This is not a user manual. It is the mental map of the system: which section owns the data, which section reads it, and what must stay connected.

---

## English

### 1. Application Tree

```text
Logistics System
├── Dashboard
│   └── Shows quick operational/accounting summaries.
│
├── Clients
│   ├── Internal client profile
│   ├── Client barcode/code
│   ├── Portal password
│   ├── Related invoices
│   ├── Related container cargo lines
│   └── Related accounting entries
│
├── Accounting
│   ├── Money In / Money Out ledger
│   ├── Receipts and invoice attachments
│   ├── Bank statement upload
│   ├── Bank line matching
│   └── Reports / CSV export
│
├── Invoices
│   ├── Invoice package cards
│   ├── Package profile
│   ├── PI / CI / PL / SC / CO / B/L documents
│   ├── Package item snapshots
│   ├── Optional product source link
│   ├── Container cargo links
│   ├── Shop order links
│   └── PDF export
│
├── Containers
│   ├── Booking card and profile
│   ├── LCL / FCL / AIR mode
│   ├── Selected shipping agent current rate
│   ├── Port, vessel, B/L, AWB, warehouse, ETD/ETA
│   ├── Client cargo lines
│   │   ├── Client link
│   │   ├── Optional linked invoice
│   │   ├── Goods list / OCR extracted goods
│   │   ├── Cargo photos
│   │   ├── Uploaded PL / PI / CI / SC / CO / B/L / approvals / other files
│   │   ├── Clearance through us or external/manual broker
│   │   └── Clearance agent rate selection
│   ├── Loading info and loading photos
│   ├── Freight share calculation
│   ├── Customs estimate link
│   └── Container archive ZIP
│
├── Shipping Agents
│   ├── Agent cards
│   ├── Agent profile
│   ├── Current carrier rates
│   │   ├── Sea FCL by 20GP / 40GP / 40HQ
│   │   ├── LCL per CBM by container size
│   │   ├── Air carrier per kg offers
│   │   ├── POL / POD / warehouse
│   │   ├── Effective / expiry / sealing / vessel dates
│   │   └── Origin fees: loading, B/L, trucking, other
│   ├── Expired weekly price history
│   ├── Contracts/files
│   └── Edit log
│
├── Clearance Agents
│   ├── Agent cards
│   ├── Agent profile
│   ├── Permanent clearance quote entries
│   │   ├── Sea or air
│   │   ├── Country and port/airport
│   │   ├── Container size
│   │   ├── Carrier
│   │   ├── Clearance fee
│   │   ├── Transportation/route
│   │   ├── Delivery authorization
│   │   ├── Inspection ramp and port inspection
│   │   └── Import/export card percent
│   └── Edit log
│
├── Tax & Customs Calculator
│   ├── Estimate header
│   ├── Product/HS/invoice/container cargo import
│   ├── Product lines
│   ├── Customs unit basis and quantity
│   ├── Product customs value
│   ├── Shipping allocation
│   ├── Duty/tax/other tax calculations
│   └── Saved estimate history
│
├── HS & Customs References
│   ├── HS code list by country
│   ├── Customs description Arabic/English
│   ├── Customs unit basis: dozen/piece/kg/carton/etc.
│   ├── Customs unit quantity: pieces per dozen/carton/unit
│   ├── Estimated customs value in USD
│   ├── Duty, sales tax, other tax percentages
│   ├── Import allowed flag
│   └── Product/product type links
│
├── Market
│   ├── Currency rates
│   ├── Agent quick prices
│   ├── Top clients
│   └── Public TV board
│
├── Products
│   ├── Product list for internal/shop use
│   ├── Product taxonomy
│   │   ├── Main category
│   │   ├── Subcategory/frame
│   │   └── Product type
│   ├── Supplier link
│   ├── HS reference link
│   ├── Packing/carton defaults
│   ├── Product photos
│   └── Public shop visibility
│
├── Suppliers
│   └── Supplier records used by products and accounting.
│
├── Company
│   ├── Company identity
│   ├── Default bank details
│   ├── Logo
│   └── Stamp
│
├── Warehouses
│   ├── Loading warehouses
│   └── Unloading warehouses
│
├── Users
│   ├── Staff accounts
│   └── Roles and branch assignment
│
└── Public Shop / Client Portal
    ├── Public product browsing
    ├── Website customer signup/login
    ├── Shop order request from product page
    ├── Shop order creates invoice package
    ├── Public shipping calculator
    ├── Client portal login
    ├── Client invoice view
    └── Client shipment view
```

---

### 2. Main Connection Map

```text
PRODUCT FOUNDATION
  suppliers
    -> products
      -> product_photos
      -> hs_code_references
  product_main_categories
    -> product_subcategories
      -> product_types
        -> hs_code_references

INVOICE FOUNDATION
  clients
    -> invoice_packages
      -> invoice_package_items
        -> products / hs_code_references (optional source)
      -> invoice_documents
      -> invoice_files
  customers
    -> shop_orders
      -> shop_order_items
      -> invoice_packages
  legacy invoices
    -> invoice_items

FREIGHT FOUNDATION
  shipping_agents
    -> agent_carrier_rates
      -> bookings
    -> agent_price_history
    -> agent_contracts
    -> agent_edit_log

CONTAINER OPERATIONS
  bookings
    -> booking_cargo_lines
      -> clients
      -> invoice_packages
      -> legacy invoices
      -> booking_cargo_documents
      -> booking_cargo_images
      -> clearance_agents
      -> clearance_agent_rates
      -> customs_estimates
    -> booking_loading_photos
    -> company_warehouses

CLEARANCE FOUNDATION
  clearance_agents
    -> clearance_agent_rates
    -> clearance_agent_edit_log

CUSTOMS FOUNDATION
  hs_code_references
    -> products/product_types
    -> customs_estimate_lines
  customs_estimates
    -> clients/invoices/bookings/booking_cargo_lines

ACCOUNTING FOUNDATION
  accounting_entries
    -> clients
    -> invoices
    -> bookings
    -> shipping_agents
    -> clearance_agents
    -> suppliers
    -> accounting_attachments
  bank_statement_imports
    -> bank_statement_lines
      -> accounting_entries
```

---

### 3. Operational Flow

#### A. Product to invoice to container

```text
Product/HS setup
  -> Product selected in invoice package or shop order
  -> Invoice package item saves a snapshot
  -> Container client cargo line can link invoice package
  -> Cargo goods list can import invoice package item data
  -> Customs calculator can import cargo/invoice goods
```

The package item keeps its own saved text and numbers. Product changes later do not rewrite old package documents.

#### A2. Shop order to invoice package

```text
Website customer login
  -> Product page order request
  -> shop_orders / shop_order_items
  -> invoice_packages with source_type = shop_order
  -> PI / CI / PL / SC can be generated from the package
  -> Container cargo line can link the same package later
```

#### B. Shipping agent to container

```text
Shipping agent profile
  -> Current carrier rate
  -> New booking selects that rate
  -> Booking stores rate snapshot values
  -> ETD can follow vessel date from selected carrier rate
  -> Client freight share uses selling freight basis
```

Current carrier rates are active operational data. Expired offers move to price history.

#### C. Clearance agent to container cargo

```text
Clearance agent profile
  -> Permanent clearance rates
  -> Cargo line chooses clearance through us
  -> Rate matches by destination country + mode + container size + carrier
  -> Clearance price becomes part of future final cost equation
```

If clearance is external/manual, the cargo line stores manual broker name/phone/notes.

#### D. Uploaded documents to goods list

```text
Cargo line documents
  -> Upload PL / invoice / B/L / approvals / other
  -> System previews files
  -> Extraction reads goods/packing and B/L identifiers
  -> Extracted goods become editable list
  -> Container archive exports originals and snapshots
```

OCR/extraction should not change destination, country, port, or routing from sample files.

#### E. Customs calculator to accounting

```text
HS reference + goods packing + shipping allocation
  -> Customs estimate
  -> Estimated duty/tax/other tax
  -> Later: connect final amount into accounting and client cost equation
```

Customs unit quantity is important here. Example: if `dozen = 12`, then `240 pieces = 20 customs units`.

#### F. Accounting as company base

```text
Money received or paid
  -> Accounting entry
  -> Optional source links
  -> Receipt/invoice attachment
  -> Bank statement import
  -> Match bank line to entry
  -> Reports by day/week/month/client/section
```

Accounting should become the human-accountant-style source for company money movement.

---

### 4. Source Files By Section

| Section | Frontend | Backend API | Main models |
| --- | --- | --- | --- |
| Clients | `frontend/src/pages/Clients/` | `backend/app/api/v1/clients.py` | `client.py` |
| Accounting | `frontend/src/pages/Accounting/` | `backend/app/api/v1/accounting.py` | `accounting.py` |
| Invoices | `frontend/src/pages/InvoicePackages/`, legacy `frontend/src/pages/Invoices/` | `backend/app/api/v1/invoice_packages.py`, legacy `invoices.py` | `invoice_package.py`, legacy `invoice.py` |
| Shop Orders | `frontend/src/pages/Shop/` | `backend/app/api/v1/shop.py` | `shop_order.py`, `customer.py`, `invoice_package.py` |
| Containers | `frontend/src/pages/Containers/`, `frontend/src/components/booking/` | `backend/app/api/v1/bookings.py` | `booking.py` |
| Shipping Agents | `frontend/src/pages/ShippingAgents/` | `backend/app/api/v1/shipping_agents.py` | `shipping_agent.py`, `shipping_quote.py` |
| Clearance Agents | `frontend/src/pages/ClearanceAgents/` | `backend/app/api/v1/clearance_agents.py` | `clearance_agent.py` |
| Tax & Customs | `frontend/src/pages/CustomsCalculator/` | `backend/app/api/v1/customs_calculator.py` | `customs_calculator.py` |
| HS & Customs | `frontend/src/pages/CustomsReferences/` | `backend/app/api/v1/customs_references.py` | `product.py` / `HSCodeReference` |
| Products | `frontend/src/pages/Products/`, `frontend/src/pages/Shop/` | `backend/app/api/v1/products.py`, `shop.py` | `product.py`, `supplier.py`, `customer.py` |
| Company/Warehouses | `frontend/src/pages/Company/`, `frontend/src/pages/Warehouses/` | `company.py`, `warehouses.py` | `company_settings.py`, `company_warehouse.py` |
| Users | `frontend/src/pages/Users/` | `users.py`, `auth.py` | `user.py`, `branch.py` |

---

### 5. How To Follow Partner Changes

After someone pushes:

```bash
git pull
git log -1 --oneline
git status --short
```

Then check what changed:

```bash
git show --stat --oneline HEAD
rg "__tablename__|ForeignKey\\(" backend/app/models
rg "include_router|Route path=" backend/app/main.py frontend/src/App.tsx
```

Update docs when any of these changed:
- A new DB table or column.
- A new API prefix or frontend page.
- A changed connection between sections.
- A changed delete/archive rule.
- A changed pricing/customs/accounting equation.

---

## العربية

### 1. شجرة التطبيق

```text
نظام اللوجستيك
├── لوحة التحكم
│   └── ملخصات تشغيلية وحسابية سريعة.
│
├── العملاء
│   ├── ملف العميل الداخلي
│   ├── كود/باركود العميل
│   ├── كلمة مرور البوابة
│   ├── الفواتير المرتبطة
│   ├── بضائع العميل داخل الحاويات
│   └── القيود المالية المرتبطة
│
├── الحسابات
│   ├── قبض ودفع
│   ├── مرفقات إيصالات وفواتير
│   ├── رفع كشف البنك
│   ├── مطابقة حركات البنك
│   └── تقارير وتصدير CSV
│
├── الفواتير
│   ├── بطاقات ملفات الفواتير
│   ├── ملف فاتورة يحتوي PI / CI / PL / SC / CO / B/L
│   ├── أصناف ملف الفاتورة كنسخة محفوظة
│   ├── رابط اختياري للمنتج الأصلي
│   ├── رابط بضائع الحاوية
│   ├── رابط طلب المتجر
│   └── تصدير PDF
│
├── الحاويات
│   ├── بطاقة الحجز وملف الحاوية
│   ├── LCL / FCL / AIR
│   ├── سعر وكيل الشحن المختار
│   ├── الميناء، السفينة، B/L، AWB، المستودع، ETD/ETA
│   ├── بضائع العملاء
│   │   ├── رابط العميل
│   │   ├── فاتورة مرتبطة إن وجدت
│   │   ├── قائمة البضاعة أو بيانات OCR
│   │   ├── صور البضاعة
│   │   ├── ملفات PL / PI / CI / SC / CO / B/L / الموافقات / أخرى
│   │   ├── التخليص عن طريقنا أو وكيل خارجي/يدوي
│   │   └── اختيار سعر وكيل التخليص
│   ├── معلومات وصور التحميل
│   ├── حصة العميل من الشحن
│   ├── ربط تقدير الجمارك
│   └── أرشيف ZIP للحاوية
│
├── وكلاء الشحن
│   ├── بطاقات الوكلاء
│   ├── ملف الوكيل
│   ├── أسعار الناقلين الحالية
│   │   ├── FCL بحجم 20GP / 40GP / 40HQ
│   │   ├── LCL لكل CBM حسب حجم الحاوية
│   │   ├── عروض الشحن الجوي لكل كغ
│   │   ├── ميناء التحميل والتفريغ والمستودع
│   │   ├── تاريخ الفعالية والانتهاء والإغلاق ومغادرة السفينة
│   │   └── رسوم المنشأ: تحميل، B/L، نقل، أخرى
│   ├── تاريخ الأسعار المنتهية
│   ├── العقود والملفات
│   └── سجل التعديلات
│
├── وكلاء التخليص
│   ├── بطاقات الوكلاء
│   ├── ملف الوكيل
│   ├── أسعار تخليص دائمة
│   │   ├── بحري أو جوي
│   │   ├── الدولة والميناء أو المطار
│   │   ├── حجم الحاوية
│   │   ├── الناقل
│   │   ├── رسوم التخليص
│   │   ├── النقل/المسار
│   │   ├── إذن التسليم
│   │   ├── رمبة ومعاينة الميناء
│   │   └── نسبة بطاقة المستورد/المصدر
│   └── سجل التعديلات
│
├── حاسبة الجمارك
│   ├── رأس التقدير
│   ├── استيراد من منتج/HS/فاتورة/بضاعة حاوية
│   ├── بنود المنتجات
│   ├── أساس وحدة الجمارك وكميتها
│   ├── قيمة المنتج الجمركية
│   ├── توزيع الشحن
│   ├── حساب الجمرك والضريبة والضرائب الأخرى
│   └── سجل التقديرات المحفوظة
│
├── HS والجمارك
│   ├── قائمة HS حسب الدولة
│   ├── وصف جمركي عربي/إنجليزي
│   ├── أساس الوحدة: دزينة/قطعة/كغ/كرتون/إلخ
│   ├── كمية الوحدة: عدد القطع داخل الدزينة/الكرتون/الوحدة
│   ├── القيمة الجمركية بالدولار
│   ├── نسب الجمرك والضريبة والضرائب الأخرى
│   ├── السماح بالاستيراد
│   └── ربط المنتج ونوع المنتج
│
├── السوق
│   ├── أسعار العملات
│   ├── أسعار سريعة للوكلاء
│   ├── أفضل العملاء
│   └── شاشة عامة
│
├── المنتجات
│   ├── قائمة المنتجات للداخل والمتجر
│   ├── التصنيف
│   │   ├── فئة رئيسية
│   │   ├── إطار/فئة فرعية
│   │   └── نوع المنتج
│   ├── رابط المورد
│   ├── رابط HS
│   ├── بيانات التغليف والكرتون
│   ├── صور المنتجات
│   └── الظهور في المتجر
│
├── الموردين
│   └── سجلات الموردين المستخدمة في المنتجات والحسابات.
│
├── الشركة
│   ├── بيانات الشركة
│   ├── الحساب البنكي الافتراضي
│   ├── الشعار
│   └── الختم
│
├── المستودعات
│   ├── مستودعات تحميل
│   └── مستودعات تفريغ
│
├── المستخدمين
│   ├── حسابات الموظفين
│   └── الأدوار والفروع
│
└── المتجر العام / بوابة العميل
    ├── تصفح المنتجات
    ├── تسجيل ودخول عميل الموقع
    ├── إنشاء طلب من صفحة المنتج
    ├── الطلب ينشئ ملف فاتورة
    ├── حاسبة شحن عامة
    ├── دخول بوابة العميل
    ├── عرض فواتير العميل
    └── عرض شحنات العميل
```

---

### 2. خريطة الربط الرئيسية

```text
أساس المنتجات
  الموردين
    -> المنتجات
      -> صور المنتجات
      -> مراجع HS والجمارك
  الفئات الرئيسية
    -> الفئات الفرعية
      -> أنواع المنتجات
        -> مراجع HS والجمارك

أساس الفواتير
  العملاء الداخليين
    -> ملفات الفواتير
      -> أصناف ملف الفاتورة
      -> المستندات والملفات
  عملاء الموقع
    -> طلبات المتجر
      -> أصناف طلب المتجر
      -> ملفات الفواتير
  الفواتير القديمة
    -> أصناف الفواتير القديمة

أساس الشحن
  وكلاء الشحن
    -> أسعار الناقلين الحالية
      -> الحاويات
    -> تاريخ الأسعار
    -> العقود
    -> سجل التعديل

تشغيل الحاويات
  الحاويات
    -> بضائع العملاء
      -> العملاء
      -> ملفات الفواتير
      -> الفواتير القديمة
      -> المستندات
      -> الصور
      -> وكلاء التخليص
      -> أسعار التخليص
      -> تقديرات الجمارك
    -> صور التحميل
    -> المستودعات

أساس التخليص
  وكلاء التخليص
    -> أسعار التخليص
    -> سجل التعديل

أساس الجمارك
  مراجع HS والجمارك
    -> المنتجات وأنواع المنتجات
    -> بنود تقدير الجمارك
  تقديرات الجمارك
    -> العملاء / الفواتير / الحاويات / بضائع العملاء

أساس الحسابات
  القيود المالية
    -> العملاء
    -> الفواتير
    -> الحاويات
    -> وكلاء الشحن
    -> وكلاء التخليص
    -> الموردين
    -> المرفقات
  كشوف البنك
    -> حركات البنك
      -> القيود المالية
```

---

### 3. مسارات التشغيل

#### أ. من المنتج إلى الفاتورة إلى الحاوية

```text
إعداد المنتج و HS
  -> اختيار المنتج في الفاتورة
  -> صنف الفاتورة يحفظ نسخة مستقلة
  -> بضاعة العميل في الحاوية يمكن أن ترتبط بالفاتورة
  -> قائمة البضاعة يمكن أن تستورد أصناف الفاتورة
  -> حاسبة الجمارك يمكن أن تستورد بيانات الفاتورة أو البضاعة
```

#### ب. من وكيل الشحن إلى الحاوية

```text
ملف وكيل الشحن
  -> سعر ناقل حالي
  -> الحجز الجديد يختار السعر
  -> الحاوية تحفظ لقطة من السعر
  -> تاريخ المغادرة يمكن أن يتبع تاريخ السفينة من السعر المختار
  -> حصة العميل من الشحن تعتمد على سعر البيع
```

#### ج. من وكيل التخليص إلى بضاعة العميل

```text
ملف وكيل التخليص
  -> أسعار دائمة
  -> بضاعة العميل تختار التخليص عن طريقنا
  -> السعر يطابق الدولة + نوع الشحن + حجم الحاوية + الناقل
  -> سعر التخليص يدخل لاحقا في معادلة التكلفة النهائية
```

#### د. من الملفات المرفوعة إلى قائمة البضاعة

```text
ملفات بضاعة العميل
  -> رفع PL / invoice / B/L / approvals / other
  -> معاينة الملف داخل النظام
  -> استخراج البضاعة والتغليف وأرقام B/L
  -> النتائج تصبح قائمة قابلة للتعديل
  -> أرشيف الحاوية يصدر الملفات الأصلية والنسخ المحفوظة
```

استخراج OCR لا يجب أن يغير الدولة أو الوجهة أو الميناء أو مسار الحاوية من ملفات عينة.

#### هـ. من حاسبة الجمارك إلى الحسابات

```text
مرجع HS + التغليف + توزيع الشحن
  -> تقدير جمركي
  -> جمرك وضريبة وتكاليف أخرى
  -> لاحقا: ربط المبلغ النهائي بالحسابات ومعادلة تكلفة العميل
```

كمية وحدة الجمارك مهمة هنا. مثال: إذا كانت الدزينة = 12، فإن 240 قطعة = 20 وحدة جمركية.

#### و. الحسابات كأساس للشركة

```text
قبض أو دفع
  -> قيد مالي
  -> روابط اختيارية للمصدر
  -> مرفق إيصال/فاتورة
  -> رفع كشف البنك
  -> مطابقة حركة البنك مع القيد
  -> تقارير يومية/أسبوعية/شهرية/حسب العميل/حسب القسم
```

---

### 4. ملفات الكود حسب القسم

| القسم | الواجهة | API | الجداول الرئيسية |
| --- | --- | --- | --- |
| العملاء | `frontend/src/pages/Clients/` | `backend/app/api/v1/clients.py` | `client.py` |
| الحسابات | `frontend/src/pages/Accounting/` | `backend/app/api/v1/accounting.py` | `accounting.py` |
| الفواتير | `frontend/src/pages/InvoicePackages/` | `backend/app/api/v1/invoice_packages.py`, legacy `invoices.py` | `invoice_package.py`, legacy `invoice.py` |
| المتجر | `frontend/src/pages/Shop/` | `backend/app/api/v1/shop.py` | `customer.py`, `shop_order.py`, `invoice_package.py` |
| الحاويات | `frontend/src/pages/Containers/` | `backend/app/api/v1/bookings.py` | `booking.py` |
| وكلاء الشحن | `frontend/src/pages/ShippingAgents/` | `backend/app/api/v1/shipping_agents.py` | `shipping_agent.py`, `shipping_quote.py` |
| وكلاء التخليص | `frontend/src/pages/ClearanceAgents/` | `backend/app/api/v1/clearance_agents.py` | `clearance_agent.py` |
| حاسبة الجمارك | `frontend/src/pages/CustomsCalculator/` | `backend/app/api/v1/customs_calculator.py` | `customs_calculator.py` |
| HS والجمارك | `frontend/src/pages/CustomsReferences/` | `backend/app/api/v1/customs_references.py` | `product.py` |
| المنتجات | `frontend/src/pages/Products/`, `frontend/src/pages/Shop/` | `products.py`, `shop.py` | `product.py`, `supplier.py`, `customer.py` |
| الشركة والمستودعات | `frontend/src/pages/Company/`, `frontend/src/pages/Warehouses/` | `company.py`, `warehouses.py` | `company_settings.py`, `company_warehouse.py` |
| المستخدمون | `frontend/src/pages/Users/` | `users.py`, `auth.py` | `user.py`, `branch.py` |

---

### 5. متابعة تغييرات الشريك

بعد أي سحب من Git:

```bash
git pull
git log -1 --oneline
git status --short
```

ثم افحص ما تغير:

```bash
git show --stat --oneline HEAD
rg "__tablename__|ForeignKey\\(" backend/app/models
rg "include_router|Route path=" backend/app/main.py frontend/src/App.tsx
```

حدث هذه المستندات إذا تغير:
- جدول أو عمود في قاعدة البيانات.
- API جديد أو صفحة جديدة.
- ربط جديد بين الأقسام.
- قاعدة حذف أو أرشفة.
- معادلة أسعار أو جمارك أو حسابات.
