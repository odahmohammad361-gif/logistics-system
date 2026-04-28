import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpenCheck, Pencil, Plus, Save, Search } from 'lucide-react'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Table from '@/components/ui/Table'
import { FormSection, Input } from '@/components/ui/Form'
import {
  createHSCodeReference,
  listHSCodeReferences,
  updateHSCodeReference,
} from '@/services/customsReferenceService'
import type { HSCodeReference } from '@/types'

interface HSForm {
  country: string
  hs_code: string
  chapter: string
  description: string
  description_ar: string
  customs_unit_basis: string
  customs_estimated_value_usd: string
  customs_duty_pct: string
  sales_tax_pct: string
  other_tax_pct: string
  source_url: string
  notes: string
  import_allowed: boolean
  is_active: boolean
}

const emptyForm: HSForm = {
  country: 'Jordan',
  hs_code: '',
  chapter: '',
  description: '',
  description_ar: '',
  customs_unit_basis: 'dozen',
  customs_estimated_value_usd: '',
  customs_duty_pct: '',
  sales_tax_pct: '',
  other_tax_pct: '',
  source_url: '',
  notes: '',
  import_allowed: true,
  is_active: true,
}

const COUNTRIES = ['Jordan', 'Iraq', 'China', 'UAE', 'Saudi Arabia']
const PAGE_SIZE = 25

