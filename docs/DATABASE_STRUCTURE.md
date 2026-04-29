# Database Structure
> Last updated: 2026-04-30
> Source of truth: SQLAlchemy models in `backend/app/models/` plus Alembic migrations in `backend/alembic/versions/`.

This document is the working database map for the logistics system. It focuses on the tables that drive the current app, how they connect, and the rules that must stay clear when more people push changes.

---

## 1. Core Rules

| Rule | Meaning |
| --- | --- |
| `clients` and `customers` are different | `customers` are public website signups. Operational work uses `clients`. A customer must be migrated/created as a client before invoices, containers, and accounting can rely on them. |
| Invoices are snapshots | `invoice_items` may link to `products`, but saved invoice text/prices/packing stay independent so old invoices do not change when products are edited. |
| Containers are the operations hub | `bookings` connect shipping agent rates, clients, cargo lines, uploaded documents, clearance decisions, and later final cost equations. |
| HS/customs values live in HS references | New customs/tax logic should use `hs_code_references`. Legacy customs fields still exist on products/product types for compatibility. |
| Accounting links to source records | Money in/out can link to clients, invoices, containers, shipping agents, clearance agents, and suppliers. |
| USD is the working currency for customs/accounting stages | Multi-currency logic is intentionally deferred until the main sections are stable. |

---

## 2. Organization And Access

### `branches`
Branches identify the business side/location: Jordan, China, Iraq.

Key fields:
- `name`, `name_ar`, `code`, `country`
- `is_active`

Connections:
- `branches.id` -> `users.branch_id`
- `branches.id` -> `clients.branch_id`
- `branches.id` -> `bookings.branch_id`
- `branches.id` -> `company_warehouses.branch_id`
- `branches.id` -> `accounting_entries.branch_id`

### `users`
Staff login accounts and permissions.

Key fields:
- `full_name`, `full_name_ar`, `email`, `hashed_password`
- `role`: `super_admin`, `admin`, `branch_manager`, `staff`, `viewer`
- `branch_id`, `is_active`

Used by:
- Auth and protected admin pages.
- Audit fields such as `created_by_id`, `uploaded_by_id`, `changed_by_id`.

### `company_settings`
Single company profile used by invoices and company branding.

Key fields:
- Company identity: `name`, `name_ar`, `tagline`, `tagline_ar`
- Contact: `address`, `address_ar`, `phone`, `email`, `website`
- Default bank: `bank_account_name`, `bank_account_no`, `bank_swift`, `bank_name`, `bank_address`
- Assets: `logo_path`, `stamp_path`

Important:
- Invoices can override bank details and stamp/background per invoice.

### `company_warehouses`
Company loading/unloading warehouses.

Key fields:
- `name`, `name_ar`, `warehouse_type`: `loading` or `unloading`
- `country`, `city`, `address`, `contact_name`, `phone`
- `branch_id`, `is_active`

Connections:
- `company_warehouses.id` -> `bookings.loading_warehouse_id`
- `company_warehouses.id` -> `agent_carrier_rates.loading_warehouse_id`
- `company_warehouses.id` -> `agent_price_history.loading_warehouse_id`

---

## 3. People And Trading Parties

### `clients`
Internal business clients. These are the clients used in real operations.

Key fields:
- Identity: `client_code`, `name`, `name_ar`
- Contact: `phone`, `whatsapp`, `email`
- Address: `country`, `city`, `address`
- Business: `company_name`, `company_name_ar`, `tax_number`
- Assignment: `branch_id`, `created_by_id`
- Portal: `portal_password_hash`
- `is_active`, `notes`

Connections:
- `clients.id` -> `invoices.client_id`
- `clients.id` -> `shop_orders.client_id` when a website customer email matches an internal client
- `clients.id` -> `booking_cargo_lines.client_id`
- `clients.id` -> `shipping_quotes.client_id`
- `clients.id` -> `service_quotes.client_id`
- `clients.id` -> `customs_estimates.client_id`
- `clients.id` -> `accounting_entries.client_id`

Delete behavior:
- Client delete is guarded by usage checks. A client connected to invoices, containers, accounting, or estimates should not be removed in a way that breaks history.

### `customers`
Public website/customer portal signup records.

Key fields:
- `full_name`, `email`, `phone`, `telegram`, `country`
- `hashed_password`, `verification_token`
- `is_verified`, `is_active`, `notes`

Important:
- A `customer` is not automatically an operational `client`.
- Customer-to-client migration is handled through the customers API.
- Website shop orders are stored in `shop_orders`; staff can later manage the client invoice from the client profile.

### `suppliers`
Supplier/shop source records.

Key fields:
- `code`, `name`, `name_ar`
- `market_location`, `wechat_id`, `phone`
- `is_active`, `notes`

