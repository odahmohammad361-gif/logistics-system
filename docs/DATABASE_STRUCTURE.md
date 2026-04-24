# Database Structure
> Last updated: 2026-04-24
> All tables share: `id (PK)`, `created_at`, `updated_at`, `is_active` — not repeated below.

---

## 1. Organization

```
branches
  └── users               (staff — has branch_id)
  └── clients             (main clients — has branch_id)
  └── bookings            (containers — has branch_id)
  └── company_warehouses
```

### `branches`
| Column | Notes |
|--------|-------|
| name / name_ar | e.g. "Jordan" / "الأردن" |
| code | e.g. "JO", "CN", "IQ" |
| country | |

### `users` → FK: branches
| Column | Notes |
|--------|-------|
| full_name / full_name_ar | |
| email | unique |
| role | super_admin / admin / branch_manager / staff / viewer |
| branch_id | which branch they belong to |

---

## 2. Clients ⚠️ TWO SEPARATE SYSTEMS

> **IMPORTANT:** `clients` and `customers` are completely independent tables with no FK between them.
> A `customer` (website signup) never automatically becomes a `client`.
> The admin must manually migrate them: this creates a brand new row in `clients` and marks the customer as `is_verified = true`.

### `clients` — added by admin
> Used everywhere that matters: invoices, booking cargo lines, shipping quotes.

| Column | Notes |
|--------|-------|
| client_code | auto-generated e.g. JO-0001 **(unique, used as barcode)** |
| name / name_ar | |
| phone / whatsapp / email | |
| country / city / address | |
| company_name / company_name_ar | |
| tax_number | |
| branch_id | FK → branches |
| created_by_id | FK → users |
| notes | |

### `customers` — website self-signup only
> **Cannot be used in invoices or bookings directly.** Must be migrated to `clients` first.

| Column | Notes |
|--------|-------|
| full_name / email / phone | |
| telegram | |
| country | jordan / iraq / other |
| hashed_password | |
| is_verified | false by default — set to true after admin migrates them |
| notes | admin notes |

---

## 3. Invoices

> Flow: `clients` → `invoices` → `invoice_items`

### `invoices` → FK: clients, users, branches
| Column | Notes |
|--------|-------|
| invoice_number | unique, auto-generated |
| invoice_type | PRICE_OFFER / PI / CI / PL / SC |
| status | draft / sent / approved / paid / cancelled / dummy |
| client_id | nullable — use `buyer_name` instead when no client linked |
| buyer_name | free-text fallback when no client |
| issue_date / due_date | |
| currency | USD default |
| subtotal / discount / total | |
| **Trade fields** | |
| origin | e.g. "China" |
| payment_terms | e.g. "100% before shipping" |
| shipping_term | Incoterm: FOB, CIF, etc. |
| port_of_loading / port_of_discharge | |
| shipping_marks | |
| **Shipping refs** ⚠️ copied manually from a booking | |
| container_no / seal_no / bl_number | |
| vessel_name / voyage_number | |
| **Bank override** | only fill if different from `company_settings` defaults |
| bank_account_name / bank_account_no / bank_swift / bank_name / bank_address | |
| **Assets** | |
| stamp_image_path / stamp_position | uploaded PNG per invoice |
| document_background_path | custom background per invoice |
| notes / notes_ar | |

### `invoice_items` → FK: invoices

> **IMPORTANT:** No FK to `products` table. Items are free-form text or filled by copying product data at the moment of creation. Once saved, they are independent — editing a product does NOT change existing invoice items.

| Column | Notes |
|--------|-------|
| description / description_ar | product name |
| details / details_ar | material, sizes, colors, packing |
| product_image_path | uploaded image per line item |
| hs_code | customs code |
| quantity / unit | pcs, pairs, kg |
| unit_price / total_price | |
| cartons / gross_weight / net_weight / cbm | |
| carton_length/width/height_cm | air cargo dims |
| volumetric_weight_kg / chargeable_weight_kg | max(actual, volumetric) |
| sort_order | display order |

---

## 4. Bookings (Containers / Shipments)

> Flow: `shipping_agents` → `bookings` → `booking_cargo_lines` → `booking_cargo_images`

> **IMPORTANT:** Bookings and Invoices are NOT linked by FK. The shipping refs (container_no, bl_number, etc.) must be copied manually from a booking into an invoice. They are separate documents.

### `shipping_agents`
| Column | Notes |
|--------|-------|
| name / name_ar | |
| country / contact_person / phone / wechat_id / email | |
| warehouse_city | China origin city e.g. Guangzhou |
| price_20gp / price_40ft / price_40hq | ballpark USD prices |
| price_air_kg | air price per kg |
| transit_sea_days / transit_air_days | |
| serves_sea / serves_air | bool — controls which agents appear in booking form |
| bank_name / bank_account / bank_swift | for paying freight invoices |

