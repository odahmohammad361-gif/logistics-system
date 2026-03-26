import { useState, useRef } from 'react'
import { ScanLine, Upload } from 'lucide-react'
import Button from '@/components/ui/Button'
import type { OcrResult } from '@/types'
import { ocrContainerDocument } from '@/services/containerService'

interface Props {
  onExtracted: (result: OcrResult) => void
  onClose: () => void
}

export default function OcrUploadPanel({ onExtracted, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<OcrResult | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const data = await ocrContainerDocument(file)
      setResult(data)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'OCR failed — please fill fields manually')
    } finally {
      setLoading(false)
    }
  }

  function applyResult() {
    if (result) onExtracted(result)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        Upload a container document image (B/L, arrival notice, etc.) to auto-extract
        container number, seal number, and B/L number.
      </p>

      <div
        className="border-2 border-dashed border-brand-border rounded-lg p-6 text-center cursor-pointer hover:border-brand-green/50 transition-colors"
        onClick={() => fileRef.current?.click()}
      >
        <ScanLine size={28} className="mx-auto text-gray-500 mb-2" />
        <p className="text-xs text-gray-400">Click to upload document image (PNG / JPG)</p>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <div className="w-4 h-4 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
          Running OCR...
        </div>
      )}

      {error && <p className="text-red-400 text-xs">{error}</p>}

      {result && (
        <div className="bg-brand-surface rounded-lg p-3 space-y-2 border border-brand-border">
          <p className="text-xs font-semibold text-gray-300 mb-1">Extracted Fields (review before applying)</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-500">B/L Number</span>
              <p className="text-white font-mono">{result.bl_number ?? '—'}</p>
            </div>
            <div>
              <span className="text-gray-500">Seal Number</span>
              <p className="text-white font-mono">{result.seal_no ?? '—'}</p>
            </div>
            <div>
              <span className="text-gray-500">Container No.</span>
              <p className="text-white font-mono">{result.container_number ?? '—'}</p>
            </div>
            <div>
              <span className="text-gray-500">Cargo Mode</span>
              <p className={`font-semibold ${result.cargo_mode === 'unknown' ? 'text-gray-500' : 'text-brand-green'}`}>
                {result.cargo_mode.toUpperCase()}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-600 mt-1">
            Fields will be pre-filled — you can still edit them before saving.
          </p>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        {result && (
          <Button type="button" size="sm" onClick={applyResult}>
            Apply Extracted Data
          </Button>
        )}
      </div>
    </div>
  )
}