Connections:
- `suppliers.id` -> `products.supplier_id`
- `suppliers.id` -> `accounting_entries.supplier_id`

---

## 4. Products, Taxonomy, And HS References

### Product taxonomy tree

```text
product_main_categories
  -> product_subcategories
      -> product_types
          -> hs_code_references (optional default)
              -> products (optional direct reference)
```

### `product_main_categories`
Top-level categories, such as clothing, electronics, bags, furniture, home goods.

Key fields:
- `code`, `name`, `name_ar`, `description`
- `sort_order`, `is_active`

### `product_subcategories`
Category frame/subgroup, such as men, women, children, mobile accessories, kitchenware.

Key fields:
- `main_category_id`
- `code`, `name`, `name_ar`, `description`
- `sort_order`, `is_active`

### `product_types`
Specific product type, such as men's trousers, LED lamp, backpack.

Key fields:
- `main_category_id`, `subcategory_id`
- `hs_code_ref_id`
- `code`, `name`, `name_ar`, `description`
- Legacy/default customs fields: `default_customs_unit_basis`, `default_customs_estimated_value_usd`, `default_customs_duty_pct`, `default_sales_tax_pct`, `default_other_tax_pct`
- `sort_order`, `is_active`

Important:
- Active customs/tax values should come from `hs_code_references`.

### `hs_code_references`
Dedicated HS/customs reference table.

Key fields:
- `country`: Jordan, Iraq, or other country scope
- `hs_code`, `chapter`
- `description`, `description_ar`
- `customs_unit_basis`: `dozen`, `piece`, `kg`, `carton`, etc.
- `customs_unit_quantity`: how many pieces form one customs unit, such as 12 pcs per dozen or a custom carton/pack quantity
- `customs_estimated_value_usd`
- `customs_duty_pct`, `sales_tax_pct`, `other_tax_pct`
- `import_allowed`
- `source_url`, `notes`
- `effective_from`, `effective_to`
- `is_active`

Connections:
- `hs_code_references.id` -> `product_types.hs_code_ref_id`
- `hs_code_references.id` -> `products.hs_code_ref_id`
- Customs calculator matches by product link and/or HS code.

Delete behavior:
- Deleting an HS reference clears links from products and product types, then removes the HS row from the database. Historical invoice/cargo text remains unchanged.

### `products`
Internal product catalog and public shop products.

Key fields:
- Identity: `code`, `name`, `name_ar`, `category`
- Text: `description`, `description_ar`
- Links: `supplier_id`, `main_category_id`, `subcategory_id`, `product_type_id`, `hs_code_ref_id`
- Pricing: `price_cny`, `price_usd`
- Legacy customs: `hs_code`, `origin_country`, `customs_category`, `customs_unit_basis`, `customs_estimated_value_usd`, `customs_duty_pct`, `sales_tax_pct`, `other_tax_pct`, `customs_notes`
- Packing: `pcs_per_carton`, `cbm_per_carton`, `min_order_cartons`, `gross_weight_kg_per_carton`, `net_weight_kg_per_carton`, `carton_length_cm`, `carton_width_cm`, `carton_height_cm`
- Display: `is_featured`, `is_active`

Connections:
- `products.id` -> `product_photos.product_id`
- `products.id` -> `invoice_items.product_id` using `ON DELETE SET NULL`
- `products.id` -> `customs_estimate_lines.product_id`
- Product IDs may also appear inside cargo extracted goods JSON snapshots.

Delete behavior:
- Product delete is permanent for the product row and photos.
- Existing invoice item snapshots stay as saved text; their `product_id` is nullable.

### `product_photos`
Product images used by admin product page and public shop.

Key fields:
- `product_id`, `file_path`, `is_main`, `sort_order`, `uploaded_at`

---

## 5. Invoices

```text
clients -> invoices -> invoice_items -> products / hs_code_references
customers -> shop_orders -> shop_order_items -> products
stored/internal only: invoice_packages -> invoice_package_items / invoice_documents / invoice_files
```

### `invoice_packages`
Stored/internal package tables from the paused rebuild. They are not exposed as a standalone UI section now.
The active shop, booking, and frontend APIs no longer create or select invoice packages; these tables remain only so old stored rows do not break the database.

Key fields:
- `package_number`
- `source_type`: `manual`, `shop_order`, `external_upload`, `container_cargo`, etc.
- `status`
- Buyer: `client_id` or manual `buyer_name`
- Operational links: `booking_id`, `booking_cargo_line_id`
- Route/trade: `origin`, `destination`, `port_of_loading`, `port_of_discharge`, `shipping_term`, `payment_terms`, `shipping_marks`
- Transport refs: `container_no`, `seal_no`, `bl_number`, `vessel_name`, `voyage_number`, `awb_number`, `flight_number`
- Money: `currency`, `subtotal`, `discount`, `total`
- Audit: `branch_id`, `created_by_id`, `is_active`