### `bookings` → FK: shipping_agents, branches
| Column | Notes |
|--------|-------|
| booking_number | unique, auto-generated |
| mode | LCL / FCL / AIR |
| status | draft / confirmed / in_transit / arrived / delivered / cancelled |
| shipping_agent_id | nullable |
| is_direct_booking | "1" = no agent used |
| carrier_name | shipping line or airline |
| container_size | 20GP / 40GP / 40HQ |
| **Transport refs** | |
| container_no / seal_no / bl_number | sea |
| awb_number / flight_number | air |
| vessel_name / voyage_number | sea |
| **Routing** | |
| port_of_loading / port_of_discharge | |
| etd / eta | departure / arrival dates |
| incoterm | |
| **Pricing** ⚠️ | |
| freight_cost | total price paid to agent |
| max_cbm | editable container CBM capacity |
| markup_pct | selling markup % |
| | → buying/cbm = freight_cost ÷ max_cbm |
| | → selling/cbm = buying/cbm × (1 + markup_pct ÷ 100) |
| currency | |
| notes | |

### `booking_cargo_lines` → FK: bookings, clients

> **IMPORTANT:** This is the bridge between a booking and clients. One row per client per booking. This is how the system tracks which client has how much cargo in a shared container, and splits the freight cost.

| Column | Notes |
|--------|-------|
| booking_id | |
| client_id | **must be a `clients` row** — not a `customer` |
| sort_order | |
| description / description_ar | |
| hs_code / shipping_marks | |
| cartons / gross_weight_kg / net_weight_kg / cbm | |
| carton_length/width/height_cm | air dims |
| volumetric_weight_kg / chargeable_weight_kg | |
| freight_share | cost portion allocated to this client |
| notes | |

### `booking_cargo_images` → FK: booking_cargo_lines
| Column | Notes |
|--------|-------|
| file_path / original_filename | cargo photos |

---

## 5. Shipping Quotes

> Detailed quotes from agents. Fed into Market Board and public Shipping Calculator.
> Flow: `shipping_agents` → `shipping_quotes` ← optionally for a specific `client`

### `shipping_quotes` → FK: shipping_agents, clients (optional), users
| Column | Notes |
|--------|-------|
| quote_number | unique e.g. QT-2026-0001 |
| agent_id | |
| client_id | nullable — client-specific quote |
| service_mode | SEA_FCL / AIR / LCL |
| container_type | 20GP / 40FT / 40HQ — null for AIR/LCL |
| incoterm / incoterm_point | e.g. "FOB Guangzhou" |
| carrier | CMA CGM, MSC, Emirates, etc. |
| port_of_loading / port_of_discharge | |
| validity_from / validity_to | |
| status | draft / active / expired / rejected |
| currency | |
| **Main freight** | |
| ocean_freight | per container (FCL) or per CBM (LCL) |
| air_freight_per_kg | AIR only |
| min_chargeable_weight_kg / min_chargeable_cbm | AIR/LCL minimums |
| **Surcharges** | |
| baf | Bunker Adjustment Factor (fuel) |
| eca_surcharge | Emission Control Area |
| war_risk_surcharge | |
| other_surcharges | |
| **China-side fees** | |
| thc_origin | Terminal Handling Charge |
| bl_fee / doc_fee | B/L and documentation |
| sealing_fee / inspection_fee | |
| trucking_origin | warehouse → port |
| stuffing_fee | loading cargo into container |
| warehouse_handling | receiving, sorting |
| **Destination fees (JO/IQ)** | |
| thc_destination | terminal handling at arrival port |
| customs_destination / brokerage_destination | |
| trucking_destination | port → final warehouse |
| **Timing** | |
| transit_days | sea/air transit time |
| free_days_origin / free_days_destination | detention / demurrage free days |
| cut_off_days | days before ETD cargo must be at port |
| stuffing_days | days needed to load from pickup |
| **Auto-computed totals** | |
| total_origin / total_destination / total_surcharges / total_all | |
| document_path | original quote image/PDF from agent |

---

## 6. Clearance Agents

> Used in the public shipping calculator to estimate destination costs.
> NOT linked to invoices or bookings by FK — reference data only.

### `clearance_agents`
| Column | Notes |
|--------|-------|
| name / name_ar | |
| country / city | Jordan or Iraq |
| contact_person / phone / email | |
| license_number | customs broker license |
| bank_name / bank_account / bank_swift | for paying their fees |
| clearance_fee | base customs clearance (USD) |
| service_fee | brokerage charge |
| transport_fee | port → warehouse |
| handling_fee | per-shipment handling |
| storage_fee_per_day | port storage per day |
| notes | |

---

## 7. Product Catalog

> Flow: `suppliers` → `products` → `product_photos`

> **IMPORTANT:** Products have NO link to `invoice_items` or `booking_cargo_lines`. They exist only in the shop. When a product is added to an invoice, its data is copied as free text into `invoice_items` — after that the two are independent.

