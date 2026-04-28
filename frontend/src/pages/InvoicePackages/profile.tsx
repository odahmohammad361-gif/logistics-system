import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Download, FilePlus2, FileText, History, Package, Paperclip,
  Plus, Save, Ship, Trash2, WalletCards,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { FormRow, Input, Select, Textarea } from '@/components/ui/Form'
import {
  addInvoicePackageItem,
  deleteInvoicePackageFile,
  deleteInvoicePackageItem,
  downloadInvoicePackageDocumentPdf,
  generateInvoicePackageDocument,
  getInvoicePackage,
  getInvoicePackageFileUrl,
  updateInvoicePackage,
  uploadInvoicePackageFile,
} from '@/services/invoicePackageService'
import { listProducts } from '@/services/productService'
import { useAuth } from '@/hooks/useAuth'
import type { InvoiceDocumentType, InvoicePackageDocument, Product } from '@/types'
import clsx from 'clsx'

const DOC_TYPES: InvoiceDocumentType[] = ['PI', 'CI', 'PL', 'SC', 'CO', 'BL', 'OTHER']
const STATUSES = ['draft', 'active', 'approved', 'closed', 'cancelled']

const TXT = {
  en: {
    back: 'Back',
    overview: 'Overview',
    items: 'Items',
    shipping: 'Shipping',
    documents: 'Documents',
    files: 'Files',
    accounting: 'Accounting',
    history: 'History',
    source: 'Source',
    status: 'Status',
    buyer: 'Buyer',
    route: 'Route',
    total: 'Total',
    subtotal: 'Subtotal',
    discount: 'Discount',
    save: 'Save',
    addItem: 'Add item',
    addDocument: 'Generate document',
    uploadFile: 'Upload file',
    product: 'Product',
    description: 'Description',
    descriptionAr: 'Arabic description',
    hs: 'HS code',
    qty: 'Quantity',
    unit: 'Unit',
    price: 'Unit price',
    cartons: 'Cartons',
    pcsCarton: 'PCS/carton',
    gross: 'Gross kg',
    net: 'Net kg',
    cbm: 'CBM',
    cancel: 'Cancel',
    create: 'Create',
    upload: 'Upload',
    documentType: 'Document type',
    language: 'Language',
    pdfEn: 'English PDF',
    pdfAr: 'Arabic PDF',
    issueDate: 'Issue date',
    dueDate: 'Due date',
    fileType: 'File type',
    noItems: 'No items',
    noDocs: 'No documents',
    noFiles: 'No files',
    noHistory: 'No history',
    linkedLater: 'Linked entries will appear here',
    delete: 'Delete',
    notes: 'Notes',
    origin: 'Origin',
    destination: 'Destination',
    pol: 'Port of loading',
    pod: 'Port of discharge',
    containerNo: 'Container no.',
    sealNo: 'Seal no.',
    bl: 'B/L no.',
    vessel: 'Vessel',
    voyage: 'Voyage',
    awb: 'AWB',
    flight: 'Flight',
  },
  ar: {
    back: 'رجوع',
    overview: 'نظرة عامة',
    items: 'الأصناف',
    shipping: 'الشحن',
    documents: 'المستندات',
    files: 'الملفات',
    accounting: 'الحسابات',
    history: 'السجل',
    source: 'المصدر',
    status: 'الحالة',
    buyer: 'المشتري',
    route: 'المسار',
    total: 'الإجمالي',
    subtotal: 'المجموع',
    discount: 'الخصم',
    save: 'حفظ',
    addItem: 'إضافة صنف',
    addDocument: 'إنشاء مستند',
    uploadFile: 'رفع ملف',
    product: 'المنتج',
    description: 'الوصف',
    descriptionAr: 'الوصف العربي',
    hs: 'رمز HS',
    qty: 'الكمية',
    unit: 'الوحدة',
    price: 'سعر الوحدة',
    cartons: 'الكرتين',
    pcsCarton: 'قطعة/كرتونة',
    gross: 'الوزن الإجمالي',
    net: 'الوزن الصافي',
    cbm: 'الحجم CBM',
    cancel: 'إلغاء',
    create: 'إنشاء',
    upload: 'رفع',
    documentType: 'نوع المستند',
    language: 'اللغة',
    pdfEn: 'PDF إنجليزي',
    pdfAr: 'PDF عربي',
    issueDate: 'تاريخ الإصدار',
    dueDate: 'تاريخ الاستحقاق',
    fileType: 'نوع الملف',
    noItems: 'لا توجد أصناف',
    noDocs: 'لا توجد مستندات',
    noFiles: 'لا توجد ملفات',
    noHistory: 'لا يوجد سجل',
    linkedLater: 'ستظهر القيود المرتبطة هنا',
    delete: 'حذف',
    notes: 'ملاحظات',
    origin: 'المنشأ',
    destination: 'الوجهة',
    pol: 'ميناء التحميل',
    pod: 'ميناء التفريغ',
    containerNo: 'رقم الحاوية',
    sealNo: 'رقم السيل',
    bl: 'رقم البوليصة',
    vessel: 'السفينة',
    voyage: 'الرحلة',
    awb: 'AWB',
    flight: 'الرحلة الجوية',
  },
} as const

