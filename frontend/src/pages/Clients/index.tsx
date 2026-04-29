import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, Pencil, Trash2, Users,
  Barcode, Download, X, Loader2, ScanLine, CheckCircle2, AlertCircle, ExternalLink,
  Globe, ShieldCheck, ShieldOff, ArrowRightLeft,
} from 'lucide-react'
import { getClients, createClient, updateClient, deleteClient } from '@/services/clientService'
import { getCustomers, migrateCustomer, deleteCustomer } from '@/services/customerService'
import { getBranches } from '@/services/branchService'
import { useAuth } from '@/hooks/useAuth'
import api from '@/services/api'
import Table from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import { Input, Select, FormRow, FormSection, Textarea } from '@/components/ui/Form'
import PhoneInput from '@/components/ui/PhoneInput'
import {
  localizedCountryOptions,
  localizedRegionOptions,
  normalizeCountryValue,
  validateEmailValue,
  validatePhoneValue,
} from '@/constants/contact'
import { useForm } from 'react-hook-form'
import type { Client, CustomerAdmin } from '@/types'
import clsx from 'clsx'

interface FormValues {
  name: string; phone: string; email: string
  address: string; city: string; country: string; branch_id: string; notes: string
}

interface MigrateFormValues {
  name: string; phone: string; email: string
  city: string; country: string; address: string; branch_id: string; notes: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Barcode View Modal
// ─────────────────────────────────────────────────────────────────────────────
function BarcodeModal({ client, onClose }: { client: Client; onClose: () => void }) {
  const { t } = useTranslation()
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)

