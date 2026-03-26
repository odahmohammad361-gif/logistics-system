import { useState, useRef } from 'react'
import { FileSpreadsheet, ClipboardPaste, Upload } from 'lucide-react'
import Button from '@/components/ui/Button'
import { importInvoiceExcel } from '@/services/invoiceService'

export interface ParsedItem {
  description: string
  details: string
  hs_code: string
  quantity: number | null
  unit_price: number | null
  cartons: number | null
  gross_weight: number | null
  net_weight: number | null
  cbm: number | null
}

interface Props {
  onImport: (items: ParsedItem[]) => void
  onClose: () => void
}

function parseTsv(text: string): ParsedItem[] {
  return text
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((row) => {
      const cols = row.split('\t')
      const num = (v: string | undefined) => {
        if (!v || v.trim() === '') return null
        const n = parseFloat(v.replace(/,/g, ''))
        return isNaN(n) ? null : n
      }
      return {
        description: cols[0]?.trim() ?? '',
        details: cols[1]?.trim() ?? '',
        hs_code: cols[2]?.trim() ?? '',
        quantity: num(cols[3]),
        unit_price: num(cols[4]),
        cartons: num(cols[5]) !== null ? Math.round(num(cols[5])!) : null,
        gross_weight: num(cols[6]),
        net_weight: num(cols[7]),
        cbm: num(cols[8]),
      }
    })
    .filter((i) => i.description)
}

export default function ExcelImportPanel({ onImport, onClose }: Props) {
  const [tab, setTab] = useState<'paste' | 'file'>('paste')
  const [pasteText, setPasteText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setLoading(true)
    setError('')
    try {
      const result = await importInvoiceExcel(file)
      onImport(result.items)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to parse file')
    } finally {
      setLoading(false)
    }
  }

  function handlePasteImport() {
    if (!pasteText.trim()) { setError('Paste some data first'); return }
    const items = parseTsv(pasteText)
    if (!items.length) { setError('No valid rows found'); return }
    onImport(items)
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-400">
        Expected columns: <span className="text-gray-300 font-mono">Description | Details | HS Code | QTY | Unit Price | Cartons | G.W. | N.W. | CBM</span>
      </p>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab('paste')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs ${
            tab === 'paste' ? 'bg-brand-green text-black font-semibold' : 'bg-brand-surface text-gray-400'
          }`}
        >
          <ClipboardPaste size={13} /> Paste from Excel
        </button>
        <button
          type="button"
          onClick={() => setTab('file')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs ${
            tab === 'file' ? 'bg-brand-green text-black font-semibold' : 'bg-brand-surface text-gray-400'
          }`}
        >
          <FileSpreadsheet size={13} /> Upload .xlsx
        </button>
      </div>

      {tab === 'paste' && (
        <div className="space-y-2">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Select rows in Excel and Ctrl+C, then paste here (Ctrl+V)..."
            rows={8}
            className="w-full bg-brand-surface border border-brand-border rounded p-2 text-xs font-mono text-gray-200 placeholder-gray-600 resize-y"
          />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="button" size="sm" onClick={handlePasteImport}>Import Rows</Button>
          </div>
        </div>
      )}

      {tab === 'file' && (
        <div className="space-y-2">
          <div
            className="border-2 border-dashed border-brand-border rounded-lg p-6 text-center cursor-pointer hover:border-gray-500 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={24} className="mx-auto text-gray-500 mb-2" />
            <p className="text-xs text-gray-400">Click to upload .xlsx file</p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            {loading && <span className="text-xs text-gray-400 self-center">Parsing...</span>}
          </div>
        </div>
      )}
    </div>
  )
}