const DOC_LABELS: Record<InvoiceDocumentType, { en: string; ar: string }> = {
  PI: { en: 'Proforma Invoice', ar: 'فاتورة مبدئية' },
  CI: { en: 'Commercial Invoice', ar: 'فاتورة تجارية' },
  PL: { en: 'Packing List', ar: 'قائمة تعبئة' },
  SC: { en: 'Sales Contract', ar: 'عقد بيع' },
  CO: { en: 'Certificate of Origin', ar: 'شهادة منشأ' },
  BL: { en: 'Bill of Lading', ar: 'بوليصة شحن' },
  OTHER: { en: 'Other', ar: 'أخرى' },
}

type Tab = 'overview' | 'items' | 'shipping' | 'documents' | 'files' | 'accounting' | 'history'

function money(value: number | string | null | undefined, currency = 'USD') {
  return `${currency} ${Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function docLabel(type: string, isAr: boolean) {
  const key = type as InvoiceDocumentType
  return DOC_LABELS[key]?.[isAr ? 'ar' : 'en'] ?? type
}

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}

interface ItemForm {
  product_id: string
  description: string
  description_ar: string
  hs_code: string
  quantity: string
  unit: string
  unit_price: string
  cartons: string
  pcs_per_carton: string
  gross_weight: string
  net_weight: string
  cbm: string
  hs_code_ref_id: number | null
  customs_unit_basis: string
  customs_unit_quantity: string
}

function emptyItem(): ItemForm {
  return {
    product_id: '',
    description: '',
    description_ar: '',
    hs_code: '',
    quantity: '1',
    unit: 'pcs',
    unit_price: '0',
    cartons: '',
    pcs_per_carton: '',
    gross_weight: '',
    net_weight: '',
    cbm: '',
    hs_code_ref_id: null,
    customs_unit_basis: '',
    customs_unit_quantity: '',
  }
}

export default function InvoicePackageProfile() {
  const { id } = useParams<{ id: string }>()
  const packageId = Number(id)
  const navigate = useNavigate()
  const { i18n } = useTranslation()
  const isAr = i18n.language === 'ar'
  const c = isAr ? TXT.ar : TXT.en
  const qc = useQueryClient()
  const { isStaff } = useAuth()

  const [tab, setTab] = useState<Tab>('overview')
  const [edit, setEdit] = useState<Record<string, string>>({})
  const [itemOpen, setItemOpen] = useState(false)
  const [itemForm, setItemForm] = useState<ItemForm>(() => emptyItem())
  const [documentOpen, setDocumentOpen] = useState(false)
  const [documentForm, setDocumentForm] = useState({
    document_type: 'PI',
    language: isAr ? 'ar' : 'en',
    issue_date: isoToday(),
    due_date: '',
    notes: '',
  })
  const [fileOpen, setFileOpen] = useState(false)
  const [fileMeta, setFileMeta] = useState({ document_type: 'OTHER', custom_file_type: '' })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const { data: pack, isLoading, isError } = useQuery({
    queryKey: ['invoice-package', packageId],
    queryFn: () => getInvoicePackage(packageId),
    enabled: !!packageId,
  })

  const { data: productsData } = useQuery({
    queryKey: ['invoice-package-products'],
    queryFn: () => listProducts({ page: 1, page_size: 200 }),
    staleTime: 60_000,
  })

  const updateMut = useMutation({
    mutationFn: (data: unknown) => updateInvoicePackage(packageId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoice-package', packageId] }),
  })

  const addItemMut = useMutation({
    mutationFn: (data: unknown) => addInvoicePackageItem(packageId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice-package', packageId] })
      setItemOpen(false)
      setItemForm(emptyItem())
    },
  })

  const deleteItemMut = useMutation({
    mutationFn: (itemId: number) => deleteInvoicePackageItem(packageId, itemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoice-package', packageId] }),
  })

  const docMut = useMutation({
    mutationFn: (data: unknown) => generateInvoicePackageDocument(packageId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice-package', packageId] })
      setDocumentOpen(false)
    },
  })

  const uploadMut = useMutation({
    mutationFn: () => uploadInvoicePackageFile(packageId, selectedFile as File, fileMeta),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice-package', packageId] })
      setFileOpen(false)
      setSelectedFile(null)
      setFileMeta({ document_type: 'OTHER', custom_file_type: '' })
    },
  })

  const deleteFileMut = useMutation({
    mutationFn: (fileId: number) => deleteInvoicePackageFile(packageId, fileId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoice-package', packageId] }),
  })

  const products = productsData?.results ?? []
  const productOptions = useMemo(() => products.map((product) => ({
    value: String(product.id),
    label: `${product.code} - ${isAr ? product.name_ar || product.name : product.name}`,
  })), [products, isAr])

  function setItem<K extends keyof ItemForm>(key: K, value: ItemForm[K]) {
    setItemForm((prev) => ({ ...prev, [key]: value }))
  }

  function applyProduct(productId: string) {
    setItem('product_id', productId)
    const product = products.find((row: Product) => String(row.id) === productId)
    if (!product) return
    setItemForm((prev) => ({
      ...prev,
      product_id: productId,
      hs_code_ref_id: product.hs_code_ref_id,
      description: product.name,
      description_ar: product.name_ar ?? '',
      hs_code: product.hs_code_ref?.hs_code ?? product.hs_code ?? '',
      customs_unit_basis: product.hs_code_ref?.customs_unit_basis ?? product.customs_unit_basis ?? '',
      customs_unit_quantity: product.hs_code_ref?.customs_unit_quantity ? String(product.hs_code_ref.customs_unit_quantity) : '',
      unit_price: product.price_usd ? String(product.price_usd) : prev.unit_price,
      pcs_per_carton: product.pcs_per_carton ? String(product.pcs_per_carton) : prev.pcs_per_carton,
      gross_weight: product.gross_weight_kg_per_carton ?? prev.gross_weight,
      net_weight: product.net_weight_kg_per_carton ?? prev.net_weight,
    }))
  }

  function saveOverview() {
    if (!pack) return
    updateMut.mutate({
      title: edit.title ?? pack.title,
      status: edit.status ?? pack.status,
      buyer_name: edit.buyer_name ?? pack.buyer_name,
      origin: edit.origin ?? pack.origin,
      destination: edit.destination ?? pack.destination,
      port_of_loading: edit.port_of_loading ?? pack.port_of_loading,
      port_of_discharge: edit.port_of_discharge ?? pack.port_of_discharge,
      shipping_term: edit.shipping_term ?? pack.shipping_term,
      payment_terms: edit.payment_terms ?? pack.payment_terms,
      discount: Number(edit.discount ?? pack.discount ?? 0),
      notes: edit.notes ?? pack.notes,
      currency: 'USD',
    })
  }

  function submitItem(e: React.FormEvent) {
    e.preventDefault()
    addItemMut.mutate({
      product_id: itemForm.product_id ? Number(itemForm.product_id) : null,
      hs_code_ref_id: itemForm.hs_code_ref_id,
      description: itemForm.description,
      description_ar: itemForm.description_ar || null,
      hs_code: itemForm.hs_code || null,
      customs_unit_basis: itemForm.customs_unit_basis || null,
      customs_unit_quantity: itemForm.customs_unit_quantity ? Number(itemForm.customs_unit_quantity) : null,
      quantity: Number(itemForm.quantity || 0),
      unit: itemForm.unit || null,
      unit_price: Number(itemForm.unit_price || 0),
      cartons: itemForm.cartons ? Number(itemForm.cartons) : null,
      pcs_per_carton: itemForm.pcs_per_carton ? Number(itemForm.pcs_per_carton) : null,
      gross_weight: itemForm.gross_weight ? Number(itemForm.gross_weight) : null,
      net_weight: itemForm.net_weight ? Number(itemForm.net_weight) : null,
      cbm: itemForm.cbm ? Number(itemForm.cbm) : null,
      sort_order: pack?.items.length ?? 0,
    })
  }

  async function downloadDocumentPdf(doc: InvoicePackageDocument, lang: 'en' | 'ar') {
    const blob = await downloadInvoicePackageDocumentPdf(packageId, doc.id, lang)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${doc.document_number}_${lang}.pdf`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  if (isLoading) return <div className="py-16 text-center text-brand-text-muted">Loading...</div>
  if (isError || !pack) {
    return (
      <div className="py-16 text-center space-y-4">
        <p className="text-brand-red">Package not found</p>
        <Button variant="secondary" onClick={() => navigate('/invoices')}>{c.back}</Button>
      </div>
    )
  }

  const tabs: { id: Tab; icon: React.ReactNode; label: string }[] = [
    { id: 'overview', icon: <FileText size={15} />, label: c.overview },
    { id: 'items', icon: <Package size={15} />, label: c.items },
    { id: 'shipping', icon: <Ship size={15} />, label: c.shipping },
    { id: 'documents', icon: <FilePlus2 size={15} />, label: c.documents },
    { id: 'files', icon: <Paperclip size={15} />, label: c.files },
    { id: 'accounting', icon: <WalletCards size={15} />, label: c.accounting },
    { id: 'history', icon: <History size={15} />, label: c.history },
  ]

  const statusOptions = STATUSES.map((value) => ({ value, label: value }))
  const docOptions = DOC_TYPES.map((value) => ({ value, label: `${value} - ${docLabel(value, isAr)}` }))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="secondary" size="sm" onClick={() => navigate('/invoices')}>
            <ArrowLeft size={15} />
            {c.back}
          </Button>
          <div className="min-w-0">
            <h1 className="page-title truncate">{pack.package_number}</h1>
            <p className="text-sm text-brand-text-muted truncate">
              {pack.title || pack.client?.name || pack.buyer_name || '-'}
            </p>
          </div>
        </div>
        {isStaff && (
          <Button onClick={saveOverview} loading={updateMut.isPending}>
            <Save size={16} />
            {c.save}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-brand-border bg-brand-card/80 p-4">
          <div className="text-xs text-brand-text-muted">{c.status}</div>
          <div className="text-lg font-bold text-brand-text">{pack.status}</div>
        </div>
        <div className="rounded-xl border border-brand-border bg-brand-card/80 p-4">
          <div className="text-xs text-brand-text-muted">{c.items}</div>
          <div className="text-lg font-bold text-brand-text">{pack.items.length}</div>
        </div>
        <div className="rounded-xl border border-brand-border bg-brand-card/80 p-4">
          <div className="text-xs text-brand-text-muted">{c.documents}</div>
          <div className="text-lg font-bold text-brand-text">{pack.documents.length}</div>
        </div>
        <div className="rounded-xl border border-brand-border bg-brand-card/80 p-4">
          <div className="text-xs text-brand-text-muted">{c.total}</div>
          <div className="text-lg font-bold text-emerald-300">{money(pack.total, pack.currency)}</div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={clsx(
              'shrink-0 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm border transition-colors',
              tab === item.id
                ? 'border-brand-primary bg-brand-primary/15 text-brand-primary-light'
                : 'border-brand-border bg-white/[0.03] text-brand-text-muted hover:text-brand-text',
            )}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <section className="rounded-xl border border-brand-border bg-brand-card/80 p-5 space-y-4">
          <FormRow cols={3}>
            <Input label={c.source} value={pack.source_type} disabled />
            <Select
              label={c.status}
              value={edit.status ?? pack.status}
              onChange={(e) => setEdit((prev) => ({ ...prev, status: e.target.value }))}
              options={statusOptions}
            />
            <Input label={c.discount} type="number" step="0.01" value={edit.discount ?? String(pack.discount)} onChange={(e) => setEdit((prev) => ({ ...prev, discount: e.target.value }))} />
          </FormRow>
          <FormRow cols={2}>
            <Input label="Title" value={edit.title ?? pack.title ?? ''} onChange={(e) => setEdit((prev) => ({ ...prev, title: e.target.value }))} />
            <Input label={c.buyer} value={edit.buyer_name ?? pack.buyer_name ?? pack.client?.name ?? ''} onChange={(e) => setEdit((prev) => ({ ...prev, buyer_name: e.target.value }))} />
          </FormRow>
          <Textarea label={c.notes} value={edit.notes ?? pack.notes ?? ''} onChange={(e) => setEdit((prev) => ({ ...prev, notes: e.target.value }))} />
        </section>
      )}

      {tab === 'shipping' && (
        <section className="rounded-xl border border-brand-border bg-brand-card/80 p-5 space-y-4">
          <FormRow cols={2}>
            <Input label={c.origin} value={edit.origin ?? pack.origin ?? ''} onChange={(e) => setEdit((prev) => ({ ...prev, origin: e.target.value }))} />
            <Input label={c.destination} value={edit.destination ?? pack.destination ?? ''} onChange={(e) => setEdit((prev) => ({ ...prev, destination: e.target.value }))} />
          </FormRow>
          <FormRow cols={2}>
            <Input label={c.pol} value={edit.port_of_loading ?? pack.port_of_loading ?? ''} onChange={(e) => setEdit((prev) => ({ ...prev, port_of_loading: e.target.value }))} />
            <Input label={c.pod} value={edit.port_of_discharge ?? pack.port_of_discharge ?? ''} onChange={(e) => setEdit((prev) => ({ ...prev, port_of_discharge: e.target.value }))} />
          </FormRow>
          <FormRow cols={3}>
            <Input label={c.containerNo} value={pack.container_no ?? ''} disabled />
            <Input label={c.sealNo} value={pack.seal_no ?? ''} disabled />
            <Input label={c.bl} value={pack.bl_number ?? ''} disabled />
          </FormRow>
          <FormRow cols={2}>
            <Input label={c.vessel} value={pack.vessel_name ?? ''} disabled />
            <Input label={c.voyage} value={pack.voyage_number ?? ''} disabled />
          </FormRow>
          <FormRow cols={2}>
            <Input label={c.awb} value={pack.awb_number ?? ''} disabled />
            <Input label={c.flight} value={pack.flight_number ?? ''} disabled />
          </FormRow>
        </section>
      )}

      {tab === 'items' && (
        <section className="space-y-3">
          <div className="flex justify-end">
            {isStaff && <Button onClick={() => setItemOpen(true)}><Plus size={16} />{c.addItem}</Button>}
          </div>
          {pack.items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-brand-border p-8 text-center text-brand-text-muted">{c.noItems}</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-brand-border">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.04] text-brand-text-muted">
                  <tr>
                    <th className="text-start p-3">{c.description}</th>
                    <th className="text-start p-3">{c.hs}</th>
                    <th className="text-end p-3">{c.qty}</th>
                    <th className="text-end p-3">{c.cartons}</th>
                    <th className="text-end p-3">{c.cbm}</th>
                    <th className="text-end p-3">{c.total}</th>
                    {isStaff && <th className="w-10" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border">
                  {pack.items.map((item) => (
                    <tr key={item.id} className="bg-brand-card/70">
                      <td className="p-3">
                        <div className="font-medium text-brand-text">{isAr ? item.description_ar || item.description : item.description}</div>
                        <div className="text-xs text-brand-text-muted">{item.unit || '-'}</div>
                      </td>
                      <td className="p-3 text-brand-text-muted">{item.hs_code || '-'}</td>
                      <td className="p-3 text-end">{Number(item.quantity).toLocaleString()}</td>
                      <td className="p-3 text-end">{item.cartons ?? '-'}</td>
                      <td className="p-3 text-end">{item.cbm ?? '-'}</td>
                      <td className="p-3 text-end font-semibold text-emerald-300">{money(item.total_price, pack.currency)}</td>
                      {isStaff && (
                        <td className="p-2">
                          <button className="p-2 rounded-lg text-brand-text-muted hover:text-brand-red hover:bg-brand-red/10" onClick={() => deleteItemMut.mutate(item.id)}>
                            <Trash2 size={15} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'documents' && (
        <section className="space-y-3">
          <div className="flex justify-end">
            {isStaff && <Button onClick={() => setDocumentOpen(true)}><FilePlus2 size={16} />{c.addDocument}</Button>}
          </div>
          {pack.documents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-brand-border p-8 text-center text-brand-text-muted">{c.noDocs}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pack.documents.map((doc) => (
                <div key={doc.id} className="rounded-xl border border-brand-border bg-brand-card/80 p-4">
                  <div className="flex justify-between gap-3">
                    <div>
                      <div className="font-bold text-brand-text">{doc.document_number}</div>
                      <div className="text-sm text-brand-text-muted">{docLabel(doc.document_type, isAr)} · {doc.language.toUpperCase()}</div>
                    </div>
                    <span className="text-xs rounded-full bg-white/10 px-2 py-1 h-fit text-brand-text-muted">{doc.status}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void downloadDocumentPdf(doc, 'en')}
                      className="inline-flex items-center gap-2 rounded-lg border border-brand-border bg-white/[0.04] px-3 py-2 text-xs font-semibold text-brand-text-muted hover:text-brand-primary-light hover:border-brand-primary/60"
                    >
                      <Download size={14} />
                      {c.pdfEn}
                    </button>
                    <button
                      type="button"
                      onClick={() => void downloadDocumentPdf(doc, 'ar')}
                      className="inline-flex items-center gap-2 rounded-lg border border-brand-border bg-white/[0.04] px-3 py-2 text-xs font-semibold text-brand-text-muted hover:text-brand-primary-light hover:border-brand-primary/60"
                    >
                      <Download size={14} />
                      {c.pdfAr}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'files' && (
        <section className="space-y-3">
          <div className="flex justify-end">
            {isStaff && <Button onClick={() => setFileOpen(true)}><Paperclip size={16} />{c.uploadFile}</Button>}
          </div>
          {pack.files.length === 0 ? (
            <div className="rounded-xl border border-dashed border-brand-border p-8 text-center text-brand-text-muted">{c.noFiles}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pack.files.map((file) => (
                <div key={file.id} className="rounded-xl border border-brand-border bg-brand-card/80 p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-brand-text truncate">{file.original_filename || file.file_path}</div>
                    <div className="text-xs text-brand-text-muted">{docLabel(file.document_type, isAr)} · {file.extraction_status}</div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Link className="p-2 rounded-lg text-brand-text-muted hover:text-brand-primary-light hover:bg-white/10" to={getInvoicePackageFileUrl(pack.id, file.id)} target="_blank">
                      <Download size={15} />
                    </Link>
                    {isStaff && (
                      <button className="p-2 rounded-lg text-brand-text-muted hover:text-brand-red hover:bg-brand-red/10" onClick={() => deleteFileMut.mutate(file.id)}>
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'accounting' && (
        <div className="rounded-xl border border-dashed border-brand-border p-8 text-center text-brand-text-muted">{c.linkedLater}</div>
      )}

      {tab === 'history' && (
        <section className="space-y-3">
          {pack.activity_log.length === 0 ? (
            <div className="rounded-xl border border-dashed border-brand-border p-8 text-center text-brand-text-muted">{c.noHistory}</div>
          ) : pack.activity_log.map((log) => (
            <div key={log.id} className="rounded-xl border border-brand-border bg-brand-card/80 p-4">
              <div className="font-semibold text-brand-text">{log.action}</div>
              <div className="text-sm text-brand-text-muted">{log.summary || '-'}</div>
              <div className="text-xs text-brand-text-muted mt-1">{new Date(log.created_at).toLocaleString()}</div>
            </div>
          ))}
        </section>
      )}

      <Modal open={itemOpen} onClose={() => setItemOpen(false)} title={c.addItem} size="xl">
        <form onSubmit={submitItem} className="space-y-4">
          <Select label={c.product} value={itemForm.product_id} onChange={(e) => applyProduct(e.target.value)} options={productOptions} placeholder="-" />
          <FormRow cols={2}>
            <Input label={c.description} value={itemForm.description} onChange={(e) => setItem('description', e.target.value)} required />
            <Input label={c.descriptionAr} value={itemForm.description_ar} onChange={(e) => setItem('description_ar', e.target.value)} />
          </FormRow>
          <FormRow cols={3}>
            <Input label={c.hs} value={itemForm.hs_code} onChange={(e) => setItem('hs_code', e.target.value)} />
            <Input label={c.qty} type="number" step="0.001" value={itemForm.quantity} onChange={(e) => setItem('quantity', e.target.value)} />
            <Input label={c.unit} value={itemForm.unit} onChange={(e) => setItem('unit', e.target.value)} />
          </FormRow>
          <FormRow cols={3}>
            <Input label={c.price} type="number" step="0.0001" value={itemForm.unit_price} onChange={(e) => setItem('unit_price', e.target.value)} />
            <Input label={c.cartons} type="number" step="0.001" value={itemForm.cartons} onChange={(e) => setItem('cartons', e.target.value)} />
            <Input label={c.pcsCarton} type="number" step="0.001" value={itemForm.pcs_per_carton} onChange={(e) => setItem('pcs_per_carton', e.target.value)} />
          </FormRow>
          <FormRow cols={3}>
            <Input label={c.gross} type="number" step="0.001" value={itemForm.gross_weight} onChange={(e) => setItem('gross_weight', e.target.value)} />
            <Input label={c.net} type="number" step="0.001" value={itemForm.net_weight} onChange={(e) => setItem('net_weight', e.target.value)} />
            <Input label={c.cbm} type="number" step="0.0001" value={itemForm.cbm} onChange={(e) => setItem('cbm', e.target.value)} />
          </FormRow>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setItemOpen(false)}>{c.cancel}</Button>
            <Button type="submit" loading={addItemMut.isPending}>{c.create}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={documentOpen} onClose={() => setDocumentOpen(false)} title={c.addDocument} size="md">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            docMut.mutate({
              ...documentForm,
              due_date: documentForm.due_date || null,
              notes: documentForm.notes || null,
            })
          }}
        >
          <Select label={c.documentType} value={documentForm.document_type} onChange={(e) => setDocumentForm((prev) => ({ ...prev, document_type: e.target.value }))} options={docOptions} />
          <Select label={c.language} value={documentForm.language} onChange={(e) => setDocumentForm((prev) => ({ ...prev, language: e.target.value }))} options={[{ value: 'en', label: 'English' }, { value: 'ar', label: 'العربية' }]} />
          <FormRow cols={2}>
            <Input label={c.issueDate} type="date" value={documentForm.issue_date} onChange={(e) => setDocumentForm((prev) => ({ ...prev, issue_date: e.target.value }))} />
            <Input label={c.dueDate} type="date" value={documentForm.due_date} onChange={(e) => setDocumentForm((prev) => ({ ...prev, due_date: e.target.value }))} />
          </FormRow>
          <Textarea label={c.notes} value={documentForm.notes} onChange={(e) => setDocumentForm((prev) => ({ ...prev, notes: e.target.value }))} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setDocumentOpen(false)}>{c.cancel}</Button>
            <Button type="submit" loading={docMut.isPending}>{c.create}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={fileOpen} onClose={() => setFileOpen(false)} title={c.uploadFile} size="md">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (selectedFile) uploadMut.mutate()
          }}
        >
          <Select label={c.documentType} value={fileMeta.document_type} onChange={(e) => setFileMeta((prev) => ({ ...prev, document_type: e.target.value }))} options={docOptions} />
          <Input label={c.fileType} value={fileMeta.custom_file_type} onChange={(e) => setFileMeta((prev) => ({ ...prev, custom_file_type: e.target.value }))} />
          <input className="input-base w-full" type="file" onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setFileOpen(false)}>{c.cancel}</Button>
            <Button type="submit" loading={uploadMut.isPending} disabled={!selectedFile}>{c.upload}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