Connections:
- `invoice_packages.id` -> `invoice_package_items.package_id`
- `invoice_packages.id` -> `invoice_documents.package_id`
- `invoice_packages.id` -> `invoice_files.package_id`
- `invoice_packages.id` -> `invoice_activity_log.package_id`
- `invoice_packages.id` -> `booking_cargo_lines.invoice_package_id`
- `invoice_packages.id` -> `customs_estimates.invoice_package_id`
- `invoice_packages.id` -> `accounting_entries.invoice_package_id`
- `invoice_packages.id` -> `shop_orders.invoice_package_id`
- `invoice_packages.id` -> legacy `invoices.package_id`

Rule:
- Keep existing package records for history/internal use only. Active staff invoice work happens in `invoices`.
- Existing foreign-key columns may remain in tables, but the active API surface should use `invoice_id` for client invoices.

### `shop_orders`
Website customer order requests.

Key fields:
- `order_number`
- `customer_id`, optional `client_id`
- `invoice_package_id` may exist as an old nullable/internal column, but new shop orders do not use it.
- `status`, `destination`, `currency`
- Totals: `subtotal_usd`, `total_cartons`, `total_pieces`, `total_cbm`, `total_gross_weight_kg`
- `notes`

### `shop_order_items`
Snapshot rows for products requested from the public shop.

Key fields:
- `order_id`, optional `product_id`
- Product snapshot: `product_code`, `product_name`, `product_name_ar`, `hs_code`
- `cartons`, `pcs_per_carton`, `quantity`
- `unit_price_usd`, `total_price_usd`
- `cbm`, `gross_weight_kg`, `net_weight_kg`

### `invoice_package_items`
Internal package item/goods table from the paused rebuild.

Key fields:
- `package_id`
- Optional references: `product_id`, `hs_code_ref_id`
- Description snapshots: `description`, `description_ar`, `details`, `details_ar`
- Customs snapshot: `hs_code`, `customs_unit_basis`, `customs_unit_quantity`
- Pricing: `quantity`, `unit`, `unit_price`, `total_price`
- Packing: `cartons`, `pcs_per_carton`, `gross_weight`, `net_weight`, `cbm`
- Air dimensions: `carton_length_cm`, `carton_width_cm`, `carton_height_cm`, `volumetric_weight_kg`, `chargeable_weight_kg`
- `source_product_snapshot_json`

### `invoice_documents`
Generated document records inside a package.

Key fields:
- `package_id`
- `document_type`: `PI`, `CI`, `PL`, `SC`, `CO`, `BL`, `OTHER`
- `document_number`
- `language`: `en` or `ar`
- `status`, `issue_date`, `due_date`, `pdf_path`
- Optional `legacy_invoice_id` while old invoice records still exist

### `invoice_files`
Uploaded external files inside a package.

Key fields:
- `package_id`, optional `document_id`
- `document_type`, `custom_file_type`
- `file_path`, `original_filename`, `content_type`, `file_size`
- `extraction_status`, `extraction_json`
- `uploaded_by_id`

### `invoice_activity_log`
Audit trail for package edits.

Key fields:
- `package_id`, `action`, `summary`, `changed_by_id`, `created_at`

### `invoices`
Active client-profile PI, CI, PL, SC, price offer, and manual invoice records.

Key fields:
- `package_id` optional stored/internal link from the paused package rebuild
- `invoice_number`, `invoice_type`: `price_offer`, `PI`, `CI`, `PL`, `SC`
- `status`: `draft`, `sent`, `approved`, `paid`, `cancelled`, `dummy`
- Buyer: `client_id` or manual `buyer_name`
- Dates: `issue_date`, `due_date`
- Trade: `origin`, `payment_terms`, `shipping_term`, `port_of_loading`, `port_of_discharge`, `shipping_marks`
- Shipping refs copied/saved on invoice: `container_no`, `seal_no`, `bl_number`, `vessel_name`, `voyage_number`
- Money: `subtotal`, `discount`, `total`, `currency`
- Bank override: `bank_account_name`, `bank_account_no`, `bank_swift`, `bank_name`, `bank_address`
- Assets: `stamp_image_path`, `stamp_position`, `document_background_path`
- Audit: `created_by_id`, `branch_id`

Connections:
- `invoices.id` -> `invoice_items.invoice_id`
- `invoices.id` -> `booking_cargo_lines.invoice_id`
- `invoices.id` -> `customs_estimates.invoice_id`
- `invoices.id` -> `accounting_entries.invoice_id`
- `invoices.id` -> `invoice_documents.legacy_invoice_id`

### `invoice_items`
Line item snapshots for invoices and packing lists.

