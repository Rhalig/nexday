import { useEffect, type ReactNode } from 'react'
import { Icon } from './Icon'
import { Button, Kbd } from './ui'
import './drawer.css'

/** Breadcrumb row with expand / more / close, shared by detail drawers. */
export function DrawerHeader({
  color,
  section,
  name,
  onMore,
  onClose
}: {
  color: string
  section: string
  name: string
  onMore?: () => void
  onClose: () => void
}): React.JSX.Element {
  return (
    <div className="dw-head">
      <span style={{ width: 9, height: 9, borderRadius: 3, background: color }} />
      <span style={{ fontSize: 13, color: 'var(--ink3)', marginLeft: 2 }}>{section}</span>
      <span style={{ color: '#BDBDBA' }}>/</span>
      <span style={{ fontSize: 13 }}>{name}</span>
      <span style={{ flex: 1 }} />
      <span className="dw-ic">
        <Icon name="expand" strokeWidth={1.7} round />
      </span>
      <button className="dw-ic" aria-label="More" onClick={onMore}>
        <Icon name="more" strokeWidth={1.7} round />
      </button>
      <button className="dw-ic" aria-label="Close" onClick={onClose}>
        <Icon name="x" strokeWidth={1.7} round />
      </button>
    </div>
  )
}

export type MenuItem =
  | { icon: React.ReactNode; label: string; hint?: string; danger?: boolean; chevron?: boolean; onSelect: () => void }
  | 'sep'

/** Popover menu anchored under the drawer's "more" button. */
export function PopMenu({ items, onClose }: { items: MenuItem[]; onClose: () => void }): React.JSX.Element {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 29 }} onMouseDown={(e) => { e.stopPropagation(); onClose() }} />
      <div className="menu" onMouseDown={(e) => e.stopPropagation()}>
        {items.map((it, i) =>
          it === 'sep' ? (
            <div className="menu-hr" key={i} />
          ) : (
            <button
              key={it.label}
              className={`mi${it.danger ? ' danger' : ''}`}
              onClick={() => {
                onClose()
                it.onSelect()
              }}
            >
              {it.icon}
              <span>{it.label}</span>
              {it.chevron ? (
                <span style={{ marginLeft: 'auto', color: '#767676', display: 'flex' }}>
                  <Icon name="caretRight" size={14} strokeWidth={2} />
                </span>
              ) : (
                it.hint && <span className="k">{it.hint}</span>
              )}
            </button>
          )
        )}
      </div>
    </>
  )
}

/** Centered confirmation dialog on a lightly blurred scrim. */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel
}: {
  title: string
  body: ReactNode
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}): React.JSX.Element {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCancel()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onCancel])

  return (
    <div className="dialog-scrim" onMouseDown={onCancel}>
      <div className="dialog" onMouseDown={(e) => e.stopPropagation()}>
        <span style={{ fontSize: 18, fontWeight: 500 }}>{title}</span>
        <span style={{ fontSize: 13.5, color: '#6B6B6B', lineHeight: 1.55 }}>{body}</span>
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 18 }}>
          <div className="row" style={{ gap: 6 }}>
            <Kbd>esc</Kbd>
            <span style={{ fontSize: 12, color: '#6B6B6B' }}>Cancel</span>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <Button onClick={onCancel} style={{ justifyContent: 'center' }}>
              <span>Cancel</span>
            </Button>
            <Button className="danger-fill" onClick={onConfirm} style={{ justifyContent: 'center' }}>
              <span>{confirmLabel}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
