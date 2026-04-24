import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FolderOpen, ScanLine, Play, CheckCircle2, XCircle, SkipForward, Loader2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import { getSuppliers } from '@/services/supplierService'

const DEFAULT_PATH = '/home/odah/Downloads/Telegram Desktop'

interface FolderEntry { code: string; path: string; photo_count: number }
interface ProgressEvent {
  type: 'start' | 'progress' | 'done'
  total?: number
  i?: number
  code?: string
  status?: 'created' | 'skipped' | 'error'
  photos?: number
  error?: string
  created?: number
  skipped?: number
  failed?: number
}

export default function BulkImport() {
  const [folderPath, setFolderPath] = useState(DEFAULT_PATH)
  const [entries, setEntries] = useState<FolderEntry[] | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState('')

  const [supplierId, setSupplierId] = useState('')
  const [price, setPrice] = useState('0.00')
  const [pcs, setPcs] = useState('250')
  const [cbm, setCbm] = useState('0.20')
  const [minOrder, setMinOrder] = useState('1')
  const [category, setCategory] = useState('')

  const [importing, setImporting] = useState(false)
  const [log, setLog] = useState<ProgressEvent[]>([])
  const [summary, setSummary] = useState<ProgressEvent | null>(null)
  const [total, setTotal] = useState(0)
  const [progress, setProgress] = useState(0)
  const logRef = useRef<HTMLDivElement>(null)

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => getSuppliers(),
  })

  async function handleScan() {
    setScanError('')
    setEntries(null)
    setScanning(true)
    try {
      const token = localStorage.getItem('access_token') ?? ''
      const res = await fetch('/api/v1/products/admin/scan-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ folder_path: folderPath }),
      })
      if (!res.ok) {
        const err = await res.json()
        setScanError(err.detail ?? 'Scan failed')
        return
      }
      const data = await res.json()
      setEntries(data.entries)
    } catch (e: any) {
      setScanError(String(e))
    } finally {
      setScanning(false)
    }
  }

  async function handleImport() {
    if (!entries?.length) return
    setImporting(true)
    setLog([])
    setSummary(null)
    setProgress(0)

    const token = localStorage.getItem('access_token') ?? ''
    const body = {
      folder_path: folderPath,
      supplier_id: supplierId ? Number(supplierId) : null,
      default_price: price,
      default_pcs: Number(pcs),
      default_cbm: cbm,
      default_min: Number(minOrder),
      default_category: category || null,
    }

    try {
      const res = await fetch('/api/v1/products/admin/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })

      if (!res.ok || !res.body) {
        setImporting(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event: ProgressEvent = JSON.parse(line.slice(6))
            if (event.type === 'start') {
              setTotal(event.total ?? 0)
            } else if (event.type === 'progress') {
              setProgress(event.i ?? 0)
              setLog((prev) => [...prev, event])
              setTimeout(() => {
                logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
              }, 10)
            } else if (event.type === 'done') {
              setSummary(event)
            }
          } catch {}
        }
      }
    } finally {
      setImporting(false)
    }
  }

  const pct = total > 0 ? Math.round((progress / total) * 100) : 0

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Bulk Import Products</h1>
        <p className="text-sm text-gray-400 mt-1">
          Import products from a local folder — each subfolder becomes one product with its photos.
        </p>
      </div>

      {/* Folder path */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <FolderOpen size={16} className="text-brand-primary-light" /> Source Folder
        </h2>
        <div className="flex gap-2">
          <input
            value={folderPath}
            onChange={(e) => setFolderPath(e.target.value)}
            placeholder="/path/to/folder"
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-primary/50"
          />
          <Button
            onClick={handleScan}
            disabled={scanning || !folderPath}
            className="flex items-center gap-2 shrink-0"
          >
            {scanning ? <Loader2 size={14} className="animate-spin" /> : <ScanLine size={14} />}
            Scan
          </Button>
        </div>
        {scanError && <p className="text-red-400 text-xs">{scanError}</p>}

        {entries !== null && (
          <p className="text-xs text-gray-400">
            Found <span className="text-white font-semibold">{entries.length}</span> product folders
            {entries.length > 0 && (
              <> — {entries.reduce((s, e) => s + e.photo_count, 0)} photos total</>
            )}
          </p>
        )}
      </div>

      {/* Folder preview */}
      {entries && entries.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white">Preview ({entries.length} folders)</h2>
          <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
            {entries.map((e) => (
              <div key={e.code} className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg bg-white/5">
                <span className="text-white font-mono">{e.code}</span>
                <span className="text-gray-500">{e.photo_count} photo{e.photo_count !== 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Import defaults */}
      {entries && entries.length > 0 && !summary && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Default Values</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <label className="space-y-1">
              <span className="text-xs text-gray-400">Supplier</span>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-primary/50"
              >
                <option value="">None</option>
                {suppliersData?.results?.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs text-gray-400">Price CNY (¥)</span>
              <input value={price} onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-primary/50" />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-gray-400">Pcs / carton</span>
              <input value={pcs} onChange={(e) => setPcs(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-primary/50" />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-gray-400">CBM / carton</span>
              <input value={cbm} onChange={(e) => setCbm(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-primary/50" />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-gray-400">Min order (ctn)</span>
              <input value={minOrder} onChange={(e) => setMinOrder(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-primary/50" />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-gray-400">Category</span>
              <input value={category} onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Clothing"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-primary/50" />
            </label>
          </div>

          <Button
            onClick={handleImport}
            disabled={importing}
            className="flex items-center gap-2 bg-brand-primary hover:bg-brand-primary/90 text-white w-full justify-center py-2.5"
          >
            {importing
              ? <><Loader2 size={15} className="animate-spin" /> Importing…</>
              : <><Play size={15} /> Start Import ({entries.length} products)</>
            }
          </Button>
        </div>
      )}

      {/* Progress bar */}
      {importing && total > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-gray-400">
            <span>{progress} / {total} processed</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-primary rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Live log */}
      {log.length > 0 && (
        <div
          ref={logRef}
          className="rounded-xl border border-white/10 bg-black/30 p-4 max-h-64 overflow-y-auto font-mono text-xs space-y-0.5"
        >
          {log.map((ev, idx) => (
            <div key={idx} className="flex items-center gap-2">
              {ev.status === 'created'  && <CheckCircle2 size={12} className="text-green-400 shrink-0" />}
              {ev.status === 'skipped'  && <SkipForward  size={12} className="text-yellow-400 shrink-0" />}
              {ev.status === 'error'    && <XCircle       size={12} className="text-red-400 shrink-0" />}
              <span className={
                ev.status === 'created' ? 'text-green-300' :
                ev.status === 'skipped' ? 'text-yellow-300' : 'text-red-300'
              }>
                [{ev.i}/{ev.total}] {ev.code}
                {ev.status === 'created' && ` — ${ev.photos} photos`}
                {ev.status === 'skipped' && ' — already exists'}
                {ev.status === 'error'   && ` — ${ev.error}`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Done summary */}
      {summary && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-5 space-y-3">
          <h2 className="text-sm font-bold text-green-400 flex items-center gap-2">
            <CheckCircle2 size={16} /> Import Complete
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-white/5 p-3 text-center">
              <p className="text-2xl font-black text-green-400">{summary.created}</p>
              <p className="text-xs text-gray-400 mt-1">Created</p>
            </div>
            <div className="rounded-lg bg-white/5 p-3 text-center">
              <p className="text-2xl font-black text-yellow-400">{summary.skipped}</p>
              <p className="text-xs text-gray-400 mt-1">Skipped</p>
            </div>
            <div className="rounded-lg bg-white/5 p-3 text-center">
              <p className="text-2xl font-black text-red-400">{summary.failed}</p>
              <p className="text-xs text-gray-400 mt-1">Failed</p>
            </div>
          </div>
          <p className="text-xs text-gray-400">
            Products are now available in the{' '}
            <a href="/products" className="text-brand-primary-light hover:underline">Products list</a>{' '}
            and the{' '}
            <a href="/shop/products" className="text-brand-primary-light hover:underline">shop</a>.
          </p>
        </div>
      )}
    </div>
  )
}