Key fields:
- `invoice_id`
- `product_id` optional source link
- `hs_code_ref_id` optional HS/customs reference
- `description`, `description_ar`, `details`, `details_ar`
- `product_image_path`
- `hs_code`, `customs_unit_basis`, `customs_unit_quantity`, `quantity`, `unit`, `unit_price`, `total_price`
- Packing: `cartons`, `pcs_per_carton`, `gross_weight`, `net_weight`, `cbm`
- Air dimensions: `carton_length_cm`, `carton_width_cm`, `carton_height_cm`, `volumetric_weight_kg`, `chargeable_weight_kg`
- `sort_order`

Important:
- The item stores its own text and numbers. It does not live-update from the product after saving.

---

## 5B. Client Service Quotes

```text
clients -> service_quotes -> invoices
service_quotes -> agent_carrier_rates / clearance_agent_rates / service_quote_city_fees
service_quotes -> bookings / booking_cargo_lines
service_quotes -> accounting_entries through generated shipping invoices
```

### `service_quotes`
Client-facing shipping/service quote snapshot.

Key fields:
- Links: `client_id`, `invoice_id`, `booking_id`, `booking_cargo_line_id`
- Mode/scope: `mode`, `service_scope`, `cargo_source`, `status`
- Route: `origin_country`, `origin_city`, `pickup_address`, `loading_warehouse_id`, `port_of_loading`, `port_of_discharge`, `destination_country`, `destination_city`, `final_address`
- Cargo: `container_size`, `cbm`, `gross_weight_kg`, `chargeable_weight_kg`, `cartons`, `goods_description`
- Clearance: `clearance_through_us`, `delivery_through_us`, `clearance_agent_id`, `clearance_agent_rate_id`, `customs_value_usd`
- Pricing sources: `shipping_agent_id`, `agent_carrier_rate_id`, `agent_quote_id`, `city_fee_id`, `carrier_name`
- Calculation snapshot: `rate_basis`, `buy_rate`, `sell_rate`, `chargeable_quantity`
- Totals: freight/origin/destination/other buy and sell, `total_buy`, `total_sell`, `profit`, `margin_pct`
- `rate_snapshot`, `calculation_notes`, `notes`

Rules:
- Quotes snapshot rates so old client offers do not change when agent prices are edited later.
- Quotes can be created manually or from a `booking_cargo_lines` row.
- Creating a shipping invoice from a quote also creates a `needs_review` money-out accounting entry for the expected buy cost.
- Quote export packages include linked cargo documents/photos when `booking_cargo_line_id` exists.

### `service_quote_city_fees`
Optional origin city fee rules.

Key fields:
- `origin_country`, `origin_city`, `port_of_loading`, `service_scope`
- `buy_trucking`, `sell_trucking`, `buy_handling`, `sell_handling`
- `is_active`, `notes`, `created_by_id`

Usage:
- Adds a reusable origin pickup/trucking/handling layer for cases such as factory in Ningbo or Yiwu instead of the normal Foshan warehouse.
- Manual quote origin fees can still override these rules.

---

## 6. Containers / Bookings

```text
shipping_agents -> agent_carrier_rates -> bookings
bookings -> booking_cargo_lines -> clients
booking_cargo_lines -> invoices / clearance_agents / documents / images / extracted goods
bookings -> loading warehouse / loading photos
```

### `bookings`
Container/air shipment header.

Key fields:
- `booking_number`
- `mode`: `LCL`, `FCL`, `AIR`
- `status`: `draft`, `confirmed`, `in_transit`, `arrived`, `delivered`, `cancelled`
- Agent/rate: `shipping_agent_id`, `agent_carrier_rate_id`, `is_agent_snapshot`
- `branch_id`
- Sea/air identifiers: `container_size`, `container_no`, `seal_no`, `bl_number`, `awb_number`, `vessel_name`, `voyage_number`, `flight_number`
- Route: `port_of_loading`, `port_of_discharge`, `destination`, `etd`, `eta`
- Commercial: `incoterm`, `freight_cost`, `sell_freight_cost`, `currency`, `markup_pct`
- Capacity: `max_cbm`
- Direct booking: `is_direct_booking`, `carrier_name`
- Loading: `loading_warehouse_id`, `loading_date`, `loading_notes`
- `notes`

Connections:
- `bookings.id` -> `booking_cargo_lines.booking_id`
- `bookings.id` -> `booking_loading_photos.booking_id`
- `bookings.id` -> `customs_estimates.booking_id`
- `bookings.id` -> `accounting_entries.booking_id`

Rules:
- LCL capacity is checked by CBM.
- FCL/full-container client rules prevent adding more clients when one client owns the full container.
- Freight share is recalculated from selling freight values for client-facing allocation.

### `booking_cargo_lines`
One client inside one booking/container.

