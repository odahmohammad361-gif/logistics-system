import { useRef, useEffect, useState, useCallback } from 'react'
import { Upload, X, Image as ImageIcon } from 'lucide-react'

interface Props {
  label?: string
  currentImageUrl?: string | null
  onFile: (file: File) => void
  accept?: string
  className?: string
}

/**
 * Image upload zone supporting:
 * - Click to browse
 * - Drag & drop
 * - Paste from clipboard (Ctrl+V)
 */
export default function ImageUploadZone({
  label = 'رفع صورة',
  currentImageUrl,
  onFile,
  accept = 'image/png,image/jpeg',
  className = '',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [preview, setPreview] = useState<string | null>(currentImageUrl ?? null)

  useEffect(() => {
    setPreview(currentImageUrl ?? null)
  }, [currentImageUrl])

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = (e) => setPreview(e.target?.result as string)
      reader.readAsDataURL(file)
      onFile(file)
    },
    [onFile],
  )

  // Clipboard paste listener
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? [])
      const imgItem = items.find((i) => i.type.startsWith('image/'))
      if (imgItem) {
        const file = imgItem.getAsFile()
        if (file) handleFile(file)
      }
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [handleFile])

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div className={className}>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <div
        className={`relative border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors ${
          dragOver
            ? 'border-brand-green bg-brand-green/5'
            : 'border-brand-border hover:border-gray-500'
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
          }}
        />
        {preview ? (
          <div className="relative inline-block">
            <img
              src={preview}
              alt="preview"
              className="max-h-24 max-w-full object-contain rounded"
            />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setPreview(null) }}
              className="absolute -top-2 -right-2 bg-red-500 rounded-full p-0.5 text-white"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 py-2 text-gray-500">
            <ImageIcon size={24} />
            <span className="text-xs">{label}</span>
            <span className="text-xs text-gray-600">انقر أو اسحب وأفلت أو الصق (Ctrl+V)</span>
          </div>
        )}
      </div>
    </div>
  )
}
