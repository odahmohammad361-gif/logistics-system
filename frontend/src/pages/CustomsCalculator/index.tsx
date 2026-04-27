import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Calculator, FolderOpen, Plus, Printer, RefreshCw, Save, Trash2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import { FormSection, Input } from '@/components/ui/Form'
import { getBooking, getBookings } from '@/services/bookingService'
import { getClients } from '@/services/clientService'
import { getInvoice, getInvoices } from '@/services/invoiceService'
import { listProducts, listProductTaxonomy } from '@/services/productService'
import {
  archiveCustomsEstimate,
  calculateCustoms,
  createCustomsEstimate,
  listCustomsEstimates,
} from '@/services/customsCalculatorService'
import type { BookingCargoLine, CustomsCalculatorRequest, CustomsCalculatorResponse, CustomsEstimate, HSCodeReference, Invoice, InvoiceItem, Product } from '@/types'

type UnitBasis = 'dozen' | 'piece' | 'kg' | 'carton'

interface CalcRow {
  id: string
  product_id: string
  hs_ref_id: string
  description: string
  description_ar: string
  hs_code: string
  customs_category: string
  unit_basis: UnitBasis
  cartons: string
  pieces_per_carton: string
  quantity_pieces: string
  gross_weight_kg: string
  estimated_value_usd: string
  shipping_cost_per_unit_usd: string
  shipping_cost_total_usd: string
  customs_duty_pct: string
  sales_tax_pct: string
  other_tax_pct: string
}

const COUNTRIES = ['Jordan', 'Iraq', 'China', 'UAE', 'Saudi Arabia']

let fallbackRowId = 0

function makeRowId() {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return uuid
  fallbackRowId += 1
  return `customs-row-${Date.now()}-${fallbackRowId}`
}

function newRow(): CalcRow {
  return {
    id: makeRowId(),
    product_id: '',
    hs_ref_id: '',
    description: '',
    description_ar: '',
    hs_code: '',
    customs_category: '',
    unit_basis: 'dozen',
    cartons: '',
    pieces_per_carton: '',
    quantity_pieces: '',
    gross_weight_kg: '',
    estimated_value_usd: '',
    shipping_cost_per_unit_usd: '',
    shipping_cost_total_usd: '',
    customs_duty_pct: '',
    sales_tax_pct: '',
    other_tax_pct: '',
  }
}

function compact(value: string) {
  return value === '' ? null : value
}

function money(value: string | number | null | undefined) {
  return `$${Number(value || 0).toFixed(2)}`
}

function pct(value: string | number | null | undefined) {
  return `${Number(value || 0).toFixed(2)}%`
}

function esc(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch] as string))
}

function buildRequest(country: string, rows: CalcRow[]): CustomsCalculatorRequest {
  return {
    country,
    currency: 'USD',
    items: rows.map((row) => ({
      product_id: row.product_id ? Number(row.product_id) : null,
      description: compact(row.description),
      description_ar: compact(row.description_ar),
      hs_code: compact(row.hs_code),
      customs_category: compact(row.customs_category),
      unit_basis: row.unit_basis,
      cartons: compact(row.cartons),
      pieces_per_carton: compact(row.pieces_per_carton),
      quantity_pieces: compact(row.quantity_pieces),
      gross_weight_kg: compact(row.gross_weight_kg),
      estimated_value_usd: compact(row.estimated_value_usd),
      shipping_cost_per_unit_usd: compact(row.shipping_cost_per_unit_usd),
      shipping_cost_total_usd: compact(row.shipping_cost_total_usd),
      customs_duty_pct: compact(row.customs_duty_pct),
      sales_tax_pct: compact(row.sales_tax_pct),
      other_tax_pct: compact(row.other_tax_pct),
    })),
  }
}

function optionalId(value: string) {
  return value ? Number(value) : null
}

function estimateToResult(estimate: CustomsEstimate): CustomsCalculatorResponse {
  return {
    country: estimate.country,
    currency: 'USD',
    items: [...estimate.lines].sort((a, b) => a.sort_order - b.sort_order),
    totals: {
      product_value_usd: estimate.product_value_usd,
      shipping_cost_usd: estimate.shipping_cost_usd,
      customs_base_usd: estimate.customs_base_usd,
      customs_duty_usd: estimate.customs_duty_usd,
      sales_tax_usd: estimate.sales_tax_usd,
      other_tax_usd: estimate.other_tax_usd,
      total_taxes_usd: estimate.total_taxes_usd,
      landed_estimate_usd: estimate.landed_estimate_usd,
    },
  }
}