export default function CustomsReferencesPage() {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === 'ar'
  const qc = useQueryClient()
  const [country, setCountry] = useState('Jordan')
  const [search, setSearch] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<HSCodeReference | null>(null)
  const [form, setForm] = useState<HSForm>(emptyForm)

  const { data = [], isLoading } = useQuery({
    queryKey: ['customs-references', { country, search, includeInactive }],
    queryFn: () => listHSCodeReferences({ country, search, include_inactive: includeInactive }),
  })

  const paged = useMemo(() => data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [data, page])

  function setField<K extends keyof HSForm>(field: K, value: HSForm[K]) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function openCreate() {
    setEditing(null)
    setForm({ ...emptyForm, country })
    setModalOpen(true)
  }

  function openEdit(row: HSCodeReference) {
    setEditing(row)
    setForm({
      country: row.country,
      hs_code: row.hs_code,
      chapter: row.chapter ?? '',
      description: row.description,
      description_ar: row.description_ar ?? '',
      customs_unit_basis: row.customs_unit_basis ?? 'dozen',
      customs_estimated_value_usd: row.customs_estimated_value_usd ?? '',
      customs_duty_pct: row.customs_duty_pct ?? '',
      sales_tax_pct: row.sales_tax_pct ?? '',
      other_tax_pct: row.other_tax_pct ?? '',
      source_url: row.source_url ?? '',
      notes: row.notes ?? '',
      import_allowed: row.import_allowed,
      is_active: row.is_active,
    })
    setModalOpen(true)
  }

  function payload() {
    return {
      country: form.country || 'Jordan',
      hs_code: form.hs_code.trim(),
      chapter: form.chapter || null,
      description: form.description.trim(),
      description_ar: form.description_ar || null,
      customs_unit_basis: form.customs_unit_basis || null,
      customs_estimated_value_usd: form.customs_estimated_value_usd || null,
      customs_duty_pct: form.customs_duty_pct || null,
      sales_tax_pct: form.sales_tax_pct || null,
      other_tax_pct: form.other_tax_pct || null,
      source_url: form.source_url || null,
      notes: form.notes || null,
      import_allowed: form.import_allowed,
      is_active: form.is_active,
    }
  }

  const saveMut = useMutation({
    mutationFn: () => editing ? updateHSCodeReference(editing.id, payload()) : createHSCodeReference(payload()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customs-references'] })
      qc.invalidateQueries({ queryKey: ['product-taxonomy'] })
      setModalOpen(false)
      setEditing(null)
      setForm(emptyForm)
    },
  })

  const columns = [
    {
      key: 'hs',
      label: t('customs_refs.hs_system'),
      render: (row: HSCodeReference) => (
        <div>
          <p className="font-mono text-sm text-brand-primary-light">{row.hs_code}</p>
          <p className="text-xs text-brand-text-muted">{row.country}{row.chapter ? ` · ${t('products.chapter')} ${row.chapter}` : ''}</p>
        </div>
      ),
    },
    {
      key: 'description',
      label: t('products.description'),
      render: (row: HSCodeReference) => (
        <div className="max-w-xl">
          <p className="text-sm text-brand-text">{isAr && row.description_ar ? row.description_ar : row.description}</p>
          {row.description_ar && <p className="text-xs text-brand-text-muted">{row.description_ar}</p>}
        </div>
      ),
    },
    {
      key: 'value',
      label: t('customs_refs.customs_basis'),
      render: (row: HSCodeReference) => (
        <div className="text-xs text-brand-text-muted">
          <p>{row.customs_unit_basis || 'unit'} · ${Number(row.customs_estimated_value_usd || 0).toFixed(2)}</p>
          <p>{t('products.customs_duty_pct')}: {row.customs_duty_pct ?? '0'}%</p>
        </div>
      ),
    },
    {
      key: 'tax',
      label: t('customs_refs.tax_rates'),
      render: (row: HSCodeReference) => (
        <div className="text-xs text-brand-text-muted">
          <p>{t('products.sales_tax_pct')}: {row.sales_tax_pct ?? '0'}%</p>
          <p>{t('products.other_tax_pct')}: {row.other_tax_pct ?? '0'}%</p>
        </div>
      ),
    },
    {
      key: 'status',
      label: t('common.status'),
      render: (row: HSCodeReference) => (
        <div className="flex flex-wrap gap-1">
          <span className={`rounded px-2 py-0.5 text-xs ${row.import_allowed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
            {row.import_allowed ? t('products.import_allowed') : t('customs_refs.import_blocked')}
          </span>
          <span className={`rounded px-2 py-0.5 text-xs ${row.is_active ? 'bg-blue-500/10 text-blue-300' : 'bg-gray-500/10 text-gray-400'}`}>
            {row.is_active ? t('common.active') : t('common.inactive')}
          </span>
        </div>
      ),
    },
    {
      key: 'actions',
      label: '',
      className: 'w-20',
      render: (row: HSCodeReference) => (
        <button
          type="button"
          onClick={() => openEdit(row)}
          className="rounded p-1.5 text-brand-text-muted transition-colors hover:bg-white/5 hover:text-brand-text"
          title={t('common.edit')}
        >
          <Pencil size={15} />
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 text-brand-primary-light">
            <BookOpenCheck size={18} />
            <span className="text-xs font-semibold uppercase tracking-wide">{t('customs_refs.badge')}</span>
          </div>
          <h1 className="page-title mt-1">{t('customs_refs.title')}</h1>
          <p className="mt-1 text-sm text-brand-text-muted">{t('customs_refs.subtitle')}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} />
          {t('customs_refs.add_hs')}
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)_auto]">
        <select
          className="input-base w-full"
          value={country}
          onChange={(e) => { setCountry(e.target.value); setPage(1) }}
        >
          {COUNTRIES.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <div className="relative">
          <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-brand-text-muted" />
          <input
            className="input-base w-full ps-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder={t('customs_refs.search_placeholder')}
          />
        </div>
        <label className="flex items-center gap-2 rounded-lg border border-brand-border bg-white/[0.03] px-3 py-2 text-sm text-brand-text-muted">
          <input
            type="checkbox"
            className="rounded"
            checked={includeInactive}
            onChange={(e) => { setIncludeInactive(e.target.checked); setPage(1) }}
          />
          {t('customs_refs.include_inactive')}
        </label>
      </div>

      <Table
        columns={columns}
        data={paged}
        total={data.length}
        page={page}
        pageSize={PAGE_SIZE}
        loading={isLoading}
        onPageChange={setPage}
        rowKey={(row) => row.id}
      />

      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); setForm(emptyForm) }}
        title={editing ? t('customs_refs.edit_hs') : t('customs_refs.add_hs')}
        size="xl"
      >
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault()
            saveMut.mutate()
          }}
        >
          {saveMut.isError && (
            <div className="rounded-lg border border-brand-red/30 bg-brand-red/10 px-3 py-2 text-xs text-brand-red">
              {(saveMut.error as any)?.response?.data?.detail ?? t('common.required')}
            </div>
          )}

          <FormSection title={t('customs_refs.hs_identity')}>
            <div className="grid gap-3 md:grid-cols-3">
              <Input label={t('common.country')} required value={form.country} onChange={(e) => setField('country', e.target.value)} />
              <Input label={t('products.hs_code')} required value={form.hs_code} onChange={(e) => setField('hs_code', e.target.value)} />
              <Input label={t('products.chapter')} value={form.chapter} onChange={(e) => setField('chapter', e.target.value)} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Input label={t('products.description')} required value={form.description} onChange={(e) => setField('description', e.target.value)} />
              <Input label={t('products.description_ar')} value={form.description_ar} onChange={(e) => setField('description_ar', e.target.value)} />
            </div>
          </FormSection>

          <FormSection title={t('customs_refs.calculation_values')}>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <label className="label-base">{t('products.customs_unit_basis')}</label>
                <select className="input-base w-full" value={form.customs_unit_basis} onChange={(e) => setField('customs_unit_basis', e.target.value)}>
                  <option value="">—</option>
                  <option value="dozen">{t('products.unit_dozen')}</option>
                  <option value="piece">{t('products.unit_piece')}</option>
                  <option value="kg">{t('products.unit_kg')}</option>
                  <option value="carton">{t('products.unit_carton')}</option>
                </select>
              </div>
              <Input label={t('products.customs_estimated_value_usd')} type="number" step="0.0001" value={form.customs_estimated_value_usd} onChange={(e) => setField('customs_estimated_value_usd', e.target.value)} />
              <Input label={t('products.customs_duty_pct')} type="number" step="0.01" value={form.customs_duty_pct} onChange={(e) => setField('customs_duty_pct', e.target.value)} />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Input label={t('products.sales_tax_pct')} type="number" step="0.01" value={form.sales_tax_pct} onChange={(e) => setField('sales_tax_pct', e.target.value)} />
              <Input label={t('products.other_tax_pct')} type="number" step="0.01" value={form.other_tax_pct} onChange={(e) => setField('other_tax_pct', e.target.value)} />
              <Input label={t('products.source_url')} value={form.source_url} onChange={(e) => setField('source_url', e.target.value)} />
            </div>
            <Input label={t('common.notes')} value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
          </FormSection>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-5">
              <label className="flex items-center gap-2 text-sm text-brand-text-muted">
                <input type="checkbox" className="rounded" checked={form.import_allowed} onChange={(e) => setField('import_allowed', e.target.checked)} />
                {t('products.import_allowed')}
              </label>
              <label className="flex items-center gap-2 text-sm text-brand-text-muted">
                <input type="checkbox" className="rounded" checked={form.is_active} onChange={(e) => setField('is_active', e.target.checked)} />
                {t('common.active')}
              </label>
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit" loading={saveMut.isPending}>
                <Save size={15} />
                {t('common.save')}
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  )
}
