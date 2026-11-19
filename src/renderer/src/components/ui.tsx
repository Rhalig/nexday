import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import type { Project } from '../data/tasks'
import { Icon } from './Icon'

export const projectColor: Record<Project, string> = {
  planner: 'var(--acc)',
  moving: 'var(--work)',
  reading: 'var(--personal)',
  personal: 'var(--health)'
}

export function cn(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'dark' | 'destructive'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'default', className, children, ...rest },
  ref
) {
  return (
    <button ref={ref} className={cn('btn', variant !== 'default' && variant, className)} {...rest}>
      {children}
    </button>
  )
})

export function Kbd({ children, mono }: { children: ReactNode; mono?: boolean }): React.JSX.Element {
  return <span className={cn('kbd', mono && 'mono-kbd')}>{children}</span>
}

export function Checkbox({
  checked = false,
  onClick
}: {
  checked?: boolean
  onClick?: (e: React.MouseEvent) => void
}): React.JSX.Element {
  return (
    <button className="cb" role="checkbox" aria-checked={checked} onClick={onClick}>
      <Icon name="check" size={12} strokeWidth={3} />
    </button>
  )
}

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }): React.JSX.Element {
  return (
    <button className={cn('toggle', on && 'on')} role="switch" aria-checked={on} onClick={() => onChange(!on)}>
      <i />
    </button>
  )
}

export function GroupHeader({ title, meta, padTop }: { title: string; meta: string; padTop?: number }): React.JSX.Element {
  return (
    <div className="grp" style={padTop !== undefined ? { paddingTop: padTop } : undefined}>
      <span className="grp-t">{title}</span>
      <span className="mono muted grp-meta">{meta}</span>
      <div className="grp-line" />
    </div>
  )
}

export function Segmented<T extends string>({
  items,
  value,
  onChange
}: {
  items: Array<{ id: T; label: string; count?: number }>
  value: T
  onChange: (id: T) => void
}): React.JSX.Element {
  return (
    <div className="seg">
      {items.map((it) => (
        <button key={it.id} className={cn('seg-item', it.id === value && 'on')} onClick={() => onChange(it.id)}>
          <span className="seg-label">{it.label}</span>
          {it.count !== undefined && <span className="mono seg-count">{it.count}</span>}
        </button>
      ))}
    </div>
  )
}