function estimateToRows(estimate: CustomsEstimate): CalcRow[] {
  const lines = [...estimate.lines].sort((a, b) => a.sort_order - b.sort_order)
  if (lines.length === 0) return [newRow()]
  return lines.map((line) => ({
    id: makeRowId(),
    product_id: line.product_id ? String(line.product_id) : '',
    hs_ref_id: '',
    description: line.description ?? '',
    description_ar: line.description_ar ?? '',
    hs_code: line.hs_code ?? '',
    customs_category: line.customs_category ?? '',
    unit_basis: (line.unit_basis as UnitBasis) || 'dozen',
    cartons: line.cartons ?? '',
    pieces_per_carton: line.pieces_per_carton ?? '',
    quantity_pieces: line.total_pieces ?? '',
    gross_weight_kg: line.gross_weight_kg ?? '',
    estimated_value_usd: line.estimated_value_per_unit_usd ?? '',
    shipping_cost_per_unit_usd: line.shipping_cost_per_unit_usd ?? '',
    shipping_cost_total_usd: line.shipping_cost_total_usd ?? '',
    customs_duty_pct: line.customs_duty_pct ?? '',
    sales_tax_pct: line.sales_tax_pct ?? '',
    other_tax_pct: line.other_tax_pct ?? '',
  }))
}

function valueString(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return ''
  return String(value)
}