Key fields:
- Links: `booking_id`, `client_id`, `invoice_id`
- `goods_source`: company buying service or client ready goods
- `is_full_container_client`
- Goods summary: `description`, `description_ar`, `hs_code`, `shipping_marks`
- Quantities: `cartons`, `gross_weight_kg`, `net_weight_kg`, `cbm`
- Air dimensions: `carton_length_cm`, `carton_width_cm`, `carton_height_cm`, `volumetric_weight_kg`, `chargeable_weight_kg`
- `freight_share`
- `extracted_goods`: editable goods list imported/OCR extracted from PL/PI/CI/SC documents
- Clearance decision: `clearance_through_us`, `clearance_agent_id`, `clearance_agent_rate_id`, manual clearance agent fields
- `notes`, `sort_order`

Connections:
- `booking_cargo_lines.id` -> `booking_cargo_images.cargo_line_id`
- `booking_cargo_lines.id` -> `booking_cargo_documents.cargo_line_id`
- `booking_cargo_lines.id` -> `customs_estimates.booking_cargo_line_id`

### `booking_cargo_documents`
Uploaded client cargo documents.

Key fields:
- `cargo_line_id`
- `document_type`: `pl`, `security_approval`, `invoice`, `other`
- `custom_file_type`
- `file_path`, `original_filename`, `uploaded_at`

Usage:
- Files can be previewed/downloaded.
- OCR/text extraction fills `booking_cargo_lines.extracted_goods` and B/L/container fields when relevant.
- Destination/route should not be changed from OCR sample files.

### `booking_cargo_images`
Uploaded cargo photos per client cargo line.

Key fields:
- `cargo_line_id`, `file_path`, `original_filename`, `uploaded_at`

### `booking_loading_photos`
Origin warehouse/loading process photos per booking.

Key fields:
- `booking_id`, `file_path`, `original_filename`, `caption`, `uploaded_at`

---

## 7. Shipping Agents And Freight Pricing

```text
shipping_agents
  -> agent_carrier_rates      (current active carrier rates)
  -> agent_price_history      (weekly/expired offer snapshots)
  -> agent_contracts          (uploaded files)
  -> agent_edit_log           (audit)
  -> shipping_quotes          (older/detailed quote model)
```

### `shipping_agents`
Agent profile and older quick pricing fields.

Key fields:
- Profile: `name`, `name_ar`, `country`, contacts, WeChat/email
- Warehouse: `warehouse_address`, `warehouse_city`
- Bank: `bank_name`, `bank_account`, `bank_swift`
- Legacy quick prices: `price_20gp`, `price_40ft`, `price_40hq`, `price_air_kg`, `buy_lcl_cbm`
- Legacy sell prices: `sell_price_20gp`, `sell_price_40ft`, `sell_price_40hq`, `sell_price_air_kg`, `sell_lcl_cbm`
- Services: `serves_sea`, `serves_air`
- Current validity: `offer_valid_from`, `offer_valid_to`
- `transit_sea_days`, `transit_air_days`, `is_active`, `notes`

### `agent_carrier_rates`
Current rate per shipping agent/carrier/service mode.

Key fields:
- `agent_id`, `carrier_name`, `rate_type`: `sea` or `air`
- Route: `pol`, `pod`, `loading_warehouse_id`
- Dates: `effective_date`, `expiry_date`, `sealing_day`, `vessel_day`
- FCL by size: `buy_20gp`, `sell_20gp`, `cbm_20gp`, `buy_40ft`, `sell_40ft`, `cbm_40ft`, `buy_40hq`, `sell_40hq`, `cbm_40hq`
- LCL per CBM by size: `buy_lcl_20gp`, `sell_lcl_20gp`, `buy_lcl_40ft`, `sell_lcl_40ft`, `buy_lcl_40hq`, `sell_lcl_40hq`
- Legacy generic LCL: `buy_lcl_cbm`, `sell_lcl_cbm`
- Air: `buy_air_kg`, `sell_air_kg`, `min_load_kg`, `max_load_kg`
- Transit: `transit_sea_days`, `transit_air_days`
- Origin fees: `fee_loading`, `fee_bl`, `fee_trucking`, `fee_other`
- `is_active`, `notes`, `updated_at`

Usage:
- Container creation can snapshot a selected rate into booking pricing.
- Current rates should not appear in weekly history until expired.

### `agent_price_history`
Historical weekly/offer snapshots.

Key fields:
- Same major price/date/route fields as `agent_carrier_rates`
- `created_by_id`, `created_at`

Usage:
- Stores old/expired shipping offers so recent current rates are not duplicated as history.

### `agent_contracts`
Uploaded agent contracts/files.

Key fields:
- `agent_id`, `title`, `file_path`, `original_filename`
- `valid_from`, `valid_to`, `uploaded_by_id`, `notes`

### `agent_edit_log`
Shipping agent audit log.

