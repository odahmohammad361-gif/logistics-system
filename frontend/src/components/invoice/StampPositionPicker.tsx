interface Props {
  value: string
  onChange: (position: string) => void
}

const POSITIONS = [
  ['top-left', 'top-right'],
  ['bottom-left', 'bottom-right'],
]

const LABELS: Record<string, string> = {
  'top-left': 'TL',
  'top-right': 'TR',
  'bottom-left': 'BL',
  'bottom-right': 'BR',
}

export default function StampPositionPicker({ value, onChange }: Props) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-1">Stamp Position</p>
      <div
        className="inline-grid gap-1 p-2 bg-brand-surface border border-brand-border rounded-lg"
        style={{ gridTemplateColumns: '1fr 1fr' }}
      >
        {POSITIONS.flat().map((pos) => (
          <button
            key={pos}
            type="button"
            onClick={() => onChange(pos)}
            className={`w-10 h-8 rounded text-xs font-mono transition-colors ${
              value === pos
                ? 'bg-brand-green text-black font-bold'
                : 'bg-brand-border/30 text-gray-400 hover:bg-brand-border/60'
            }`}
            title={pos}
          >
            {LABELS[pos]}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-600 mt-1">{value}</p>
    </div>
  )
}