function numeric(value: string | number | null | undefined) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalized(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function isUnitBasis(value: unknown): value is UnitBasis {
  return value === 'dozen' || value === 'piece' || value === 'kg' || value === 'carton'
}

function findProductByText(products: Product[], hsCode?: string | null, ...texts: Array<string | null | undefined>) {
  const hs = normalized(hsCode)
  if (hs) {
    const match = products.find((product) => normalized(product.hs_code) === hs)
    if (match) return match
  }

  const itemText = texts.map(normalized).filter(Boolean).join(' ')
  if (!itemText) return undefined

  return products.find((product) => {
    const names = [
      normalized(product.name),
      normalized(product.name_ar),
      normalized(product.description),
      normalized(product.description_ar),
    ].filter(Boolean)
    return names.some((name) => itemText.includes(name) || name.includes(itemText))
  })
}

function inferUnitBasis(item: InvoiceItem, product?: Product): UnitBasis {
  if (isUnitBasis(product?.customs_unit_basis)) return product.customs_unit_basis
  const unit = normalized(item.unit)
  if (unit.includes('kg') || unit.includes('kilo') || unit.includes('كغ')) return 'kg'
  if (unit.includes('carton') || unit.includes('ctn') || unit.includes('كرت')) return 'carton'
  if (unit.includes('piece') || unit.includes('pcs') || unit.includes('pc') || unit.includes('قط')) return 'piece'
  return 'dozen'
}

function customsUnitsFor(item: InvoiceItem, basis: UnitBasis) {
  const pieces = numeric(item.quantity)
  const cartons = numeric(item.cartons)
  const grossKg = numeric(item.gross_weight)
  if (basis === 'piece') return pieces
  if (basis === 'carton') return cartons
  if (basis === 'kg') return grossKg
  return pieces / 12
}

function productValueFor(item: InvoiceItem, basis: UnitBasis, customsUnits: number, product?: Product) {
  const productCustomsValue = numeric(product?.customs_estimated_value_usd)
  if (productCustomsValue > 0) return productCustomsValue

  if (basis === 'piece') {
    const productPrice = numeric(product?.price_usd)
    if (productPrice > 0) return productPrice
  }

  const lineTotal = numeric(item.total_price)
  if (customsUnits > 0 && lineTotal > 0) return lineTotal / customsUnits

  const unitPrice = numeric(item.unit_price)
  if (unitPrice > 0) return unitPrice

  return 0
}

function findProductForInvoiceItem(item: InvoiceItem, products: Product[]) {
  return findProductByText(products, item.hs_code, item.description, item.description_ar)
}

function invoiceItemToRow(item: InvoiceItem, products: Product[]): CalcRow {
  const product = findProductForInvoiceItem(item, products)
  const basis = inferUnitBasis(item, product)
  const cartons = numeric(item.cartons)
  const quantity = numeric(item.quantity)
  const piecesPerCarton = cartons > 0 ? quantity / cartons : numeric(product?.pcs_per_carton)
  const customsUnits = customsUnitsFor(item, basis)

  return {
    id: makeRowId(),
    product_id: product ? String(product.id) : '',
    hs_ref_id: product?.hs_code_ref_id ? String(product.hs_code_ref_id) : '',
    description: item.description ?? product?.name ?? '',
    description_ar: item.description_ar ?? product?.name_ar ?? '',
    hs_code: item.hs_code ?? product?.hs_code ?? '',
    customs_category: product?.customs_category ?? product?.category ?? '',
    unit_basis: basis,
    cartons: valueString(item.cartons),
    pieces_per_carton: piecesPerCarton > 0 ? String(Number(piecesPerCarton.toFixed(4))) : '',
    quantity_pieces: valueString(item.quantity),
    gross_weight_kg: valueString(item.gross_weight),
    estimated_value_usd: valueString(productValueFor(item, basis, customsUnits, product)),
    shipping_cost_per_unit_usd: '',
    shipping_cost_total_usd: '',
    customs_duty_pct: product?.customs_duty_pct ?? '',
    sales_tax_pct: product?.sales_tax_pct ?? '',
    other_tax_pct: product?.other_tax_pct ?? '',
  }
}

function invoiceTitle(invoice: Invoice) {
  const name = invoice.client?.name || invoice.buyer_name
  return name ? `${invoice.invoice_number} - ${name}` : invoice.invoice_number
}

type ExtractedCargoGoods = NonNullable<NonNullable<BookingCargoLine['extracted_goods']>['goods']>[number]

function cargoProductValue(product?: Product) {
  const productCustomsValue = numeric(product?.customs_estimated_value_usd)
  if (productCustomsValue > 0) return productCustomsValue
  return numeric(product?.price_usd)
}

function cargoGoodsToRow(item: Partial<ExtractedCargoGoods>, line: BookingCargoLine, products: Product[]): CalcRow {
  const product = findProductByText(products, item.hs_code ?? line.hs_code, item.description, line.description, line.description_ar)
  const basis = isUnitBasis(product?.customs_unit_basis) ? product.customs_unit_basis : 'dozen'
  const cartons = numeric(item.cartons ?? line.cartons)
  const quantity = numeric(item.quantity)
  const piecesPerCarton = cartons > 0 && quantity > 0 ? quantity / cartons : numeric(product?.pcs_per_carton)

  return {
    id: makeRowId(),
    product_id: product ? String(product.id) : '',
    hs_ref_id: product?.hs_code_ref_id ? String(product.hs_code_ref_id) : '',
    description: item.description ?? line.description ?? product?.name ?? '',
    description_ar: line.description_ar ?? product?.name_ar ?? '',
    hs_code: item.hs_code ?? line.hs_code ?? product?.hs_code ?? '',
    customs_category: product?.customs_category ?? product?.category ?? '',
    unit_basis: basis,
    cartons: valueString(item.cartons ?? line.cartons),
    pieces_per_carton: piecesPerCarton > 0 ? String(Number(piecesPerCarton.toFixed(4))) : '',
    quantity_pieces: valueString(item.quantity),
    gross_weight_kg: valueString(item.gross_weight_kg ?? line.gross_weight_kg),
    estimated_value_usd: valueString(cargoProductValue(product)),
    shipping_cost_per_unit_usd: '',
    shipping_cost_total_usd: '',
    customs_duty_pct: product?.customs_duty_pct ?? '',
    sales_tax_pct: product?.sales_tax_pct ?? '',
    other_tax_pct: product?.other_tax_pct ?? '',
  }
}

function cargoLineToRows(line: BookingCargoLine, products: Product[]): CalcRow[] {
  const goods = line.extracted_goods?.goods ?? []
  if (goods.length) return goods.map((item) => cargoGoodsToRow(item, line, products))
  return [cargoGoodsToRow({}, line, products)]
}

export default function CustomsCalculatorPage() {
  const { t, i18n } = useTranslation()
  const [searchParams] = useSearchParams()
  const qc = useQueryClient()
  const isAr = i18n.language === 'ar'
  const [country, setCountry] = useState('Jordan')
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [clientId, setClientId] = useState('')
  const [invoiceId, setInvoiceId] = useState('')
  const [bookingId, setBookingId] = useState(searchParams.get('booking_id') ?? '')
  const [bookingCargoLineId, setBookingCargoLineId] = useState(searchParams.get('cargo_line_id') ?? '')
  const [rows, setRows] = useState<CalcRow[]>([newRow()])
  const [result, setResult] = useState<CustomsCalculatorResponse | null>(null)

  const { data: productsData } = useQuery({
    queryKey: ['customs-calculator-products'],
    queryFn: () => listProducts({ page: 1, page_size: 100 }),
  })

  const { data: taxonomyData } = useQuery({
    queryKey: ['customs-calculator-taxonomy', country],
    queryFn: () => listProductTaxonomy({ country }),
  })

  const { data: estimatesData } = useQuery({
    queryKey: ['customs-estimates'],
    queryFn: () => listCustomsEstimates({ page: 1, page_size: 8 }),
  })

  const { data: clientsData } = useQuery({
    queryKey: ['customs-link-clients'],
    queryFn: () => getClients({ page: 1, page_size: 100 }),
  })

  const { data: invoicesData } = useQuery({
    queryKey: ['customs-link-invoices'],
    queryFn: () => getInvoices({ page: 1, page_size: 100 }),
  })

  const { data: bookingsData } = useQuery({
    queryKey: ['customs-link-bookings'],
    queryFn: () => getBookings({ page: 1, page_size: 100 }),
  })

  const selectedBookingId = Number(bookingId)
  const { data: selectedBooking } = useQuery({
    queryKey: ['customs-link-booking-detail', selectedBookingId],
    queryFn: () => getBooking(selectedBookingId),
    enabled: Number.isFinite(selectedBookingId) && selectedBookingId > 0,
  })

  const products = productsData?.results ?? []
  const hsReferences = taxonomyData?.hs_codes ?? []
  const bookingCargoLines = selectedBooking?.cargo_lines ?? []
  const selectedCargoLine = bookingCargoLines.find((line) => String(line.id) === bookingCargoLineId)
  const productById = useMemo(() => {
    const map = new Map<number, Product>()
    products.forEach((product) => map.set(product.id, product))
    return map
  }, [products])
  const hsReferenceById = useMemo(() => {
    const map = new Map<number, HSCodeReference>()
    hsReferences.forEach((ref) => map.set(ref.id, ref))
    return map
  }, [hsReferences])

  const calcMut = useMutation({
    mutationFn: () => calculateCustoms(buildRequest(country, rows)),
    onSuccess: setResult,
  })

  const importInvoiceMut = useMutation({
    mutationFn: () => getInvoice(Number(invoiceId)),
    onSuccess: (invoice) => {
      const importedRows = invoice.items.length > 0
        ? invoice.items.map((item) => invoiceItemToRow(item, products))
        : [newRow()]
      setRows(importedRows)
      setResult(null)
      setInvoiceId(String(invoice.id))
      setClientId(invoice.client_id ? String(invoice.client_id) : '')
      if (!title) setTitle(invoiceTitle(invoice))
    },
  })

  const saveMut = useMutation({
    mutationFn: () => createCustomsEstimate({
      ...buildRequest(country, rows),
      title: compact(title),
      notes: compact(notes),
      client_id: optionalId(clientId),
      invoice_id: optionalId(invoiceId),
      booking_id: optionalId(bookingId),
      booking_cargo_line_id: optionalId(bookingCargoLineId),
    }),
    onSuccess: (estimate) => {
      setResult(estimateToResult(estimate))
      setTitle(estimate.title || estimate.estimate_number)
      setNotes(estimate.notes || '')
      setClientId(estimate.client_id ? String(estimate.client_id) : '')
      setInvoiceId(estimate.invoice_id ? String(estimate.invoice_id) : '')
      setBookingId(estimate.booking_id ? String(estimate.booking_id) : '')
      setBookingCargoLineId(estimate.booking_cargo_line_id ? String(estimate.booking_cargo_line_id) : '')
      qc.invalidateQueries({ queryKey: ['customs-estimates'] })
    },
  })

  const archiveMut = useMutation({
    mutationFn: archiveCustomsEstimate,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customs-estimates'] }),
  })

  function patchRow(id: string, patch: Partial<CalcRow>) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row))
  }

  function applyProduct(id: string, productId: string) {
    const product = productById.get(Number(productId))
    if (!product) {
      patchRow(id, { product_id: productId, hs_ref_id: '' })
      return
    }
    const matchingHsRef =
      hsReferences.find((ref) => ref.id === product.hs_code_ref_id)
      ?? hsReferences.find((ref) => ref.hs_code === product.hs_code)
    patchRow(id, {
      product_id: productId,
      hs_ref_id: matchingHsRef ? String(matchingHsRef.id) : '',
      description: product.name ?? '',
      description_ar: product.name_ar ?? '',
      hs_code: product.hs_code ?? '',
      customs_category: product.customs_category ?? product.category ?? '',
      unit_basis: (product.customs_unit_basis as UnitBasis) || 'dozen',
      pieces_per_carton: String(product.pcs_per_carton ?? ''),
      estimated_value_usd: product.customs_estimated_value_usd ?? product.price_usd ?? '',
      customs_duty_pct: product.customs_duty_pct ?? '',
      sales_tax_pct: product.sales_tax_pct ?? '',
      other_tax_pct: product.other_tax_pct ?? '',
    })
  }

  function applyHsReference(id: string, hsRefId: string) {
    const ref = hsReferenceById.get(Number(hsRefId))
    if (!ref) {
      patchRow(id, { hs_ref_id: hsRefId })
      return
    }
    patchRow(id, {
      hs_ref_id: hsRefId,
      hs_code: ref.hs_code,
      customs_category: isAr && ref.description_ar ? ref.description_ar : ref.description,
      description: ref.description,
      description_ar: ref.description_ar ?? '',
      unit_basis: (ref.customs_unit_basis as UnitBasis) || 'dozen',
      estimated_value_usd: ref.customs_estimated_value_usd ?? '',
      customs_duty_pct: ref.customs_duty_pct ?? '',
      sales_tax_pct: ref.sales_tax_pct ?? '',
      other_tax_pct: ref.other_tax_pct ?? '',
    })
  }

  function addRow() {
    setRows((current) => [...current, newRow()])
  }

  function removeRow(id: string) {
    setRows((current) => current.length > 1 ? current.filter((row) => row.id !== id) : current)
  }

  function applyClothingRate(id: string) {
    patchRow(id, { customs_duty_pct: '30', sales_tax_pct: '', other_tax_pct: '' })
  }

  function changeBooking(nextBookingId: string) {
    setBookingId(nextBookingId)
    setBookingCargoLineId('')
  }

  function changeCargoLine(nextLineId: string) {
    setBookingCargoLineId(nextLineId)
    const line = bookingCargoLines.find((item) => String(item.id) === nextLineId)
    if (!line) return
    setClientId(String(line.client.id))
    if (line.invoice_id) setInvoiceId(String(line.invoice_id))
  }

  function importCargoLine(line: BookingCargoLine | undefined) {
    if (!line) return
    setRows(cargoLineToRows(line, products))
    setResult(null)
    setBookingId(String(line.booking_id))
    setBookingCargoLineId(String(line.id))
    setClientId(String(line.client.id))
    if (line.invoice_id) setInvoiceId(String(line.invoice_id))
    if (!title) {
      setTitle(`${selectedBooking?.booking_number ?? t('containers.title')} - ${line.client.client_code}`)
    }
  }

  function loadEstimate(estimate: CustomsEstimate) {
    setCountry(estimate.country)
    setTitle(estimate.title || estimate.estimate_number)
    setNotes(estimate.notes || '')
    setClientId(estimate.client_id ? String(estimate.client_id) : '')
    setInvoiceId(estimate.invoice_id ? String(estimate.invoice_id) : '')
    setBookingId(estimate.booking_id ? String(estimate.booking_id) : '')
    setBookingCargoLineId(estimate.booking_cargo_line_id ? String(estimate.booking_cargo_line_id) : '')
    setRows(estimateToRows(estimate))
    setResult(estimateToResult(estimate))
  }

  function printReport() {
    if (!result) return
    const itemRows = result.items.map((item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${esc(isAr ? item.description_ar || item.description : item.description)}</td>
        <td>${esc(item.hs_code || '')}</td>
        <td>${esc(item.customs_category || '')}</td>
        <td>${esc(item.customs_units)} ${esc(item.unit_basis)}</td>
        <td>${esc(money(item.customs_base_usd))}</td>
        <td>${esc(pct(item.total_tax_pct))}</td>
        <td>${esc(money(item.total_taxes_usd))}</td>
        <td>${esc(money(item.landed_estimate_usd))}</td>
      </tr>
    `).join('')

    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!doctype html>
      <html dir="${isAr ? 'rtl' : 'ltr'}">
      <head>
        <meta charset="utf-8" />
        <title>${esc(t('tax_customs.print_title'))}</title>
        <style>
          body{font-family:Arial,sans-serif;margin:28px;color:#111827}
          h1{font-size:22px;margin:0 0 6px}
          .meta{color:#6b7280;margin-bottom:18px}
          .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:18px 0}
          .card{border:1px solid #d1d5db;border-radius:8px;padding:10px}
          .label{font-size:11px;color:#6b7280;text-transform:uppercase}
          .value{font-size:18px;font-weight:700;margin-top:4px}
          table{width:100%;border-collapse:collapse;margin-top:12px}
          th,td{border:1px solid #d1d5db;padding:8px;font-size:12px;text-align:${isAr ? 'right' : 'left'}}
          th{background:#f3f4f6}
          @media print{button{display:none}}
        </style>
      </head>
      <body>
        <button onclick="window.print()">${esc(t('tax_customs.print'))}</button>
        <h1>${esc(t('tax_customs.print_title'))}</h1>
        <div class="meta">${esc(t('tax_customs.country'))}: ${esc(result.country)} · USD</div>
        <div class="grid">
          <div class="card"><div class="label">${esc(t('tax_customs.product_value'))}</div><div class="value">${esc(money(result.totals.product_value_usd))}</div></div>
          <div class="card"><div class="label">${esc(t('tax_customs.customs_base'))}</div><div class="value">${esc(money(result.totals.customs_base_usd))}</div></div>
          <div class="card"><div class="label">${esc(t('tax_customs.total_taxes'))}</div><div class="value">${esc(money(result.totals.total_taxes_usd))}</div></div>
          <div class="card"><div class="label">${esc(t('tax_customs.landed_estimate'))}</div><div class="value">${esc(money(result.totals.landed_estimate_usd))}</div></div>
        </div>
        <table>
          <thead><tr>
            <th>#</th><th>${esc(t('tax_customs.product'))}</th><th>${esc(t('tax_customs.hs_code'))}</th>
            <th>${esc(t('tax_customs.category'))}</th><th>${esc(t('tax_customs.units'))}</th>
            <th>${esc(t('tax_customs.customs_base'))}</th><th>${esc(t('tax_customs.total_tax_pct'))}</th>
            <th>${esc(t('tax_customs.total_taxes'))}</th><th>${esc(t('tax_customs.landed_estimate'))}</th>
          </tr></thead>
          <tbody>${itemRows}</tbody>
        </table>
      </body>
      </html>`)
    win.document.close()
  }

  const summary = result?.totals

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-brand-primary-light">
            <Calculator size={16} />
            {t('tax_customs.badge')}
          </div>
          <h1 className="page-title mt-1">{t('tax_customs.title')}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={addRow}>
            <Plus size={16} />
            {t('tax_customs.add_item')}
          </Button>
          <Button onClick={() => calcMut.mutate()} loading={calcMut.isPending}>
            <RefreshCw size={16} />
            {t('tax_customs.calculate')}
          </Button>
          <Button variant="secondary" onClick={printReport} disabled={!result}>
            <Printer size={16} />
            {t('tax_customs.print')}
          </Button>
          <Button variant="secondary" onClick={() => saveMut.mutate()} loading={saveMut.isPending}>
            <Save size={16} />
            {t('tax_customs.save_estimate')}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-brand-border bg-brand-surface/60 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Input
            label={t('tax_customs.estimate_title')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="space-y-1.5">
            <label className="label-base">{t('tax_customs.country')}</label>
            <select value={country} onChange={(e) => setCountry(e.target.value)} className="input-base w-full">
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <Input label={t('common.currency')} value="USD" disabled />
          <div className="rounded-lg border border-brand-border bg-white/[0.03] px-3 py-2">
            <p className="text-xs text-brand-text-muted">{t('tax_customs.line_count')}</p>
            <p className="text-xl font-black text-brand-text">{rows.length}</p>
          </div>
        </div>
        <div className="mt-4">
          <Input
            label={t('common.notes')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <FormSection title={t('tax_customs.linked_records')}>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label className="label-base">{t('clients.title')}</label>
              <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="input-base w-full">
                <option value="">{t('tax_customs.no_link')}</option>
                {(clientsData?.results ?? []).map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.client_code} — {isAr ? client.name_ar || client.name : client.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="label-base">{t('invoices.title')}</label>
              <select value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} className="input-base w-full">
                <option value="">{t('tax_customs.no_link')}</option>
                {(invoicesData?.results ?? []).map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>
                    {invoice.invoice_number} — {invoice.invoice_type} — {money(invoice.total)}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => importInvoiceMut.mutate()}
                disabled={!invoiceId}
                loading={importInvoiceMut.isPending}
              >
                {t('tax_customs.import_invoice_items')}
              </Button>
            </div>
            <div className="space-y-1.5">
              <label className="label-base">{t('containers.title')}</label>
              <select value={bookingId} onChange={(e) => changeBooking(e.target.value)} className="input-base w-full">
                <option value="">{t('tax_customs.no_link')}</option>
                {(bookingsData?.results ?? []).map((booking) => (
                  <option key={booking.id} value={booking.id}>
                    {booking.booking_number} — {booking.mode}{booking.container_size ? ` / ${booking.container_size}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="label-base">{t('tax_customs.cargo_line')}</label>
              <select
                value={bookingCargoLineId}
                onChange={(e) => changeCargoLine(e.target.value)}
                className="input-base w-full"
                disabled={!bookingId}
              >
                <option value="">{bookingId ? t('tax_customs.no_link') : t('tax_customs.select_container_first')}</option>
                {bookingCargoLines.map((line) => (
                  <option key={line.id} value={line.id}>
                    {line.client.client_code} — {isAr ? line.client.name_ar || line.client.name : line.client.name}
                    {line.cbm != null ? ` — ${Number(line.cbm).toFixed(3)} CBM` : ''}
                    {line.invoice_number ? ` — ${line.invoice_number}` : ''}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => importCargoLine(selectedCargoLine)}
                disabled={!selectedCargoLine}
              >
                {t('tax_customs.import_cargo_goods')}
              </Button>
            </div>
          </div>
        </FormSection>
      </div>

      <div className="rounded-xl border border-brand-border bg-brand-surface/60 p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold text-brand-text">{t('tax_customs.saved_estimates')}</h2>
          <span className="text-xs text-brand-text-muted">{estimatesData?.total ?? 0}</span>
        </div>
        {(estimatesData?.results ?? []).length === 0 ? (
          <p className="text-sm text-brand-text-muted">{t('tax_customs.no_saved_estimates')}</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {(estimatesData?.results ?? []).map((estimate) => (
              <div key={estimate.id} className="rounded-lg border border-brand-border bg-white/[0.03] px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-brand-text truncate">
                      {estimate.title || estimate.estimate_number}
                    </p>
                    <p className="text-xs text-brand-text-muted mt-0.5">
                      {estimate.estimate_number} · {estimate.country} · {new Date(estimate.created_at).toLocaleDateString()}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {estimate.client && (
                        <span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-[11px] text-brand-primary-light">
                          {estimate.client.client_code} · {isAr ? estimate.client.name_ar || estimate.client.name : estimate.client.name}
                        </span>
                      )}
                      {estimate.invoice && (
                        <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-[11px] text-yellow-300">
                          {estimate.invoice.invoice_number}
                        </span>
                      )}
                      {estimate.booking && (
                        <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[11px] text-cyan-300">
                          {estimate.booking.booking_number}
                        </span>
                      )}
                      {estimate.cargo_line && (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
                          {estimate.cargo_line.client_code || estimate.cargo_line.client_name || `#${estimate.cargo_line.id}`}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm font-black text-brand-green tabular-nums">{money(estimate.landed_estimate_usd)}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => loadEstimate(estimate)}>
                    <FolderOpen size={14} />
                    {t('tax_customs.load_estimate')}
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => archiveMut.mutate(estimate.id)} loading={archiveMut.isPending}>
                    <Trash2 size={14} />
                    {t('tax_customs.archive')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {rows.map((row, index) => {
          const lineResult = result?.items[index]
          return (
            <div key={row.id} className="rounded-xl border border-brand-border bg-brand-surface/60 p-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-brand-text-dim">
                    {t('tax_customs.item')} {index + 1}
                  </p>
                  <p className="text-sm font-semibold text-brand-text mt-1">
                    {row.description || t('tax_customs.manual_item')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  className="p-2 rounded-lg text-brand-text-muted hover:text-brand-red hover:bg-brand-red/10 transition-colors"
                  disabled={rows.length === 1}
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <FormSection title={t('tax_customs.product_data')}>
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-5 gap-4">
                  <div className="space-y-1.5">
                    <label className="label-base">{t('tax_customs.product')}</label>
                    <select
                      value={row.product_id}
                      onChange={(e) => applyProduct(row.id, e.target.value)}
                      className="input-base w-full"
                    >
                      <option value="">{t('tax_customs.manual_item')}</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.code} — {isAr ? product.name_ar || product.name : product.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="label-base">{t('products.hs_code_reference')}</label>
                    <select
                      value={row.hs_ref_id}
                      onChange={(e) => applyHsReference(row.id, e.target.value)}
                      className="input-base w-full"
                    >
                      <option value="">{t('tax_customs.manual_item')}</option>
                      {hsReferences.map((ref) => (
                        <option key={ref.id} value={ref.id}>
                          {ref.country} · {ref.hs_code} · {isAr && ref.description_ar ? ref.description_ar : ref.description}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Input
                    label={t('tax_customs.description')}
                    value={row.description}
                    onChange={(e) => patchRow(row.id, { description: e.target.value })}
                  />
                  <Input
                    label={t('tax_customs.hs_code')}
                    value={row.hs_code}
                    onChange={(e) => patchRow(row.id, { hs_code: e.target.value })}
                  />
                  <Input
                    label={t('tax_customs.category')}
                    value={row.customs_category}
                    onChange={(e) => patchRow(row.id, { customs_category: e.target.value })}
                  />
                </div>
              </FormSection>

              <FormSection title={t('tax_customs.quantity')}>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
                  <Input label={t('tax_customs.cartons')} type="number" step="0.001" value={row.cartons} onChange={(e) => patchRow(row.id, { cartons: e.target.value })} />
                  <Input label={t('tax_customs.pieces_per_carton')} type="number" step="0.001" value={row.pieces_per_carton} onChange={(e) => patchRow(row.id, { pieces_per_carton: e.target.value })} />
                  <Input label={t('tax_customs.total_pieces')} type="number" step="0.001" value={row.quantity_pieces} onChange={(e) => patchRow(row.id, { quantity_pieces: e.target.value })} />
                  <Input label={t('tax_customs.gross_weight_kg')} type="number" step="0.001" value={row.gross_weight_kg} onChange={(e) => patchRow(row.id, { gross_weight_kg: e.target.value })} />
                  <div className="space-y-1.5">
                    <label className="label-base">{t('tax_customs.unit_basis')}</label>
                    <select value={row.unit_basis} onChange={(e) => patchRow(row.id, { unit_basis: e.target.value as UnitBasis })} className="input-base w-full">
                      <option value="dozen">{t('products.unit_dozen')}</option>
                      <option value="piece">{t('products.unit_piece')}</option>
                      <option value="kg">{t('products.unit_kg')}</option>
                      <option value="carton">{t('products.unit_carton')}</option>
                    </select>
                  </div>
                </div>
              </FormSection>

              <FormSection title={t('tax_customs.rates')}>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
                  <Input label={t('tax_customs.value_per_unit')} type="number" step="0.0001" value={row.estimated_value_usd} onChange={(e) => patchRow(row.id, { estimated_value_usd: e.target.value })} />
                  <Input label={t('tax_customs.shipping_per_unit')} type="number" step="0.0001" value={row.shipping_cost_per_unit_usd} onChange={(e) => patchRow(row.id, { shipping_cost_per_unit_usd: e.target.value })} />
                  <Input label={t('tax_customs.shipping_total')} type="number" step="0.01" value={row.shipping_cost_total_usd} onChange={(e) => patchRow(row.id, { shipping_cost_total_usd: e.target.value })} />
                  <Input label={t('tax_customs.customs_duty_pct')} type="number" step="0.01" value={row.customs_duty_pct} onChange={(e) => patchRow(row.id, { customs_duty_pct: e.target.value })} />
                  <Input label={t('tax_customs.sales_tax_pct')} type="number" step="0.01" value={row.sales_tax_pct} onChange={(e) => patchRow(row.id, { sales_tax_pct: e.target.value })} />
                  <Input label={t('tax_customs.other_tax_pct')} type="number" step="0.01" value={row.other_tax_pct} onChange={(e) => patchRow(row.id, { other_tax_pct: e.target.value })} />
                </div>
                <Button type="button" size="sm" variant="secondary" onClick={() => applyClothingRate(row.id)}>
                  {t('tax_customs.apply_clothing_30')}
                </Button>
              </FormSection>

              {lineResult && (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 pt-2 border-t border-brand-border/60">
                  <MiniStat label={t('tax_customs.units')} value={`${lineResult.customs_units} ${t(`tax_customs.units_short.${lineResult.unit_basis}`, lineResult.unit_basis)}`} />
                  <MiniStat label={t('tax_customs.product_value')} value={money(lineResult.product_value_usd)} />
                  <MiniStat label={t('tax_customs.customs_base')} value={money(lineResult.customs_base_usd)} />
                  <MiniStat label={`${t('tax_customs.total_taxes')} (${pct(lineResult.total_tax_pct)})`} value={money(lineResult.total_taxes_usd)} tone="warn" />
                  <MiniStat label={t('tax_customs.landed_estimate')} value={money(lineResult.landed_estimate_usd)} tone="good" />
                  {lineResult.warnings.length > 0 && (
                    <div className="col-span-2 lg:col-span-5 flex flex-wrap gap-2">
                      {lineResult.warnings.map((warning) => (
                        <span key={warning} className="inline-flex items-center gap-1 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-1 text-[11px] text-yellow-300">
                          <AlertTriangle size={12} />
                          {warning}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {summary && (
        <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MiniStat label={t('tax_customs.product_value')} value={money(summary.product_value_usd)} />
            <MiniStat label={t('tax_customs.shipping_total')} value={money(summary.shipping_cost_usd)} />
            <MiniStat label={t('tax_customs.customs_base')} value={money(summary.customs_base_usd)} />
            <MiniStat label={t('tax_customs.total_taxes')} value={money(summary.total_taxes_usd)} tone="warn" />
            <MiniStat label={t('tax_customs.customs_duty')} value={money(summary.customs_duty_usd)} />
            <MiniStat label={t('tax_customs.sales_tax')} value={money(summary.sales_tax_usd)} />
            <MiniStat label={t('tax_customs.other_tax')} value={money(summary.other_tax_usd)} />
            <MiniStat label={t('tax_customs.landed_estimate')} value={money(summary.landed_estimate_usd)} tone="good" />
          </div>
        </div>
      )}

      {calcMut.isError && (
        <div className="rounded-lg border border-brand-red/30 bg-brand-red/10 px-3 py-2 text-sm text-brand-red">
          {(calcMut.error as any)?.response?.data?.detail ?? t('tax_customs.calculate_error')}
        </div>
      )}
      {saveMut.isError && (
        <div className="rounded-lg border border-brand-red/30 bg-brand-red/10 px-3 py-2 text-sm text-brand-red">
          {(saveMut.error as any)?.response?.data?.detail ?? t('tax_customs.save_error')}
        </div>
      )}
      {importInvoiceMut.isError && (
        <div className="rounded-lg border border-brand-red/30 bg-brand-red/10 px-3 py-2 text-sm text-brand-red">
          {(importInvoiceMut.error as any)?.response?.data?.detail ?? t('tax_customs.import_invoice_error')}
        </div>
      )}
    </div>
  )
}

function MiniStat({ label, value, tone = 'normal' }: { label: string; value: string; tone?: 'normal' | 'warn' | 'good' }) {
  return (
    <div className="rounded-lg border border-brand-border bg-white/[0.03] px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-brand-text-muted">{label}</p>
      <p className={
        tone === 'good'
          ? 'mt-1 text-lg font-black text-brand-green tabular-nums'
          : tone === 'warn'
            ? 'mt-1 text-lg font-black text-yellow-300 tabular-nums'
            : 'mt-1 text-lg font-black text-brand-text tabular-nums'
      }>
        {value}
      </p>
    </div>
  )
}
