import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { cn } from './ui'

/** Working rows for the New popup: a dropdown, a text box, a switch, a time box, weekday toggles. */

export type Opt = { value: string; label: string; swatch?: string }

const chev = (
  <span style={{ color: '#767676', display: 'flex' }}>
    <Icon name="chevronDown" size={14} strokeWidth={2} />
  </span>
)

type Common = { label: string; top?: boolean; last?: boolean }

export function SelectField({
  label,
  value,
  options,
  onChange,
  open,
  onOpen,
  top,
  last
}: Common & {
  value: string
  options: Opt[]
  onChange: (v: string) => void
  /** Which dropdown of the popup is open (the popup owns it, so Esc and outside clicks can close it) */
  open: boolean
  onOpen: (open: boolean) => void
}): React.JSX.Element {
  const cur = options.find((o) => o.value === value) ?? options[0]
  return (
    <div className={cn('np-prop', top && 'top', last && 'last', 'np-dd')} style={{ position: 'relative' }}>
      <span className="np-pl">{label}</span>
      <button
        type="button"
        className="np-trig"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          onOpen(!open)
        }}
      >
        {cur?.swatch && <span className="swatch" style={{ background: cur.swatch }} />}
        <span className="np-pv">{cur?.label}</span>
        {chev}
      </button>
      {open && (
        <div className="np-menu" role="listbox" onMouseDown={(e) => e.stopPropagation()}>
          {options.map((o) => (
            <button
              type="button"
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className={cn('np-opt', o.value === value && 'on')}
              onClick={(e) => {
                e.stopPropagation()
                onChange(o.value)
                onOpen(false)
              }}
            >
              {o.swatch && <span className="swatch" style={{ background: o.swatch }} />}
              <span style={{ flex: 1 }}>{o.label}</span>
              {o.value === value && <Icon name="check" size={13} strokeWidth={2.4} round />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  top,
  last
}: Common & { value: string; onChange: (v: string) => void; placeholder: string }): React.JSX.Element {
  return (
    <div className={cn('np-prop', top && 'top', last && 'last')}>
      <span className="np-pl">{label}</span>
      <input
        className="np-in"
        value={value}
        maxLength={200}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

export function TimeField({ label, value, onChange, top, last }: Common & { value: string; onChange: (v: string) => void }): React.JSX.Element {
  return (
    <div className={cn('np-prop', top && 'top', last && 'last')}>
      <span className="np-pl">{label}</span>
      <input
        className="np-in mono"
        type="time"
        step={300}
        value={value}
        onChange={(e) => e.target.value && onChange(e.target.value)}
      />
    </div>
  )
}

export function SwitchField({ label, text, on, onChange, top, last }: Common & { text: string; on: boolean; onChange: (v: boolean) => void }): React.JSX.Element {
  return (
    <div className={cn('np-prop', top && 'top', last && 'last')} style={{ cursor: 'pointer' }} onClick={() => onChange(!on)}>
      <span className="np-pl">{label}</span>
      <span className="np-pv">{text}</span>
      <button type="button" role="switch" aria-checked={on} className={cn('np-tg', on && 'on')} onClick={(e) => { e.stopPropagation(); onChange(!on) }} />
    </div>
  )
}

export function DaysField({ label, days, onChange, top, last }: Common & { days: number[]; onChange: (d: number[]) => void }): React.JSX.Element {
  return (
    <div className={cn('np-prop', top && 'top', last && 'last')}>
      <span className="np-pl">{label}</span>
      <div className="row" style={{ gap: 6, flex: 1 }}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, n) => (
          <button
            type="button"
            key={n}
            aria-pressed={days.includes(n)}
            className={cn('np-dy', days.includes(n) && 'on')}
            style={{ cursor: 'pointer' }}
            onClick={() => onChange(days.includes(n) ? days.filter((x) => x !== n) : [...days, n].sort())}
          >
            {d}
          </button>
        ))}
      </div>
    </div>
  )
}

export function FieldHint({ children }: { children: ReactNode }): React.JSX.Element {
  return <span className="muted" style={{ fontSize: 12.5 }}>{children}</span>
}
