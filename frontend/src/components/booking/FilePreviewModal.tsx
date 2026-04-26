import { Download, ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  url: string
  filename?: string | null
}

function isPdf(filename: string | null | undefined, url: string) {
  return /\.pdf($|\?)/i.test(filename || url)
}

function isImage(filename: string | null | undefined, url: string) {
  return /\.(png|jpe?g|gif|webp|bmp)($|\?)/i.test(filename || url)
}

export default function FilePreviewModal({ open, onClose, title, url, filename }: Props) {
  const { i18n } = useTranslation()
  const isRTL = i18n.language === 'ar'
  const canShowPdf = isPdf(filename, url)
  const canShowImage = isImage(filename, url)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="xl"
      footer={
        <>
          <a href={url} target="_blank" rel="noreferrer">
            <Button variant="ghost">
              <ExternalLink size={14} />
              {isRTL ? 'فتح' : 'Open'}
            </Button>
          </a>
          <a href={url} download={filename || undefined}>
            <Button>
              <Download size={14} />
              {isRTL ? 'تحميل' : 'Download'}
            </Button>
          </a>
        </>
      }
    >
      <div className="h-[72vh] rounded-xl border border-brand-border bg-black/20 overflow-hidden">
        {canShowPdf ? (
          <iframe
            title={title}
            src={url}
            className="w-full h-full bg-white"
          />
        ) : canShowImage ? (
          <div className="w-full h-full flex items-center justify-center p-3">
            <img
              src={url}
              alt={filename || title}
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-brand-text">
              {isRTL ? 'المعاينة غير متوفرة لهذا النوع من الملفات.' : 'Preview is not available for this file type.'}
            </p>
            <p className="text-xs text-brand-text-muted max-w-md">
              {isRTL ? 'يمكنك فتح أو تحميل الملف الأصلي.' : 'You can still open or download the original file.'}
            </p>
          </div>
        )}
      </div>
    </Modal>
  )
}
