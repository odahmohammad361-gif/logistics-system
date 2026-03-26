import { useTranslation } from 'react-i18next'
import { Printer, Download } from 'lucide-react'
import type { Invoice } from '@/types'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { getPdfUrl, downloadPdf } from '@/services/invoiceService'

interface Props {
  invoice: Invoice
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm text-gray-200">{value}</p>
    </div>
  )
}

function handlePrint(invoiceId: number, lang: 'en' | 'ar' = 'en') {
  const url = getPdfUrl(invoiceId, lang)
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0;'
  iframe.src = url
  document.body.appendChild(iframe)
  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } catch {
      // fallback: open in new tab
      window.open(url, '_blank')
    }
    setTimeout(() => document.body.removeChild(iframe), 2000)
  }
}

async function handleDownload(invoice: Invoice, lang: 'en' | 'ar' = 'en') {
  const blob = await downloadPdf(invoice.id, lang)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${invoice.invoice_number}_${lang}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

export default function InvoicePreview({ invoice }: Props) {
  const { t } = useTranslation()

  return (
    <div className="space-y-5 text-sm">

      {/* Print / Download actions */}
      <div className="flex flex-wrap gap-2 pb-2 border-b border-brand-border">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => handlePrint(invoice.id, 'en')}
        >
          <Printer size={13} /> Print (EN)
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => handlePrint(invoice.id, 'ar')}
        >
          <Printer size={13} /> Print (AR)
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => handleDownload(invoice, 'en')}
        >
          <Download size={13} /> PDF (EN)
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => handleDownload(invoice, 'ar')}
        >
          <Download size={13} /> PDF (AR)
        </Button>
      </div>

      {/* Header info */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <p className="text-xs text-gray-400">{t('invoices.number')}</p>
          <p className="font-mono font-semibold text-white">{invoice.invoice_number}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-gray-400">{t('common.status')}</p>
          <Badge value={invoice.status} label={t(`invoices.status.${invoice.status}`)} />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-gray-400">{t('invoices.type')}</p>
          <p className="text-brand-green font-semibold uppercase">{invoice.invoice_type}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-gray-400">{t('invoices.date')}</p>
          <p className="text-white">{invoice.issue_date?.slice(0, 10)}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-gray-400">{t('clients.title')}</p>
          <p className="text-white">{invoice.client?.name}</p>
          <p className="text-xs text-gray-500">{invoice.client?.client_code}</p>
        </div>
        {invoice.due_date && (
          <div className="space-y-1">
            <p className="text-xs text-gray-400">{t('invoices.due_date')}</p>
            <p className="text-white">{invoice.due_date?.slice(0, 10)}</p>
          </div>
        )}
      </div>

      {/* Shipping details */}
      {(invoice.origin || invoice.shipping_term || invoice.payment_terms ||
        invoice.port_of_loading || invoice.port_of_discharge) && (
        <div className="grid grid-cols-2 gap-3 p-3 bg-brand-surface rounded-lg border border-brand-border">
          <Field label="Origin" value={invoice.origin} />
          <Field label="Shipping Term" value={invoice.shipping_term} />
          <Field label="Payment Terms" value={invoice.payment_terms} />
          <Field label="Port of Loading" value={invoice.port_of_loading} />
          <Field label="Port of Discharge" value={invoice.port_of_discharge} />
          <Field label="Shipping Marks" value={invoice.shipping_marks} />
        </div>
      )}

      {/* Container / B/L details */}
      {(invoice.container_no || invoice.seal_no || invoice.bl_number ||
        invoice.vessel_name || invoice.voyage_number) && (
        <div className="grid grid-cols-2 gap-3 p-3 bg-brand-surface rounded-lg border border-brand-border">
          <p className="col-span-2 text-xs font-semibold text-brand-green">Container / B/L Details</p>
          <Field label="Container No." value={invoice.container_no} />
          <Field label="Seal No." value={invoice.seal_no} />
          <Field label="B/L No." value={invoice.bl_number} />
          <Field label="Vessel" value={invoice.vessel_name} />
          <Field label="Voyage No." value={invoice.voyage_number} />
          {invoice.container && (
            <div className="space-y-0.5">
              <p className="text-xs text-gray-500">Linked Container</p>
              <p className="text-sm text-gray-200 font-mono">{invoice.container.booking_number}</p>
            </div>
          )}
        </div>
      )}

      {/* Items table */}
      {invoice.items && invoice.items.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-brand-green border-b border-brand-border pb-2 mb-3">
            {t('invoices.items')}
          </p>
          <div className="space-y-2">
            {invoice.items.map((item, i) => (
              <div key={i} className="py-2 border-b border-brand-border/50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">{item.description}</p>
                    {item.details && <p className="text-xs text-gray-500 mt-0.5">{item.details}</p>}
                    {item.hs_code && <p className="text-xs text-gray-600">HS: {item.hs_code}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-400">
                      {item.quantity} × ${Number(item.unit_price).toFixed(2)}
                    </p>
                    <p className="text-white font-semibold">${Number(item.total_price).toFixed(2)}</p>
                  </div>
                </div>
                {(item.cartons || item.gross_weight || item.cbm) && (
                  <div className="flex gap-3 text-xs text-gray-600 mt-1 font-mono">
                    {item.cartons != null && <span>{item.cartons} CTN</span>}
                    {item.gross_weight != null && <span>{item.gross_weight} kg</span>}
                    {item.cbm != null && <span>{item.cbm} CBM</span>}
                    {item.chargeable_weight_kg != null && (
                      <span className="text-blue-400">Chargeable: {item.chargeable_weight_kg} kg</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Totals */}
      <div className="bg-brand-surface rounded-lg p-4 space-y-2">
        <div className="flex justify-between text-sm text-gray-400">
          <span>{t('invoices.subtotal')}</span>
          <span>${Number(invoice.subtotal).toFixed(2)}</span>
        </div>
        {Number(invoice.discount) > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">{t('invoices.discount')}</span>
            <span className="text-red-400">-${Number(invoice.discount).toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-bold border-t border-brand-border pt-2">
          <span className="text-white">{t('invoices.total')}</span>
          <span className="text-brand-green">${Number(invoice.total).toFixed(2)}</span>
        </div>
      </div>

      {/* Notes */}
      {invoice.notes && (
        <div>
          <p className="text-xs text-gray-400 mb-1">{t('common.notes')}</p>
          <p className="text-sm text-gray-300 bg-brand-surface rounded p-3">{invoice.notes}</p>
        </div>
      )}
    </div>
  )
}