Key fields:
- `agent_id`, `action`, `summary`, `changed_by_id`, `changed_at`

### `shipping_quotes`
Older detailed quote model used by market/public calculator paths.

Key fields:
- `quote_number`, `agent_id`, optional `client_id`
- `service_mode`: `SEA_FCL`, `AIR`, `LCL`
- `container_type`, `incoterm`, `incoterm_point`, `carrier`
- Route and validity
- Freight: `ocean_freight`, `air_freight_per_kg`, minimums
- Surcharges and origin/destination charges
- Timing fields
- Computed totals: `total_origin`, `total_destination`, `total_surcharges`, `total_all`
- `document_path`, `status`, `is_active`

---

## 8. Clearance Agents

```text
clearance_agents
  -> clearance_agent_rates
  -> clearance_agent_edit_log
booking_cargo_lines -> clearance_agent_id / clearance_agent_rate_id
```

### `clearance_agents`
Customs broker profile.

Key fields:
- Profile: `name`, `name_ar`, `country`, `city`, `address`
- Contacts: `contact_person`, `phone`, `whatsapp`, `email`
- Official: `license_number`
- Bank: `bank_name`, `bank_account`, `bank_swift`
- Legacy/general fees: `clearance_fee`, `service_fee`, `transport_fee`, `handling_fee`, `storage_fee_per_day`
- `is_active`, `notes`

### `clearance_agent_rates`
Permanent editable clearance quote lines.

Key fields:
- `agent_id`
- `service_mode`: `sea` or `air`
- `country`, `port`, `route`
- `container_size`, `carrier_name`
- Buy/sell charges:
  - `buy_clearance_fee`, `sell_clearance_fee`
  - `buy_transportation`, `sell_transportation`
  - `buy_delivery_authorization`, `sell_delivery_authorization`
  - `buy_inspection_ramp`, `sell_inspection_ramp`
  - `buy_port_inspection`, `sell_port_inspection`
- Percent charges:
  - `buy_import_export_card_pct`
  - `sell_import_export_card_pct`
- `is_active`, `notes`

Usage:
- Container cargo line matches by country, sea/air mode, container size, and carrier where needed.

### `clearance_agent_edit_log`
Audit log for clearance agent changes.

Key fields:
- `agent_id`, `action`, `summary`, `changed_by_id`, `changed_at`

---

## 9. Customs Calculator

```text
hs_code_references + products + invoice_items + booking_cargo_lines
  -> customs_estimates
      -> customs_estimate_lines
```

### `customs_estimates`
Saved tax/customs estimate header.

Key fields:
- `estimate_number`, `title`, `country`, `currency`, `status`
- Links: `client_id`, `invoice_id`, `booking_id`, `booking_cargo_line_id`
- Totals: `product_value_usd`, `shipping_cost_usd`, `customs_base_usd`, `customs_duty_usd`, `sales_tax_usd`, `other_tax_usd`, `total_taxes_usd`, `landed_estimate_usd`
- `is_archived`, `created_by_id`, `notes`

### `customs_estimate_lines`
Calculated product/customs rows.

Key fields:
- `estimate_id`, optional `product_id`
- `description`, `description_ar`, `hs_code`, `customs_category`
- `unit_basis`
- Quantities: `cartons`, `pieces_per_carton`, `total_pieces`, `gross_weight_kg`, `customs_units`
- Values: `estimated_value_per_unit_usd`, `shipping_cost_per_unit_usd`, `shipping_cost_total_usd`, `product_value_usd`, `customs_base_usd`
- Percentages: `customs_duty_pct`, `sales_tax_pct`, `other_tax_pct`, `total_tax_pct`
- Results: `customs_duty_usd`, `sales_tax_usd`, `other_tax_usd`, `total_taxes_usd`, `landed_estimate_usd`
- `warnings_json`

Current calculation rule:
- If an HS reference says basis `dozen`, customs units = `total_pieces / customs_unit_quantity`, defaulting to 12.
- If basis `piece`, customs units = `total_pieces`.
- If basis `kg`, customs units = `gross_weight_kg`.
- If basis `carton`, customs units = cartons, or `total_pieces / customs_unit_quantity` when a unit quantity is set.

---

## 10. Accounting

```text
accounting_entries
  -> accounting_attachments
bank_statement_imports
  -> bank_statement_lines
      -> accounting_entries (matched_entry_id)
```

### `accounting_entries`
Money in/out ledger.

Key fields:
- `entry_number`, `direction`: `money_in` or `money_out`
- `status`: `draft`, `posted`, `needs_review`, `void`
- `entry_date`, `amount`, `currency`
- `payment_method`, `category`
- Counterparty: `counterparty_type`, `counterparty_name`
- `reference_no`, `description`, `notes`
- Links: `client_id`, `invoice_id`, `booking_id`, `shipping_agent_id`, `clearance_agent_id`, `supplier_id`
- Tax: `tax_rate_pct`, `tax_amount`, `has_official_tax_invoice`
- `branch_id`, `created_by_id`

