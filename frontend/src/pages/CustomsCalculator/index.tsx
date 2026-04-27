import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery } from '@tanstack/react-query'
import { AlertTriangle, Calculator, Plus, Printer, RefreshCw, Trash2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import { FormSection, Input } from '@/components/ui/Form'
import { listProducts } from '@/services/productService'
import { calculateCustoms } from '@/services/customsCalculatorService'
import type { CustomsCalculatorResponse, Product } from '@/types'

type UnitBasis = 'dozen' | 'piece' | 'kg' | 'carton'

interface CalcRow {
  id: string
  product_id: string
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

function newRow(): CalcRow {
  return {
    id: crypto.randomUUID(),
    product_id: '',
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

export default function CustomsCalculatorPage() {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === 'ar'
  const [country, setCountry] = useState('Jordan')
  const [rows, setRows] = useState<CalcRow[]>([newRow()])
  const [result, setResult] = useState<CustomsCalculatorResponse | null>(null)

  const { data: productsData } = useQuery({
    queryKey: ['customs-calculator-products'],
    queryFn: () => listProducts({ page: 1, page_size: 100 }),
  })

  const products = productsData?.results ?? []
  const productById = useMemo(() => {
    const map = new Map<number, Product>()
    products.forEach((product) => map.set(product.id, product))
    return map
  }, [products])

  const calcMut = useMutation({
    mutationFn: () => calculateCustoms({
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
    }),
    onSuccess: setResult,
  })

  function patchRow(id: string, patch: Partial<CalcRow>) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row))
  }

  function applyProduct(id: string, productId: string) {
    const product = productById.get(Number(productId))
    if (!product) {
      patchRow(id, { product_id: productId })
      return
    }
    patchRow(id, {
      product_id: productId,
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

  function addRow() {
    setRows((current) => [...current, newRow()])
  }

  function removeRow(id: string) {
    setRows((current) => current.length > 1 ? current.filter((row) => row.id !== id) : current)
  }

  function applyClothingRate(id: string) {
    patchRow(id, { customs_duty_pct: '30', sales_tax_pct: '', other_tax_pct: '' })
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
        </div>
      </div>

      <div className="rounded-xl border border-brand-border bg-brand-surface/60 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
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
