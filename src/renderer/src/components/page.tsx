import { useRef, useState, type ReactNode } from 'react'
import { SyncPopover } from './Popups'
import { Icon, type IconName } from './Icon'
import { useUI } from '../store/ui'
import { Button } from './ui'
import { useSync } from '../lib/cloud'
import { useCalendar } from '../store/calendar'

export function Topbar({ icon, section, current, sync: forced }: { icon: IconName; section: string; current: string; sync?: 'ok' | 'error' | 'loading' }): React.JSX.Element {
  const live = useSync((s) => s.state)
  const cloudAt = useSync((s) => s.lastSync)
  const macAt = useCalendar((s) => s.lastSync)
  const macOn = useCalendar((s) => s.status === 'authorized')
  const ago = (t: number): string => {
    const m = Math.floor((Date.now() - t) / 60000)
    return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ago`
  }
  const okLabel = macOn && macAt ? `Synced with Calendar · ${ago(macAt)}` : cloudAt ? `All changes saved · ${ago(cloudAt)}` : 'All changes saved'
  // The state screens force a look; everywhere else the button shows the real cloud status
  const syncState: 'ok' | 'error' | 'loading' = forced ?? (live === 'error' ? 'error' : live === 'saving' ? 'loading' : 'ok')
  const openNew = useUI((s) => s.openNew)
  const syncRef = useRef<HTMLButtonElement>(null)
  const [sync, setSync] = useState<{ right: number; bottom: number } | null>(null)
  return (
    <div className="topbar">
      <div className="crumbs">
        <Icon name={icon} size={15} />
        <span>{section}</span>
        <span>/</span>
        <span style={{ color: 'var(--ink)' }}>{current}</span>
      </div>
      <div className="row" style={{ gap: 12 }}>
        <Button ref={syncRef} style={syncState === 'error' ? { color: 'var(--err)', borderColor: 'var(--err)' } : undefined} onClick={() => {
            const btn = syncRef.current
            if (!btn) return
            // The popover hangs from the right edge of the whole button group, not the sync button itself
            const row = btn.closest('.topbar')
            setSync({ right: row ? row.getBoundingClientRect().right : btn.getBoundingClientRect().right, bottom: btn.getBoundingClientRect().bottom })
          }}>
          {syncState === 'ok' && <Icon name="refresh" size={15} />}
          {syncState === 'error' && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v6M12 16.5v.5" />
            </svg>
          )}
          <span>{syncState === 'ok' ? okLabel : syncState === 'error' ? 'Sync failed' : 'Syncing…'}</span>
        </Button>
        {sync && <SyncPopover anchor={sync} onClose={() => setSync(null)} />}
        <Button variant="dark" onClick={() => openNew('task')}>
          <Icon name="plus" size={15} strokeWidth={2} />
          <span>New</span>
        </Button>
      </div>
    </div>
  )
}

export function PageHead({
  date,
  title,
  sub,
  stats
}: {
  date: string
  title: string
  sub: ReactNode
  stats?: Array<[label: string, value: string]>
}): React.JSX.Element {
  return (
    <header className="page-head">
      <div className="col" style={{ gap: 6 }}>
        <span className="muted">{date}</span>
        <h1>{title}</h1>
        <p className="muted">{sub}</p>
      </div>
      {stats && (
      <div className="stats">
        {stats.map(([label, value]) => (
          <div className="stat" key={label}>
            <span>{label}</span>
            <span className="mono">{value}</span>
          </div>
        ))}
      </div>
      )}
    </header>
  )
}