### `accounting_attachments`
Receipts, invoices, proof of payment files.

Key fields:
- `entry_id`, `document_type`
- `file_path`, `original_filename`, `content_type`, `file_size`
- `uploaded_by_id`, `created_at`

### `bank_statement_imports`
Uploaded bank statements.

Key fields:
- `bank_name`, `account_name`, `account_no`
- `statement_from`, `statement_to`
- `original_filename`, `file_path`
- `currency`, `line_count`, `status`, `notes`
- `uploaded_by_id`

### `bank_statement_lines`
Parsed statement transactions and matches.

Key fields:
- `statement_id`
- `transaction_date`, `direction`, `amount`, `currency`
- `description`, `reference_no`, `balance`, `raw_data`
- Match: `match_status`, `matched_entry_id`, `match_confidence`, `match_reason`
- Review: `reviewed_by_id`, `reviewed_at`

---

## 11. Market And Reference Data

### `market_rates`
Currency exchange snapshots.

Key fields:
- `base_currency`, usually `USD`
- `target_currency`
- `rate`
- `fetched_at`

Usage:
- Frontend product/shop conversion still uses market rates.
- Main customs/accounting work currently stays USD until multi-currency is rebuilt.

### Static reference endpoints
Not database tables, but important:
- `/api/v1/reference/ports`
- `/api/v1/reference/container-limits`
- `/api/v1/reference/shipping-terms`
- `/api/v1/reference/payment-terms`
- `/api/v1/reference/stamp-positions`

---

## 12. File Storage Map

Current uploaded files are stored under backend upload folders and referenced by DB paths.

| Area | DB table | Typical files |
| --- | --- | --- |
| Product photos | `product_photos` | Shop/admin product images |
| Invoice stamp/background/item image | `invoices`, `invoice_items` | Stamp PNG, background image, item image |
| Shipping agent contracts | `agent_contracts` | Contract PDFs/images |
| Shipping quote documents | `shipping_quotes` | Agent quote screenshots/PDFs |
| Container cargo images | `booking_cargo_images` | Cargo/loading photos per client |
| Container cargo documents | `booking_cargo_documents` | PL, PI/CI, SC, CO, B/L, security approvals, other |
| Booking loading photos | `booking_loading_photos` | Warehouse/loading process photos |
| Accounting attachments | `accounting_attachments` | Receipts, payment proof, invoices |
| Bank statements | `bank_statement_imports` | CSV/XLSX bank statements |

Important:
- DB rows store paths and metadata; physical files must stay on disk for preview/download/archive.

---

## 13. Current API Prefix Map

All admin API routes are under `/api/v1`.

| Prefix | Main tables |
| --- | --- |
| `/auth` | `users` |
| `/users` | `users` |
| `/clients` | `clients` |
| `/customers` | `customers`, migration into `clients` |
| `/shop` | public products, customer auth, shop orders, shipping calculator |
| `/client-portal` | `clients`, invoices, bookings |
| `/invoices` | active client profile invoice API: `invoices`, `invoice_items` |
| `/service-quotes` | client shipping/service quotes, origin city fees, quote print/export, generated shipping invoices |
| `/invoice-packages` | inactive/removed from active router; tables may remain for stored package records |
| `/bookings` | `bookings`, cargo lines, cargo docs/images, loading photos |
| `/shipping-agents` | shipping agents, current rates, history, contracts, quotes |
| `/clearance-agents` | clearance agents, rates, edit log |
| `/products` | products, photos, taxonomy, public shop product list |
| `/customs-references` | `hs_code_references` |
| `/customs-calculator` | customs estimates and lines |
| `/accounting` | ledger, attachments, bank statements, reports |
| `/market` | market board and rates |
| `/company` | company settings |
| `/warehouses` | company warehouses |
| `/suppliers` | suppliers |
| `/branches` | branches |
| `/reference` | static reference lists |
| `/shop` | public shop customer/signup/calculator/rates |

---

## 14. High-Level Data Flow

