import { useI18n } from '../contexts/I18nContext'
import type { TypeOption } from '../constants/typeOptions'

export default function TypeGate({
  titleKey,
  titleFallback,
  subtitleKey,
  subtitleFallback,
  options,
  selectedValue,
  onSelect,
}: {
  titleKey: string
  titleFallback: string
  subtitleKey?: string
  subtitleFallback?: string
  options: TypeOption[]
  selectedValue?: string
  onSelect: (value: string) => void
}) {
  const { t } = useI18n()
  return (
    <div className="type-gate">
      <div className="type-gate-head">
        <div className="type-gate-title">{t(titleKey, titleFallback)}</div>
        {subtitleKey ? <div className="type-gate-sub">{t(subtitleKey, subtitleFallback)}</div> : null}
      </div>
      <div className="type-gate-grid">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`type-gate-card ${selectedValue === opt.value ? 'type-gate-card--active' : ''}`}
            onClick={() => onSelect(opt.value)}
          >
            <div className="type-gate-thumb" style={{ backgroundImage: `url(${opt.imageUrl})` }} aria-hidden="true" />
            <div className="type-gate-label">{t(opt.labelKey, opt.fallbackLabel)}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
