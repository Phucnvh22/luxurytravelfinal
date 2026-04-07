import { useMemo } from 'react'

type Props = {
  label: string
  value: string
  onChange: (next: string) => void
  min?: number
  max?: number
  placeholder?: string
}

export default function GuestQuantityInput({
  label,
  value,
  onChange,
  min = 1,
  max = 1000,
  placeholder = 'Enter guests',
}: Props) {
  const numericValue = useMemo(() => {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }, [value])

  const canDecrement = numericValue !== null && numericValue > min
  const canIncrement = numericValue === null || numericValue < max

  const sanitize = (raw: string) => raw.replace(/[^\d]/g, '').replace(/^0+(?=\d)/, '')

  const handleInput = (raw: string) => {
    const next = sanitize(raw)
    if (!next) {
      onChange('')
      return
    }
    const n = Number(next)
    if (!Number.isFinite(n)) return
    onChange(String(Math.min(max, Math.max(min, n))))
  }

  return (
    <label className="field guest-input-field">
      <div className="field-label">{label}</div>
      <div className="guest-input-wrap">
        <button
          type="button"
          className="guest-step-btn"
          aria-label="Decrease guests"
          onClick={() => {
            if (!canDecrement) return
            onChange(String((numericValue ?? min) - 1))
          }}
          disabled={!canDecrement}
        >
          -
        </button>
        <input
          className="input guest-count-input"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          placeholder={placeholder}
          onChange={(e) => handleInput(e.target.value)}
          onPaste={(e) => {
            const text = e.clipboardData.getData('text')
            if (!text) return
            e.preventDefault()
            handleInput(text)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              if (canIncrement) onChange(String((numericValue ?? min - 1) + 1))
            } else if (e.key === 'ArrowDown') {
              e.preventDefault()
              if (canDecrement) onChange(String((numericValue ?? min + 1) - 1))
            }
          }}
        />
        <button
          type="button"
          className="guest-step-btn"
          aria-label="Increase guests"
          onClick={() => {
            if (!canIncrement) return
            const base = numericValue ?? (min - 1)
            onChange(String(base + 1))
          }}
          disabled={!canIncrement}
        >
          +
        </button>
      </div>
    </label>
  )
}

