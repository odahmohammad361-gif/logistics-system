interface Props {
  value: string
  onChange: (position: string) => void
}

const POSITIONS = [
  ['top-left', 'top-right'],
  ['bottom-left', 'bottom-right'],
]

const LABELS: Record<string, string> = {
  'top-left':     'أعلى يسار',
  'top-right':    'أعلى يمين',
  'bottom-left':  'أسفل يسار',
  'bottom-right': 'أسفل يمين',
}

const SHORT: Record<string, string> = {
  'top-left':     'ي↖',
  'top-right':    '↗ي',
  'bottom-left':  'ي↙',
  'bottom-right': '↘ي',
}

export default function StampPositionPicker({ value, onChange }: Props) {
  return (
    <div>
      <p className="text-xs text-brand-text-muted mb-2">موضع الختم</p>
      <div
        className="inline-grid gap-1 p-2 bg-brand-surface border border-brand-border rounded-lg"
        style={{ gridTemplateColumns: '1fr 1fr' }}
      >
        {POSITIONS.flat().map((pos) => (
          <button
            key={pos}
            type="button"
            onClick={() => onChange(pos)}
            title={LABELS[pos]}
            className={`w-20 h-8 rounded text-xs font-medium transition-colors ${
              value === pos
                ? 'bg-brand-primary text-white font-bold'
                : 'bg-brand-border/20 text-brand-text-muted hover:bg-brand-border/40 hover:text-brand-text'
            }`}
          >
            {LABELS[pos]}
          </button>
        ))}
      </div>
    </div>
  )
}