### `suppliers`
| Column | Notes |
|--------|-------|
| code | unique e.g. SHA-023 |
| name / name_ar | |
| market_location | e.g. "Shahe Market, Block B, Shop 23" |
| wechat_id / phone | |

### `products` → FK: suppliers
| Column | Notes |
|--------|-------|
| code | unique e.g. TS-001 |
| name / name_ar | bilingual |
| category | t-shirt, jeans, jacket, etc. |
| description / description_ar | |
| supplier_id | |
| price_cny | **stored in CNY only** — conversion on frontend via market_rates |
| pcs_per_carton | default 250 |
| cbm_per_carton | default 0.20 |
| min_order_cartons | minimum order in cartons |
| is_featured | shown on shop homepage |

### `product_photos` → FK: products
| Column | Notes |
|--------|-------|
| file_path | under /uploads/products |
| is_main | hero/thumbnail used in shop grid |
| sort_order | |

---

## 8. Reference / Config

### `market_rates`
> Currency snapshots fetched from external API. Base is always USD.

> **IMPORTANT — conversion formula:**
> `target_amount = (cny_amount ÷ rate["CNY"]) × rate["TARGET"]`
> Example: product costs ¥100 CNY → USD = 100 ÷ 7.2 = $13.88

| Column | Notes |
|--------|-------|
| base_currency | always "USD" |
| target_currency | CNY, JOD, IQD, EUR |
| rate | 1 USD = X target |
| fetched_at | snapshot time |

### `company_settings` ⚠️ SINGLE ROW

> **IMPORTANT:** This is a single-row config table. It drives the header/footer of every invoice — company name, address, logo, default bank details. If it is empty or missing, invoices will print blank headers.
> Bank details here are the DEFAULT — each invoice can override them individually.

| Column | Notes |
|--------|-------|
| name / name_ar / tagline / tagline_ar | printed on invoice header |
| address / address_ar / phone / email / website | |
| bank_account_name / bank_account_no / bank_swift / bank_name / bank_address | default — overridable per invoice |
| logo_path | company logo PNG |
| stamp_path | default stamp/signature PNG |

### `company_warehouses` → FK: branches
> Reference data only — not FK'd to any other table.

| Column | Notes |
|--------|-------|
| name / name_ar | |
| warehouse_type | "loading" (China) or "unloading" (JO/IQ) |
| country / city / address | |
| contact_name / phone | |

---

## Shared Field Patterns
> These appear in multiple tables with the same meaning — no need to explain twice.

| Pattern | Appears in |
|---------|-----------|
| `port_of_loading` / `port_of_discharge` | invoices, bookings, shipping_quotes |
| `container_no` / `seal_no` / `bl_number` / `vessel_name` / `voyage_number` | invoices, bookings |
| `incoterm` | invoices, bookings, shipping_quotes |
| `currency` | invoices, bookings, shipping_quotes |
| `cartons` / `cbm` / `gross_weight` / `net_weight` | invoice_items, booking_cargo_lines |
| `carton_length/width/height_cm` / `volumetric_weight_kg` / `chargeable_weight_kg` | invoice_items, booking_cargo_lines |
| `name` / `name_ar` | almost every table — all data is bilingual |
| `notes` | almost every table |

---

## Data Flow Summary

```
PRODUCT CATALOG
  suppliers → products → product_photos
                ↓ price in CNY, converted via market_rates on frontend
            customers (browse — cart TBD)

INVOICING
  clients ──────────────────────────────────→ invoices → invoice_items
                                                ↑
              shipping refs (container_no, bl_number, etc.)
              are copied MANUALLY from bookings — no automatic link

CONTAINERS
  shipping_agents → bookings → booking_cargo_lines → booking_cargo_images
                                      ↑
                    clients (one cargo line per client per container)

PRICING REFERENCE
  shipping_agents → shipping_quotes  (market board + public calculator)
  clearance_agents                   (public shipping calculator only)

CURRENCY
  market_rates → frontend shop price conversion (USD base)

COMPANY CONFIG
  company_settings (1 row) → every invoice header/footer
  company_warehouses        → reference only, no downstream FK
```

---

## Critical Rules Summary

| Rule | Why it matters |
|------|---------------|
| `customers` ≠ `clients` | A website signup cannot appear on an invoice until admin migrates them |
| `invoice_items` has no FK to `products` | Editing a product never breaks old invoices |
| `bookings` has no FK to `invoices` | Shipping refs must be copied manually |
| `booking_cargo_lines.client_id` must be a `clients` row | Customers cannot be added to cargo directly |
| `company_settings` must have data | Empty = blank invoice headers |
| `price_cny` is the only stored price | All other currencies are calculated live, never stored |
| Soft delete via `is_active = false` | Deleted records still exist in DB — old invoices stay intact |
