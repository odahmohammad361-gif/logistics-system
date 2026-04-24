import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import {
  User, FileText, Package, LogOut, Building2, Phone,
  Mail, MapPin, Ship, Plane, Boxes, CheckCircle2,
  Clock, AlertTriangle, XCircle, Anchor,
} from 'lucide-react'
import ShopLayout from '@/components/layout/ShopLayout'
import { useClientPortalStore } from '@/store/clientPortalStore'
import { clientPortalInvoices, clientPortalShipments } from '@/services/clientPortalService'
import type { ClientShipment, ClientInvoice } from '@/services/clientPortalService'
import clsx from 'clsx'

// ── Status configs ─────────────────────────────────────────────────────────────
const BOOKING_STATUS: Record<string, { en: string; ar: string; color: string; icon: React.ElementType }> = {
  draft:      { en: 'Draft',      ar: 'مسودة',        color: 'text-gray-400  bg-gray-400/10  border-gray-400/20',  icon: Clock },
  confirmed:  { en: 'Confirmed',  ar: 'مؤكد',          color: 'text-blue-400  bg-blue-400/10  border-blue-400/20',  icon: CheckCircle2 },
  in_transit: { en: 'In Transit', ar: 'في الطريق',     color: 'text-amber-400 bg-amber-400/10 border-amber-400/20', icon: Ship },
  arrived:    { en: 'Arrived',    ar: 'وصل',           color: 'text-green-400 bg-green-400/10 border-green-400/20', icon: Anchor },
  delivered:  { en: 'Delivered',  ar: 'تم التسليم',    color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', icon: CheckCircle2 },
  cancelled:  { en: 'Cancelled',  ar: 'ملغى',          color: 'text-red-400   bg-red-400/10   border-red-400/20',   icon: XCircle },
}

const INV_STATUS: Record<string, { en: string; ar: string; color: string }> = {
  draft:     { en: 'Draft',       ar: 'مسودة',     color: 'text-gray-400   bg-gray-400/10   border-gray-400/20'   },
  sent:      { en: 'Sent',        ar: 'مُرسلة',    color: 'text-blue-400   bg-blue-400/10   border-blue-400/20'   },
  approved:  { en: 'Approved',    ar: 'معتمدة',    color: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20' },
  paid:      { en: 'Paid',        ar: 'مدفوعة',    color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  cancelled: { en: 'Cancelled',   ar: 'ملغاة',     color: 'text-red-400    bg-red-400/10    border-red-400/20'    },
  dummy:     { en: 'Unconfirmed', ar: 'غير معتمدة',color: 'text-purple-400 bg-purple-400/10 border-purple-400/20' },
}

// ── CBM Bar ────────────────────────────────────────────────────────────────────
function CbmBar({ myCbm, totalUsed, maxCbm, myPct, isAr }: {
  myCbm: number; totalUsed: number; maxCbm: number; myPct: number; isAr: boolean
}) {
  const totalPct = Math.min((totalUsed / maxCbm) * 100, 100)
  const myStart  = Math.min(((totalUsed - myCbm) / maxCbm) * 100, 100)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-400">
          {isAr ? 'سعة الحاوية' : 'Container capacity'}
        </span>
        <span className="text-gray-300 font-mono">{totalUsed.toFixed(1)} / {maxCbm} CBM</span>
      </div>

      {/* Bar */}
      <div className="relative w-full h-4 rounded-full bg-white/10 overflow-hidden">
        {/* Total filled (grey) */}
        <div
          className="absolute inset-y-0 start-0 bg-white/15 rounded-full transition-all"
          style={{ width: `${totalPct}%` }}
        />
        {/* My portion (brand color) */}
        <div
          className="absolute inset-y-0 bg-brand-primary rounded-full transition-all"
          style={{ [isAr ? 'right' : 'left']: `${myStart}%`, width: `${myPct}%` }}
        />
      </div>

      <div className="flex items-center gap-3 text-[11px]">
        <span className="flex items-center gap-1 text-brand-primary-light">
          <span className="w-2 h-2 rounded-full bg-brand-primary inline-block" />
          {isAr ? 'حمولتي:' : 'My cargo:'} {myCbm.toFixed(2)} CBM ({myPct.toFixed(1)}%)
        </span>
        <span className="text-gray-500">
          {isAr ? 'إجمالي مشغول:' : 'Total used:'} {totalPct.toFixed(1)}%
        </span>
      </div>
    </div>
  )
}

// ── Shipment Card ──────────────────────────────────────────────────────────────
function ShipmentCard({ s, isAr }: { s: ClientShipment; isAr: boolean }) {
  const cfg    = BOOKING_STATUS[s.status] ?? BOOKING_STATUS.draft
  const StatusIcon = cfg.icon
  const ModeIcon   = s.mode === 'AIR' ? Plane : s.mode === 'LCL' ? Boxes : Ship

  const daysLabel = (() => {
    const target = s.status === 'draft' || s.status === 'confirmed' ? s.etd : s.eta
    if (!target) return null
    const diff = Math.round((new Date(target).getTime() - Date.now()) / 86400000)
    if (diff > 0) return { text: `${diff}d`, color: 'text-amber-400' }
    if (diff === 0) return { text: isAr ? 'اليوم' : 'Today', color: 'text-green-400' }
    return { text: isAr ? `منذ ${Math.abs(diff)} يوم` : `${Math.abs(diff)}d ago`, color: 'text-gray-400' }
  })()

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-white/[0.02] border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <ModeIcon size={15} className="text-brand-primary-light" />
          <span className="font-mono text-sm font-semibold text-white">{s.booking_number}</span>
          {s.container_size && (
            <span className="px-2 py-0.5 rounded-md bg-white/10 text-[11px] text-gray-300">{s.container_size}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {daysLabel && (
            <span className={clsx('text-xs font-semibold', daysLabel.color)}>{daysLabel.text}</span>
          )}
          <span className={clsx('inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-medium', cfg.color)}>
            <StatusIcon size={11} />
            {isAr ? cfg.ar : cfg.en}
          </span>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Route */}
        <div className="flex items-center gap-3 text-sm">
          <div className="text-center min-w-0">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">{isAr ? 'من' : 'From'}</p>
            <p className="text-white font-medium truncate max-w-[130px]">{s.port_of_loading ?? '—'}</p>
            {s.etd && <p className="text-[11px] text-gray-500 mt-0.5">{s.etd}</p>}
          </div>
          <div className="flex-1 flex items-center gap-1">
            <div className="flex-1 border-t border-dashed border-white/20" />
            <ModeIcon size={13} className="text-gray-500 shrink-0" />
            <div className="flex-1 border-t border-dashed border-white/20" />
          </div>
          <div className="text-center min-w-0">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">{isAr ? 'إلى' : 'To'}</p>
            <p className="text-white font-medium truncate max-w-[130px]">{s.port_of_discharge ?? '—'}</p>
            {s.eta && <p className="text-[11px] text-gray-500 mt-0.5">{s.eta}</p>}
          </div>
        </div>

        {/* Carrier + refs */}
        {(s.carrier_name || s.vessel_name || s.bl_number || s.container_no) && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            {s.carrier_name  && <div><span className="text-gray-500">{isAr ? 'الناقل: ' : 'Carrier: '}</span><span className="text-gray-200">{s.carrier_name}</span></div>}
            {s.vessel_name   && <div><span className="text-gray-500">{isAr ? 'السفينة: ' : 'Vessel: '}</span><span className="text-gray-200">{s.vessel_name}</span></div>}
            {s.bl_number     && <div><span className="text-gray-500">B/L: </span><span className="text-gray-200 font-mono">{s.bl_number}</span></div>}
            {s.container_no  && <div><span className="text-gray-500">{isAr ? 'الحاوية: ' : 'Container: '}</span><span className="text-gray-200 font-mono">{s.container_no}</span></div>}
          </div>
        )}

        {/* My cargo */}
        <div className="rounded-xl bg-brand-primary/5 border border-brand-primary/20 p-4 space-y-2">
          <p className="text-[10px] text-brand-primary-light uppercase tracking-wider font-semibold">
            {isAr ? 'بضاعتي' : 'My Cargo'}
          </p>
          {(s.my_description || s.my_description_ar) && (
            <p className="text-sm text-white">
              {isAr && s.my_description_ar ? s.my_description_ar : s.my_description}
            </p>
          )}
          <div className="flex gap-4 text-xs text-gray-400">
            {s.my_cartons    && <span>{s.my_cartons} {isAr ? 'كرتون' : 'ctn'}</span>}
            {s.my_cbm        && <span>{s.my_cbm.toFixed(3)} CBM</span>}
            {s.my_gross_weight_kg && <span>{s.my_gross_weight_kg} kg</span>}
          </div>
        </div>

        {/* CBM bar */}
        {s.max_cbm && s.my_cbm && s.my_pct !== null && (
          <CbmBar
            myCbm={s.my_cbm}
            totalUsed={s.total_cbm_used}
            maxCbm={s.max_cbm}
            myPct={s.my_pct}
            isAr={isAr}
          />
        )}
      </div>
    </div>
  )
}

// ── Invoice Row ────────────────────────────────────────────────────────────────
function InvoiceRow({ inv, isAr }: { inv: ClientInvoice; isAr: boolean }) {
  const cfg = INV_STATUS[inv.status] ?? INV_STATUS.draft
  return (
    <div className="flex items-center gap-3 py-3 border-b border-white/[0.06] last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-mono text-white">{inv.invoice_number}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {inv.invoice_type} · {inv.issue_date?.slice(0, 10) ?? '—'}
        </p>
      </div>
      <span className={clsx('px-2 py-0.5 rounded-full border text-[11px] font-medium shrink-0', cfg.color)}>
        {isAr ? cfg.ar : cfg.en}
      </span>
      <div className="text-end shrink-0">
        <p className="text-sm font-semibold text-emerald-400">
          {new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(inv.total)}
        </p>
        <p className="text-[11px] text-gray-500">{inv.currency}</p>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function ClientPortalPage() {
  const { i18n } = useTranslation()
  const isAr = i18n.language === 'ar'
  const navigate = useNavigate()
  const { token, client, clearAuth } = useClientPortalStore()

  useEffect(() => {
    if (!token || !client) navigate('/shop/client-login')
  }, [token, client, navigate])

  const { data: invoiceData, isLoading: invLoading } = useQuery({
    queryKey: ['portal-invoices', token],
    queryFn: () => clientPortalInvoices(token!),
    enabled: !!token,
  })

  const { data: shipmentData, isLoading: shipLoading } = useQuery({
    queryKey: ['portal-shipments', token],
    queryFn: () => clientPortalShipments(token!),
    enabled: !!token,
  })

  if (!client) return null

  const invoices  = invoiceData?.results  ?? []
  const shipments = shipmentData?.results ?? []

  function handleLogout() { clearAuth(); navigate('/shop/client-login') }

  return (
    <ShopLayout>
      <div className="space-y-8 pb-16">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-brand-primary/15 border border-brand-primary/30 flex items-center justify-center shrink-0">
              <span className="text-2xl font-bold text-brand-primary-light">{client.name.charAt(0)}</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">
                {isAr && client.name_ar ? client.name_ar : client.name}
              </h1>
              <p className="text-sm text-gray-400 font-mono mt-0.5">{client.client_code}</p>
              {client.company_name && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {isAr && client.company_name_ar ? client.company_name_ar : client.company_name}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 text-xs text-gray-400 hover:text-red-400 hover:border-red-400/30 transition-all"
          >
            <LogOut size={13} />
            {isAr ? 'تسجيل الخروج' : 'Sign Out'}
          </button>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: isAr ? 'إجمالي الفواتير' : 'Total Invoices', value: String(invoices.length),  color: 'border-brand-primary/20 bg-brand-primary/5 text-brand-primary-light' },
            { label: isAr ? 'مدفوع'           : 'Paid',           value: String(invoices.filter(i => i.status === 'paid').length),      color: 'border-emerald-400/20 bg-emerald-400/5 text-emerald-400' },
            { label: isAr ? 'شحنات نشطة'      : 'Active Shipments', value: String(shipments.filter(s => ['confirmed','in_transit'].includes(s.status)).length), color: 'border-amber-400/20 bg-amber-400/5 text-amber-400' },
            { label: isAr ? 'تم التسليم'      : 'Delivered',      value: String(shipments.filter(s => s.status === 'delivered').length), color: 'border-blue-400/20 bg-blue-400/5 text-blue-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className={clsx('rounded-xl p-4 border text-center', color)}>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-[11px] opacity-70 mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Main grid ── */}
        <div className="grid lg:grid-cols-3 gap-6">

          {/* ── Profile card ── */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 space-y-4 h-fit">
            <div className="flex items-center gap-2 mb-2">
              <User size={14} className="text-brand-primary-light" />
              <h2 className="text-sm font-semibold text-white">{isAr ? 'معلومات الحساب' : 'Account Info'}</h2>
            </div>
            {[
              { icon: User,      label: isAr ? 'الاسم'         : 'Name',    value: isAr && client.name_ar ? client.name_ar : client.name },
              { icon: Building2, label: isAr ? 'الشركة'        : 'Company', value: isAr && client.company_name_ar ? client.company_name_ar : client.company_name },
              { icon: Phone,     label: isAr ? 'الهاتف'        : 'Phone',   value: client.phone },
              { icon: Mail,      label: isAr ? 'البريد'        : 'Email',   value: client.email },
              { icon: MapPin,    label: isAr ? 'المدينة'       : 'City',    value: client.city },
              { icon: MapPin,    label: isAr ? 'الدولة'        : 'Country', value: client.country },
            ].filter(r => r.value).map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-3 py-2 border-b border-white/[0.06] last:border-0">
                <Icon size={13} className="text-gray-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
                  <p className="text-sm text-white mt-0.5">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Invoices ── */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <FileText size={15} className="text-emerald-400" />
              <h2 className="text-sm font-semibold text-white">
                {isAr ? 'الفواتير' : 'Invoices'}
              </h2>
              <span className="text-xs text-gray-500">({invoices.length})</span>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              {invLoading ? (
                <div className="space-y-3">
                  {[1,2,3].map(i => <div key={i} className="h-12 rounded-lg bg-white/5 animate-pulse" />)}
                </div>
              ) : invoices.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText size={32} className="mx-auto mb-2 opacity-20" />
                  <p className="text-sm">{isAr ? 'لا توجد فواتير حتى الآن' : 'No invoices yet'}</p>
                </div>
              ) : (
                <div>
                  {invoices.map(inv => <InvoiceRow key={inv.id} inv={inv} isAr={isAr} />)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Shipments ── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Ship size={15} className="text-amber-400" />
            <h2 className="text-sm font-semibold text-white">
              {isAr ? 'شحناتي' : 'My Shipments'}
            </h2>
            <span className="text-xs text-gray-500">({shipments.length})</span>
          </div>

          {shipLoading ? (
            <div className="grid sm:grid-cols-2 gap-4">
              {[1,2].map(i => <div key={i} className="h-64 rounded-2xl bg-white/5 animate-pulse" />)}
            </div>
          ) : shipments.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] py-14 text-center text-gray-500">
              <Package size={40} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">{isAr ? 'لا توجد شحنات مرتبطة بحسابك' : 'No shipments linked to your account'}</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {shipments.map(s => <ShipmentCard key={`${s.booking_id}-${s.booking_number}`} s={s} isAr={isAr} />)}
            </div>
          )}
        </div>

      </div>
    </ShopLayout>
  )
}
