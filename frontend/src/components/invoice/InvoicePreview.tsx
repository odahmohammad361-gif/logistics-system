import { useEffect, useState } from 'react'
import { Printer, Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Invoice } from '@/types'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { downloadPdf, getInvoiceBarcode } from '@/services/invoiceService'

interface Props {
  invoice: Invoice
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-brand-text-muted">{label}</p>
      <p className="text-sm text-brand-text">{value}</p>
    </div>
  )
}

async function handlePrint(invoiceId: number, lang: 'en' | 'ar' = 'ar') {
  // Fetch as authenticated blob (axios sends Bearer token), then print
  const blob = await downloadPdf(invoiceId, lang)
  const url  = URL.createObjectURL(blob)
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0;'
  iframe.src = url
  document.body.appendChild(iframe)
  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } catch {
      window.open(url, '_blank')
    }
    setTimeout(() => {
      document.body.removeChild(iframe)
      URL.revokeObjectURL(url)
    }, 60000) // keep alive for 60s so print dialog can load it
  }
}

async function handleDownload(invoice: Invoice, lang: 'en' | 'ar' = 'ar') {
  const blob = await downloadPdf(invoice.id, lang)
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${invoice.invoice_number}_${lang}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

export default function InvoicePreview({ invoice }: Props) {
  const { t } = useTranslation()
  const [barcodeUrl, setBarcodeUrl] = useState<string | null>(null)

  useEffect(() => {
    let url: string | null = null
    getInvoiceBarcode(invoice.id)
      .then((blob) => {
        url = URL.createObjectURL(blob)
        setBarcodeUrl(url)
      })
      .catch(() => {})
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [invoice.id])

  return (
    <div className="space-y-5 text-sm">

      {/* Print / Download buttons */}
      <div className="flex flex-wrap gap-2 pb-3 border-b border-brand-border">
        <Button size="sm" variant="secondary" onClick={() => void handlePrint(invoice.id, 'ar')}>
          <Printer size={13} /> {t('common.print_ar', 'طباعة عربي')}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => void handlePrint(invoice.id, 'en')}>
          <Printer size={13} /> {t('common.print_en', 'طباعة إنجليزي')}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => handleDownload(invoice, 'ar')}>
          <Download size={13} /> PDF {t('common.arabic', 'عربي')}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => handleDownload(invoice, 'en')}>
          <Download size={13} /> PDF {t('common.english', 'إنجليزي')}
        </Button>
      </div>

      {/* Barcode */}
      {barcodeUrl && (
        <div className="flex justify-center py-2 bg-white rounded-lg border border-brand-border/30">
          <img src={barcodeUrl} alt={invoice.invoice_number} className="h-14 w-auto" />
        </div>
      )}

      {/* Invoice header */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <p className="text-xs text-brand-text-muted">{t('invoices.number')}</p>
          <p className="font-mono font-semibold text-brand-text">{invoice.invoice_number}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-brand-text-muted">{t('common.status')}</p>
          <Badge value={invoice.status} label={t(`invoices.status.${invoice.status}`, invoice.status)} />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-brand-text-muted">{t('invoices.type')}</p>
          <p className="text-brand-primary font-semibold">
            {t(`invoices.types.${invoice.invoice_type}`, invoice.invoice_type)}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-brand-text-muted">{t('common.currency')}</p>
          <p className="font-mono font-semibold text-emerald-400">{invoice.currency}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-brand-text-muted">{t('invoices.client')}</p>
          <p className="text-brand-text font-medium">
            {invoice.client?.name ?? invoice.buyer_name ?? '—'}
            {!invoice.client && (
              <span className="ms-1 text-[10px] text-purple-400">({t('invoices.unregistered')})</span>
            )}
          </p>
          {invoice.client && <p className="text-xs text-brand-text-muted font-mono">{invoice.client.client_code}</p>}
        </div>
        <div className="space-y-1">
          <p className="text-xs text-brand-text-muted">{t('invoices.issue_date')}</p>
          <p className="text-brand-text">{invoice.issue_date?.slice(0, 10)}</p>
          {invoice.due_date && (
            <>
              <p className="text-xs text-brand-text-muted mt-1">{t('invoices.due_date')}</p>
              <p className="text-brand-text">{invoice.due_date?.slice(0, 10)}</p>
            </>
          )}
        </div>
      </div>

      {/* Shipping & Trade */}
      {(invoice.origin || invoice.shipping_term || invoice.payment_terms ||
        invoice.port_of_loading || invoice.port_of_discharge || invoice.shipping_marks) && (
        <div className="rounded-lg bg-brand-surface border border-brand-border p-4 space-y-3">
          <p className="text-xs font-semibold text-brand-primary">{t('invoices.shipping_info_title', 'بيانات الشحن والتجارة')}</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('invoices.origin')}          value={invoice.origin} />
            <Field label={t('invoices.shipping_term')}   value={invoice.shipping_term} />
            <Field label={t('invoices.payment_terms')}   value={invoice.payment_terms} />
            <Field label={t('invoices.shipping_marks')}  value={invoice.shipping_marks} />
            <Field label={t('invoices.port_loading')}    value={invoice.port_of_loading} />
            <Field label={t('invoices.port_discharge')}  value={invoice.port_of_discharge} />
          </div>
        </div>
      )}

      {/* Container & B/L */}
      {(invoice.container_no || invoice.seal_no || invoice.bl_number ||
        invoice.vessel_name || invoice.voyage_number) && (
        <div className="rounded-lg bg-brand-surface border border-brand-border p-4 space-y-3">
          <p className="text-xs font-semibold text-brand-primary">{t('invoices.container_bl_title', 'بيانات الحاوية وسند الشحن')}</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('invoices.container_no')}   value={invoice.container_no} />
            <Field label={t('invoices.seal_no')}        value={invoice.seal_no} />
            <Field label={t('invoices.bl_number')}      value={invoice.bl_number} />
            <Field label={t('invoices.vessel')}         value={invoice.vessel_name} />
            <Field label={t('invoices.voyage_number')}  value={invoice.voyage_number} />
          </div>
        </div>
      )}

      {/* Items */}
      {invoice.items && invoice.items.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-brand-primary border-b border-brand-border pb-2 mb-3">
            {t('invoices.items')} ({invoice.items.length})
          </p>
          <div className="space-y-2">
            {invoice.items.map((item, i) => (
              <div key={i} className="py-2.5 border-b border-brand-border/40 last:border-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-brand-text text-sm font-medium">{item.description}</p>
                    {item.description_ar && (
                      <p className="text-xs text-brand-text-dim mt-0.5">{item.description_ar}</p>
                    )}
                    {item.details && <p className="text-xs text-brand-text-muted mt-0.5">{item.details}</p>}
                    {item.hs_code && (
                      <p className="text-xs text-brand-text-muted mt-0.5">
                        {t('invoices.hs_code')}: <span className="font-mono">{item.hs_code}</span>
                      </p>
                    )}
                  </div>
                  <div className="text-end shrink-0">
                    <p className="text-xs text-brand-text-muted">
                      {item.quantity} {item.unit ? t(`invoices.units.${item.unit}`, item.unit) : t('invoices.units.pcs')} × {Number(item.unit_price).toFixed(2)} {invoice.currency}
                    </p>
                    <p className="text-brand-text font-semibold">{Number(item.total_price).toFixed(2)} {invoice.currency}</p>
                  </div>
                </div>
                {(item.cartons || item.gross_weight || item.cbm) && (
                  <div className="flex flex-wrap gap-3 text-xs text-brand-text-muted mt-1.5 font-mono">
                    {item.cartons      != null && <span>{item.cartons} {t('invoices.units.cartons')}</span>}
                    {item.gross_weight != null && <span>{t('invoices.gross_weight')}: {item.gross_weight}</span>}
                    {item.net_weight   != null && <span>{t('invoices.net_weight')}: {item.net_weight}</span>}
                    {item.cbm          != null && <span>{t('invoices.cbm')}: {item.cbm}</span>}
                    {item.chargeable_weight_kg != null && (
                      <span className="text-blue-400">{t('invoices.chargeable_weight')}: {item.chargeable_weight_kg}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Totals */}
      <div className="rounded-xl bg-brand-surface border border-brand-border p-4 space-y-2">
        <div className="flex justify-between text-sm text-brand-text-dim">
          <span>{t('invoices.subtotal')}</span>
          <span className="font-mono">{Number(invoice.subtotal).toFixed(2)} {invoice.currency}</span>
        </div>
        {Number(invoice.discount) > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-brand-text-dim">{t('invoices.discount')}</span>
            <span className="text-brand-red font-mono">- {Number(invoice.discount).toFixed(2)} {invoice.currency}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-bold border-t border-brand-border pt-2">
          <span className="text-brand-text">{t('invoices.total')}</span>
          <span className="text-emerald-400 font-mono">{Number(invoice.total).toFixed(2)} {invoice.currency}</span>
        </div>
      </div>

      {/* Notes */}
      {(invoice.notes_ar || invoice.notes) && (
        <div className="space-y-2">
          {invoice.notes_ar && (
            <div>
              <p className="text-xs text-brand-text-muted mb-1">{t('common.notes')}</p>
              <p className="text-sm text-brand-text-dim bg-brand-surface rounded-lg p-3 border border-brand-border/50">{invoice.notes_ar}</p>
            </div>
          )}
          {invoice.notes && (
            <div>
              <p className="text-xs text-brand-text-muted mb-1">Notes</p>
              <p className="text-sm text-brand-text-dim bg-brand-surface rounded-lg p-3 border border-brand-border/50">{invoice.notes}</p>
            </div>
          )}
        </div>
      )}

    </div>
  )
}