```text
PUBLIC SHOP
  customers -> shop product browsing -> later order/invoice flow

PRODUCT REFERENCE
  suppliers -> products -> product_photos
  product_main_categories -> product_subcategories -> product_types
  hs_code_references -> product_types/products -> customs calculator

INVOICING
  clients -> invoices -> invoice_items -> optional product source snapshots
  clients -> service_quotes -> generated shipping invoices -> accounting needs_review cost entries

CONTAINERS
  shipping_agents -> agent_carrier_rates -> bookings
  bookings -> booking_cargo_lines -> clients
  booking_cargo_lines -> invoices / cargo documents / cargo images
  booking_cargo_lines -> clearance_agents / clearance_agent_rates
  booking_cargo_lines -> customs_estimates

PRICING
  shipping agent current rate -> booking freight snapshot
  shipping agent/clearance agent/city fee rules -> service quote snapshot
  clearance agent permanent rate -> cargo line clearance selection
  hs_code_reference -> customs estimate values/taxes

ACCOUNTING
  accounting_entries -> clients / invoices / containers / agents / suppliers
  bank_statement_lines -> accounting_entries

EXPORT
  booking archive ZIP -> booking JSON + client cargo + goods + linked invoice snapshots + uploaded files
```

---

## 15. Arabic Summary / ملخص عربي

### القاعدة العامة

- `customers` هم عملاء الموقع فقط، أما التشغيل الحقيقي داخل النظام فيستخدم `clients`.
- الفواتير تحفظ نسخة من بيانات الأصناف وقت الإنشاء، لذلك تعديل المنتج لاحقا لا يغير الفاتورة القديمة.
- الحاوية هي مركز التشغيل: تربط وكيل الشحن، السعر، العملاء، البضاعة، الملفات، التخليص، والتكاليف لاحقا.
- بيانات HS والجمارك والضرائب يجب أن تعتمد على جدول `hs_code_references`.
- الحسابات تربط أي قبض أو دفع بالعميل أو الفاتورة أو الحاوية أو وكيل الشحن أو وكيل التخليص أو المورد.

### شجرة الربط المختصرة

```text
الفروع -> المستخدمين / العملاء / الحاويات / المستودعات / القيود المالية

العملاء الداخليين clients
  -> الفواتير invoices
  -> عروض الشحن والخدمات service_quotes
  -> بضائع الحاويات booking_cargo_lines
  -> القيود المالية accounting_entries

الموردين suppliers
  -> المنتجات products
      -> صور المنتجات product_photos
      -> مرجع HS والجمارك hs_code_references

التصنيف
  product_main_categories
    -> product_subcategories
      -> product_types
        -> hs_code_references

وكلاء الشحن
  shipping_agents
    -> agent_carrier_rates      أسعار حالية حسب الناقل والحجم والميناء
    -> agent_price_history      عروض منتهية أو تاريخية
    -> agent_contracts          عقود وملفات
    -> agent_edit_log           سجل تعديلات

الحاويات
  bookings
    -> booking_cargo_lines      كل عميل داخل الحاوية
      -> invoices               فاتورة مرتبطة إن وجدت
      -> booking_cargo_documents ملفات PL/PI/CI/SC/CO/B/L وغيرها
      -> booking_cargo_images   صور البضاعة
      -> clearance_agent_rates  سعر التخليص المناسب

عروض الشحن والخدمات
  service_quotes
    -> agent_carrier_rates      سعر الشحن المختار أو المقترح
    -> service_quote_city_fees  رسوم مدينة المصدر إن وجدت
    -> clearance_agent_rates    رسوم التخليص إن كانت عن طريقنا
    -> invoices                 فاتورة شحن للعميل
    -> accounting_entries       قيد دفع متوقع لتكلفة الشراء

وكلاء التخليص
  clearance_agents
    -> clearance_agent_rates    أسعار دائمة حسب الدولة/الميناء/الحجم/الناقل
    -> clearance_agent_edit_log سجل تعديلات

حاسبة الجمارك
  hs_code_references + products + invoice_items + booking_cargo_lines
    -> customs_estimates
      -> customs_estimate_lines

الحسابات
  accounting_entries
    -> accounting_attachments
  bank_statement_imports
    -> bank_statement_lines
      -> accounting_entries
```

### ملاحظة مهمة للجمارك

حقل `customs_unit_quantity` في جدول `hs_code_references` يحدد كم قطعة داخل وحدة الجمارك:

- إذا كانت الوحدة `dozen` والقيمة `12`، فكل 12 قطعة = دزينة واحدة.
- إذا كانت الوحدة `carton` يمكن وضع عدد القطع داخل الكرتون أو العبوة الخاصة لهذا النوع.
- هذا الرقم يستخدم في حاسبة الجمارك حتى لا تختلط قطعة/دزينة/كرتون/كيلو.

---

## 16. When A Partner Pushes New Work

Use this quick check after pulling changes:

```bash
git pull
git log -1 --oneline
git status --short
rg "__tablename__|ForeignKey\\(" backend/app/models
rg "include_router|Route path=" backend/app/main.py frontend/src/App.tsx
```

If any model, migration, API prefix, or major page changed, update:

1. `docs/DATABASE_STRUCTURE.md`
2. `docs/SYSTEM_TREE.md`
3. `README.md` if the workflow or deployment instructions changed

This keeps the project understandable even when multiple people are pushing.