  useEffect(() => {
    let objectUrl: string
    setLoading(true); setError(false)
    api.get(`/clients/${client.id}/barcode`, { responseType: 'blob' })
      .then((r) => { objectUrl = URL.createObjectURL(r.data); setBlobUrl(objectUrl) })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [client.id])

  function handleDownload() {
    if (!blobUrl) return
    const a = document.createElement('a')
    a.href = blobUrl; a.download = `${client.client_code}.svg`; a.click()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl overflow-hidden animate-slide-in"
        style={{ background: '#0A1929', border: '1px solid #1E3A5F', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border/60">
          <div>
            <p className="text-sm font-semibold text-brand-text">{client.name}</p>
            <p className="text-xs text-brand-text-muted font-mono mt-0.5">{client.client_code}</p>
          </div>
          <button onClick={onClose} className="btn-icon"><X size={15} /></button>
        </div>
        <div className="px-6 py-6 flex flex-col items-center gap-4">
          <div className="w-full rounded-xl p-4 flex items-center justify-center min-h-[100px]"
            style={{ background: '#ffffff' }}>
            {loading && (
              <div className="flex flex-col items-center gap-2 py-4">
                <Loader2 size={22} className="animate-spin text-brand-primary" />
                <span className="text-xs text-gray-400">{t('clients.barcode_loading')}</span>
              </div>
            )}
            {error && !loading && (
              <p className="text-xs text-red-500 text-center py-4">{t('clients.barcode_error')}</p>
            )}
            {blobUrl && !loading && (
              <img src={blobUrl} alt={client.client_code} className="w-full max-w-[260px] h-auto" />
            )}
          </div>
          <Button onClick={handleDownload} variant="secondary" className="w-full" disabled={!blobUrl}>
            <Download size={14} /> {t('clients.barcode_download')}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Barcode Scanner Button
// ─────────────────────────────────────────────────────────────────────────────
type ScanState = 'idle' | 'scanning' | 'success' | 'error'

function BarcodeScanButton({ onDecoded }: { onDecoded: (code: string) => void }) {
  const { t } = useTranslation()
  const fileRef           = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<ScanState>('idle')

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setState('scanning')
    const url = URL.createObjectURL(file)
    try {
      // @ts-ignore
      const { BrowserMultiFormatReader } = await import('@zxing/library')
      const reader = new BrowserMultiFormatReader()
      const result = await reader.decodeFromImageUrl(url)
      onDecoded(result.getText())
      setState('success')
      setTimeout(() => setState('idle'), 2000)
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 2500)
    } finally {
      URL.revokeObjectURL(url)
      e.target.value = ''
    }
  }

  const styles: Record<ScanState, string> = {
    idle:     'text-brand-text-muted hover:text-brand-primary hover:bg-brand-primary/10 border-brand-border',
    scanning: 'text-brand-primary bg-brand-primary/10 border-brand-primary/30 cursor-wait',
    success:  'text-brand-green   bg-brand-green/10   border-brand-green/30',
    error:    'text-brand-red     bg-brand-red/10     border-brand-red/30',
  }
  const icons: Record<ScanState, React.ReactNode> = {
    idle:     <ScanLine size={15} />,
    scanning: <Loader2 size={15} className="animate-spin" />,
    success:  <CheckCircle2 size={15} />,
    error:    <AlertCircle size={15} />,
  }
  const labels: Record<ScanState, string> = {
    idle:     t('clients.barcode_scan'),
    scanning: t('clients.barcode_scanning'),
    success:  t('clients.barcode_found'),
    error:    t('clients.barcode_unrecognized'),
  }

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <button
        onClick={() => state === 'idle' && fileRef.current?.click()}
        disabled={state === 'scanning'}
        title={labels[state]}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all duration-200 ${styles[state]}`}
      >
        {icons[state]}
        <span className="hidden sm:inline">{labels[state]}</span>
      </button>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function ClientsPage() {
  const { t, i18n } = useTranslation()
  const { isStaff, isAdmin } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const isAr = i18n.language === 'ar'

  // Tab state
  const [activeTab, setActiveTab] = useState<'main' | 'website'>('main')

  // ── Main clients state ────────────────────────────────────────────────────
  const [page, setPage]             = useState(1)
  const [search, setSearch]         = useState('')
  const [modalOpen, setModal]       = useState(false)
  const [editing, setEditing]       = useState<Client | null>(null)
  const [deleting, setDeleting]     = useState<Client | null>(null)
  const [barcodeClient, setBarcode] = useState<Client | null>(null)

  // ── Website customers state ───────────────────────────────────────────────
  const [custPage, setCustPage]             = useState(1)
  const [custSearch, setCustSearch]         = useState('')
  const [custFilter, setCustFilter]         = useState<'all' | 'verified' | 'pending'>('all')
  const [migrating, setMigrating]           = useState<CustomerAdmin | null>(null)
  const [deletingCust, setDeletingCust]     = useState<CustomerAdmin | null>(null)
  const [migrateSuccess, setMigrateSuccess] = useState<{ code: string; name: string } | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['clients', { page, search }],
    queryFn:  () => getClients({ page, page_size: 20, search: search || undefined }),
  })

  const { data: custData, isLoading: custLoading } = useQuery({
    queryKey: ['customers', { custPage, custSearch, custFilter }],
    queryFn:  () => getCustomers({
      page:        custPage,
      page_size:   20,
      search:      custSearch || undefined,
      is_verified: custFilter === 'all' ? undefined : custFilter === 'verified',
    }),
    enabled: activeTab === 'website',
  })

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'], queryFn: getBranches, staleTime: Infinity,
  })

  // ── Main client form ──────────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    reset,
    clearErrors,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>()
  const clientCountry = watch('country')
  const clientCity = watch('city')
  const clientPhone = watch('phone')

  const saveMut = useMutation({
    mutationFn: (v: FormValues) => {
      const p = {
        name:      v.name,
        phone:     v.phone     || undefined,
        email:     v.email     || undefined,
        address:   v.address   || undefined,
        city:      v.city      || undefined,
        country:   v.country   || undefined,
        branch_id: v.branch_id ? parseInt(v.branch_id) : undefined,
        notes:     v.notes     || undefined,
      }
      return editing ? updateClient(editing.id, p) : createClient(p)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); setModal(false); setEditing(null) },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteClient(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['clients'] }); setDeleting(null) },
  })

  // ── Migrate form ──────────────────────────────────────────────────────────
  const {
    register: regM,
    handleSubmit: handleMigrate,
    reset: resetM,
    watch: watchM,
    setValue: setValueM,
    formState: { errors: errM },
  } = useForm<MigrateFormValues>()
  const migrateCountry = watchM('country')
  const migrateCity = watchM('city')
  const migratePhone = watchM('phone')

  const migrateMut = useMutation({
    mutationFn: (v: MigrateFormValues) =>
      migrateCustomer(migrating!.id, {
        name:      v.name      || undefined,
        phone:     v.phone     || undefined,
        email:     v.email     || undefined,
        city:      v.city      || undefined,
        country:   v.country   || undefined,
        address:   v.address   || undefined,
        branch_id: v.branch_id ? parseInt(v.branch_id) : undefined,
        notes:     v.notes     || undefined,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      qc.invalidateQueries({ queryKey: ['clients'] })
      setMigrating(null)
      setMigrateSuccess({ code: res.client.client_code, name: res.client.name })
    },
  })

  const deleteCustMut = useMutation({
    mutationFn: (id: number) => deleteCustomer(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['customers'] }); setDeletingCust(null) },
  })

  function openCreate() {
    setEditing(null)
    reset({ name: '', phone: '', email: '', address: '', city: '', country: 'Jordan', branch_id: String(branches[0]?.id ?? ''), notes: '' })
    clearErrors(); setModal(true)
  }
  function openEdit(c: Client) {
    setEditing(c)
    reset({
      name: c.name, phone: c.phone ?? '', email: c.email ?? '', address: c.address ?? '',
      city: c.city ?? '', country: normalizeCountryValue(c.country) || 'Jordan', branch_id: c.branch ? String(c.branch.id) : '', notes: c.notes ?? '',
    })
    clearErrors(); setModal(true)
  }
  function openMigrate(c: CustomerAdmin) {
    setMigrating(c)
    resetM({
      name: c.full_name, phone: c.phone, email: c.email,
      city: '', country: normalizeCountryValue(c.country) || 'Jordan', address: '', branch_id: String(branches[0]?.id ?? ''), notes: c.notes ?? '',
    })
  }

  function handleBarcodeDecoded(code: string) { setSearch(code); setPage(1) }

  const branchOptions = branches.map((b) => ({ value: String(b.id), label: b.name }))
  const dateLocale    = isAr ? 'ar-JO' : 'en-GB'
  const phoneError = isAr ? 'رقم الهاتف يجب أن يكون 8 إلى 12 رقماً' : 'Phone number must be 8 to 12 digits'
  const emailError = isAr ? 'صيغة البريد الإلكتروني غير صحيحة' : 'Enter a valid email address'
  const countryOptions = localizedCountryOptions(isAr)
  const clientRegionOptions = localizedRegionOptions(clientCountry, isAr)
  const migrateRegionOptions = localizedRegionOptions(migrateCountry, isAr)

  useEffect(() => {
    const allowed = localizedRegionOptions(clientCountry, false, false).map(option => option.value)
    if (clientCity && allowed.length && !allowed.includes(clientCity)) setValue('city', '')
  }, [clientCountry, clientCity, setValue])

  useEffect(() => {
    const allowed = localizedRegionOptions(migrateCountry, false, false).map(option => option.value)
    if (migrateCity && allowed.length && !allowed.includes(migrateCity)) setValueM('city', '')
  }, [migrateCountry, migrateCity, setValueM])

  // ── Main clients columns ──────────────────────────────────────────────────
  const columns = [
    {
      key: 'name', label: t('clients.column_client'),
      render: (c: Client) => (
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate(`/clients/${c.id}`)}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold text-brand-green"
            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
            {c.name.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-semibold text-brand-text group-hover:text-brand-primary transition-colors flex items-center gap-1">
              {c.name}
              <ExternalLink size={11} className="opacity-0 group-hover:opacity-60 transition-opacity" />
            </p>
            <p className="text-xs text-brand-text-muted font-mono">{c.client_code}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'branch', label: t('clients.branch'),
      render: (c: Client) => c.branch
        ? <Badge value={c.branch.code} label={c.branch.name} />
        : <span className="text-brand-text-muted">—</span>,
    },
    {
      key: 'contact', label: t('clients.column_contact'),
      render: (c: Client) => (
        <div className="leading-tight">
          {c.phone && <p className="text-sm text-brand-text-dim">{c.phone}</p>}
          {c.email && <p className="text-xs text-brand-text-muted">{c.email}</p>}
          {!c.phone && !c.email && <span className="text-brand-text-muted">—</span>}
        </div>
      ),
    },
    {
      key: 'city', label: t('clients.city'),
      render: (c: Client) => <span className="text-sm text-brand-text-dim">{c.city ?? '—'}</span>,
    },
    {
      key: 'actions', label: '', className: 'w-28',
      render: (c: Client) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => setBarcode(c)}
            className="btn-icon text-brand-primary-light hover:text-brand-primary hover:bg-brand-primary/10"
            title={t('clients.barcode_view')}
          >
            <Barcode size={14} />
          </button>
          {isStaff && (
            <>
              <button onClick={() => openEdit(c)} className="btn-icon" title={t('common.edit')}><Pencil size={14} /></button>
              {isAdmin && (
                <button onClick={() => setDeleting(c)} className="btn-icon hover:text-brand-red hover:bg-brand-red/10" title={t('common.delete')}><Trash2 size={14} /></button>
              )}
            </>
          )}
        </div>
      ),
    },
  ]

  // ── Website customers columns ─────────────────────────────────────────────
  const custColumns = [
    {
      key: 'name', label: t('clients.column_client'),
      render: (c: CustomerAdmin) => (
        <div className="flex items-center gap-3">
          <div className={clsx(
            'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold',
            c.is_verified ? 'text-brand-primary-light' : 'text-brand-text-muted',
          )} style={{
            background:  c.is_verified ? 'rgba(99,102,241,0.12)' : 'rgba(100,116,139,0.1)',
            border: `1px solid ${c.is_verified ? 'rgba(99,102,241,0.25)' : 'rgba(100,116,139,0.2)'}`,
          }}>
            {c.full_name.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-semibold text-brand-text">{c.full_name}</p>
            <p className="text-xs text-brand-text-muted">{c.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'contact', label: t('clients.column_contact'),
      render: (c: CustomerAdmin) => (
        <div className="leading-tight">
          <p className="text-sm text-brand-text-dim">{c.phone}</p>
          {c.telegram && <p className="text-xs text-brand-text-muted">@{c.telegram}</p>}
        </div>
      ),
    },
    {
      key: 'country', label: t('clients.column_country'),
      render: (c: CustomerAdmin) => <span className="text-sm text-brand-text-dim capitalize">{c.country}</span>,
    },
    {
      key: 'status', label: t('clients.column_status'),
      render: (c: CustomerAdmin) => (
        <div className="flex items-center gap-1.5">
          {c.is_verified ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium text-green-400 bg-green-400/10 border border-green-400/20">
              <ShieldCheck size={11} /> {t('clients.verified')}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium text-amber-400 bg-amber-400/10 border border-amber-400/20">
              <ShieldOff size={11} /> {t('clients.not_verified')}
            </span>
          )}
          {!c.is_active && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium text-red-400 bg-red-400/10 border border-red-400/20">
              {t('clients.inactive')}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'joined', label: t('clients.joined'),
      render: (c: CustomerAdmin) => (
        <span className="text-xs text-brand-text-muted">
          {new Date(c.created_at).toLocaleDateString(dateLocale, { year: 'numeric', month: 'short', day: 'numeric' })}
        </span>
      ),
    },
    {
      key: 'actions', label: '', className: 'w-36',
      render: (c: CustomerAdmin) => (
        <div className="flex items-center gap-1">
          {!c.is_verified && isStaff && (
            <button
              onClick={() => openMigrate(c)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-brand-primary-light bg-brand-primary/10 hover:bg-brand-primary/20 border border-brand-primary/20 transition-all"
              title={t('clients.migrate')}
            >
              <ArrowRightLeft size={12} />
              <span className="hidden sm:inline">{t('clients.migrate')}</span>
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => setDeletingCust(c)}
              className="btn-icon hover:text-brand-red hover:bg-brand-red/10"
              title={t('clients.deactivate')}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <Users size={15} className="text-brand-green" />
            </div>
            <h1 className="page-title">{t('clients.title')}</h1>
          </div>
          {activeTab === 'main' && data && (
            <p className="text-xs text-brand-text-muted mt-1 ms-10">
              {t('clients.client_count', { count: data.total })}
            </p>
          )}
          {activeTab === 'website' && custData && (
            <p className="text-xs text-brand-text-muted mt-1 ms-10">
              {t('clients.website_count', { count: custData.total })}
            </p>
          )}
        </div>
        {activeTab === 'main' && isStaff && (
          <Button onClick={openCreate}><Plus size={15} />{t('clients.add')}</Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        {(['main', 'website'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              activeTab === tab
                ? 'bg-brand-primary text-white shadow-sm'
                : 'text-brand-text-muted hover:text-brand-text hover:bg-white/5',
            )}
          >
            {tab === 'main' ? <Users size={14} /> : <Globe size={14} />}
            {tab === 'main' ? t('clients.tab_main') : t('clients.tab_website')}
          </button>
        ))}
      </div>

      {/* ── MAIN CLIENTS TAB ────────────────────────────────────────────── */}
      {activeTab === 'main' && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search size={14} className="search-icon text-brand-text-muted" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                placeholder={t('clients.search_placeholder')}
                className="search-input w-full"
              />
              {search && (
                <button onClick={() => { setSearch(''); setPage(1) }}
                  className="absolute top-1/2 -translate-y-1/2 end-2 text-brand-text-muted hover:text-brand-text">
                  <X size={13} />
                </button>
              )}
            </div>
            <BarcodeScanButton onDecoded={handleBarcodeDecoded} />
          </div>

          {search && search.includes('-') && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
              style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <Barcode size={13} className="text-brand-primary-light flex-shrink-0" />
              <span className="text-brand-text-dim">{t('clients.search_by_code')}</span>
              <span className="font-bold font-mono text-brand-primary-light">{search}</span>
              <button onClick={() => { setSearch(''); setPage(1) }} className="ms-auto text-brand-text-muted hover:text-brand-text">
                <X size={12} />
              </button>
            </div>
          )}

          <Table
            columns={columns} data={data?.results ?? []} total={data?.total ?? 0}
            page={page} loading={isLoading} onPageChange={setPage} rowKey={(c) => c.id}
          />
        </>
      )}

      {/* ── WEBSITE CLIENTS TAB ─────────────────────────────────────────── */}
      {activeTab === 'website' && (
        <>
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs text-brand-text-muted"
            style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
            <Globe size={13} className="text-brand-primary-light flex-shrink-0" />
            {t('clients.website_clients_desc')}
          </div>

          {migrateSuccess && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
              <CheckCircle2 size={16} className="text-brand-green flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-brand-green">{t('clients.migrate_success')}</p>
                <p className="text-xs text-brand-text-muted mt-0.5">
                  {migrateSuccess.name} — <span className="font-mono">{migrateSuccess.code}</span>
                </p>
              </div>
              <button onClick={() => setMigrateSuccess(null)} className="btn-icon text-brand-text-muted"><X size={13} /></button>
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search size={14} className="search-icon text-brand-text-muted" />
              <input
                value={custSearch}
                onChange={(e) => { setCustSearch(e.target.value); setCustPage(1) }}
                placeholder={t('clients.search_cust_placeholder')}
                className="search-input w-full"
              />
              {custSearch && (
                <button onClick={() => { setCustSearch(''); setCustPage(1) }}
                  className="absolute top-1/2 -translate-y-1/2 end-2 text-brand-text-muted hover:text-brand-text">
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="flex gap-1">
              {(['all', 'pending', 'verified'] as const).map((f) => (
                <button key={f} onClick={() => { setCustFilter(f); setCustPage(1) }}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                    custFilter === f
                      ? 'border-brand-primary bg-brand-primary/15 text-brand-primary-light'
                      : 'border-brand-border text-brand-text-muted hover:border-brand-border-focus',
                  )}>
                  {f === 'all'
                    ? t('clients.filter_all')
                    : f === 'pending'
                      ? t('clients.filter_pending')
                      : t('clients.verified')}
                </button>
              ))}
            </div>
          </div>

          <Table
            columns={custColumns}
            data={custData?.results ?? []}
            total={custData?.total ?? 0}
            page={custPage}
            loading={custLoading}
            onPageChange={setCustPage}
            rowKey={(c) => c.id}
          />
        </>
      )}

      {/* ── Create / Edit Main Client Modal ─────────────────────────────── */}
      <Modal
        key={modalOpen ? (editing ? `edit-${editing.id}` : 'create') : 'closed'}
        open={modalOpen} onClose={() => setModal(false)}
        title={editing ? t('clients.edit_client') : t('clients.add_client')}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)}>{t('common.cancel')}</Button>
            <Button loading={saveMut.isPending} onClick={handleSubmit((v) => saveMut.mutate(v))}>{t('common.save')}</Button>
          </>
        }
      >
        {editing ? (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg"
            style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <Barcode size={14} className="text-brand-primary-light flex-shrink-0" />
            <span className="text-xs text-brand-text-muted">{t('clients.code_auto')}</span>
            <span className="text-sm font-bold text-brand-primary-light font-mono">{editing.client_code}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg"
            style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <Barcode size={14} className="text-brand-green flex-shrink-0" />
            <span className="text-xs text-brand-text-dim">{t('clients.code_auto_hint')}</span>
          </div>
        )}
        <form onSubmit={handleSubmit((v) => saveMut.mutate(v))} className="space-y-5">
          <FormSection title={t('clients.basic_info')}>
            <Input label={t('clients.name')} {...register('name', { required: true })}
              error={errors.name ? t('clients.required') : undefined} />
            <input type="hidden" {...register('phone', { validate: (v) => validatePhoneValue(v) || phoneError })} />
            <FormRow>
              <PhoneInput
                label={t('clients.phone')}
                value={clientPhone}
                country={clientCountry}
                onChange={(value) => setValue('phone', value, { shouldValidate: true, shouldDirty: true })}
                error={errors.phone?.message}
              />
              <Input type="email" label={t('clients.email')} {...register('email', { validate: (v) => validateEmailValue(v) || emailError })} error={errors.email?.message} />
            </FormRow>
            <Select label={t('clients.branch')} options={branchOptions} {...register('branch_id')} />
          </FormSection>
          <FormSection title={t('common.address')}>
            <FormRow>
              <Select label={isAr ? 'الدولة' : t('clients.country')} options={countryOptions} {...register('country')} />
              <Select
                label={isAr ? 'المحافظة / المنطقة' : 'Governorate / Region'}
                options={clientRegionOptions}
                disabled={!clientCountry}
                {...register('city')}
              />
            </FormRow>
            <Input label={t('clients.address_detail')} {...register('address')} />
          </FormSection>
          <Input label={t('clients.notes')} {...register('notes')} />
        </form>
      </Modal>

      {/* ── Migrate to Client Modal ──────────────────────────────────────── */}
      <Modal
        open={!!migrating} onClose={() => setMigrating(null)}
        title={t('clients.migrate_title')} size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setMigrating(null)}>{t('common.cancel')}</Button>
            <Button loading={migrateMut.isPending} onClick={handleMigrate((v) => migrateMut.mutate(v))}>
              <ArrowRightLeft size={14} /> {t('clients.migrate')}
            </Button>
          </>
        }
      >
        {migrating && (
          <>
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl mb-4"
              style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <Globe size={15} className="text-brand-primary-light mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-brand-text">{migrating.full_name}</p>
                <p className="text-xs text-brand-text-muted mt-0.5">{migrating.email} · {migrating.phone}</p>
                <p className="text-xs text-brand-text-muted mt-1">{t('clients.migrate_desc')}</p>
              </div>
            </div>

            {migrateMut.isError && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg mb-4 text-xs text-red-400"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <AlertCircle size={13} />
                {(migrateMut.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
                  ?? t('clients.error_retry')}
              </div>
            )}

            <form className="space-y-4">
              <FormSection title={t('clients.basic_info')}>
                <Input label={t('clients.name')} {...regM('name', { required: true })}
                  error={errM.name ? t('clients.required') : undefined} />
                <input type="hidden" {...regM('phone', { validate: (v) => validatePhoneValue(v) || phoneError })} />
                <FormRow>
                  <PhoneInput
                    label={t('clients.phone')}
                    value={migratePhone}
                    country={migrateCountry}
                    onChange={(value) => setValueM('phone', value, { shouldValidate: true, shouldDirty: true })}
                    error={errM.phone?.message}
                  />
                  <Input type="email" label={t('clients.email')} {...regM('email', { validate: (v) => validateEmailValue(v) || emailError })} error={errM.email?.message} />
                </FormRow>
                <Select label={t('clients.branch')} options={branchOptions} {...regM('branch_id')} />
              </FormSection>
              <FormSection title={t('common.address')}>
                <FormRow>
                  <Select label={isAr ? 'الدولة' : t('clients.country')} options={countryOptions} {...regM('country')} />
                  <Select
                    label={isAr ? 'المحافظة / المنطقة' : 'Governorate / Region'}
                    options={migrateRegionOptions}
                    disabled={!migrateCountry}
                    {...regM('city')}
                  />
                </FormRow>
                <Input label={t('clients.address_detail')} {...regM('address')} />
              </FormSection>
              <Textarea label={t('clients.notes')} {...regM('notes')} />
            </form>
          </>
        )}
      </Modal>

      {/* ── Delete main client confirm ───────────────────────────────────── */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title={t('common.confirm_delete')} size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>{t('common.cancel')}</Button>
            <Button variant="danger" loading={deleteMut.isPending}
              onClick={() => deleting && deleteMut.mutate(deleting.id)}>
              {t('common.delete')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-brand-text-dim">
          {t('clients.delete_confirm', { name: deleting?.name ?? '' })}
        </p>
      </Modal>

      {/* ── Deactivate customer confirm ──────────────────────────────────── */}
      <Modal open={!!deletingCust} onClose={() => setDeletingCust(null)} title={t('clients.deactivate_title')} size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeletingCust(null)}>{t('common.cancel')}</Button>
            <Button variant="danger" loading={deleteCustMut.isPending}
              onClick={() => deletingCust && deleteCustMut.mutate(deletingCust.id)}>
              {t('clients.deactivate')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-brand-text-dim">
          {t('clients.deactivate_confirm', { name: deletingCust?.full_name ?? '' })}
        </p>
        <p className="text-xs text-brand-text-muted mt-2">{t('clients.deactivate_warning')}</p>
      </Modal>

      {barcodeClient && <BarcodeModal client={barcodeClient} onClose={() => setBarcode(null)} />}
    </div>
  )
}
